use std::collections::HashMap;
use std::process::Stdio;
use std::time::Duration;

use tauri::Manager;
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_fs::FsExt;
use tokio::io::AsyncReadExt;

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct SpawnResult {
  status: Option<i32>,
  stdout: String,
  stderr: String,
  timed_out: bool,
  truncated: bool,
}

const READ_CHUNK_BYTES: usize = 8 * 1024;

/// tokio 的 pipe 讀取本身沒有位元組上限，讀到底等於讓被呼叫的指令決定 App 要
/// 吃多少記憶體。到上限就停手並回報，讓呼叫端把它當成失敗。
async fn read_capped<R: tokio::io::AsyncRead + Unpin>(
  mut reader: R,
  limit: usize,
) -> std::io::Result<(Vec<u8>, bool)> {
  let mut collected = Vec::new();
  let mut chunk = [0u8; READ_CHUNK_BYTES];
  loop {
    let read = reader.read(&mut chunk).await?;
    if read == 0 {
      return Ok((collected, false));
    }
    collected.extend_from_slice(&chunk[..read]);
    if collected.len() >= limit {
      collected.truncate(limit);
      return Ok((collected, true));
    }
  }
}

/// 動態程式路徑＋動態 cwd 的外部指令執行。shell plugin 白名單是編譯期
/// 靜態的，無法表達使用者設定的 CLI 路徑，故直包行程通道。
///
/// 逾時靠三個第三方行為：tauri 把 async command 丟到 async runtime，等待
/// 期間不佔住主執行緒；tokio::time::timeout 到點丟棄整個等待的 future，其中
/// 的 Child 一併 drop；tokio 的 kill_on_drop 在該 drop 時終止行程。stdin 接
/// null 沿用 std 的 output() 行為，互動式 shell 才不會停在讀 stdin。
///
/// stdout 與 stderr 必須同時讀：只讀完一邊，另一邊的 pipe 滿了行程就會停在
/// write 上，變成等到逾時才結束。
///
/// `env` 疊加在子行程繼承到的環境之上（不是取代整份環境）：只給要補的變數，
/// 例如借登入 shell 問回來的搜尋路徑（`PATH`）——執行檔可能是一層需要其他
/// 執行環境（如 node）才跑得動的轉接殼，找得到它與跑得動它是兩件事。
#[tauri::command]
async fn spawn_bin(
  program: String,
  args: Vec<String>,
  cwd: String,
  timeout_ms: u64,
  max_output_bytes: usize,
  env: Option<HashMap<String, String>>,
) -> Result<SpawnResult, String> {
  let mut command = tokio::process::Command::new(&program);
  command
    .args(&args)
    .current_dir(&cwd)
    .stdin(Stdio::null())
    .stdout(Stdio::piped())
    .stderr(Stdio::piped())
    .kill_on_drop(true);
  if let Some(vars) = &env {
    command.envs(vars);
  }
  let mut child = command
    .spawn()
    .map_err(|e| format!("failed to spawn `{program}`: {e}"))?;

  let (Some(stdout), Some(stderr)) = (child.stdout.take(), child.stderr.take()) else {
    return Err(format!("failed to capture the output of `{program}`"));
  };

  let run = async {
    let (stdout, stderr) = tokio::join!(
      read_capped(stdout, max_output_bytes),
      read_capped(stderr, max_output_bytes)
    );
    let (stdout, stdout_capped) = stdout?;
    let (stderr, stderr_capped) = stderr?;
    let truncated = stdout_capped || stderr_capped;
    // 不再收的那一刻起行程就會卡在寫 pipe 上，不主動終止就得等到逾時
    if truncated {
      let _ = child.start_kill();
    }
    let status = child.wait().await?;
    Ok::<_, std::io::Error>(SpawnResult {
      status: status.code(),
      stdout: String::from_utf8_lossy(&stdout).into_owned(),
      stderr: String::from_utf8_lossy(&stderr).into_owned(),
      timed_out: false,
      truncated,
    })
  };

  match tokio::time::timeout(Duration::from_millis(timeout_ms), run).await {
    Ok(result) => result.map_err(|e| format!("failed to run `{program}`: {e}")),
    Err(_) => Ok(SpawnResult {
      status: None,
      stdout: String::new(),
      stderr: String::new(),
      timed_out: true,
      truncated: false,
    }),
  }
}

/// runtime 擴充 fs scope。遞迴 allow 不含 dotfile 目錄，而 park 機制依賴
/// `.git/specrun-app/` 讀寫，故同一呼叫內對 `.git` 補顯式 allow。
#[tauri::command]
fn allow_path<R: tauri::Runtime>(app: tauri::AppHandle<R>, path: String) -> Result<(), String> {
  let scope = app.fs_scope();
  scope.allow_directory(&path, true).map_err(|e| e.to_string())?;
  let git = std::path::Path::new(&path).join(".git");
  if git.is_dir() {
    scope.allow_directory(&git, true).map_err(|e| e.to_string())?;
  }
  Ok(())
}

