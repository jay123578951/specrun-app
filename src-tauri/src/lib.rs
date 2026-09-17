use std::process::Stdio;
use std::time::Duration;

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
#[tauri::command]
async fn spawn_bin(
  program: String,
  args: Vec<String>,
  cwd: String,
  timeout_ms: u64,
  max_output_bytes: usize,
) -> Result<SpawnResult, String> {
  let mut child = tokio::process::Command::new(&program)
    .args(&args)
    .current_dir(&cwd)
    .stdin(Stdio::null())
    .stdout(Stdio::piped())
    .stderr(Stdio::piped())
    .kill_on_drop(true)
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_fs::init())
    .invoke_handler(tauri::generate_handler![
      spawn_bin,
      allow_path,
      allow_dir_listing,
      host_platform,
      canonical_path
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
    ))
    .unwrap();

    std::fs::remove_dir_all(&dir).ok();
    assert_eq!(result.stdout.trim(), canonical.to_string_lossy());
  }

  #[test]
  fn spawn_bin_does_not_block_other_work_while_waiting_for_timeout() {
    block_on(async {
      let slow = spawn_bin("/bin/sleep".into(), vec!["5".into()], "/".into(), 300, MAX);
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
  fn host_platform_reports_the_actual_compile_target() {
    let reported = host_platform();
    assert_eq!(reported, std::env::consts::OS);
    assert!(
      ["macos", "windows", "linux"].contains(&reported),
      "unexpected platform string: {reported}"
    );
  }
}

