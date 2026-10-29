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
import { useLayoutEffect, useRef } from 'react'
import * as THREE from 'three'
import type { LotPlacement } from '../../data/street-companies'
import { INDUSTRIES } from '../../data/street-companies'
import { facadeTexture, glassTexture } from './HRStand'
import {
  ColorSceneGateDark,
  ThemeLightGlassHead,
  TwinFacadeMetalnessDay,
  TwinFacadeRoughnessDay,
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
  return roofMatrixFor(pl, localX, localY, DOOR_OFFSET_Z + localZ, sx, sy, sz)
}

/** 屋面元素的世界 matrix：以楼体中心为原点（无门面偏置） */
function roofMatrixFor(
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
  const wx = pl.position[0] + localX * c - localZ * s
  const wy = localY
  const wz = pl.position[2] + localX * s + localZ * c

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

// 岗位海报贴图（决策纸④ · v2 背板版）：横幅灰阶线稿（标题带/职责行/薪资 chip）——
// instanceColor 行业色染色后成为「公司背板」。basic 材质自发光，夜间读作发光屏。
// 挂在摊位后玻璃墙（HR 身后）——特写帧里天然成为展位背景（展会摊位语汇），
// 同时填掉 R11 点名的「左 1/3 灰死墙」。模块级单例。
let POSTER_TEX: THREE.CanvasTexture | null = null
export function posterTexture() {
  if (POSTER_TEX) return POSTER_TEX
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 256
  const ctx = c.getContext('2d')!
  // 深底屏幕风：instanceColor 行业色 × 深底 = 深色发光屏；白线=可读文字。
  // （浅底贴图被身后玻璃 0.42 透明混合洗白，v1-v4 四轮不可见的根因）
  ctx.fillStyle = '#141b24'
  ctx.fillRect(0, 0, 512, 256)
  // 顶部标题带（染色后呈行业色亮带）
  ctx.fillStyle = '#e6edf3'
  ctx.fillRect(28, 26, 200, 16)
  ctx.fillStyle = 'rgba(230,237,243,0.55)'
  ctx.fillRect(28, 52, 120, 8)
  // 职责行
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = 'rgba(230,237,243,0.45)'
    ctx.fillRect(28, 84 + i * 30, 380 - (i % 2) * 90, 10)
  }
  // 薪资 chip（右下亮块）
  ctx.fillStyle = '#e6edf3'
  ctx.fillRect(340, 176, 140, 48)
  ctx.fillStyle = '#141b24'
  ctx.fillRect(358, 194, 104, 12)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  POSTER_TEX = t
  return t
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
  const ridgeRef = useRef<THREE.InstancedMesh>(null)
  const nightRidgeRef = useRef<THREE.InstancedMesh>(null)
  const skylightRef = useRef<THREE.InstancedMesh>(null)
  const glassRef = useRef<THREE.InstancedMesh>(null)
  const ledRef = useRef<THREE.InstancedMesh>(null)
  const posterRef = useRef<THREE.InstancedMesh>(null)
  const storefrontRef = useRef<THREE.InstancedMesh>(null)

  const countRef = useRef(0)

  // ---------- 初始化 count ----------
  // useLayoutEffect：useEffect 首帧不跑会留下 64 实例未就位/叠原点窗口（同 BoothHardwareInstanced 注释）
  useLayoutEffect(() => {
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
  useLayoutEffect(() => {
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
    // 屋顶配方 v2（决策纸②）：日间不再「lerp 向白 40%」（洗白把色相拉向同一粉彩均值，
    // 四区色距被压缩——R8「米色/橙红难辨」根因），改 offsetHSL 压饱和+压明度：
    // 深色域里四区色相自然分开，且大面不再是高明度平涂。夜间配方不动（R7 已验收）。
    const capMesh = capRef.current
    if (capMesh) {
      const roofColors: THREE.Color[] = []
      placements.forEach((pl, li) => {
        const bHeight =
          pl.lot.industry === 'internet' ? 8 : pl.lot.industry === 'finance' ? 11.5 : pl.lot.industry === 'manufacturing' ? 4.6 : 4.2
        capMesh.setMatrixAt(li, roofMatrixFor(pl, 0, bHeight + 0.1, 0, 1, 1, 1))
        const industryColor = new THREE.Color(INDUSTRIES[pl.lot.industry].color)
        const headColor = envNight
          ? industryColor.clone().lerp(new THREE.Color(ThemeLightGlassHead), 0.26)
          : industryColor.clone().offsetHSL(0, -0.08, -0.1)
        roofColors.push(headColor)
        capMesh.setColorAt(li, headColor)
      })
      capMesh.instanceMatrix.needsUpdate = true
      capMesh.instanceColor!.needsUpdate = true
      // 屋顶母题套件（决策纸②）：脊线=屋顶色提亮一档，天窗/设备箱=压暗一档，
      // 让近半画面的屋顶从「纯色平涂」变成有微表面的面。矩阵始终写入（防夜间实例堆原点），
      // 夜间由 visible=false 隐藏（夜间屋顶近黑，母题无意义）。
      const ridgeMesh = ridgeRef.current
      const nightRidgeMesh = nightRidgeRef.current
      const skyMesh = skylightRef.current
      if (ridgeMesh && skyMesh) {
        placements.forEach((pl, li) => {
          const bHeight =
            pl.lot.industry === 'internet' ? 8 : pl.lot.industry === 'finance' ? 11.5 : pl.lot.industry === 'manufacturing' ? 4.6 : 4.2
          const roof = roofColors[li]
          const ridgeY = bHeight + 0.31 + 0.07
          ridgeMesh.setMatrixAt(li, roofMatrixFor(pl, 0, ridgeY, 0, 6.3, 0.14, 0.42))
          ridgeMesh.setColorAt(li, roof.clone().offsetHSL(0, -0.04, 0.07))
          // 夜间屋脊微光（决策纸③）：basic 材质 + 行业色压暗 = 建筑描边层，
          // 夜鸟瞰四区色相可辨（R10 空间评审）+ 暗部有内容（R10 视觉评审）
          if (nightRidgeMesh) {
            nightRidgeMesh.setMatrixAt(li, roofMatrixFor(pl, 0, ridgeY, 0, 6.3, 0.14, 0.42))
            nightRidgeMesh.setColorAt(li, new THREE.Color(INDUSTRIES[pl.lot.industry].color).offsetHSL(0, 0.08, -0.22))
          }
          ;[-1.7, 1.7].forEach((lx, k) => {
            const idx = li * 2 + k
            skyMesh.setMatrixAt(idx, roofMatrixFor(pl, lx, bHeight + 0.31 + 0.09, (k === 0 ? -1 : 1) * 0.9, 1.2, 0.2, 1.5))
            skyMesh.setColorAt(idx, roof.clone().offsetHSL(0, -0.05, -0.07))
          })
        })
        ridgeMesh.instanceMatrix.needsUpdate = true
        if (ridgeMesh.instanceColor) ridgeMesh.instanceColor.needsUpdate = true
        skyMesh.instanceMatrix.needsUpdate = true
        if (skyMesh.instanceColor) skyMesh.instanceColor.needsUpdate = true
        if (nightRidgeMesh) {
          nightRidgeMesh.instanceMatrix.needsUpdate = true
          if (nightRidgeMesh.instanceColor) nightRidgeMesh.instanceColor.needsUpdate = true
        }
      }

      // 公司背板（决策纸④ v2）：摊位后玻璃墙整面横幅（HR 身后），行业色染色；
      // basic 自发光——白天是背板、夜间是发光屏。特写帧填掉左 1/3 灰死墙 +
      // 「这家人做什么的」的视觉答案（R11 双评审 #1）
      const posterMesh = posterRef.current
      if (posterMesh) {
        const tex = posterTexture()
        const mat = posterMesh.material as THREE.MeshBasicMaterial
        if (mat.map !== tex) mat.map = tex
        mat.needsUpdate = true
        placements.forEach((pl, li) => {
          const industryColor = new THREE.Color(INDUSTRIES[pl.lot.industry].color)
          // 深底贴图 × 行业色提亮 = 发光屏（玻璃混合洗白 42% 后仍可读）
          const tint = industryColor.clone().lerp(new THREE.Color('#f2f5f8'), 0.55)
          posterMesh.setMatrixAt(li, instanceMatrixFor(pl, 0.3, 1.42, 2.72, 3.4, 1.7, 1))
          posterMesh.setColorAt(li, tint)
        })
        posterMesh.instanceMatrix.needsUpdate = true
        if (posterMesh.instanceColor) posterMesh.instanceColor.needsUpdate = true
      }

      // 沿街商店发光边（决策纸⑤，仅夜间）：建筑底脚一条行业色发光带——
      // 夜鸟瞰的「沿街自发光信息层」（R9-R12 四轮共同失分位：橙/紫区成片纯黑）。
      // 与屋顶夜脊微光上下呼应成建筑描边双线。矩阵始终写入，夜间由 visible 控制。
      const sfMesh = storefrontRef.current
      if (sfMesh) {
        placements.forEach((pl, li) => {
          // 建筑前脸（建筑中心 localZ=-3.6、深 5.2 → 前脸 localZ=-1.0），发光边贴脸外 0.02
          sfMesh.setMatrixAt(li, roofMatrixFor(pl, 0, 0.32, -0.98, 6.4, 0.16, 0.05))
          sfMesh.setColorAt(
            li,
            new THREE.Color(INDUSTRIES[pl.lot.industry].color).multiplyScalar(0.8)
          )
        })
        sfMesh.instanceMatrix.needsUpdate = true
        if (sfMesh.instanceColor) sfMesh.instanceColor.needsUpdate = true
      }
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
            roughness={night ? 0.85 : TwinFacadeRoughnessDay}
            metalness={night ? 0 : TwinFacadeMetalnessDay}
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
      {/* 屋顶母题：脊线（1 DC）+ 天窗/设备箱（1 DC）。仅昼间挂载（夜间隐藏不卸载，矩阵始终有效）。
          instanceColor 染色；勿加 vertexColors（T14） */}
      <instancedMesh ref={ridgeRef} args={[undefined, undefined, count]} visible={!night}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.55} />
      </instancedMesh>
      {/* 夜间屋脊微光：basic 材质 + 行业色 instanceColor（1 DC，仅夜间）。
          basic 的输出=色×instanceColor，不受光照——正好做「LED 描边」语汇 */}
      <instancedMesh ref={nightRidgeRef} args={[undefined, undefined, count]} visible={night}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial />
      </instancedMesh>
      <instancedMesh ref={skylightRef} args={[undefined, undefined, count * 2]} visible={!night}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.3} metalness={0.15} />
      </instancedMesh>
      {/* glass：底层玻璃幕墙 —— 三层配方：白天低透明蓝灰（大堂退暗）＋夜间不透明暗玻璃（暖窗显出）。
          夜间不再隐藏：白幕真凶是无贴图白方块阴影面（已修），暗玻璃走 ACES 后不再过曝，
          且能托住雨棚立柱不悬浮（盲审 R5 短板②） */}
      <instancedMesh ref={glassRef} args={[undefined, undefined, count]}>
        <planeGeometry args={[5.8, 2.1]} />
        <meshBasicMaterial
          transparent
          opacity={night ? 1 : 0.42}
          color={night ? '#ffffff' : '#c2d3e0'}
          toneMapped
        />
      </instancedMesh>
      {/* led：门楣 LED。⚠ 勿加 vertexColors：BoxGeometry 无 color 顶点属性，USE_COLOR 乘
          未绑定 attribute = 纯黑（T14 同配方，R9 前该 LED 实际渲染成黑条、被评审批
          「悬空黑胶带」；instanceColor 单独生效即可染色） */}
      <instancedMesh ref={ledRef} args={[undefined, undefined, count]}>
        <boxGeometry args={[2.9, 0.42, 0.1]} />
        <meshStandardMaterial emissiveIntensity={0.85} />
      </instancedMesh>
      {/* 公司背板：摊位后玻璃墙 1 面/摊（1 DC，64 实例）。basic 自发光=夜间发光屏 */}
      <instancedMesh ref={posterRef} args={[undefined, undefined, count]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      {/* 沿街商店发光边（决策纸⑤，仅夜间 1 DC）：建筑底脚行业色灯带 */}
      <instancedMesh ref={storefrontRef} args={[undefined, undefined, count]} visible={night}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial />
      </instancedMesh>
    </group>
  )
}
