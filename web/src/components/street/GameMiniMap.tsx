// 街区小地图：世界坐标俯视投影 + 玩家朝向；只在漫游态显示
import { useEffect, useMemo, useState } from 'react'
import type { RoamRefs } from '../AvatarActor'
import { INDUSTRIES, placeLots, STREET_BOUNDS } from '../../data/street-companies'

const SIZE = 168

export function GameMiniMap({
  refs,
  delivered,
}: {
  refs: RoamRefs
  delivered: Set<string>
}) {
  const placed = useMemo(() => placeLots(), [])
  const [pos, setPos] = useState({ x: 0, z: 0, h: 0 })
  useEffect(() => {
    const id = window.setInterval(() => {
      const p = refs.position.current
      setPos({ x: p.x, z: p.z, h: refs.heading?.current ?? 0 })
    }, 100)
    return () => window.clearInterval(id)
  }, [refs])

  const c = SIZE / 2
  const r = SIZE / 2 - 6
  const scale = r / STREET_BOUNDS
  const px = c + pos.x * scale
  const py = c - pos.z * scale
  const deg = (pos.h * 180) / Math.PI
  const district =
    Math.abs(pos.x) >= Math.abs(pos.z)
      ? pos.x >= 0
        ? 'internet'
        : 'finance'
      : pos.z >= 0
        ? 'manufacturing'
        : 'culture'
  const arms = [
    { ind: 'internet' as const, x1: c, y1: c, x2: c + r, y2: c, lx: c + r - 20, ly: c + 14, text: '互联网' },
    { ind: 'finance' as const, x1: c, y1: c, x2: c - r, y2: c, lx: c - r + 20, ly: c + 14, text: '金融' },
    { ind: 'manufacturing' as const, x1: c, y1: c, x2: c, y2: c - r, lx: c, ly: c - r + 18, text: '智造' },
    { ind: 'culture' as const, x1: c, y1: c, x2: c, y2: c + r, lx: c, ly: c + r - 10, text: '文创' },
  ]
  return (
    <>
      <div
        className="district-chip"
        style={{ borderColor: INDUSTRIES[district].color, color: INDUSTRIES[district].color }}
      >
        当前 · {INDUSTRIES[district].label}
      </div>
      <div className="mini-map" aria-label="街区小地图">
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE}>
        <defs>
          <clipPath id="mm-clip">
            <circle cx={c} cy={c} r={r} />
          </clipPath>
        </defs>
        <g clipPath="url(#mm-clip)">
          <rect width={SIZE} height={SIZE} fill="rgba(13,17,23,0.9)" />
          <rect x={c - 5} y={0} width={10} height={SIZE} fill="#333d48" />
          <rect x={0} y={c - 5} width={SIZE} height={10} fill="#333d48" />
          {arms.map((a) => (
            <g key={a.ind}>
              <line
                x1={a.x1}
                y1={a.y1}
                x2={a.x2}
                y2={a.y2}
                stroke={INDUSTRIES[a.ind].color}
                strokeWidth={1.5}
                opacity={0.75}
              />
              <text
                x={a.lx}
                y={a.ly}
                fill={INDUSTRIES[a.ind].color}
                fontSize={8}
                fontWeight={700}
                textAnchor="middle"
                paintOrder="stroke"
                stroke="#0d1117"
                strokeWidth={2.4}
              >
                {a.text}
              </text>
            </g>
          ))}
          {placed.map((pl) => (
            <circle
              key={pl.lot.id}
              cx={c + pl.position[0] * scale}
              cy={c - pl.position[2] * scale}
              r={delivered.has(pl.lot.id) ? 2.1 : 1.4}
              fill={INDUSTRIES[pl.lot.industry].color}
              opacity={delivered.has(pl.lot.id) ? 1 : 0.42}
            />
          ))}
          <circle cx={c} cy={c} r={5} fill="none" stroke="#ffd24a" strokeWidth={1} opacity={0.8} />
          <g transform={`translate(${px} ${py}) rotate(${deg})`}>
            <path d="M0,0 L-17,-29.4 A 34 34 0 0 1 17,-29.4 Z" fill="#ffd24a" opacity={0.1} />
            <path d="M0,-5 L3.6,4 L0,2 L-3.6,4 Z" fill="#ffd24a" />
          </g>
        </g>
        <circle cx={c} cy={c} r={r} fill="none" stroke="#30363d" strokeWidth={1} />
      </svg>
      </div>
    </>
  )
}
