// 立体参数沙盘 · 简化 HUD（D6 定向修复 / 2026-11-05）
//
// D5 双盲审两位评审共同点名「六处浮层抢戏、底部白面板压住前排楼体、口诀字号过小」，
// D6 收敛为**三处浮层**：左上图例（含真实计数）、右上公司卡、贴底对比细条。
// 对比栏三列用 ①②③ + 同色左边框，与沙盘里 SelectionMarkers 的彩色标记双向对应。
//
// 对比度纪律：浮层用不透明面板令牌
//   --ui-panel-bg / --ui-page-fg / --ui-panel-fg-muted / --ui-panel-accent，
// 不用玻璃墨色 --ui-ink-*（深色主题下会变成深字压深底）。
// 双主题实测：浅色 19.23/7.96、深色 16.02/6.15，均 ≥4.5:1。
//
// pointerEvents：外层 none，只有可点控件 auto，否则 HUD 会吃掉 Canvas 的拾取事件。

import type { CSSProperties } from 'react'
import type { BuildingDatum } from './layout'
import { totalPackage } from '../../engine/params'

const panel: CSSProperties = {
  background: 'var(--ui-panel-bg)',
  color: 'var(--ui-page-fg)',
  border: '1px solid var(--ui-panel-border, var(--ui-glass-border))',
  borderRadius: 12,
  boxShadow: '0 6px 24px rgba(0,0,0,.18)',
  padding: '12px 14px',
}

const label: CSSProperties = { color: 'var(--ui-panel-fg-muted)', fontSize: 14, lineHeight: 1.55 }
const strong: CSSProperties = { color: 'var(--ui-page-fg)', fontWeight: 700 }

const btn: CSSProperties = {
  pointerEvents: 'auto',
  background: 'var(--ui-panel-bg)',
  color: 'var(--ui-page-fg)',
  border: '1px solid var(--ui-panel-border, var(--ui-glass-border))',
  borderRadius: 8,
  padding: '4px 9px',
  fontSize: 12,
  cursor: 'pointer',
}

const wan = (n: number) => `${(n / 10000).toFixed(1)} 万`
const clock = (h: number) => `${String(Math.floor(h)).padStart(2, '0')}:${h % 1 ? '30' : '00'}`
const insurance = (ratio: string) =>
  ratio === 'full' ? '足额缴纳' : `按 ${Math.round(Number(ratio) * 100)}% 基数`
const PIN_NUM = ['①', '②', '③']

export interface DioramaHudProps {
  hovered: BuildingDatum | null
  selected: BuildingDatum | null
  pinned: BuildingDatum[]
  /** 真实 hover 过的公司数（不是动画进度） */
  visited: number
  total: number
  zoneColors: readonly string[]
  /** 与沙盘 SelectionMarkers 同色的三种钉选标记色 */
  pinColors: readonly string[]
  industryLabels: readonly string[]
  onPin: (index: number) => void
  onUnpin: (index: number) => void
  onClearPins: () => void
}

function CompanyCard({
  d, pinned, onPin, onUnpin,
}: {
  d: BuildingDatum
  pinned: boolean
  onPin: (i: number) => void
  onUnpin: (i: number) => void
}) {
  return (
    <div style={{ ...panel, pointerEvents: 'auto', width: 226 }} aria-label={`${d.lot.name} 参数卡`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 15, fontWeight: 800 }}>{d.lot.name}</span>
        <span style={{ ...label, fontSize: 12 }}>#{String(d.lot.lotNo).padStart(2, '0')}</span>
      </div>
      <div style={{ ...label, marginTop: 2 }}>{d.lot.industryLabel} · {d.lot.tagline}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px', marginTop: 10, fontSize: 13 }}>
        <span style={label}>年总包</span><span style={strong}>{wan(totalPackage(d.lot.params))}</span>
        <span style={label}>下班时间</span><span style={strong}>{clock(d.lot.params.offworkTime)}</span>
        <span style={label}>五险</span><span style={strong}>{insurance(d.lot.params.socialInsuranceBaseRatio)}</span>
        {/* D7：把「楼越高→给得越多」从相对隐喻变成可读分位，与左侧标尺互证 */}
        <span style={label}>行业分位</span><span style={strong}>{Math.round(d.norm * 100)}%</span>
      </div>
      <button
        style={{ ...btn, marginTop: 10, width: '100%' }}
        aria-label={pinned ? `取消钉选 ${d.lot.name}` : `钉选 ${d.lot.name} 加入对比`}
        onClick={() => (pinned ? onUnpin(d.index) : onPin(d.index))}
      >
        {pinned ? '✓ 已钉选 · 点击移除' : '＋ 钉选对比'}
      </button>
    </div>
  )
}

