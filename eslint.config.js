import antfu from '@antfu/eslint-config'

export default antfu({
  // orb-engine.ts 是 thinking-orbs 的 engine.es.js 逐字搬入（design D1），
  // 不套用本專案的 lint 規則——改了就不再是「幾何部分一字不改」
  ignores: ['src-tauri', 'src/utils/orb-engine.ts'],
})
