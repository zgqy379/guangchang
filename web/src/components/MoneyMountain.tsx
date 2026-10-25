// 薪酬钞票山：Instanced Mesh + 逐层隆起生长动画（M3 关键帧 A/D）
// v1.1 修复：实例数由参数实际算出（旧版固定 10000，低年薪时
// 未设置的实例全部堆在原点形成"幽灵柱"）
import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { BILL, MOUNTAIN_SCALE, yuanToStacks } from '../engine/params'

interface StackPos {
  pos: [number, number, number]
  layer: number
}

// 金字塔堆叠：逐层收窄的正方形层；y 为该层中心（层高 5mm = 50 张一沓）
function pyramidLayout(stacks: number, startLayer: number): StackPos[] {
  const positions: StackPos[] = []
  let remaining = stacks
  let layer = startLayer
  while (remaining > 0) {
    const side = Math.ceil(Math.sqrt(remaining))
    for (let x = 0; x < side && remaining > 0; x++)
      for (let z = 0; z < side && remaining > 0; z++) {
        positions.push({
          pos: [x * BILL.w, (layer + 0.5) * BILL.stackH, z * BILL.d],
          layer,
        })
        remaining--
      }
    layer++
  }
  return positions
}

const easeOutCubic = (k: number) => 1 - Math.pow(1 - k, 3)

function InstancedBundles({
  positions,
  color,
}: {
  positions: StackPos[]
  color: string
}) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const temp = useMemo(() => new THREE.Object3D(), [])
  const startRef = useRef<number | null>(null)

  // 生长动画：每层延迟 0.12s，从底部向上一层层隆起
  useFrame((state) => {
    const mesh = ref.current
    if (!mesh) return
    if (startRef.current === null) startRef.current = state.clock.elapsedTime
    const t = state.clock.elapsedTime - startRef.current
    positions.forEach((p, i) => {
      const k = Math.min(1, Math.max(0, (t - p.layer * 0.12) / 0.6))
      const e = easeOutCubic(k)
      // 从各自层的底部生长：中心随 ease 上移、高度随 ease 增加
      temp.position.set(
        p.pos[0],
        p.layer * BILL.stackH + BILL.stackH * e * 0.5,
        p.pos[2]
      )
      temp.scale.set(1, Math.max(e, 0.001), 1)
      temp.updateMatrix()
      mesh.setMatrixAt(i, temp.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  })

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    // 居中：让每层绕原点对齐，并应用感知放大系数
    mesh.position.set(-2, 0, -1)
    mesh.scale.setScalar(MOUNTAIN_SCALE)
  }, [positions])

  return (
    <instancedMesh
      key={positions.length}
      ref={ref}
      args={[undefined, undefined, Math.max(1, positions.length)]}
    >
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
    const baseL = pyramidLayout(baseStacks, 0)
    const incL = pyramidLayout(incStacks, baseL.length ? Math.max(...baseL.map((p) => p.layer)) + 1 : 0)
    return { base: baseL, increment: incStacks > 0 ? incL : [] }
  }, [baseYuan, incrementYuan])

  return (
    <group>
      <InstancedBundles positions={base} color="#c23a2b" />
      <InstancedBundles positions={increment} color="#d98e32" />
    </group>
  )
}