/// 只放行這一個路徑本身、不遞迴到底下：tauri 的 `Scope::allow_file` push 的是
/// 該路徑的精確樣式，read_dir 檢查的也是目錄本身在不在 scope 內。
/// 與 allow_path 分開是因為 tauri 的 fs scope 只能加不能減——Scope::forbid_directory
/// 的文件明載它永久優先於 allow，加了就撤不回來。
///
/// 因此非目錄一律先擋下：allow_file 對檔案路徑放行的是它的內容，使用者在「加入
/// 專案」貼進一個檔案路徑（打錯字、貼到 `.env`）不該換來一筆撤不掉的檔案放行。
/// Rust 端的 is_dir 走的是行程自己的檔案系統存取，不受 fs scope 限制。
///
/// 回 `false`＝這不是一個資料夾，一次都沒放行；`Err` 才是真的授權失敗。
/// 兩者對呼叫端是不同的事，錯誤訊息不能指向錯的原因，所以不收成同一個 `Err`。
///
/// tauri 的 fs scope API 只收路徑字串，沒有「對這個已開啟的檔案描述子放行」的形式，
/// 所以 `is_dir()` 與 `allow_file()` 之間必然有空隙：這兩步不是原子的，`is_dir()`
/// 也跟隨 symlink。同一使用者在這個空隙內把路徑換成檔案，該檔案內容就會進 scope。
#[tauri::command]
fn allow_dir_listing<R: tauri::Runtime>(app: tauri::AppHandle<R>, path: String) -> Result<bool, String> {
  if !std::path::Path::new(&path).is_dir() {
    return Ok(false);
  }
  app
    .fs_scope()
    .allow_file(&path)
    .map(|_| true)
    .map_err(|e| e.to_string())
}

/// 平台由外殼回答：webview 那一側沒有行程環境可問。回的是 Rust
/// `std::env::consts::OS`，即編譯目標的名稱（"macos"／"windows"／"linux"…）。
#[tauri::command]
fn host_platform() -> &'static str {
  std::env::consts::OS
}

/// 解開路徑中的 symlink，回傳它實際指向的位置。走 Rust `std::fs::canonicalize`：
/// 它要求路徑既存，不存在或讀不到時回 `Err`，不編一個路徑出來。
/// 前端只有字串可操作，解不開 symlink，所以這一步只能由外殼做。
///
/// 宣告成 async 是因為 tauri 只把 async command 丟到 async runtime，同步的會在主
/// 執行緒上跑完：這一趟每次讀取都要走一遍，網路磁碟區上的專案會卡住畫面。
#[tauri::command]
async fn canonical_path(path: String) -> Result<String, String> {
  std::fs::canonicalize(&path)
    .map(|resolved| resolved.to_string_lossy().into_owned())
    .map_err(|e| format!("could not resolve `{path}`: {e}"))
}

/// 加入專案的原生資料夾選擇。自有指令包對話框外掛的 **Rust API**
/// （`FileDialogBuilder`），不讓 webview 直接呼叫外掛自己的 JS 指令——外掛的
/// JS 指令在 `directory: true` 時會對選定路徑自動呼叫 `allow_directory`，
/// 把該資料夾第一層的檔案在 `openspec/` 驗證之前就放進 fs scope，且撤不回來。
/// Rust API 不碰 fs scope，兩階段授權（見 `allow_dir_listing`／`allow_path`）
/// 因此仍然成立。
///
/// `set_parent()` 指定 main 視窗：macOS 呈現為附屬的 sheet，其餘平台為以主視窗為
/// 擁有者的強制回應視窗，兩者的共同保證是開啟期間主視窗不接受輸入。取不到
/// main 視窗時仍照開，只是失去附屬關係——不因此讓整個功能不可用。
///
/// 宣告成 async、以一次性通道等待外掛的回呼：理由同 `canonical_path`——tauri
/// 只把 async command 丟到 async runtime，同步的會卡在主執行緒上，選資料夾的
/// 等待長度由使用者決定。外掛的回呼版本自己把開視窗那一步送回主執行緒。
///
/// 回傳 `Ok(Some(path))`＝選定、`Ok(None)`＝取消、`Err`＝開不起來，三者由
/// 前端薄殼映射成既有的 `PickFolderOutcome`。不設起始目錄、標題沿用現行文案。
#[tauri::command]
async fn pick_folder<R: tauri::Runtime>(app: tauri::AppHandle<R>) -> Result<Option<String>, String> {
  let (tx, rx) = tokio::sync::oneshot::channel();

  let mut dialog = app.dialog().file().set_title("Select a project folder");
  if let Some(window) = app.get_webview_window("main") {
    dialog = dialog.set_parent(&window);
  }
  dialog.pick_folder(move |result| {
    let _ = tx.send(result);
  });

  match rx.await {
    Ok(Some(file_path)) => file_path
      .into_path()
      .map(|path| Some(path.to_string_lossy().into_owned()))
      .map_err(|e| format!("could not resolve the picked folder: {e}")),
    Ok(None) => Ok(None),
    Err(e) => Err(format!("folder picker channel closed unexpectedly: {e}")),
  }
}

