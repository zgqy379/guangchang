// HR 摊位三件套：①真 3D 形象（批量生成 8 款池，近景 LOD 切换）②参数具象化悬浮
//（钱袋层数∝总包 / 五险切口牌 / 头顶日月）③身后办公空间门面（点击进 3DGS）
import { Suspense, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useAnimations, useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import type { Lot } from '../../data/street-companies'
import { INDUSTRIES } from '../../data/street-companies'
import { assetUrl } from '../../engine/asset'
import {
  ColorSceneBillOrange,
  ColorSceneBillRed,
  ColorSceneFloor,
  ColorSceneGate,
  ColorSceneWindow,
  ColorStateInfo,
  ColorStateSuccess,
  ThemeLightGlassBody,
  TwinContactOpacityDay,
} from '../../../generated/design-tokens.output.mjs'
import type { ThemeName } from '../../engine/theme'

const DRACO_PATH = assetUrl('/draco/')
const HR_POOL = [
  'hr-f01', 'hr-f02', 'hr-f03', 'hr-f04', 'hr-f05',
  'hr-m01', 'hr-m02', 'hr-m03', 'hr-m04',
]
const NEAR = 26 // 真 HR GLB 自带 idle clip 为 T-pose；近景改用玩家 Avatar 的 idle clip（同 52 根 Mixamo 骨）
const FAR = 34

// 落地漫游（follow）时的 HR GLB 预热。
// 必须**分批**：follow 首次触发若一次性并发拉 9 个 HR GLB（≈16MB），会瞬间占满带宽
// 并挤压主线程，反而拖慢近景首个人形出现。策略：
//   ① 玩家 idle clip（所有 RealHR 共用、近景真 HR 渲染的前置）立即拉
//   ② HR 池分 2 个一批、每批错开 600ms 陆续拉 → 保持 roam 顺滑
// 幂等：follow 可能反复切换，模块级标记保证批调度只注册一次（useGLTF.preload 自身也有缓存）
let hrPreloadScheduled = false
export function preloadHRModels() {
  useGLTF.preload(assetUrl('/assets/avatar/avatar-idle.glb'), DRACO_PATH)
  if (hrPreloadScheduled) return
  hrPreloadScheduled = true
  const BATCH = 2
  const STEP_MS = 600
  HR_POOL.forEach((f, i) => {
    const delay = Math.floor(i / BATCH) * STEP_MS
    window.setTimeout(() => {
      useGLTF.preload(assetUrl(`/assets/hr/${f}-idle.glb`), DRACO_PATH)
    }, delay)
  })
}

/**
 * 玻璃孪生体的**边缘光（rim light）**：在标准材质的自发光项上叠加一个 Fresnel 项。
 *
 * 为什么必须手写而不是用现成材质：
 *   孪生风的关键是"半透明体块在浅色背景上也要读出轮廓"。纯漫反射的玻璃体在
 *   冷白天幕前会和背景糊成一片（这正是盲审说的"摊位同构 / 读不出体积"）。
 *   Fresnel 项让视角越掠（轮廓）越亮 —— 这正是玻璃/全息语汇的边缘辉光。
 *
 * 实现走 onBeforeCompile：只加几条 ALU，**不增加 draw call、不增加后处理通道**。
 */
// 占位 HR 的西装色池（按 hrIndex 分配，避免 64 个摊位同色）
export const OUTFITS = ['#3d4c63', '#4a3b52', '#2f4a45', '#5a4038', '#33465e', '#4a4230', '#3b3b46', '#533a44', '#304c58']
export const HAIRS = ['#1b1b22', '#2a1d18', '#20262f', '#3a2a22', '#151a20']

// 办公楼立面：程序化窗格（同一楼层数 + 同一模式共享纹理，避免 64 份贴图）
// v4 玻璃数字孪生：mode='day' 画浅色玻璃幕墙（冷白底 + 淡青玻璃 + 结构线框）
//                mode='night' 画原夜景（深蓝底 + 暖色亮窗）
const FACADE_TEX = new Map<string, THREE.CanvasTexture>()

export function facadeTexture(floors: number, mode: 'day' | 'night' = 'night') {
  const key = `${floors}:${mode}`
  const cached = FACADE_TEX.get(key)
  if (cached) return cached
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 512
  const ctx = c.getContext('2d')!
  const day = mode === 'day'

  const bg = ctx.createLinearGradient(0, 0, 0, 512)
  if (day) {
    // 白天：冷白玻璃底（⑥：底色微提亮，与加深的窗格拉开对比——白盒楼远读出窗格节奏）
    bg.addColorStop(0, '#dcebf5')
    bg.addColorStop(1, '#c3d5e4')
  } else {
    bg.addColorStop(0, '#1e2a38')
    bg.addColorStop(1, '#131c28')
  }
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, 512, 512)

  const cols = 6
  const fh = 512 / floors
  const cw = 512 / cols
  for (let f = 0; f < floors; f++) {
    if (day) {
      // 楼层分隔：深色结构线（线框感）
      ctx.fillStyle = '#6f8ba1'
      ctx.fillRect(0, f * fh, 512, 2)
      ctx.fillStyle = 'rgba(255,255,255,0.55)'
      ctx.fillRect(0, f * fh + 2, 512, 1)
    } else {
      ctx.fillStyle = '#090e14'
      ctx.fillRect(0, f * fh, 512, 2)
      ctx.fillStyle = '#2b3745'
      ctx.fillRect(0, f * fh + 2, 512, 1)
    }
    for (let col = 0; col < cols; col++) {
      const x = col * cw + cw * 0.17
      const y = f * fh + fh * 0.24
      const w = cw * 0.66
      const h = fh * 0.48
      if (day) {
        // 白天：加深两档的玻璃块（⑥：远距离窗格对比）+ 深窗框
        ctx.fillStyle = '#5e82a0'
        ctx.fillRect(x - 2, y - 2, w + 4, h + 4)
        const glass = ctx.createLinearGradient(x, y, x, y + h)
        glass.addColorStop(0, '#a9c9e2')
        glass.addColorStop(0.55, '#7ba6c8')
        glass.addColorStop(1, '#6d94b4')
        ctx.fillStyle = glass
        ctx.fillRect(x, y, w, h)
        // 斜向高光条：玻璃反光的标识
        ctx.fillStyle = 'rgba(255,255,255,0.4)'
        ctx.fillRect(x + w * 0.08, y + h * 0.06, w * 0.16, h * 0.88)
      } else {
        ctx.fillStyle = '#080c11'
        ctx.fillRect(x - 2, y - 2, w + 4, h + 4)
        const lit = Math.random() < 0.64
        if (lit) {
          const warm = Math.random() < 0.6
          const bright = Math.random() < 0.3 // 两档窗色：少量全亮锚点窗拉开层次（夜景 v2）
          const glass = ctx.createLinearGradient(x, y, x, y + h)
          if (bright) {
            glass.addColorStop(0, warm ? '#ffe9b8' : '#d8ecf8')
            glass.addColorStop(1, warm ? '#c08a45' : '#7fa0bd')
          } else {
            glass.addColorStop(0, warm ? '#d9bd8a' : '#a8c4d6')
            glass.addColorStop(1, warm ? '#7c5a32' : '#5d7d97')
          }
          ctx.fillStyle = glass
          ctx.fillRect(x, y, w, h)
          ctx.fillStyle = 'rgba(255,255,255,0.16)'
          ctx.fillRect(x + w * 0.1, y + h * 0.08, w * 0.14, h * 0.84)
        } else {
          ctx.fillStyle = Math.random() < 0.5 ? '#16222e' : '#1d2c3b'
          ctx.fillRect(x, y, w, h)
        }
      }
    }
  }
  for (let col = 1; col < cols; col++) {
    // 竖梃：白天为深色结构柱，夜间为暗色
    ctx.fillStyle = day ? 'rgba(70,98,124,0.8)' : 'rgba(6,10,14,0.6)'
    ctx.fillRect(col * cw - 2, 0, 4, 512)
  }
  // 底部环境光遮蔽（AO）：贴图烘焙，不花任何 draw call 就让体块"落地"
  const ao = ctx.createLinearGradient(0, 512, 0, 512 * 0.62)
  ao.addColorStop(0, day ? 'rgba(18,32,48,0.55)' : 'rgba(0,0,0,0.55)')
  ao.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = ao
  ctx.fillRect(0, 512 * 0.62, 512, 512 * 0.38)
  const tex = new THREE.CanvasTexture(c)
  tex.anisotropy = 4
  FACADE_TEX.set(key, tex)
  return tex
}

