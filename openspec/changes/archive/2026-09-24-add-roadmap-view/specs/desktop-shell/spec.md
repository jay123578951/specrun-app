# Spec Delta

## MODIFIED Requirements

### Requirement: 桌面 webview 呈現無退化

既有各頁與互動（Changes、Specs、Archived、Roadmap、詳情 slideover、Settings、拖曳與動畫）在桌面視窗的 webview（WKWebView）中 SHALL 與瀏覽器呈現一致，無 Chrome-only 樣式導致的破版或互動失效。

#### Scenario: 逐頁檢視

- **WHEN** 在桌面視窗中逐頁走過 Changes（含詳情、勾選、park 拖曳）、Specs、Archived、Roadmap（含詳情與引用跳轉）與 Settings
- **THEN** 版面與互動皆與瀏覽器中一致，無破版、無失效
