// 远景占位人形 InstancedMesh 池（M6a：draw call 优化）
//
// 原 PlaceholderHR 每个摊位 11 个独立 mesh，64 个摊位远景 = 704 draw call。
// 本组件把所有远景占位人形合并为 5 个 InstancedMesh（身 / 头 / 发 / 胸牌 / 头顶），
// 共 5 个 draw call，节省 ~699。近景时由 HRStand 渲染真 GLB（RealHR），本组件只负责远景。
//
// Per-instance 颜色通过 vertexColors + setColorAt 设置。
import { useLayoutEffect, useRef, type RefObject } from 'react'
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
  near,
  night,
}: {
  placements: LotPlacement[]
  /**
   * 摊位 id → 是否近景（由 StreetScene 经 NearTracker **以 state 上抛**）。
   * 关键：必须是 React state（引用变化触发重渲染），不能是 ref——ref 每帧替换
   * `.current` 不触发重渲染，组件拿不到新 Set，近景占位人形会与真 HR 重叠。
   */
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

  // 首次挂载时设定 count（用 useLayoutEffect：首帧渲染前落定，避免一帧全部实例叠在原点）
  useLayoutEffect(() => {
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

  // 近景集/昼夜变化时更新实例矩阵与颜色（不触发 React 重渲染）。
  // 用 useLayoutEffect：InstancedMesh 矩阵必须在首帧渲染前落定（AGENTS 铁律），
  // 否则首帧会有一帧所有占位人形叠在原点。
  useLayoutEffect(() => {
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
      const px = pl.position[0]
      const pz = pl.position[2]
      // 摊位绕 Y 的朝向；局部偏移必须经它旋转到世界坐标，否则手臂会被当成
      // 世界坐标直接写入（x=±0.22,z=0）→ 64 摊 ×2 只手臂全部堆在原点（P1 事故）。
      // 局部→世界换算与 BoothHardwareInstanced.instanceMatrixFor 保持同一约定：
      //   wx = px + lx*cos(rot) - lz*sin(rot)；wz = pz + lx*sin(rot) + lz*cos(rot)
      const rot = pl.rotationY
      const c = Math.cos(rot)
      const s = Math.sin(rot)

      // 身体：3 个胶囊。slot 一律是「相对摊位中心的局部偏移」：
      // lx/lz=水平偏移、ly=离地高度、rotZ=手臂局部张开角（仅在局部坐标系内倾斜）
      const bodySlots = [
        { lx: -0.22, ly: 0.88, lz: 0, rotZ: 0.16 }, // 左臂
        { lx: 0.22, ly: 0.88, lz: 0, rotZ: -0.16 }, // 右臂
        { lx: 0, ly: 0.62, lz: 0, rotZ: 0 }, // 躯干（居中）
      ]
      bodySlots.forEach((slot, si) => {
        const idx = baseIdx + si
        const wx = px + slot.lx * c - slot.lz * s
        const wz = pz + slot.lx * s + slot.lz * c
        o.position.set(wx, baseY + slot.ly, wz)
        // rotationY 对所有 slot 生效；手臂额外叠加局部张开角 rotZ
        o.rotation.set(0, rot, slot.rotZ)
        o.scale.set(1, h, 1)
        o.updateMatrix()
        bodies.setMatrixAt(idx, o.matrix)
        tempColor.set(outfit)
        bodies.setColorAt(idx, tempColor)
      })

      // 头部（固定肤色）
      o.position.set(px, baseY + 1.24, pz)
      o.rotation.set(0, rot, 0)
      o.scale.setScalar(h)
      o.updateMatrix()
      heads.setMatrixAt(singleIdx, o.matrix)

      // 发色
      o.position.set(px, baseY + 1.32, pz)
      o.rotation.set(0, rot, 0)
      o.scale.setScalar(h)
      o.updateMatrix()
      hairs.setMatrixAt(singleIdx, o.matrix)
      tempColor.set(hair)
      hairs.setColorAt(singleIdx, tempColor)

      // 胸牌（西装色 + 自发光）：胸前 +0.2m 也是局部偏移，须随摊位朝向旋转
      // （原写法 pz + 0.2 是世界坐标，摊位转到背面时胸牌会穿到身后）
      o.position.set(px - 0.2 * s, baseY + 0.78, pz + 0.2 * c)
      o.rotation.set(0, rot, 0)
      o.scale.setScalar(h)
      o.updateMatrix()
      badges.setMatrixAt(singleIdx, o.matrix)
      tempColor.set(outfit)
      badges.setColorAt(singleIdx, tempColor)

      // 头顶（太阳/月亮）
      o.position.set(px, baseY + 1.72, pz)
      o.rotation.set(0, rot, 0)
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
  }, [placements, near, night])

  return (
    <group>
      <instancedMesh
        ref={bodyRef}
        args={[undefined, undefined, totalBodyInstances]}
        castShadow
        receiveShadow
      >
        <capsuleGeometry args={[0.055, 0.42, 4, 8]} />
        {/* ⚠ 勿加 vertexColors：CapsuleGeometry 无 color 顶点属性，USE_COLOR 会把 vColor
            乘成 0 → 64 个远景人形全是纯黑剪影（本仓库 T14「纯黑棚顶」同一根因）。
            行业色由 instanceColor 单独生效即可。 */}
        <meshStandardMaterial roughness={0.8} />
      </instancedMesh>
      <instancedMesh ref={headRef} args={[undefined, undefined, totalSingleInstances]}>
        <sphereGeometry args={[0.185, 16, 14]} />
        <meshStandardMaterial color={ColorSceneSkin} roughness={0.6} />
      </instancedMesh>
      <instancedMesh ref={hairRef} args={[undefined, undefined, totalSingleInstances]}>
        <sphereGeometry args={[0.19, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={badgeRef} args={[undefined, undefined, totalSingleInstances]}>
        <boxGeometry args={[0.055, 0.012, 0.01]} />
        <meshStandardMaterial emissiveIntensity={0.4} />
      </instancedMesh>
      <instancedMesh ref={topRef} args={[undefined, undefined, totalSingleInstances]}>
        <sphereGeometry args={[0.1, 12, 10]} />
        <meshBasicMaterial />
      </instancedMesh>
    </group>
  )
}