// 底层玻璃幕墙：夜间=深蓝反射室内暖光；白天=浅色玻璃反射天空
let GLASS_TEX: THREE.CanvasTexture | null = null
let GLASS_TEX_DAY: THREE.CanvasTexture | null = null
export function glassTexture(mode: 'day' | 'night' = 'night') {
  if (mode === 'day') {
    if (GLASS_TEX_DAY) return GLASS_TEX_DAY
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 96
    const ctx = c.getContext('2d')!
    // 白天：玻璃反射天空（浅蓝渐变）
    const g = ctx.createLinearGradient(0, 0, 0, 96)
    g.addColorStop(0, '#a9c9e4')
    g.addColorStop(0.5, '#86aecd')
    g.addColorStop(1, '#7298ba')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 256, 96)
    // 室内工位（白天是暗色剪影，透过玻璃可见）
    for (let i = 0; i < 5; i++) {
      const x = 14 + i * 48
      ctx.fillStyle = 'rgba(70,95,118,0.28)'
      ctx.fillRect(x, 46, 26, 10)
      ctx.fillStyle = 'rgba(90,115,138,0.16)'
      ctx.fillRect(x, 30, 26, 14)
    }
    // 斜向天光反射（玻璃感的关键）
    ctx.strokeStyle = 'rgba(255,255,255,0.30)'
    ctx.lineWidth = 12
    for (let i = 0; i < 4; i++) {
      ctx.beginPath()
      ctx.moveTo(-20 + i * 70, 96)
      ctx.lineTo(40 + i * 70, 0)
      ctx.stroke()
    }
    // 竖梃 + 横梁（深色结构，勾出玻璃分格）
    ctx.fillStyle = 'rgba(60,86,110,0.85)'
    for (let i = 1; i < 4; i++) ctx.fillRect(i * 64 - 2, 0, 4, 96)
    ctx.fillRect(0, 44, 256, 3)
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    GLASS_TEX_DAY = tex
    return tex
  }
  if (GLASS_TEX) return GLASS_TEX
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 96
  const ctx = c.getContext('2d')!
  const g = ctx.createLinearGradient(0, 0, 0, 96)
  g.addColorStop(0, '#1d4260')
  g.addColorStop(0.55, '#102b42')
  g.addColorStop(1, '#0a1a28')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 256, 96)
  // 室内暖光/工位
  for (let i = 0; i < 5; i++) {
    const x = 14 + i * 48
    ctx.fillStyle = i % 2 === 0 ? 'rgba(240,200,130,0.5)' : 'rgba(150,200,235,0.28)'
    ctx.fillRect(x, 46, 26, 10)
    ctx.fillStyle = 'rgba(255,224,170,0.18)'
    ctx.fillRect(x, 30, 26, 14)
  }
  // 斜向反射
  ctx.strokeStyle = 'rgba(210,235,255,0.10)'
  ctx.lineWidth = 10
  for (let i = 0; i < 4; i++) {
    ctx.beginPath()
    ctx.moveTo(-20 + i * 70, 96)
    ctx.lineTo(40 + i * 70, 0)
    ctx.stroke()
  }
  // 竖梃 + 横梁
  ctx.fillStyle = 'rgba(5,12,18,0.85)'
  for (let i = 1; i < 4; i++) ctx.fillRect(i * 64 - 2, 0, 4, 96)
  ctx.fillRect(0, 44, 256, 3)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  GLASS_TEX = tex
  return tex
}