/// 一個路徑摸起來是資料夾、不是資料夾，還是完全摸不到——不碰任何外掛，只問
/// 檔案系統本身。`std::fs::metadata` 跟隨 symlink（`symlink_metadata` 才是不
/// 跟隨的那個），指向資料夾的 symlink 因此被當成資料夾：使用者按開啟位置那顆
/// 按鈕要看的是那個東西本身，不是指過去的那張便條（design D3）。
#[derive(Debug, PartialEq, Eq)]
enum PathKind {
  Directory,
  NotDirectory,
  Missing,
}

fn path_kind(path: &str) -> PathKind {
  match std::fs::metadata(path) {
    Ok(meta) if meta.is_dir() => PathKind::Directory,
    Ok(_) => PathKind::NotDirectory,
    Err(_) => PathKind::Missing,
  }
}

/// 一個已經解過 symlink 的路徑是不是 macOS 的應用程式包。macOS 的 LaunchServices
/// 只憑 `.app` 這個副檔名認定它，與包內結構無關：本機實測，一個裡面只有純文字檔、
/// 連 `Contents/` 都沒有的 `Foo.app` 目錄，`mdls` 仍報 `com.apple.application-bundle`；
/// 反過來，一個 `Contents/MacOS/` 俱全卻不以 `.app` 結尾的目錄報的是 `public.folder`，
/// 交給 `open` 只會被當成一般資料夾瀏覽。所以判定只看副檔名，不看包內是否有
/// `Contents/Info.plist`。副檔名比對忽略大小寫：實測 `Foo.APP` 一樣被當成應用
/// 程式啟動。
///
/// 收的必須是解過 symlink 的路徑：實測一個指向 `Foo.app`、自己不以 `.app` 結尾的
/// symlink，交給 `open` 一樣會啟動該應用程式。
fn is_application_bundle(resolved: &std::path::Path) -> bool {
  resolved
    .extension()
    .is_some_and(|extension| extension.eq_ignore_ascii_case("app"))
}

#[derive(Debug, PartialEq, Eq)]
enum FileManagerAction {
  /// 帶著解過 symlink 的路徑：判定與開啟用同一個答案，不各自解一次
  Open(std::path::PathBuf),
  Reveal,
  NotFound,
}

/// 摸一次檔案系統、解一次 symlink，回答這個路徑要開起來、要選取，還是根本不在。
/// `std::fs::canonicalize` 解不開時回 `Reveal`，讓不確定的路徑走選取那一條——
/// 選取不執行任何東西。
fn file_manager_action(path: &str) -> FileManagerAction {
  match path_kind(path) {
    PathKind::Directory => match std::fs::canonicalize(path) {
      Ok(resolved) if is_application_bundle(&resolved) => FileManagerAction::Reveal,
      Ok(resolved) => FileManagerAction::Open(resolved),
      Err(_) => FileManagerAction::Reveal,
    },
    PathKind::NotDirectory => FileManagerAction::Reveal,
    PathKind::Missing => FileManagerAction::NotFound,
  }
}

