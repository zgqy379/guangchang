// 五险一金"切走的部分"（词典 social_insurance_base_ratio，5.1）
// 缴费基数越低 → 切走的比例越大 → 灰色钱堆越大（到手前损耗的直观化）
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { BILL, MOUNTAIN_SCALE, yuanToStacks } from '../engine/params'

// 词典 mapping 参数：carveScale 按档位（full=完整小切口 … min=明显大切口）
const CARVE_SCALE: Record<string, number> = {
  full: 0.15,
  '0.8': 0.45,
  '0.6': 0.7,
  min: 1.0,
}

// 个人+单位五险一金综合费率约 10.5% 起步，作为"被切走总额"的基数
const INSURANCE_RATE = 0.105

function stackLayout(count: number) {
  const out: [number, number, number][] = []
  let layer = 0
  let remaining = count
  while (remaining > 0) {
    const side = Math.ceil(Math.sqrt(remaining))
    for (let x = 0; x < side && remaining > 0; x++)
      for (let z = 0; z < side && remaining > 0; z++) {
        out.push([x * BILL.w, (layer + 0.5) * BILL.stackH, z * BILL.d])
        remaining--
      }
    layer++
  }
  return { positions: out, topLayer: layer }
}

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

  const positions = useMemo(() => stackLayout(stacks).positions, [stacks])

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    positions.forEach((p, i) => {
      temp.position.set(p[0], p[1], p[2])
      temp.updateMatrix()
      mesh.setMatrixAt(i, temp.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.position.set(1.1, 0, -1.0)
    mesh.scale.setScalar(MOUNTAIN_SCALE)
  }, [positions, temp])

  if (stacks === 0) return null

  return (
    <instancedMesh key={positions.length} ref={ref} args={[undefined, undefined, Math.max(1, positions.length)]}>
      <boxGeometry args={[BILL.w, BILL.stackH, BILL.d]} />
      <meshStandardMaterial color="#6b7280" roughness={0.95} />
    </instancedMesh>
  )
}