// 接触阴影 / 窗光外溢 / 已投递标（共享贴图）
let SHADOW_TEX: THREE.CanvasTexture | null = null
export function shadowTexture() {
  if (SHADOW_TEX) return SHADOW_TEX
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64)
  g.addColorStop(0, 'rgba(0,0,0,0.62)')
  g.addColorStop(0.55, 'rgba(0,0,0,0.34)')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  SHADOW_TEX = new THREE.CanvasTexture(c)
  return SHADOW_TEX
}

let SPILL_TEX: THREE.CanvasTexture | null = null
export function spillTexture() {
  if (SPILL_TEX) return SPILL_TEX
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 128
  const ctx = c.getContext('2d')!
  const g = ctx.createLinearGradient(0, 0, 0, 128)
  g.addColorStop(0, 'rgba(255,190,120,0.55)')
  g.addColorStop(0.5, 'rgba(255,170,100,0.16)')
  g.addColorStop(1, 'rgba(255,160,90,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  SPILL_TEX = new THREE.CanvasTexture(c)
  return SPILL_TEX
}

let DELIVERED_TEX: THREE.CanvasTexture | null = null
export function deliveredTexture() {
  if (DELIVERED_TEX) return DELIVERED_TEX
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 64
  const ctx = c.getContext('2d')!
  ctx.fillStyle = 'rgba(10,22,16,0.92)'
  ctx.beginPath()
  ctx.roundRect(2, 2, 252, 60, 10)
  ctx.fill()
  ctx.strokeStyle = ColorStateSuccess
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.fillStyle = ColorStateSuccess
  ctx.font = '600 26px "Microsoft YaHei", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('✓ 已投递', 128, 34)
  DELIVERED_TEX = new THREE.CanvasTexture(c)
  return DELIVERED_TEX
}

// 钱捆贴图：扎带 + ¥ 压印（共享纹理，不增加 draw call）
export function cashTexture(base: string, dark: string) {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 64
  const ctx = c.getContext('2d')!
  ctx.fillStyle = base
  ctx.fillRect(0, 0, 256, 64)
  ctx.strokeStyle = dark
  ctx.lineWidth = 4
  ctx.strokeRect(3, 3, 250, 58)
  // 中央扎带
  ctx.fillStyle = dark
  ctx.fillRect(122, 0, 12, 64)
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.fillRect(123, 20, 10, 2)
  ctx.fillRect(123, 42, 10, 2)
  // ¥ 与面额
  ctx.fillStyle = '#f6e7d0'
  ctx.font = '700 30px "Microsoft YaHei", sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('¥', 62, 42)
  ctx.font = '700 16px "Microsoft YaHei", sans-serif'
  ctx.fillText('100', 196, 38)
  ctx.font = '600 10px sans-serif'
  ctx.fillText('逛厂币', 196, 52)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}
const CASH_TEX = {
  base: cashTexture(ColorSceneBillRed, '#7d1f14'),
  inc: cashTexture(ColorSceneBillOrange, '#8a5312'),
}
/** 钱捆贴图对（供 BoothProps 的 InstancedMesh 复用，避免每个摊位各画 2–7 个 mesh） */
export const CASH_TEXTURES = CASH_TEX

// 真 HR 形象：HR GLB 负责外观，动画借用玩家 Avatar 的 idle（HR 自带 clip 是 T-pose，2026-10-26 隔离验证）
function RealHR({ hrIndex }: { hrIndex: number }) {
  const file = HR_POOL[hrIndex % HR_POOL.length]
  const { scene } = useGLTF(assetUrl(`/assets/hr/${file}-idle.glb`), DRACO_PATH)
  // 同一套 52 根 Mixamo 骨：玩家的 idle clip 可以直接驱动 HR
  const { animations: avatarAnims } = useGLTF(assetUrl('/assets/avatar/avatar-idle.glb'), DRACO_PATH)
  const ref = useRef<THREE.Group>(null)
  const { actions } = useAnimations(avatarAnims, ref)
  const clone = useMemo(() => {
    const c = skeletonClone(scene)
    c.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      mesh.frustumCulled = false
      // 夜色里深色材质会糊成黑块：给一点自发光抬暗部
      if (mesh.material) {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        const lifted = mats.map((m) => {
          const mat = m.clone() as THREE.MeshStandardMaterial
          if (mat.emissive) {
            // 夜色暗部抬光：用「场景暗面」令牌（不再写死 #1b2635）
            mat.emissive.set(ColorSceneFloor)
            mat.emissiveIntensity = 0.4
          }
          return mat
        })
        mesh.material = Array.isArray(mesh.material) ? lifted : lifted[0]
      }
    })
    return c
  }, [scene])

  useLayoutEffect(() => {
    const g = ref.current
    if (!g) return
    const box = new THREE.Box3().setFromObject(g)
    const size = box.getSize(new THREE.Vector3())
    const s = 1.6 / (size.y || 1)
    g.scale.setScalar(s)
    g.position.y = -box.min.y * s
    const clip = Object.keys(actions)[0]
    actions[clip]?.reset().fadeIn(0.3).play()
    return () => {
      actions[clip]?.stop()
    }
  }, [actions, clone])

  return (
    <group ref={ref} dispose={null}>
      <primitive object={clone} />
    </group>
  )
}

