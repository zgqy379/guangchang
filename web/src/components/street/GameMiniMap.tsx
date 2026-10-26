// 街区导航器 GcNavigator（ui-system-v3 §8.5 + §9.4 三条布局铁律）
//
// 盲审差距 3：小地图"装饰性强于导航性"（无摊位点 / 距离 / 已投递态）。
// 本组件从"圆形装饰图"升级为**真导航器**：
//   ① 罗盘：四街色臂 + 区名 + 玩家视锥 + 64 个摊位点（已投递画对勾）+ 当前区高亮
//   ② 邻近摊位列表：名称 + 行业色点 + 行业 + 距离 + 状态图标，点击直达
//   ③ 四区进度行：行业色进度条，整行可点击 → 传送该区
//   ④ 移动端（≤720px）：面板收成 96px 圆形罗盘钮，点开为全屏列表浮层
//
// 布局铁律（原型实测，改前必读）：
//   · 同侧浮层必须共用一个 flex 栈 `.nav-stack`，不能各自 position:fixed
//   · SVG 罗盘文字会被 viewBox 裁切 → 标签必须落在安全区内（外圈半径收到 42）
//   · 玻璃浮层在浅色主题压最亮天幕时对比度会掉到 4.48:1 → 必须垫实底
//     （--ui-glass-underlay，且 background-color 必须写在 background 之后）
//
// 样式在同目录 navigator.css（局部导入，与全局 styles.css 解耦 —— 那边由并行工作流维护）
import { useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import type { RoamRefs } from '../AvatarActor'
import {
  INDUSTRIES,
  placeLots,
  STREET_BOUNDS,
  STREET_LOTS,
  type Industry,
  type LotPlacement,
} from '../../data/street-companies'
import './navigator.css'

const COMPASS = 132 // SVG viewBox 边长（= 渲染尺寸，1:1 才能保证区名 12px 不被缩）
const C = COMPASS / 2
const R = 42 // 罗盘外圈半径（安全区：标签留在这个圈之外、viewBox 之内）
const LIST_N = 3 // 邻近列表条数（ui-system-v3 §8.5：邻近摊位约 4 条；这里取 3 以压住面板高度）
const COMPASS_PX = 132 // 罗盘实际渲染尺寸（§8.5：直径 132）

/** 摊位在"马路一侧"的方向偏移：点击列表 → 站到摊位正前方 3.2m */
function roadSideOffset(pl: LotPlacement): [number, number] {
  return pl.axis === 'x' ? [0, -pl.side * 3.2] : [-pl.side * 3.2, 0]
}

function StatusIcon({ kind }: { kind: 'delivered' | 'visited' | 'basket' | 'none' }) {
  if (kind === 'delivered')
    return (
      <svg viewBox="0 0 16 16" width="14" height="14" aria-label="已投递">
        <path
          d="M3 8.6 L6.4 12 L13 4.6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  if (kind === 'basket')
    return (
      <svg viewBox="0 0 16 16" width="14" height="14" aria-label="已加入对比篮">
        <path
          d="M2.5 6 H13.5 L12.4 13.4 H3.6 Z M5.5 6 V4.6 A2.5 2.5 0 0 1 10.5 4.6 V6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  if (kind === 'visited')
    return (
      <svg viewBox="0 0 16 16" width="14" height="14" aria-label="已参观">
        <path
          d="M1.5 8 S4 4 8 4 S14.5 8 14.5 8 S12 12 8 12 S1.5 8 1.5 8 Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <circle cx="8" cy="8" r="1.9" fill="currentColor" />
      </svg>
    )
  return null
}

interface Arm {
  ind: Industry
  x1: number
  y1: number
  x2: number
  y2: number
  tx: number
  ty: number
  anchor: 'start' | 'middle' | 'end'
}

/** 罗盘：compact=true 时省掉区名与摊位点（移动端 96px 圆钮用） */
function Compass({
  arms,
  placed,
  delivered,
  px,
  py,
  deg,
  district,
  compact,
}: {
  arms: Arm[]
  placed: LotPlacement[]
  delivered: Set<string>
  px: number
  py: number
  deg: number
  district: Industry
  compact?: boolean
}) {
  const scale = R / STREET_BOUNDS
  return (
    <svg
      className="gc-nav-compass"
      viewBox={`0 0 ${COMPASS} ${COMPASS}`}
      width={compact ? 84 : COMPASS_PX}
      height={compact ? 84 : COMPASS_PX}
      role="img"
      aria-label="四街罗盘"
    >
      <defs>
        <clipPath id="gc-nav-clip">
          <circle cx={C} cy={C} r={R} />
        </clipPath>
      </defs>
      <g clipPath="url(#gc-nav-clip)">
        <rect width={COMPASS} height={COMPASS} fill="rgba(9,13,20,0.82)" />
        {/* 十字主路 */}
        <rect x={C - (compact ? 7 : 4)} y={0} width={compact ? 14 : 8} height={COMPASS} fill="#3b4757" />
        <rect x={0} y={C - (compact ? 7 : 4)} width={COMPASS} height={compact ? 14 : 8} fill="#3b4757" />
        {arms.map((a) => (
          <line
            key={a.ind}
            x1={a.x1}
            y1={a.y1}
            x2={a.x2}
            y2={a.y2}
            stroke={INDUSTRIES[a.ind].color}
            strokeWidth={compact ? 3.2 : 1.6}
            opacity={a.ind === district ? 1 : 0.75}
          />
        ))}
        {/* 摊位点：已投递画对勾，未投递画圆点（§8.5） */}
        {!compact &&
          placed.map((pl) => {
            const x = C + pl.position[0] * scale
            const y = C - pl.position[2] * scale
            const done = delivered.has(pl.lot.id)
            if (done) {
              return (
                <path
                  key={pl.lot.id}
                  d={`M${x - 2.6} ${y} l2 2.2 l3.4 -4.6`}
                  fill="none"
                  stroke={INDUSTRIES[pl.lot.industry].color}
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )
            }
            return (
              <circle
                key={pl.lot.id}
                cx={x}
                cy={y}
                r={1.6}
                fill={INDUSTRIES[pl.lot.industry].color}
                opacity={0.5}
              />
            )
          })}
        {/* 玩家：视锥 + 三角 */}
        <g transform={`translate(${px} ${py}) rotate(${deg}) scale(0.84)`}>
          <path d="M0,0 L-15,-26 A 30 30 0 0 1 15,-26 Z" fill="#ffd24a" opacity={0.12} />
          <path d="M0,-5 L3.6,4 L0,2 L-3.6,4 Z" fill="#ffd24a" />
        </g>
      </g>
      <circle cx={C} cy={C} r={R} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth={1} />
      {/* 区名：安全区内（不裁切） */}
      {!compact &&
        arms.map((a) => (
          <text
            key={a.ind}
            x={a.tx}
            y={a.ty}
            fill={INDUSTRIES[a.ind].color}
            fontSize={12}
            fontWeight={700}
            textAnchor={a.anchor}
            paintOrder="stroke"
            stroke="#0b0e1a"
            strokeWidth={2.6}
          >
            {INDUSTRIES[a.ind].label.replace('区', '')}
          </text>
        ))}
    </svg>
  )
}

export function GameMiniMap({
  refs,
  delivered,
  visited,
  basket,
}: {
  refs: RoamRefs
  delivered: Set<string>
  visited: string[]
  basket: string[]
}) {
  const placed = useMemo(() => placeLots(), [])
  const [pos, setPos] = useState({ x: 0, z: 0, h: 0 })
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const id = window.setInterval(() => {
      const p = refs.position.current
      setPos({ x: p.x, z: p.z, h: refs.heading?.current ?? 0 })
    }, 100)
    return () => window.clearInterval(id)
  }, [refs])

  const visitedSet = useMemo(() => new Set(visited), [visited])
  const basketSet = useMemo(() => new Set(basket), [basket])

  // 邻近摊位：按距离排序取前 N（距离实时，随玩家移动更新）
  const nearby = useMemo(() => {
    return placed
      .map((pl) => ({
        pl,
        d: Math.hypot(pos.x - pl.position[0], pos.z - pl.position[2]),
      }))
      .sort((a, b) => a.d - b.d)
      .slice(0, LIST_N)
  }, [placed, Math.round(pos.x * 4), Math.round(pos.z * 4)])

  const district: Industry =
    Math.abs(pos.x) >= Math.abs(pos.z)
      ? pos.x >= 0
        ? 'internet'
        : 'finance'
      : pos.z >= 0
        ? 'manufacturing'
        : 'culture'

  const scale = R / STREET_BOUNDS
  const px = C + pos.x * scale
  const py = C - pos.z * scale
  const deg = (pos.h * 180) / Math.PI

  const teleportToLot = (pl: LotPlacement) => {
    const [ox, oz] = roadSideOffset(pl)
    refs.teleportTo!.current = new THREE.Vector3(pl.position[0] + ox, 0, pl.position[2] + oz)
    setOpen(false)
  }

  const teleportToDistrict = (ind: Industry) => {
    const first = placed.find((p) => p.lot.industry === ind)
    if (!first) return
    refs.teleportTo!.current = new THREE.Vector3(
      first.position[0] * 0.4,
      0,
      first.position[2] * 0.4
    )
    setOpen(false)
  }

  // 四区进度（已参观数 / 该区总数）
  const districtProgress = useMemo(() => {
    const acc: Record<string, number> = {}
    for (const id of visited) {
      const ind = id.split('-')[0]
      acc[ind] = (acc[ind] ?? 0) + 1
    }
    const totals: Record<string, number> = {}
    for (const lot of STREET_LOTS) totals[lot.industry] = (totals[lot.industry] ?? 0) + 1
    return (Object.keys(INDUSTRIES) as Industry[]).map((ind) => ({
      ind,
      label: INDUSTRIES[ind].label,
      color: INDUSTRIES[ind].color,
      got: acc[ind] ?? 0,
      total: totals[ind] ?? 0,
      active: ind === district,
    }))
  }, [visited, district])

  // 罗盘臂：区名落在"圈外、viewBox 内"的安全区（§9.4 铁律 3）
  const arms: Arm[] = [
    { ind: 'internet', x1: C, y1: C, x2: C + R, y2: C, tx: C + R + 10, ty: C + 4, anchor: 'end' },
    { ind: 'finance', x1: C, y1: C, x2: C - R, y2: C, tx: C - R - 10, ty: C + 4, anchor: 'start' },
    { ind: 'manufacturing', x1: C, y1: C, x2: C, y2: C - R, tx: C, ty: C - R - 5, anchor: 'middle' },
    { ind: 'culture', x1: C, y1: C, x2: C, y2: C + R, tx: C, ty: C + R + 13, anchor: 'middle' },
  ]

  return (
    <div className="nav-stack">
      {/* 移动端折叠钮（桌面隐藏）：96px 圆形罗盘，点开全屏列表 */}
      <button
        className="gc-nav-toggle"
        onClick={() => setOpen(true)}
        aria-label="打开街区导航"
        aria-expanded={open}
      >
        <Compass
          arms={arms}
          placed={placed}
          delivered={delivered}
          px={px}
          py={py}
          deg={deg}
          district={district}
          compact
        />
      </button>

      <section className={`gc-nav${open ? ' is-open' : ''}`} aria-label="街区导航器">
        <header className="gc-nav-head">
          <span
            className="gc-nav-district"
            style={{ borderColor: INDUSTRIES[district].color, color: INDUSTRIES[district].color }}
          >
            当前 · {INDUSTRIES[district].label}
          </span>
          <button className="gc-nav-close" onClick={() => setOpen(false)} aria-label="收起导航器">
            ×
          </button>
          <span className="gc-nav-title">街区导航</span>
        </header>

        <Compass
          arms={arms}
          placed={placed}
          delivered={delivered}
          px={px}
          py={py}
          deg={deg}
          district={district}
        />

        <div className="gc-nav-section">邻近摊位</div>
        <ul className="gc-nav-list">
          {nearby.map(({ pl, d }) => {
            const state = delivered.has(pl.lot.id)
              ? ('delivered' as const)
              : basketSet.has(pl.lot.id)
                ? ('basket' as const)
                : visitedSet.has(pl.lot.id)
                  ? ('visited' as const)
                  : ('none' as const)
            return (
              <li key={pl.lot.id}>
                <button className="gc-nav-row" onClick={() => teleportToLot(pl)}>
                  <span
                    className="gc-nav-dot"
                    style={{ background: INDUSTRIES[pl.lot.industry].color }}
                  />
                  <span className="gc-nav-name">{pl.lot.name}</span>
                  <span className="gc-nav-ind">
                    {INDUSTRIES[pl.lot.industry].label.replace('区', '')}
                  </span>
                  <span className="gc-nav-dist">{Math.round(d)}m</span>
                  <span className={`gc-nav-state gc-nav-state--${state}`}>
                    <StatusIcon kind={state} />
                  </span>
                </button>
              </li>
            )
          })}
        </ul>

        <div className="gc-nav-section">四区进度 · 点击直达</div>
        <div className="gc-nav-districts">
          {districtProgress.map((d) => (
            <button
              key={d.ind}
              className={`gc-nav-district-row${d.active ? ' is-active' : ''}`}
              onClick={() => teleportToDistrict(d.ind)}
            >
              <span className="gc-nav-dot" style={{ background: d.color }} />
              <span className="gc-nav-ind-name">{d.label}</span>
              <span className="gc-nav-count">
                {d.got}/{d.total}
              </span>
              <span className="gc-nav-bar">
                <i
                  style={{
                    width: `${d.total ? (d.got / d.total) * 100 : 0}%`,
                    background: d.color,
                  }}
                />
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
