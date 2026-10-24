// 薛定谔钞票：期权/奖金的半透明悬浮云
// 防博弈规则（project.md 5.4，规则值从词典 antiGaming 字段读取）：
//   透明度上限 45% × 缩放系数 0.5，且视觉体积上限 = base 山 × 2，超出封顶
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { BILL, yuanToStacks } from '../engine/params'
import { antiGamingParams } from '../engine/dictionary'

// 确定性伪随机（同参数渲染结果稳定，便于录屏）
function seeded(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0xffffffff
  }
}

export function SchrodingerBills({
  equityYuan,
  baseYuan,
}: {
  equityYuan: number
  baseYuan: number
}) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const temp = useMemo(() => new THREE.Object3D(), [])

  const ag = useMemo(
    () => ({
      maxOpacity: (antiGamingParams('equity_value', 0).maxOpacity ?? 0.45) as number,
      scaleFactor: (antiGamingParams('equity_value', 1).scaleFactor ?? 0.5) as number,
      capRatio: (antiGamingParams('equity_value', 2).capRatioOfBase ?? 2) as number,
    }),
    []
  )

  const positions = useMemo(() => {
    if (equityYuan <= 0) return []
    const baseStacks = yuanToStacks(baseYuan)
    let effStacks = yuanToStacks(equityYuan * ag.scaleFactor)
    // 封顶规则：期权视觉体积 ≤ base 山 × 2，超出不渲染（标注由 schrodingerCapNote 提供）
    const cap = Math.floor(baseStacks * ag.capRatio)
    effStacks = Math.min(effStacks, cap)

    const rand = seeded(42)
    const out: [number, number, number][] = []
    for (let i = 0; i < effStacks; i++) {
      const a = rand() * Math.PI * 2
      const r = 0.6 + rand() * 1.6
      out.push([Math.cos(a) * r, 0.8 + rand() * 1.4, Math.sin(a) * r])
    }
    return out
  }, [equityYuan, baseYuan, ag])

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    positions.forEach((p, i) => {
      temp.position.set(p[0], p[1], p[2])
      temp.rotation.set(0, i * 0.7, 0)
      temp.updateMatrix()
      mesh.setMatrixAt(i, temp.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  }, [positions, temp])

  if (positions.length === 0) return null

  return (
    <instancedMesh key={positions.length} ref={ref} args={[undefined, undefined, positions.length]}>
      <boxGeometry args={[BILL.w * 1.2, BILL.stackH * 1.2, BILL.d * 1.2]} />
      <meshStandardMaterial
        color="#8fb4d9"
        transparent
        opacity={ag.maxOpacity}
        emissive="#3a5f82"
        emissiveIntensity={0.4}
      />
    </instancedMesh>
  )
}

export const schrodingerCapNote = (params: { equityYuan: number; baseYuan: number }) => {
  const ag = {
    scaleFactor: (antiGamingParams('equity_value', 1).scaleFactor ?? 0.5) as number,
    capRatio: (antiGamingParams('equity_value', 2).capRatioOfBase ?? 2) as number,
  }
  const eff = yuanToStacks(params.equityYuan * ag.scaleFactor)
  const cap = Math.floor(yuanToStacks(params.baseYuan) * ag.capRatio)
  return eff > cap ? `期权按规则封顶（超出 ${(1 - cap / eff).toFixed(0)}% 未渲染）` : ''
}
