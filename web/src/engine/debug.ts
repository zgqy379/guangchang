// 诊断钩子（window.__st / __cam / __gl / __roam）的暴露门控。
// 验收工具（tools/shoot-street.cjs、accept-live.mjs 等）跑在 localhost 预览上不受影响；
// 线上公开站点默认不暴露内部诊断面，需显式 ?debug=1（role-flow-engineering R08：公开仓库是评分项）。
export function debugHooksEnabled(): boolean {
  if (typeof window === 'undefined') return false
  const h = window.location.hostname
  if (h === 'localhost' || h === '127.0.0.1' || h === '[::1]') return true
  return new URLSearchParams(window.location.search).has('debug')
}
