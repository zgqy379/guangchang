// 五险一金"切走的部分"（词典 social_insurance_base_ratio，5.1）
// 缴费基数越低 → 切走的比例越大 → 灰色钱堆越大（到手前损耗的直观化）
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import {
  BILL,
  MOUNTAIN_HEIGHT_SCALE,
  MOUNTAIN_SCALE,
  layerLayout,
  yuanToStacks,
} from '../engine/params'
import { ColorTextMuted } from '../../generated/design-tokens.output.mjs'

// 词典 mapping 参数：carveScale 按档位（full=完整小切口 … min=明显大切口）
const CARVE_SCALE: Record<string, number> = {
  full: 0.15,
  '0.8': 0.45,
  '0.6': 0.7,
  min: 1.0,
}

// 个人+单位五险一金综合费率约 10.5% 起步，作为"被切走总额"的基数
const INSURANCE_RATE = 0.105

export function CarvedZone({
  baseYuan,
  ratio,
}: {
  baseYuan: number
  ratio: string
}) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const temp = useMemo(() => new THREE.Object3D(), [])

  const stacks = useMemo(() => {
    const scale = CARVE_SCALE[ratio] ?? CARVE_SCALE.full
    // 真实切走额 = base × 综合费率 × (1 + 基数折扣带来的额外损耗系数)
    const carvedYuan = baseYuan * INSURANCE_RATE * (1 + scale * 1.2)
    return yuanToStacks(carvedYuan)
  }, [baseYuan, ratio])

  const positions = useMemo(() => layerLayout(stacks, 0), [stacks])

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    positions.forEach((p, i) => {
      temp.position.set(p.pos[0], p.pos[1], p.pos[2])
      temp.updateMatrix()
      mesh.setMatrixAt(i, temp.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.position.set(1.6, 0, -1.2)
    mesh.scale.set(MOUNTAIN_SCALE, MOUNTAIN_HEIGHT_SCALE, MOUNTAIN_SCALE)
  }, [positions, temp])

  if (stacks === 0) return null

  return (
    <instancedMesh key={positions.length} ref={ref} args={[undefined, undefined, Math.max(1, positions.length)]}>
      <boxGeometry args={[BILL.w, BILL.stackH, BILL.d]} />
      {/* 被切走的钱堆：中性灰（ColorTextMuted）表达"损耗/缩水"，与山体红橙对比 */}
      <meshStandardMaterial color={ColorTextMuted} roughness={0.95} />
    </instancedMesh>
  )
}