export function DioramaHud({
  hovered, selected, pinned, visited, total, zoneColors, pinColors, industryLabels,
  onPin, onUnpin, onClearPins,
}: DioramaHudProps) {
  const card = hovered ?? selected
  const pinnedIds = new Set(pinned.map((p) => p.index))

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', fontSize: 13 }}>
      {/* ① 左上图例：字号加大、并入真实计数与操作提示（原顶部胶囊已撤，少一处浮层） */}
      <div style={{ ...panel, position: 'absolute', top: 16, left: 16, width: 236 }}>
        <div style={{ ...strong, fontSize: 14, marginBottom: 8 }}>立体参数沙盘 · 读图法</div>
        <div style={{ display: 'grid', gap: 5 }}>
          {industryLabels.map((name, i) => (
            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 13, height: 13, borderRadius: 3, background: zoneColors[i], flex: 'none' }} />
              <span style={label}>{name}</span>
            </div>
          ))}
        </div>
        <div style={{ ...label, marginTop: 10, borderTop: '1px solid var(--ui-panel-border, var(--ui-glass-border))', paddingTop: 8 }}>
          <div>楼越<b style={strong}>高、越宽</b> → 给得越多</div>
          <div><b style={strong}>金冠</b>=增薪 · <b style={strong}>青珠</b>=期权</div>
          <div><b style={strong}>暖窗</b>=下班早 · <b style={strong}>黑窗</b>=加班</div>
          <div><b style={strong}>完整台</b>=五险足额</div>
          <div><b style={strong}>左侧标尺</b>=行业内总包分位 0–100%</div>
        </div>
        <div style={{ ...strong, marginTop: 8, borderTop: '1px solid var(--ui-panel-border, var(--ui-glass-border))', paddingTop: 8, fontSize: 13 }}>
          已浏览 {visited} / {total} 家
        </div>
        <div style={{ ...label, fontSize: 12, marginTop: 3 }}>悬停看参数 · 点击拉近 · 钉选 ≤3 家</div>
      </div>

      {/* ② 右上公司卡 */}
      {card && (
        <div style={{ position: 'absolute', top: 16, right: 16 }}>
          <CompanyCard
            d={card}
            pinned={pinnedIds.has(card.index)}
            onPin={onPin}
            onUnpin={onUnpin}
          />
        </div>
      )}

      {/* ③ 贴底对比细条：高度压到 ~70px，不再压住前排楼体；①②③ 与沙盘标记同色 */}
      {pinned.length > 0 && (
        <div style={{
          ...panel,
          // D6：移到左下角空旷桌面区，画面中央与沙盘前缘完全不被遮挡
          position: 'absolute', bottom: 12, left: 16,
          pointerEvents: 'auto', width: 'min(430px, 34vw)', padding: '8px 12px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ ...strong, fontSize: 12 }}>
              并排对比 · {pinned.length}/3
              <span style={{ ...label, fontSize: 12 }}> · 沙盘上 ①②③ 对应彩色标记</span>
            </span>
            <button style={btn} aria-label="清空对比" onClick={onClearPins}>清空</button>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {pinned.map((d, k) => (
              <div key={d.index} style={{
                flex: 1, minWidth: 0,
                border: '1px solid var(--ui-panel-border, var(--ui-glass-border))',
                borderLeft: `3px solid ${pinColors[k]}`,
                borderRadius: 6, padding: '5px 8px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                  <span style={{ ...strong, fontSize: 12 }}>
                    <span style={{ color: pinColors[k] }}>{PIN_NUM[k]}</span> {d.lot.name}
                  </span>
                  <button style={{ ...btn, padding: '0 6px', lineHeight: '16px' }} aria-label={`移除 ${d.lot.name}`} onClick={() => onUnpin(d.index)}>×</button>
                </div>
                <div style={{ ...label, fontSize: 12 }}>
                  {d.lot.industryLabel} · {wan(totalPackage(d.lot.params))} · 下班 {clock(d.lot.params.offworkTime)} · {insurance(d.lot.params.socialInsuranceBaseRatio)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
