// 薪酬钞票山：Instanced Mesh，万级实例单次 draw call
// v1.1 修复：实例数由参数实际算出（旧版固定 10000，低年薪时
// 未设置的实例全部堆在原点形成"幽灵柱"）
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { BILL, yuanToStacks } from '../engine/params'

// 金字塔堆叠：逐层收窄的正方形层
function pyramidLayout(stacks: number, startLayer: number, offset: [number, number]) {
  const positions: { pos: [number, number, number]; layer: number }[] = []
  let remaining = stacks
  let layer = startLayer
  while (remaining > 0) {
    const side = Math.ceil(Math.sqrt(remaining))
    for (let x = 0; x < side && remaining > 0; x++)
      for (let z = 0; z < side && remaining > 0; z++) {
        positions.push({
          pos: [offset[0] + x * BILL.w, layer * BILL.stackH, offset[1] + z * BILL.d],
          layer,
        })
        remaining--
      }
    layer++
  }
  return { positions, topLayer: layer }
}

function InstancedBundles({
  positions,
  color,
}: {
  positions: { pos: [number, number, number] }[]
  color: string
}) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const temp = useMemo(() => new THREE.Object3D(), [])

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    positions.forEach((p, i) => {
      // 居中：让每层绕原点对齐
      temp.position.set(p.pos[0], p.pos[1], p.pos[2])
      temp.updateMatrix()
      mesh.setMatrixAt(i, temp.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
    // 居中修正：整山平移使中心落在原点
    mesh.position.set(-2, 0, -1)
  }, [positions, temp])

  return (
    <instancedMesh key={positions.length} ref={ref} args={[undefined, undefined, Math.max(1, positions.length)]}>
      <boxGeometry args={[BILL.w, BILL.stackH, BILL.d]} />
      <meshStandardMaterial color={color} roughness={0.85} />
    </instancedMesh>
  )
}

export function MoneyMountain({
  baseYuan,
  incrementYuan,
}: {
  baseYuan: number
  incrementYuan: number
}) {
  // 防博弈：base 层与增量层（14/16 薪）必须分色分垒，不允许渲染成混合山
  const { base, increment } = useMemo(() => {
    const baseStacks = yuanToStacks(baseYuan)
    const incStacks = yuanToStacks(incrementYuan)
    const baseL = pyramidLayout(baseStacks, 0, [0, 0])
    const incL = pyramidLayout(incStacks, baseL.topLayer, [0, 0])
    return {
      base: baseL.positions,
      increment: incStacks > 0 ? incL.positions : [],
    }
  }, [baseYuan, incrementYuan])

  return (
    <group>
      <InstancedBundles positions={base} color="#c23a2b" />
      <InstancedBundles positions={increment} color="#d98e32" />
    </group>
  )
}