/// 診斷區「開啟檔案所在位置」的桌面實作：判定型別與開啟落在同一趟裡，前端
/// 交出的只是一個路徑字串，不需先講明它是檔案還是資料夾（design D1）。
///
/// 自寫指令包 opener 外掛的 **Rust API**（`open_path`／`reveal_item_in_dir`，
/// 兩者皆為 crate 的公開自由函式），不讓 webview 直接呼叫外掛自己的 JS 指令
/// `open_path`——那條指令對應的 `opener:allow-open-path` 權限本身不帶路徑
/// 範圍，但指令本體要求路徑範圍非空才放行（`tauri-plugin-opener` 2.5.5，
/// `src/commands.rs`、`src/scope.rs`），要配置得能用，範圍必須涵蓋任意專案
/// 路徑，等於把「叫作業系統開啟任何路徑」整個開給 webview。走 Rust API 則連
/// 這道 IPC 門都不開，`capabilities/default.json` 因此一個字都不用動（比照
/// `pick_folder` 對話框外掛的既定做法；design D2 已查證細節）。
///
/// 一般資料夾呼叫 `open_path(…, None::<&str>)`，其餘（摸得到的檔案，以及
/// macOS 的應用程式包——`is_application_bundle` 認定的那些）呼叫
/// `reveal_item_in_dir`：開啟該項所在的資料夾並選取它，不交給任何程式開啟。
/// 摸不到則回 `Err`。只有 `.app` 被擋下來——文件型的套件（`.rtfd`、`.xcodeproj`
/// 等）在檔案系統上也是資料夾，走開起那一條時 macOS 會把它交給對應的程式開啟
/// （本機實測 `open -- Doc.rtfd` 會啟動 TextEdit）；已知並接受，理由記在 design
/// 的 D3 與 Risks。
///
/// 交給 `open_path` 的是判定當下解過 symlink 的那個路徑，不是前端交來的原字串：
/// 否則判定看的是解過的、開啟看的是沒解的，中間被換成一個指向 `.app` 的 symlink
/// 就會啟動它。選取那條不必這樣做——`reveal_item_in_dir` 自己第一件事就是
/// `canonicalize`（`tauri-plugin-opener` 2.5.5，`src/reveal_item_in_dir.rs:13`），
/// 解不開就回 `Err`，不會退成開啟。
///
/// 應用程式包走選取而不走開啟，是因為 macOS 的 `open_path` 對它就是啟動它：
/// `open_path` 內部走 `open` crate，在 macOS 上執行 `/usr/bin/open`，而
/// LaunchServices 收到「開啟一個 `.app`」等同在 Finder 裡按兩下。本機實測過
/// `open -- Foo.app`、`open -a Finder -- Foo.app`、`open -b com.apple.finder
/// -- Foo.app` 三種形態，一律啟動該應用程式——指名 Finder 只換了由誰來開，沒
/// 換「開」這個動作的語意，買不到任何保護。`reveal_item_in_dir` 則走
/// `NSWorkspace::activateFileViewerSelectingURLs`（`tauri-plugin-opener` 2.5.5，
/// `src/reveal_item_in_dir.rs`），只選取、不執行，實測對 `.app` 不會啟動它。
///
/// 宣告成 async 的理由同 `canonical_path`：tauri 只把 async command 丟到
/// async runtime，同步的會在主執行緒上跑完，而 `metadata()` 在網路磁碟區上
/// 的專案會卡住畫面。
#[tauri::command]
async fn open_in_file_manager(path: String) -> Result<(), String> {
  match file_manager_action(&path) {
    FileManagerAction::Open(resolved) => tauri_plugin_opener::open_path(&resolved, None::<&str>).map_err(|e| e.to_string()),
    FileManagerAction::Reveal => tauri_plugin_opener::reveal_item_in_dir(&path).map_err(|e| e.to_string()),
    FileManagerAction::NotFound => Err(format!("path not found: {path}")),
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_opener::init())
    .invoke_handler(tauri::generate_handler![
      spawn_bin,
      allow_path,
      allow_dir_listing,
      host_platform,
      canonical_path,
      pick_folder,
      open_in_file_manager
    ])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
  use super::*;

  const MAX: usize = 1024 * 1024;

  fn block_on<F: std::future::Future>(future: F) -> F::Output {
    tokio::runtime::Builder::new_current_thread()
      .enable_all()
      .build()
      .unwrap()
      .block_on(future)
  }

  #[test]
  fn spawn_bin_returns_output_within_timeout() {
    let result = block_on(spawn_bin(
      "/bin/echo".into(),
      vec!["hi".into()],
      "/".into(),
      5_000,
      MAX,
      None,
    ))
    .unwrap();
    assert_eq!(result.status, Some(0));
    assert_eq!(result.stdout, "hi\n");
    assert!(!result.timed_out);
  }

  #[test]
  fn spawn_bin_gives_up_at_the_limit_instead_of_waiting_out_the_command() {
    let started = std::time::Instant::now();
    let result = block_on(spawn_bin(
      "/bin/sleep".into(),
      vec!["5".into()],
      "/".into(),
      1_000,
      MAX,
      None,
    ))
    .unwrap();
    assert!(result.timed_out);
    assert_eq!(result.status, None);
    assert!(started.elapsed() < std::time::Duration::from_secs(3));
  }

  #[test]
  fn spawn_bin_reports_a_missing_program_as_an_error() {
    let Err(error) = block_on(spawn_bin(
      "/nonexistent/openspec".into(),
      vec![],
      "/".into(),
      1_000,
      MAX,
      None,
    ))
    else {
      panic!("expected a spawn error")
    };
    assert!(error.contains("/nonexistent/openspec"));
  }

  #[test]
  fn spawn_bin_reports_a_non_executable_path_as_an_error() {
    let file = std::env::temp_dir().join(format!("spawn_bin_not_executable_{}", std::process::id()));
    std::fs::write(&file, b"not a script").unwrap();
    use std::os::unix::fs::PermissionsExt;
    let mut perms = std::fs::metadata(&file).unwrap().permissions();
    perms.set_mode(0o644);
    std::fs::set_permissions(&file, perms).unwrap();

    let result = block_on(spawn_bin(
      file.to_string_lossy().into_owned(),
      vec![],
      "/".into(),
      1_000,
      MAX,
      None,
    ));

    std::fs::remove_file(&file).ok();
    assert!(result.is_err(), "expected an error for a non-executable path");
  }

  /// 只驗 elapsed time 驗不出「行程真的被終止」——即使 kill_on_drop 被拿掉，
  /// tokio::time::timeout 一樣會在上限時放棄等待、回傳逾時結果，elapsed time
  /// 一樣短。要證明行程本身死了，得讓行程在存活時做一件可觀察的事（逾時後
  /// 補寫 marker 檔），逾時後再多等一段，確認 marker 檔沒有出現。
  #[test]
  fn spawn_bin_kills_the_process_on_timeout_not_just_the_wait() {
    let marker = std::env::temp_dir().join(format!("spawn_bin_marker_{}.txt", std::process::id()));
    let _ = std::fs::remove_file(&marker);

    let result = block_on(spawn_bin(
      "/bin/sh".into(),
      vec!["-c".into(), format!("sleep 1 && touch {}", marker.display())],
      "/".into(),
      200,
      MAX,
      None,
    ))
    .unwrap();
    assert!(result.timed_out);

    // 若行程沒有被真的終止，原本的 `sleep 1 && touch` 會在逾時後約 0.8 秒
    // 補寫出 marker 檔；等超過這個時間點再確認檔案沒出現。
    std::thread::sleep(std::time::Duration::from_millis(1_500));
    let survived = marker.exists();
    let _ = std::fs::remove_file(&marker);
    assert!(!survived, "process kept running after timeout instead of being killed");
  }

  /// `env` 疊加在既有環境之上，不是取代整份環境：`/bin/sh` 本身跑得動子行程
  /// 靠的是繼承來的環境，這裡只驗補進去的那一個變數確實傳到了子行程。
  #[test]
  fn spawn_bin_adds_the_given_env_vars_on_top_of_the_inherited_environment() {
    let mut env = HashMap::new();
    env.insert("SPECRUN_TEST_VAR".to_string(), "hello".to_string());

    let result = block_on(spawn_bin(
      "/bin/sh".into(),
      vec!["-c".into(), "printf %s \"$SPECRUN_TEST_VAR\"".into()],
      "/".into(),
      5_000,
      MAX,
      Some(env),
    ))
    .unwrap();

    assert_eq!(result.stdout, "hello");
  }

  #[test]
  fn spawn_bin_runs_the_command_in_the_given_cwd() {
    let dir = std::env::temp_dir().join(format!("spawn_bin_cwd_test_{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    let canonical = std::fs::canonicalize(&dir).unwrap();

    let result = block_on(spawn_bin(
      "/bin/pwd".into(),
      vec![],
      canonical.to_string_lossy().into_owned(),
      5_000,
      MAX,
      None,
    ))
    .unwrap();

    std::fs::remove_dir_all(&dir).ok();
    assert_eq!(result.stdout.trim(), canonical.to_string_lossy());
  }

  #[test]
  fn spawn_bin_does_not_block_other_work_while_waiting_for_timeout() {
    block_on(async {
      let slow = spawn_bin("/bin/sleep".into(), vec!["5".into()], "/".into(), 300, MAX, None);
      let fast = async {
        tokio::time::sleep(std::time::Duration::from_millis(20)).await;
        42
      };
      let (slow_result, fast_result) = tokio::join!(slow, fast);
      assert!(slow_result.unwrap().timed_out);
      assert_eq!(fast_result, 42);
    });
  }

  /// `yes hello` 不會自己結束——沒被真的終止的話會一路跑到 timeout_ms 那個外層
  /// 上限，所以這裡把 timeout_ms 設得比預期的截斷時間寬很多（3s），再用 elapsed
  /// 佐證它是被爆量終止而不是耗到逾時。max_output_bytes 刻意挑非 8KiB 倍數，
  /// 用來驗 read_capped 的 truncate() 真的切在位元組上而不是切在整個 chunk 邊界。
  #[test]
  fn spawn_bin_truncates_runaway_output_and_kills_the_process() {
    let started = std::time::Instant::now();
    let result = block_on(spawn_bin(
      "/bin/sh".into(),
      vec!["-c".into(), "yes hello".into()],
      "/".into(),
      3_000,
      10_000,
      None,
    ))
    .unwrap();

    assert!(result.truncated, "expected the output cap to trip");
    assert!(!result.timed_out, "should stop because of the cap, not the timeout");
    assert_eq!(result.stdout.len(), 10_000);
    assert!(
      started.elapsed() < std::time::Duration::from_secs(2),
      "should stop as soon as the cap is hit, not wait out the 3s timeout"
    );
  }

  /// mock app 只為了拿到一份真的 fs scope——放行與否問的是 scope 自己，
  /// 不是我們記了什麼。scope 只能加不能減，所以「沒放行」要直接對 scope 斷言，
  /// 光看回傳值不算數。
  fn mock_app() -> tauri::App<tauri::test::MockRuntime> {
    tauri::test::mock_builder()
      .plugin(tauri_plugin_fs::init())
      .build(tauri::test::mock_context(tauri::test::noop_assets()))
      .unwrap()
  }

  fn temp_dir_named(name: &str) -> std::path::PathBuf {
    let dir = std::env::temp_dir().join(format!("{name}_{}", std::process::id()));
    std::fs::remove_dir_all(&dir).ok();
    std::fs::create_dir_all(&dir).unwrap();
    dir
  }

  /// 遞迴 allow 的樣式不含 dotfile 目錄，而 park 機制要讀寫 `.git/specrun-app/`。
  /// 這一條只有在同一趟裡對 `.git` 另外補一次顯式 allow 才成立，所以拿真的 scope
  /// 問，而不是看我們有沒有呼叫。
  #[test]
  fn allow_path_reaches_into_the_dot_git_directory_too() {
    let app = mock_app();
    let project = temp_dir_named("allow_path_project");
    std::fs::create_dir_all(project.join(".git/specrun-app")).unwrap();
    let parked = project.join(".git/specrun-app/parked.json");
    std::fs::write(&parked, b"{}").unwrap();
    let ordinary = project.join("openspec/changes/a/proposal.md");
    std::fs::create_dir_all(ordinary.parent().unwrap()).unwrap();
    std::fs::write(&ordinary, b"x").unwrap();

    allow_path(app.handle().clone(), project.to_string_lossy().into_owned()).unwrap();

    let scope = app.fs_scope();
    assert!(scope.is_allowed(&ordinary), "the project tree must be readable");
    assert!(
      scope.is_allowed(&parked),
      "park state lives under .git/, which a recursive allow does not cover on its own"
    );
    std::fs::remove_dir_all(&project).ok();
  }

  /// 沒有 `.git` 的專案不該因此失敗——補 allow 是有才做的事。
  #[test]
  fn allow_path_succeeds_for_a_project_without_a_git_directory() {
    let app = mock_app();
    let project = temp_dir_named("allow_path_no_git");
    let file = project.join("openspec/project.md");
    std::fs::create_dir_all(file.parent().unwrap()).unwrap();
    std::fs::write(&file, b"x").unwrap();

    assert_eq!(allow_path(app.handle().clone(), project.to_string_lossy().into_owned()), Ok(()));
    assert!(app.fs_scope().is_allowed(&file));
    std::fs::remove_dir_all(&project).ok();
  }

  /// 使用者在「加入專案」貼進一個檔案路徑（打錯字、貼到 `.env` 或 `~/.ssh/id_rsa`）
  /// 時，allow_file 放行的會是那個檔案的內容，而 fs scope 撤不回來。守衛要在進
  /// allow_file 之前就擋下，且回的是 Ok(false)＝「這不是資料夾」，不是授權失敗。
  #[test]
  fn allow_dir_listing_refuses_a_file_without_allowing_it() {
    let app = mock_app();
    let dir = temp_dir_named("allow_dir_listing_file");
    let secret = dir.join("id_rsa");
    std::fs::write(&secret, b"PRIVATE KEY").unwrap();

    let outcome = allow_dir_listing(app.handle().clone(), secret.to_string_lossy().into_owned());

    assert_eq!(outcome, Ok(false), "a file is not a folder, and that is not an authorization failure");
    assert!(
      !app.fs_scope().is_allowed(&secret),
      "the file must not be readable by the webview afterwards"
    );
    std::fs::remove_dir_all(&dir).ok();
  }

  /// 路徑根本不存在也走同一個出口：Ok(false)，一次都沒放行。
  #[test]
  fn allow_dir_listing_refuses_a_missing_path_without_allowing_it() {
    let app = mock_app();
    let missing = std::env::temp_dir().join(format!("allow_dir_listing_missing_{}", std::process::id()));
    std::fs::remove_dir_all(&missing).ok();

    let outcome = allow_dir_listing(app.handle().clone(), missing.to_string_lossy().into_owned());

    assert_eq!(outcome, Ok(false));
    assert!(!app.fs_scope().is_allowed(&missing));
  }

  /// 真的資料夾才放行，而且放行的只有這一個路徑本身：底下的檔案不跟著進 scope
  /// （遞迴放行是 allow_path 的事，驗證階段不該先給）。
  #[test]
  fn allow_dir_listing_allows_the_folder_itself_but_not_its_contents() {
    let app = mock_app();
    let dir = temp_dir_named("allow_dir_listing_dir");
    let inside = dir.join("notes.txt");
    std::fs::write(&inside, b"x").unwrap();

    let outcome = allow_dir_listing(app.handle().clone(), dir.to_string_lossy().into_owned());

    assert_eq!(outcome, Ok(true));
    assert!(app.fs_scope().is_allowed(&dir), "the folder itself must be listable");
    assert!(
      !app.fs_scope().is_allowed(&inside),
      "listing a folder must not hand out its files"
    );
    std::fs::remove_dir_all(&dir).ok();
  }

  /// 基準路徑先自己 canonicalize 過一次再往下建：macOS 的 `$TMPDIR` 本身就在
  /// `/private` 底下的 symlink 後面，不先解開的話「原樣回傳」那一條會拿解開後的
  /// 結果去比對沒解開的字串，測到的不是這個指令的行為。
  fn canonical_temp_base(name: &str) -> std::path::PathBuf {
    std::fs::canonicalize(temp_dir_named(name)).unwrap()
  }

  #[test]
  fn canonical_path_resolves_a_symlinked_directory_to_the_real_one() {
    let base = canonical_temp_base("canonical_path_symlink");
    let real = base.join("real");
    std::fs::create_dir_all(&real).unwrap();
    let link = base.join("link");
    std::os::unix::fs::symlink(&real, &link).unwrap();

    let resolved = block_on(canonical_path(link.to_string_lossy().into_owned())).unwrap();

    assert_eq!(resolved, real.to_string_lossy());
    assert_ne!(resolved, link.to_string_lossy(), "the symlink must not come back as-is");
    std::fs::remove_dir_all(&base).ok();
  }

  #[test]
  fn canonical_path_returns_a_plain_directory_at_the_same_location() {
    let base = canonical_temp_base("canonical_path_plain");

    let resolved = block_on(canonical_path(base.to_string_lossy().into_owned())).unwrap();

    assert_eq!(resolved, base.to_string_lossy());
    std::fs::remove_dir_all(&base).ok();
  }

  #[test]
  fn canonical_path_reports_a_missing_path_as_an_error() {
    let missing = std::env::temp_dir().join(format!("canonical_path_missing_{}", std::process::id()));
    std::fs::remove_dir_all(&missing).ok();

    let Err(error) = block_on(canonical_path(missing.to_string_lossy().into_owned())) else {
      panic!("expected an error for a path that does not exist")
    };

    assert!(
      error.contains(&*missing.to_string_lossy()),
      "the error must name the path that could not be resolved: {error}"
    );
  }

  #[test]
  fn path_kind_reports_a_directory() {
    let dir = temp_dir_named("path_kind_dir");
    assert_eq!(path_kind(&dir.to_string_lossy()), PathKind::Directory);
    std::fs::remove_dir_all(&dir).ok();
  }

  #[test]
  fn path_kind_reports_a_file_as_not_a_directory() {
    let dir = temp_dir_named("path_kind_file");
    let file = dir.join("config.json");
    std::fs::write(&file, b"{}").unwrap();
    assert_eq!(path_kind(&file.to_string_lossy()), PathKind::NotDirectory);
    std::fs::remove_dir_all(&dir).ok();
  }

  #[test]
  fn path_kind_reports_a_missing_path() {
    let missing = std::env::temp_dir().join(format!("path_kind_missing_{}", std::process::id()));
    std::fs::remove_dir_all(&missing).ok();
    assert_eq!(path_kind(&missing.to_string_lossy()), PathKind::Missing);
  }

  /// `std::fs::metadata` 跟隨 symlink：指向資料夾的 symlink 要被判為資料夾，
  /// 而不是「不是資料夾」。
  #[test]
  fn path_kind_follows_a_symlink_to_a_directory() {
    let base = canonical_temp_base("path_kind_symlink");
    let real = base.join("real");
    std::fs::create_dir_all(&real).unwrap();
    let link = base.join("link");
    std::os::unix::fs::symlink(&real, &link).unwrap();

    assert_eq!(path_kind(&link.to_string_lossy()), PathKind::Directory);
    std::fs::remove_dir_all(&base).ok();
  }

  #[test]
  fn file_manager_action_opens_a_directory() {
    let dir = canonical_temp_base("file_manager_action_dir");
    assert_eq!(
      file_manager_action(&dir.to_string_lossy()),
      FileManagerAction::Open(dir.clone())
    );
    std::fs::remove_dir_all(&dir).ok();
  }

  #[test]
  fn file_manager_action_reveals_a_file() {
    let dir = temp_dir_named("file_manager_action_file");
    let file = dir.join("config.json");
    std::fs::write(&file, b"{}").unwrap();
    assert_eq!(file_manager_action(&file.to_string_lossy()), FileManagerAction::Reveal);
    std::fs::remove_dir_all(&dir).ok();
  }

  #[test]
  fn file_manager_action_reports_a_missing_path() {
    let missing = std::env::temp_dir().join(format!("file_manager_action_missing_{}", std::process::id()));
    std::fs::remove_dir_all(&missing).ok();
    assert_eq!(file_manager_action(&missing.to_string_lossy()), FileManagerAction::NotFound);
  }

  #[test]
  fn file_manager_action_reveals_an_application_bundle() {
    let base = canonical_temp_base("file_manager_action_bundle");
    let bundle = base.join("Probe.app");
    std::fs::create_dir_all(&bundle).unwrap();

    assert_eq!(file_manager_action(&bundle.to_string_lossy()), FileManagerAction::Reveal);
    std::fs::remove_dir_all(&base).ok();
  }

  #[test]
  fn file_manager_action_reveals_an_application_bundle_named_in_upper_case() {
    let base = canonical_temp_base("file_manager_action_bundle_upper");
    let bundle = base.join("Upper.APP");
    std::fs::create_dir_all(&bundle).unwrap();

    assert_eq!(file_manager_action(&bundle.to_string_lossy()), FileManagerAction::Reveal);
    std::fs::remove_dir_all(&base).ok();
  }

  #[test]
  fn file_manager_action_reveals_a_symlink_to_an_application_bundle() {
    let base = canonical_temp_base("file_manager_action_bundle_symlink");
    let bundle = base.join("Linked.app");
    std::fs::create_dir_all(&bundle).unwrap();
    let link = base.join("link-to-bundle");
    std::os::unix::fs::symlink(&bundle, &link).unwrap();

    assert_eq!(file_manager_action(&link.to_string_lossy()), FileManagerAction::Reveal);
    std::fs::remove_dir_all(&base).ok();
  }

  /// 帶出來的必須是解過 symlink 的目標路徑，不是呼叫端交進來的那個 symlink：
  /// 判定與開啟共用同一次解析的答案，中間就沒有空隙可以把路徑換成指向 `.app`
  /// 的 symlink。把實作改回「交原始路徑給 open」時這一條會紅。
  #[test]
  fn file_manager_action_opens_a_symlink_to_a_directory() {
    let base = canonical_temp_base("file_manager_action_symlink");
    let real = base.join("real");
    std::fs::create_dir_all(&real).unwrap();
    let link = base.join("link");
    std::os::unix::fs::symlink(&real, &link).unwrap();

    assert_eq!(
      file_manager_action(&link.to_string_lossy()),
      FileManagerAction::Open(real.clone()),
      "開啟拿到的必須是解過 symlink 的目標，不是原始路徑 {}",
      link.display()
    );
    std::fs::remove_dir_all(&base).ok();
  }

  /// 反過來的那一種：symlink 自己叫 `FakeLink.app`，指向的卻是普通資料夾。本機
  /// 實測 macOS 對它報 `public.folder`、`open` 不啟動任何東西，正確行為是直接開
  /// 起來。判定只能看解過 symlink 之後的路徑——改成「原始路徑或解析後路徑任一
  /// 以 `.app` 結尾就選取」時，這一條會紅。
  #[test]
  fn file_manager_action_opens_a_symlink_named_like_an_application_bundle() {
    let base = canonical_temp_base("file_manager_action_fake_bundle_symlink");
    let real = base.join("plain-folder");
    std::fs::create_dir_all(&real).unwrap();
    let link = base.join("FakeLink.app");
    std::os::unix::fs::symlink(&real, &link).unwrap();

    assert_eq!(
      file_manager_action(&link.to_string_lossy()),
      FileManagerAction::Open(real.clone()),
      "指向普通資料夾的 symlink 就算自己叫 .app 也要開起來"
    );
    std::fs::remove_dir_all(&base).ok();
  }

  #[test]
  fn host_platform_reports_the_actual_compile_target() {
    let reported = host_platform();
    assert_eq!(reported, std::env::consts::OS);
    assert!(
      ["macos", "windows", "linux"].contains(&reported),
      "unexpected platform string: {reported}"
    );
  }
}

