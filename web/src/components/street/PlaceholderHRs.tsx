// 远景占位人形 InstancedMesh 池（M6a：draw call 优化）
//
// 原 PlaceholderHR 每个摊位 11 个独立 mesh，64 个摊位远景 = 704 draw call。
// 本组件把所有远景占位人形合并为 5 个 InstancedMesh（身 / 头 / 发 / 胸牌 / 头顶），
// 共 5 个 draw call，节省 ~699。近景时由 HRStand 渲染真 GLB（RealHR），本组件只负责远景。
//
// Per-instance 颜色通过 vertexColors + setColorAt 设置。
import { useEffect, useRef, type RefObject } from 'react'
import * as THREE from 'three'
import { OUTFITS, HAIRS } from './HRStand'
import { ColorSceneSkin, ColorSceneMoon, ColorSceneSun } from '../../../generated/design-tokens.output.mjs'
import type { LotPlacement } from '../../data/street-companies'

const INSTANCE_OFFSET = -9999 // 近景摊位的实例被移到这里（视野外）
const BODY_INSTANCES_PER_LOT = 3 // 左臂、右臂、躯干
const SINGLE_INSTANCES_PER_LOT = 1 // 头 / 发 / 胸牌 / 头顶

const tempColor = new THREE.Color()

export function PlaceholderHRs({
  placements,
  cameraPosition,
  near,
  night,
}: {
  placements: LotPlacement[]
  cameraPosition: THREE.Vector3
  /** 摊位 id → 是否近景（由 StreetScene 统一计算） */
  near: Set<string>
  night: boolean
}) {
  const bodyRef = useRef<THREE.InstancedMesh>(null)
  const headRef = useRef<THREE.InstancedMesh>(null)
  const hairRef = useRef<THREE.InstancedMesh>(null)
  const badgeRef = useRef<THREE.InstancedMesh>(null)
  const topRef = useRef<THREE.InstancedMesh>(null)

  const countRef = useRef(0)

  const totalBodyInstances = placements.length * BODY_INSTANCES_PER_LOT
  const totalSingleInstances = placements.length * SINGLE_INSTANCES_PER_LOT

  // 首次挂载时设定 count
  useEffect(() => {
    if (countRef.current === totalBodyInstances) return
    countRef.current = totalBodyInstances
    const setCount = (ref: RefObject<THREE.InstancedMesh>, n: number) => {
      const m = ref.current
      if (m) m.count = n
    }
    setCount(bodyRef, totalBodyInstances)
    setCount(headRef, totalSingleInstances)
    setCount(hairRef, totalSingleInstances)
    setCount(badgeRef, totalSingleInstances)
    setCount(topRef, totalSingleInstances)
  }, [placements.length, totalBodyInstances, totalSingleInstances])

  // 每帧根据相机距离更新实例矩阵与颜色（不触发 React 重渲染）
  useEffect(() => {
    const bodies = bodyRef.current
    const heads = headRef.current
    const hairs = hairRef.current
    const badges = badgeRef.current
    const tops = topRef.current
    if (!bodies || !heads || !hairs || !badges || !tops) return

    const o = new THREE.Object3D()

    placements.forEach((pl, li) => {
      const isNear = near.has(pl.lot.id)
      const baseY = isNear ? INSTANCE_OFFSET : 0
      const outfit = OUTFITS[pl.lot.hrIndex % OUTFITS.length]
      const hair = HAIRS[pl.lot.hrIndex % HAIRS.length]
      const h = 0.96 + (pl.lot.hrIndex % 5) * 0.015
      const baseIdx = li * BODY_INSTANCES_PER_LOT
      const singleIdx = li
      const { x: px, z: pz } = { x: pl.position[0], z: pl.position[2] }

      // 身体：3 个胶囊（左臂、右臂、躯干）
      const bodySlots = [
        { x: -0.22, y: 0.88, z: 0, rot: 0.16 },
        { x: 0.22, y: 0.88, z: 0, rot: -0.16 },
        { x: px, y: baseY + 0.62, z: pz, rot: pl.rotationY },
      ]
      bodySlots.forEach((slot, si) => {
        const idx = baseIdx + si
        o.position.set(slot.x, slot.y, slot.z)
        if (si === 2) {
          o.rotation.set(0, slot.rot, 0)
        } else {
          o.rotation.set(0, 0, slot.rot)
        }
        o.scale.set(1, h, 1)
        o.updateMatrix()
        bodies.setMatrixAt(idx, o.matrix)
        tempColor.set(outfit)
        bodies.setColorAt(idx, tempColor)
      })

      // 头部（固定肤色）
      o.position.set(px, baseY + 1.24, pz)
      o.rotation.set(0, pl.rotationY, 0)
      o.scale.setScalar(h)
      o.updateMatrix()
      heads.setMatrixAt(singleIdx, o.matrix)

      // 发色
      o.position.set(px, baseY + 1.32, pz)
      o.rotation.set(0, pl.rotationY, 0)
      o.scale.setScalar(h)
      o.updateMatrix()
      hairs.setMatrixAt(singleIdx, o.matrix)
      tempColor.set(hair)
      hairs.setColorAt(singleIdx, tempColor)

      // 胸牌（西装色 + 自发光）
      o.position.set(px, baseY + 0.78, pz + 0.2)
      o.rotation.set(0, pl.rotationY, 0)
      o.scale.setScalar(h)
      o.updateMatrix()
      badges.setMatrixAt(singleIdx, o.matrix)
      tempColor.set(outfit)
      badges.setColorAt(singleIdx, tempColor)

      // 头顶（太阳/月亮）
      o.position.set(px, baseY + 1.72, pz)
      o.rotation.set(0, pl.rotationY, 0)
      o.scale.setScalar(h)
      o.updateMatrix()
      tops.setMatrixAt(singleIdx, o.matrix)
      tempColor.set(night ? ColorSceneMoon : ColorSceneSun)
      tops.setColorAt(singleIdx, tempColor)
    })

    bodies.instanceMatrix.needsUpdate = true
    bodies.instanceColor!.needsUpdate = true
    heads.instanceMatrix.needsUpdate = true
    hairs.instanceMatrix.needsUpdate = true
    hairs.instanceColor!.needsUpdate = true
    badges.instanceMatrix.needsUpdate = true
    badges.instanceColor!.needsUpdate = true
    tops.instanceMatrix.needsUpdate = true
    tops.instanceColor!.needsUpdate = true
  }, [placements, near, cameraPosition, night])

  return (
    <group>
      <instancedMesh
        ref={bodyRef}
        args={[undefined, undefined, totalBodyInstances]}
        castShadow
        receiveShadow
      >
        <capsuleGeometry args={[0.055, 0.42, 4, 8]} />
        <meshStandardMaterial vertexColors roughness={0.8} />
      </instancedMesh>
      <instancedMesh ref={headRef} args={[undefined, undefined, totalSingleInstances]}>
        <sphereGeometry args={[0.185, 16, 14]} />
        <meshStandardMaterial color={ColorSceneSkin} roughness={0.6} />
      </instancedMesh>
      <instancedMesh ref={hairRef} args={[undefined, undefined, totalSingleInstances]}>
        <sphereGeometry args={[0.19, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial vertexColors roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={badgeRef} args={[undefined, undefined, totalSingleInstances]}>
        <boxGeometry args={[0.055, 0.012, 0.01]} />
        <meshStandardMaterial vertexColors emissiveIntensity={0.4} />
      </instancedMesh>
      <instancedMesh ref={topRef} args={[undefined, undefined, totalSingleInstances]}>
        <sphereGeometry args={[0.1, 12, 10]} />
        <meshBasicMaterial vertexColors />
      </instancedMesh>
    </group>
  )
}
