// 游戏化 HUD：求职者 XP 面板 + 四区收集进度（词典化数值走 design tokens）
// 状态由 StreetScene 下发（投递/收藏/参观），XP 换算规则来自 tokens.game.*
import { useMemo } from 'react'
import { INDUSTRIES, STREET_LOTS } from '../../data/street-companies'
import {
  GameXpPerDelivery,
  GameXpPerLevel,
  GameXpPerVisit,
  GameXpRarityASalary,
  GameXpRaritySSalary,
} from '../../../generated/design-tokens.output.mjs'

export interface HudState {
  delivered: string[]
  basket: string[]
  visited: string[]
  perIndustry: Record<string, number>
  xpFlash: number
}

export function GameHud({ state }: { state: HudState }) {
  const { delivered, basket, visited, perIndustry, xpFlash } = state
  const xp = delivered.length * GameXpPerDelivery + visited.length * GameXpPerVisit
  const level = Math.floor(xp / GameXpPerLevel) + 1
  const xpInLevel = xp % GameXpPerLevel
  const totals = useMemo(() => {
    const acc: Record<string, number> = {}
    for (const lot of STREET_LOTS) acc[lot.industry] = (acc[lot.industry] ?? 0) + 1
    return acc
  }, [])

  const rows = useMemo(
    () =>
      (Object.keys(INDUSTRIES) as (keyof typeof INDUSTRIES)[]).map((ind) => ({
        ind,
        label: INDUSTRIES[ind].label,
        color: INDUSTRIES[ind].color,
        got: perIndustry[ind] ?? 0,
        total: totals[ind] ?? 0,
      })),
    [perIndustry, totals]
  )

  return (
    <div className="game-hud">
      <div className="game-hud-title">求职者进度</div>
      <div className="game-hud-level">Lv.{level}</div>
      {xpFlash > 0 && (
        <span key={xpFlash} className="xp-pop">
          +{GameXpPerDelivery} XP
        </span>
      )}
      <div className="xp-bar">
        <div className="xp-fill" style={{ width: `${(xpInLevel / GameXpPerLevel) * 100}%` }} />
        <span className="xp-text">
          {xpInLevel}/{GameXpPerLevel} XP
        </span>
      </div>
      <div className="game-hud-counts">
        <span>📮 投递 {delivered.length}</span>
        <span>🧺 收藏 {basket.length}</span>
        <span>👁 参观 {visited.length}</span>
      </div>
      <div className="game-hud-districts">
        {rows.map((r) => (
          <div key={r.ind} className="district-row" title={`${r.got}/${r.total}`}>
            <span className="district-dot" style={{ background: r.color }} />
            <span className="district-label">{r.label}</span>
            <span className="district-count">
              {r.got}/{r.total}
            </span>
            <span className="district-pips">
              {Array.from({ length: r.total }).map((_, i) => (
                <i
                  key={i}
                  className={i < r.got ? 'pip on' : 'pip'}
                  style={i < r.got ? { background: r.color } : undefined}
                />
              ))}
            </span>
          </div>
        ))}
      </div>
      <div className="game-hud-legend">碑高=总包 · 灯条=五险 · 顶灯=下班</div>
    </div>
  )
}

// 名片稀有度（游戏角色卡语言）：总包决定卡框颜色与级牌
export function rarityOf(totalPackage: number): {
  label: string
  color: string
} {
  if (totalPackage >= GameXpRaritySSalary) return { label: 'S', color: 'var(--color-brand-gold)' }
  if (totalPackage >= GameXpRarityASalary) return { label: 'A', color: 'var(--color-state-info)' }
  return { label: 'B', color: 'var(--color-text-secondary)' }
}