// 占位形象（远景/加载中/真 GLB 未修好前）：已迁至 PlaceholderHRs.tsx（InstancedMesh 池，M6a）。
// 原 PlaceholderHR 每个摊位 11 个独立 mesh（64 摊位 = 704 draw call），现合并为 5 个 InstancedMesh（5 draw call）。
// 本文件不再直接渲染 PlaceholderHR；远景由 StreetScene 中的 <PlaceholderHRs /> 统一绘制。

// 孪生体玻璃材质缓存：同一 (楼层数, 主题) 共用一个材质实例
// 公司名牌：CanvasTexture 精灵（无 DOM，64 个摊位也便宜）
// v4.1 美术攻关：加**编号角标** —— 盲审指出"远看分不出是哪家"，
// 编号是唯一在鸟瞰距离也能读出的个体线索（名字在那个距离根本看不清）。
function useNameTexture(name: string, industry: string, lotNo: number) {
  return useMemo(() => {
    const W = 320
    const H = 72
    const c = document.createElement('canvas')
    c.width = W
    c.height = H
    const ctx = c.getContext('2d')!
    const accent = INDUSTRIES[industry as keyof typeof INDUSTRIES]?.color ?? '#30363d'
    ctx.fillStyle = 'rgba(13,17,23,0.9)'
    ctx.beginPath()
    ctx.roundRect(2, 2, W - 4, H - 4, 10)
    ctx.fill()
    ctx.strokeStyle = accent
    ctx.lineWidth = 2
    ctx.stroke()
    // 编号角标：行业色底 + 深色数字（保证远距离仍能分辨"第几家"）
    const badge = 54
    ctx.fillStyle = accent
    ctx.beginPath()
    ctx.roundRect(10, 9, badge, H - 18, 8)
    ctx.fill()
    ctx.fillStyle = '#0b0e1a'
    ctx.font = '800 32px "Segoe UI", Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(lotNo).padStart(2, '0'), 10 + badge / 2, H / 2 + 1)
    // 公司名
    ctx.fillStyle = '#e6edf3'
    ctx.font = '600 27px "Microsoft YaHei", sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(name.slice(0, 7), 10 + badge + 12, H / 2 + 1)
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 4
    return tex
  }, [name, industry, lotNo])
}

