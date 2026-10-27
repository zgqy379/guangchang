// 办公空间门面 InstancedMesh 池（M6b：draw call 优化）
//
// 原每个摊位门面约 8–12 个独立 mesh，64 个摊位 ≈ 600+ draw call。
// 本组件将门面主体合并为 InstancedMesh，所有摊位共享几何与材质，
// 通过 per-instance matrix（位置/旋转/缩放）和 per-instance color（行业色）区分个体。
//
// 处理的子元素（共 6 个 InstancedMesh，6 个 draw call，替代 ~384）：
//   1. body  玻璃体块（按楼层数分组，共 4 个 InstancedMesh）
//   2. cap   实体头顶（vertexColors per-instance 颜色，行业色）
//   3. glass 底层玻璃幕墙
//   4. led   门楣 LED（vertexColors per-instance 颜色，行业色）
//   5. door  门
//
// 楼层灯带、屋顶（条件渲染，数量少）保持在 HRStand 中作为独立 mesh。
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { LotPlacement } from '../../data/street-companies'
import { INDUSTRIES } from '../../data/street-companies'
import { facadeTexture, glassTexture } from './HRStand'
import {
  ColorSceneGateDark,
  ThemeLightGlassHead,
} from '../../../generated/design-tokens.output.mjs'
import type { ThemeName } from '../../engine/theme'

// 摊位门面在摊位局部坐标中的偏置（沿局部 z 轴负方向）
const DOOR_OFFSET_Z = -3.6

const tempObject = new THREE.Object3D()

/**
 * 摊位个体识别：用 lotNo（稳定、连号、跨主题不变）哈希对行业色做克制的 HSL 微扰。
 * 同行业 16 摊不再完全同色，但幅度控制在「仍读成一族」（art-style 结论 1）。
 * 纯 instanceColor 操作，0 draw call 增量；颜色仅装饰，不承载状态语义（可访问性规则不受影响）。
 */
export function applyLotJitter(target: THREE.Color, lotId: string): THREE.Color {
  const seed = parseInt(lotId.slice(-2), 10) || 0
  const hue = ((seed % 7) - 3) * 0.011 // ±0.033 ≈ ±12°
  const lightness = ((seed % 5) - 2) * 0.012 // ±0.024
  const sat = ((seed % 3) - 1) * 0.02 // ±0.02
  return target.offsetHSL(hue, sat, lightness)
}

/** 计算子元素的世界 matrix：摊位位置 + RotY(摊位旋转) × (门面偏置 + 子元素局部位置) */
function instanceMatrixFor(
  pl: LotPlacement,
  localX: number,
  localY: number,
  localZ: number,
  sx: number,
  sy: number,
  sz: number,
) {
  const r = pl.rotationY
  const c = Math.cos(r)
  const s = Math.sin(r)
  const dz = DOOR_OFFSET_Z + localZ
  const wx = pl.position[0] + localX * c - dz * s
  const wy = localY
  const wz = pl.position[2] + localX * s + dz * c

  tempObject.position.set(wx, wy, wz)
  tempObject.rotation.set(0, r, 0)
  tempObject.scale.set(sx, sy, sz)
  tempObject.updateMatrix()
  return tempObject.matrix
}

// 楼层数：bHeight → bFloors
function bFloorsFor(industry: string) {
  const bHeight =
    industry === 'internet' ? 8 : industry === 'finance' ? 11.5 : industry === 'manufacturing' ? 4.6 : 4.2
  return Math.max(3, Math.round(bHeight / 1.3))
}

