// 游戏化 HUD：求职者 XP 面板（词典化数值走 design tokens）
// 状态由 StreetScene 下发（投递/收藏/参观），XP 换算规则来自 tokens.game.*
//
// v4.1 美术攻关：**四区进度行已移到导航器 GcNavigator**（§8.3 浮层职责互斥：
// HUD 只答"我的进度如何"，导航器才答"我在哪 + 怎么过去"）。
// 之前两处都放，既重复又导致右下两个浮层在 720p 下互相压盖（实测压 44px）。
import { useMemo } from 'react'
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
  xpFlash: number
}

export function GameHud({ state }: { state: HudState }) {
  const { delivered, basket, visited, xpFlash } = state
  const xp = delivered.length * GameXpPerDelivery + visited.length * GameXpPerVisit
  const level = Math.floor(xp / GameXpPerLevel) + 1
  const xpInLevel = xp % GameXpPerLevel
  const visitedCount = useMemo(() => visited.length, [visited])

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
        <span>👁 参观 {visitedCount}</span>
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