export function HRStand({ lot, onEnterOffice, delivered = false, theme = 'dark' }: { lot: Lot; onEnterOffice: (lot: Lot) => void; delivered?: boolean; theme?: ThemeName }) {
  const nameTex = useNameTexture(lot.name, lot.industry, lot.lotNo)
  const color = INDUSTRIES[lot.industry].color
  // 参数时间语义：这家公司几点下班（与环境主题无关）
  const envNight = theme === 'dark'

  // 建筑高度：互联网平顶 / 金融尖顶 / 智造矮厂棚 / 文创坡顶
  const bHeight =
    lot.industry === 'internet' ? 8 : lot.industry === 'finance' ? 11.5 : lot.industry === 'manufacturing' ? 4.6 : 4.2
  // 门面主体（body/cap/glass/led）已移至 OfficeFacadeInstanced（M6b InstancedMesh 池），此处不再渲染

  // 就近 LOD：NEAR 内挂真形象，FAR 外卸载（滞回防抖）；GLB 按需加载（Suspense 回退占位）
  const [near, setNear] = useState(false)
  const cool = useRef(0)
  const rootRef = useRef<THREE.Group>(null)
  const tmp = useMemo(() => new THREE.Vector3(), [])
  useFrame((state, dt) => {
    cool.current -= dt
    if (cool.current > 0) return
    cool.current = 0.4
    if (!rootRef.current) return
    rootRef.current.getWorldPosition(tmp)
    const d = state.camera.position.distanceTo(tmp)
    setNear((prev) => (prev ? d < FAR : d < NEAR))
  })

  return (
    <group ref={rootRef}>
      {/* 摊位台/阴影/雨棚/侧招/参数具象化/门前细节 已移至 BoothHardwareInstanced（M6c） */}
      {delivered && (
        <group position={[0, 3.12, 0]}>
          <sprite scale={[1.02, 0.26, 1]}>
            <spriteMaterial map={deliveredTexture()} transparent depthTest={false} />
          </sprite>
          <mesh position={[0, -0.2, 0]}>
            <sphereGeometry args={[0.06, 8, 8]} />
            <meshBasicMaterial color={ColorStateSuccess} />
          </mesh>
        </group>
      )}
      {/* HR 形象（near 时真 GLB；远景占位由 PlaceholderHRs InstancedMesh 池统一绘制，M6a） */}
      <group position={[0, 0.14, 0]}>
        {near ? (
          <>
            {/* 夜间 HR 补光：暖色主光（盲审 R7：HR 面部无补光/轮廓光，关键时刻没有自己的光效语言） */}
            <pointLight position={[0, 2.5, 1.6]} intensity={envNight ? 5 : 0} distance={5.5} decay={2} color="#ffd9a0" />
            <Suspense fallback={null}>
              <RealHR hrIndex={lot.hrIndex} />
            </Suspense>
          </>
        ) : null}
      </group>
      {/* 名牌 */}
      <sprite position={[0, 2.72, 0]} scale={[1.72, 0.39, 1]}>
        <spriteMaterial map={nameTex} transparent />
      </sprite>
      {/* 办公空间门面：行业差异化天际线（盲审修复）+ 门楣 LED + 玻璃幕墙 */}
      <group position={[0, 0, -3.6]}>
        {(() => {
          const h = bHeight
          return (
            <>
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
                <planeGeometry args={[7.8, 6.6]} />
                <meshBasicMaterial
                  map={shadowTexture()}
                  transparent
                  opacity={envNight ? 0.95 : TwinContactOpacityDay}
                  depthWrite={false}
                />
              </mesh>
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.018, 2.9]}>
                <planeGeometry args={[5.4, 2.8]} />
                <meshBasicMaterial
                  map={spillTexture()}
                  transparent
                  /* 夜间降档：加法混合窗光 0.5 常开会与 LED/棚光环叠加成白雾淹没 HR（盲审 R3 短板①） */
                  opacity={envNight ? 0.22 : 0.5}
                  depthWrite={false}
                  blending={THREE.AdditiveBlending}
                />
              </mesh>
              {/* 玻璃体块、实体头、轮廓线、幕墙、门楣 LED 已移至 OfficeFacadeInstanced（M6b） */}
              {/* 楼层灯带、屋顶、门继续在此渲染 */}
              {h > 6 &&
                [3.6, 5.2, 6.8, 8.4].filter((y) => y < h - 0.6).map((y) => (
                  <mesh key={y} position={[0, y, 2.74]}>
                    <planeGeometry args={[6.1, 0.09]} />
                    <meshBasicMaterial color={envNight ? ColorSceneWindow : "#8fa3b4"} />
                  </mesh>
                ))}
              {/* 屋顶：互联网平顶广告牌 / 金融尖顶 / 智造水塔 / 文创坡顶 */}
              {lot.industry === 'internet' && (
                <mesh position={[0, h + 0.6, 0]}>
                  <boxGeometry args={[3.6, 1.1, 0.3]} />
                  <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.7} />
                </mesh>
              )}
              {lot.industry === 'finance' && (
                <mesh position={[0, h + 1.2, 0]}>
                  <coneGeometry args={[1.1, 2.4, 4]} />
                  <meshStandardMaterial color={envNight ? ColorSceneGate : ThemeLightGlassBody} metalness={0.5} roughness={0.35} />
                </mesh>
              )}
              {lot.industry === 'manufacturing' && (
                <group position={[2.1, h + 0.9, 0.9]}>
                  <mesh position={[0, 0.5, 0]}>
                    <cylinderGeometry args={[0.55, 0.62, 1.8, 10]} />
                    <meshStandardMaterial color={envNight ? ColorSceneGate : ThemeLightGlassBody} roughness={0.85} />
                  </mesh>
                  <mesh position={[0, 1.5, 0]}>
                    <sphereGeometry args={[0.55, 12, 10]} />
                    <meshStandardMaterial color={envNight ? ColorSceneGate : ThemeLightGlassBody} roughness={0.85} />
                  </mesh>
                </group>
              )}
              {lot.industry === 'culture' && (
                <mesh position={[0, h + 0.5, 0]} rotation={[0, Math.PI / 4, 0]}>
                  <coneGeometry args={[4.6, 1.1, 4]} />
                  <meshStandardMaterial color={envNight ? "#5a3a3a" : "#9fb0c0"} roughness={0.9} />
                </mesh>
              )}
            </>
          )
        })()}
        <mesh position={[0, 1.05, 2.82]}>
          <planeGeometry args={[1.1, 2.1]} />
          {/* 浅色主题下深藏青门会读成"黑洞"，改成受光的中调玻璃门 */}
          <meshStandardMaterial
            color={envNight ? '#0a1a28' : '#7f92a4'}
            roughness={envNight ? 0.85 : 0.28}
            metalness={envNight ? 0 : 0.18}
          />
        </mesh>
        <mesh position={[0.4, 1.0, 2.84]}>
          <boxGeometry args={[0.035, 0.5, 0.03]} />
          <meshBasicMaterial color={envNight ? ColorSceneWindow : "#8fa3b4"} />
        </mesh>
        <mesh
          position={[0, 2.35, 2.86]}
          onClick={(e) => {
            e.stopPropagation()
            onEnterOffice(lot)
          }}
          onPointerOver={() => (document.body.style.cursor = 'pointer')}
          onPointerOut={() => (document.body.style.cursor = 'default')}
        >
          <planeGeometry args={[1.6, 0.42]} />
          <meshBasicMaterial color={ColorStateInfo} transparent opacity={0.92} />
        </mesh>
      </group>
    </group>
  )
}