export function OfficeFacadeInstanced({
  placements,
  theme,
  night,
}: {
  placements: LotPlacement[]
  theme: ThemeName
  night: boolean
}) {
  const count = placements.length
  const envNight = theme === 'dark'

  // 按楼层数分组
  const floorGroups = new Map<number, number[]>()
  placements.forEach((_, li) => {
    const f = bFloorsFor(placements[li].lot.industry)
    const arr = floorGroups.get(f)
    if (arr) arr.push(li)
    else floorGroups.set(f, [li])
  })

  const bodyRef3 = useRef<THREE.InstancedMesh>(null)
  const bodyRef4 = useRef<THREE.InstancedMesh>(null)
  const bodyRef6 = useRef<THREE.InstancedMesh>(null)
  const bodyRef9 = useRef<THREE.InstancedMesh>(null)
  const bodyRefs = [bodyRef3, bodyRef4, bodyRef6, bodyRef9]
  const floorKeys = [3, 4, 6, 9]

  const capRef = useRef<THREE.InstancedMesh>(null)
  const glassRef = useRef<THREE.InstancedMesh>(null)
  const ledRef = useRef<THREE.InstancedMesh>(null)

  const countRef = useRef(0)

  // ---------- 初始化 count ----------
  useEffect(() => {
    if (countRef.current === count) return
    countRef.current = count
    const setCount = (ref: React.RefObject<THREE.InstancedMesh> | null, n: number) => {
      const m = ref?.current
      if (m) m.count = n
    }
    floorKeys.forEach((f) => {
      const idx = floorKeys.indexOf(f)
      setCount(bodyRefs[idx], count)
    })
    setCount(capRef, count)
    setCount(glassRef, count)
    setCount(ledRef, count)
  }, [count, floorGroups.size])

  // ---------- 每帧更新实例 matrix 和颜色 ----------
  useEffect(() => {
    const tempCol = new THREE.Color()

    // body：按楼层数分组
    floorKeys.forEach((f, bi) => {
      const indices = floorGroups.get(f)
      if (!indices) return
      const mesh = bodyRefs[bi].current
      if (!mesh) return
      const tex = facadeTexture(f, night ? 'night' : 'day')
      const mat = mesh.material as THREE.MeshStandardMaterial
      if (mat.map !== tex) mat.map = tex
      mat.needsUpdate = true

      indices.forEach((ii) => {
        const pl = placements[ii]
        const bHeight =
          pl.lot.industry === 'internet' ? 8 : pl.lot.industry === 'finance' ? 11.5 : pl.lot.industry === 'manufacturing' ? 4.6 : 4.2
        mesh.setMatrixAt(ii, instanceMatrixFor(pl, 0, bHeight / 2, 0, 1, bHeight, 1))
        // 个体识别：楼体明度微扰（±3.5%），16 栋同层楼不再完全同亮度（instanceColor 通道，T14 教训已避）
        const seed = parseInt(pl.lot.id.slice(-2), 10) || 0
        tempCol.set('#ffffff').offsetHSL(0, 0, ((seed % 5) - 2) * 0.035)
        mesh.setColorAt(ii, tempCol)
      })
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    })

    // cap：实体头顶，per-instance 颜色（行业色）
    const capMesh = capRef.current
    if (capMesh) {
      placements.forEach((pl, li) => {
        const bHeight =
          pl.lot.industry === 'internet' ? 8 : pl.lot.industry === 'finance' ? 11.5 : pl.lot.industry === 'manufacturing' ? 4.6 : 4.2
        capMesh.setMatrixAt(li, instanceMatrixFor(pl, 0, bHeight + 0.1, 0, 1, 1, 1))
        const industryColor = new THREE.Color(INDUSTRIES[pl.lot.industry].color)
        const headColor = industryColor.clone().lerp(new THREE.Color(ThemeLightGlassHead), envNight ? 0.34 : 0.4)
        capMesh.setColorAt(li, headColor)
      })
      capMesh.instanceMatrix.needsUpdate = true
      capMesh.instanceColor!.needsUpdate = true
    }

    // glass：底层玻璃幕墙
    const glassMesh = glassRef.current
    if (glassMesh) {
      const tex = glassTexture(night ? 'night' : 'day')
      const mat = glassMesh.material as THREE.MeshBasicMaterial
      if (mat.map !== tex) mat.map = tex
      mat.needsUpdate = true

      placements.forEach((pl, li) => {
        glassMesh.setMatrixAt(li, instanceMatrixFor(pl, 0, 1.15, 2.66, 1, 1, 1))
      })
      glassMesh.instanceMatrix.needsUpdate = true
    }

    // led：门楣 LED，per-instance 颜色（行业色）
    const ledMesh = ledRef.current
    if (ledMesh) {
      placements.forEach((pl, li) => {
        ledMesh.setMatrixAt(li, instanceMatrixFor(pl, 0, 2.62, 2.70, 1, 1, 1))
        tempCol.set(INDUSTRIES[pl.lot.industry].color)
        ledMesh.setColorAt(li, tempCol)
      })
      ledMesh.instanceMatrix.needsUpdate = true
      ledMesh.instanceColor!.needsUpdate = true
    }
  }, [placements, count, night, envNight, floorGroups.size])

  return (
    <group>
      {/* body：按楼层数分组的 InstancedMesh */}
      {floorKeys.map((f, bi) => (
        <instancedMesh
          key={f}
          ref={bodyRefs[bi] as unknown as React.Ref<THREE.InstancedMesh>}
          args={[undefined, undefined, count]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[6.4, 1, 5.2]} />
          <meshStandardMaterial
            color={night ? ColorSceneGateDark : ThemeLightGlassHead}
            roughness={night ? 0.85 : 0.5}
            metalness={night ? 0 : 0.1}
          />
        </instancedMesh>
      ))}
      {/* cap：实体头顶 */}
      {/* cap：实体头顶（instanceColor 染色）。
          ⚠ 勿给此材质加 vertexColors：BoxGeometry 无 color 顶点属性，
          USE_COLOR 会把 vColor 乘成 0（纯黑棚顶，M6b 起潜伏，2026-10-27 才被红帽实验定位）。
          instanceColor 不依赖 vertexColors，单独生效。 */}
      <instancedMesh ref={capRef} args={[undefined, undefined, count]} castShadow receiveShadow>
        <boxGeometry args={[6.66, 0.42, 5.44]} />
        <meshStandardMaterial />
      </instancedMesh>
      {/* glass：底层玻璃幕墙 —— 白天降到 0.55：焦点机位前多层玻璃叠加会淹没 HR（盲审 B 短板 #1）
          夜间保持 1.0（夜景靠这张反射室内暖光） */}
      <instancedMesh ref={glassRef} args={[undefined, undefined, count]}>
        <planeGeometry args={[5.8, 2.1]} />
        <meshBasicMaterial transparent opacity={night ? 1 : 0.55} toneMapped={!night} />
      </instancedMesh>
      {/* led：门楣 LED */}
      <instancedMesh ref={ledRef} args={[undefined, undefined, count]}>
        <boxGeometry args={[2.9, 0.42, 0.1]} />
        <meshStandardMaterial vertexColors emissiveIntensity={0.85} />
      </instancedMesh>
    </group>
  )
}
