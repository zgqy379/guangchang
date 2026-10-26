// HR 摊位三件套：①真 3D 形象（批量生成 8 款池，近景 LOD 切换）②参数具象化悬浮
//（钱袋层数∝总包 / 五险切口牌 / 头顶日月）③身后办公空间门面（点击进 3DGS）
import { Suspense, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useAnimations, useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import type { Lot } from '../../data/street-companies'
import { INDUSTRIES } from '../../data/street-companies'
import { totalPackage } from '../../engine/params'
import { assetUrl } from '../../engine/asset'
import {
  ColorSceneBillOrange,
  ColorSceneBillRed,
  ColorSceneBooth,
  ColorSceneFacade,
  ColorSceneGate,
  ColorSceneMoon,
  ColorSceneSkin,
  ColorSceneSun,
  ColorSceneWindow,
  ColorStateInfo,
  ThemeLightGlassHead,
  ThemeLightGlassBody,
  ThemeLightSkyTop,
  ThemeLightWire,
} from '../../../generated/design-tokens.output.mjs'
import type { ThemeName } from '../../engine/theme'

const DRACO_PATH = assetUrl('/draco/')
const HR_POOL = [
  'hr-f01', 'hr-f02', 'hr-f03', 'hr-f04', 'hr-f05',
  'hr-m01', 'hr-m02', 'hr-m03', 'hr-m04',
]
const NEAR = 26 // 真 HR GLB 自带 idle clip 为 T-pose；近景改用玩家 Avatar 的 idle clip（同 52 根 Mixamo 骨）
const FAR = 34

export function preloadHRModels() {
  useGLTF.preload(assetUrl('/assets/avatar/avatar-idle.glb'), DRACO_PATH)
  for (const f of HR_POOL) useGLTF.preload(assetUrl(`/assets/hr/${f}-idle.glb`), DRACO_PATH)
}

// 占位 HR 的西装色池（按 hrIndex 分配，避免 64 个摊位同色）
const OUTFITS = ['#3d4c63', '#4a3b52', '#2f4a45', '#5a4038', '#33465e', '#4a4230', '#3b3b46', '#533a44', '#304c58']
const HAIRS = ['#1b1b22', '#2a1d18', '#20262f', '#3a2a22', '#151a20']

// 办公楼立面：程序化窗格（同一楼层数 + 同一模式共享纹理，避免 64 份贴图）
// v4 玻璃数字孪生：mode='day' 画浅色玻璃幕墙（冷白底 + 淡青玻璃 + 结构线框）
//                mode='night' 画原夜景（深蓝底 + 暖色亮窗）
const FACADE_TEX = new Map<string, THREE.CanvasTexture>()

function facadeTexture(floors: number, mode: 'day' | 'night' = 'night') {
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
    // 白天：冷白玻璃底（浅色主题下与天幕融合）
    bg.addColorStop(0, '#dbe7f0')
    bg.addColorStop(1, '#c2d4e2')
  } else {
    bg.addColorStop(0, '#1a2431')
    bg.addColorStop(1, '#0f161f')
  }
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, 512, 512)

  const cols = 6
  const fh = 512 / floors
  const cw = 512 / cols
  for (let f = 0; f < floors; f++) {
    if (day) {
      // 楼层分隔：深色结构线（线框感）
      ctx.fillStyle = '#7d97ab'
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
        // 白天：淡青玻璃块（半透感由底色渐变模拟），无暖光窗
        ctx.fillStyle = '#8fb0c6'
        ctx.fillRect(x - 2, y - 2, w + 4, h + 4)
        const glass = ctx.createLinearGradient(x, y, x, y + h)
        glass.addColorStop(0, '#cfe4f2')
        glass.addColorStop(0.55, '#a8c8dd')
        glass.addColorStop(1, '#8fb4cc')
        ctx.fillStyle = glass
        ctx.fillRect(x, y, w, h)
        // 斜向高光条：玻璃反光的标识
        ctx.fillStyle = 'rgba(255,255,255,0.42)'
        ctx.fillRect(x + w * 0.08, y + h * 0.06, w * 0.16, h * 0.88)
      } else {
        ctx.fillStyle = '#080c11'
        ctx.fillRect(x - 2, y - 2, w + 4, h + 4)
        const lit = Math.random() < 0.58
        if (lit) {
          const warm = Math.random() < 0.68
          const glass = ctx.createLinearGradient(x, y, x, y + h)
          glass.addColorStop(0, warm ? '#f2d9a4' : '#c7dcea')
          glass.addColorStop(1, warm ? '#a87a45' : '#7595ad')
          ctx.fillStyle = glass
          ctx.fillRect(x, y, w, h)
          ctx.fillStyle = 'rgba(255,255,255,0.16)'
          ctx.fillRect(x + w * 0.1, y + h * 0.08, w * 0.14, h * 0.84)
        } else {
          ctx.fillStyle = Math.random() < 0.5 ? '#14202c' : '#1a2836'
          ctx.fillRect(x, y, w, h)
        }
      }
    }
  }
  for (let col = 1; col < cols; col++) {
    // 竖梃：白天为深色结构柱，夜间为暗色
    ctx.fillStyle = day ? 'rgba(90,120,142,0.75)' : 'rgba(6,10,14,0.6)'
    ctx.fillRect(col * cw - 2, 0, 4, 512)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.anisotropy = 4
  FACADE_TEX.set(key, tex)
  return tex
}

// 底层玻璃幕墙：夜间=深蓝反射室内暖光；白天=浅色玻璃反射天空
let GLASS_TEX: THREE.CanvasTexture | null = null
let GLASS_TEX_DAY: THREE.CanvasTexture | null = null
function glassTexture(mode: 'day' | 'night' = 'night') {
  if (mode === 'day') {
    if (GLASS_TEX_DAY) return GLASS_TEX_DAY
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 96
    const ctx = c.getContext('2d')!
    // 白天：玻璃反射天空（浅蓝渐变）
    const g = ctx.createLinearGradient(0, 0, 0, 96)
    g.addColorStop(0, '#b7d3e8')
    g.addColorStop(0.5, '#94b8d4')
    g.addColorStop(1, '#7ea4c2')
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
    ctx.fillStyle = 'rgba(78,102,124,0.8)'
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
function shadowTexture() {
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
function spillTexture() {
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
function deliveredTexture() {
  if (DELIVERED_TEX) return DELIVERED_TEX
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 64
  const ctx = c.getContext('2d')!
  ctx.fillStyle = 'rgba(10,22,16,0.92)'
  ctx.beginPath()
  ctx.roundRect(2, 2, 252, 60, 10)
  ctx.fill()
  ctx.strokeStyle = '#3ee58a'
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.fillStyle = '#7dffb0'
  ctx.font = '600 26px "Microsoft YaHei", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('✓ 已投递', 128, 34)
  DELIVERED_TEX = new THREE.CanvasTexture(c)
  return DELIVERED_TEX
}

// 钱捆贴图：扎带 + ¥ 压印（共享纹理，不增加 draw call）
function cashTexture(base: string, dark: string) {
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
            mat.emissive.set('#1b2635')
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

// 占位形象（远景/加载中/真 GLB 未修好前）：低模人形，按 hrIndex 换西装与发型
function PlaceholderHR({
  color,
  night,
  hrIndex,
}: {
  color: string
  night: boolean
  hrIndex: number
}) {
  const outfit = OUTFITS[hrIndex % OUTFITS.length]
  const hair = HAIRS[hrIndex % HAIRS.length]
  const h = 0.96 + (hrIndex % 5) * 0.015
  return (
    <group scale={[1, h, 1]}>
      <mesh position={[-0.22, 0.88, 0]} rotation={[0, 0, 0.16]}>
        <capsuleGeometry args={[0.055, 0.42, 4, 8]} />
        <meshStandardMaterial color={outfit} roughness={0.8} />
      </mesh>
      <mesh position={[0.22, 0.88, 0]} rotation={[0, 0, -0.16]}>
        <capsuleGeometry args={[0.055, 0.42, 4, 8]} />
        <meshStandardMaterial color={outfit} roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.62, 0]}>
        <capsuleGeometry args={[0.22, 0.62, 4, 10]} />
        <meshStandardMaterial color={outfit} roughness={0.75} />
      </mesh>
      <mesh position={[0, 1.24, 0]}>
        <sphereGeometry args={[0.185, 16, 14]} />
        <meshStandardMaterial color={ColorSceneSkin} roughness={0.6} />
      </mesh>
      <mesh position={[0, 1.32, -0.01]}>
        <sphereGeometry args={[0.19, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={hair} roughness={0.9} />
      </mesh>
      <mesh position={[-0.062, 1.27, 0.165]}>
        <sphereGeometry args={[0.022, 8, 8]} />
        <meshBasicMaterial color="#1b1b22" />
      </mesh>
      <mesh position={[0.062, 1.27, 0.165]}>
        <sphereGeometry args={[0.022, 8, 8]} />
        <meshBasicMaterial color="#1b1b22" />
      </mesh>
      <mesh position={[0, 1.195, 0.176]}>
        <boxGeometry args={[0.055, 0.012, 0.01]} />
        <meshBasicMaterial color="#7a4a3a" />
      </mesh>
      <mesh position={[0, 0.78, 0.2]}>
        <boxGeometry args={[0.12, 0.16, 0.02]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} />
      </mesh>
      <mesh position={[0, 1.72, 0]}>
        <sphereGeometry args={[0.1, 12, 10]} />
        <meshBasicMaterial color={night ? ColorSceneMoon : ColorSceneSun} />
      </mesh>
    </group>
  )
}

// 公司名牌：CanvasTexture 精灵（无 DOM，64 个摊位也便宜）
function useNameTexture(name: string, industry: string) {
  return useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 64
    const ctx = c.getContext('2d')!
    ctx.fillStyle = 'rgba(13,17,23,0.88)'
    ctx.beginPath()
    ctx.roundRect(2, 2, 252, 60, 8)
    ctx.fill()
    ctx.strokeStyle = INDUSTRIES[industry as keyof typeof INDUSTRIES]?.color ?? '#30363d'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.fillStyle = '#e6edf3'
    ctx.font = '600 26px "Microsoft YaHei", sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(name.slice(0, 8), 128, 34)
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }, [name, industry])
}

export function HRStand({ lot, onEnterOffice, delivered = false, theme = 'dark' }: { lot: Lot; onEnterOffice: (lot: Lot) => void; delivered?: boolean; theme?: ThemeName }) {
  const nameTex = useNameTexture(lot.name, lot.industry)
  const color = INDUSTRIES[lot.industry].color
  const total = totalPackage(lot.params)
  const layers = Math.max(2, Math.min(7, Math.round(total / 100000)))
  // 参数时间语义：这家公司几点下班（与环境主题无关）
  const night = lot.params.offworkTime >= 20
  // 环境主题：决定立面是浅色玻璃幕墙还是夜景
  const envNight = theme === 'dark'

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
      {/* 摊位台 */}
      <mesh position={[0, 0.07, 0]} receiveShadow>
        <boxGeometry args={[2.2, 0.14, 2.2]} />
        <meshStandardMaterial color={envNight ? ColorSceneBooth : ThemeLightGlassHead} roughness={envNight ? 0.9 : 0.6} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.013, 0.12]}>
        <planeGeometry args={[3.2, 3.2]} />
        <meshBasicMaterial map={shadowTexture()} transparent opacity={0.9} depthWrite={false} />
      </mesh>
      {/* 摊位雨棚 + 侧招：让展位从远处就读得出"招聘摊" */}
      <group>
        {[[-1.08, -0.82], [1.08, -0.82], [-1.08, 0.82], [1.08, 0.82]].map(([px, pz], i) => (
          <mesh key={i} position={[px, 1.16, pz]}>
            <cylinderGeometry args={[0.022, 0.022, 2.32, 6]} />
            <meshStandardMaterial color={envNight ? "#39424c" : "#aebfcc"} />
          </mesh>
        ))}
        <mesh position={[0, 2.36, 0]}>
          <boxGeometry args={[2.46, 0.09, 2.02]} />
          <meshStandardMaterial color={envNight ? "#1b232c" : "#cdd8e2"} roughness={0.85} />
        </mesh>
        <mesh position={[0, 2.31, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[2.18, 1.72]} />
          <meshBasicMaterial
            color={delivered ? '#3ee58a' : color}
            transparent
            opacity={0.16}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      </group>
      <group position={[-1.3, 0, 0.5]}>
        <mesh position={[0, 1.52, 0]}>
          <boxGeometry args={[0.14, 1.86, 0.42]} />
          <meshStandardMaterial color={envNight ? "#1b232c" : "#cdd8e2"} />
        </mesh>
        <mesh position={[0.075, 1.52, 0]}>
          <planeGeometry args={[0.34, 1.58]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={delivered ? 0.18 : 0.7} side={THREE.DoubleSide} />
        </mesh>
      </group>
      {delivered && (
        <group position={[0, 3.12, 0]}>
          <sprite scale={[1.02, 0.26, 1]}>
            <spriteMaterial map={deliveredTexture()} transparent depthTest={false} />
          </sprite>
          <mesh position={[0, -0.2, 0]}>
            <sphereGeometry args={[0.06, 8, 8]} />
            <meshBasicMaterial color="#3ee58a" />
          </mesh>
        </group>
      )}
      {/* HR 形象（near 时真 GLB，Suspense 加载期回退占位） */}
      <group position={[0, 0.14, 0]}>
        {near ? (
          <Suspense fallback={<PlaceholderHR color={color} night={night} hrIndex={lot.hrIndex} />}>
            <RealHR hrIndex={lot.hrIndex} />
          </Suspense>
        ) : (
          <PlaceholderHR color={color} night={night} hrIndex={lot.hrIndex} />
        )}
      </group>
      {/* 名牌 */}
      <sprite position={[0, 2.7, 0]} scale={[1.3, 0.33, 1]}>
        <spriteMaterial map={nameTex} transparent />
      </sprite>
      {/* 参数具象化：总包钱袋堆 + 五险切口牌 */}
      <group position={[0.62, 0.14, 0.55]}>
        {Array.from({ length: layers }).map((_, i) => (
          <mesh key={i} position={[0, 0.06 + i * 0.12, 0]}>
            <boxGeometry args={[0.5, 0.115, 0.32]} />
            <meshStandardMaterial
              map={i === layers - 1 && lot.params.salaryStructure > 12 ? CASH_TEX.inc : CASH_TEX.base}
              emissiveMap={i === layers - 1 && lot.params.salaryStructure > 12 ? CASH_TEX.inc : CASH_TEX.base}
              emissive="#ffffff"
              emissiveIntensity={0.12}
              roughness={0.62}
            />
          </mesh>
        ))}
      </group>
      <group position={[-0.62, 0.14, 0.55]}>
        <mesh position={[0, 0.24, 0]}>
          <boxGeometry args={[0.42, 0.48, 0.08]} />
          <meshStandardMaterial color={envNight ? "#3d4650" : "#b6c3cf"} />
        </mesh>
        <mesh position={[0, 0.24 + (lot.params.socialInsuranceBaseRatio === 'full' ? 0.18 : 0.08), 0.041]}>
          <boxGeometry args={[0.34, lot.params.socialInsuranceBaseRatio === 'full' ? 0.12 : 0.34, 0.02]} />
          <meshStandardMaterial color={envNight ? "#8b949e" : "#94a4b3"} />
        </mesh>
      </group>
      {/* 门前细节（动森式 1m 细节，破同构）：咨询桌 + 地毯 + 区域色侧旗 */}
      <group position={[1.35, 0, 1.15]}>
        <mesh position={[0, 0.2, 0]}>
          <boxGeometry args={[0.95, 0.07, 0.55]} />
          <meshStandardMaterial color={envNight ? "#3b4450" : "#c2cdd8"} roughness={0.8} />
        </mesh>
        <mesh position={[-0.4, 0.1, 0]}>
          <boxGeometry args={[0.06, 0.2, 0.5]} />
          <meshStandardMaterial color={envNight ? "#2b323b" : "#b4c1cd"} />
        </mesh>
        <mesh position={[0.4, 0.1, 0]}>
          <boxGeometry args={[0.06, 0.2, 0.5]} />
          <meshStandardMaterial color={envNight ? "#2b323b" : "#b4c1cd"} />
        </mesh>
      </group>
      <group position={[-1.5, 0, -0.4]} rotation={[0, 0, (parseInt(lot.id.slice(-2), 10) % 7) * 0.02 - 0.06]}>
        <mesh position={[0, 1.55, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 3.1, 6]} />
          <meshStandardMaterial color={envNight ? "#39424c" : "#aebfcc"} />
        </mesh>
        <mesh position={[0.26, 2.5, 0]}>
          <planeGeometry args={[0.52, 1.5]} />
          <meshStandardMaterial color={color} side={THREE.DoubleSide} roughness={0.85} />
        </mesh>
      </group>
      {/* 办公空间门面：行业差异化天际线（盲审修复）+ 门楣 LED + 玻璃幕墙 */}
      <group position={[0, 0, -3.6]}>
        {(() => {
          const h =
            lot.industry === 'internet' ? 8 : lot.industry === 'finance' ? 11.5 : lot.industry === 'manufacturing' ? 4.6 : 4.2
          return (
            <>
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
                <planeGeometry args={[7.8, 6.6]} />
                <meshBasicMaterial map={shadowTexture()} transparent opacity={0.95} depthWrite={false} />
              </mesh>
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.018, 2.9]}>
                <planeGeometry args={[5.4, 2.8]} />
                <meshBasicMaterial
                  map={spillTexture()}
                  transparent
                  opacity={0.5}
                  depthWrite={false}
                  blending={THREE.AdditiveBlending}
                />
              </mesh>
              <mesh position={[0, h / 2, 0]}>
                <boxGeometry args={[6.4, h, 5.2]} />
                {(() => {
                  const tex = facadeTexture(Math.max(3, Math.round(h / 1.3)), envNight ? 'night' : 'day')
                  return (
                    <>
                      {/* 白天：半透明玻璃（透出天光）+ 低粗糙度（产生环境反射） */}
                      <meshBasicMaterial
                        attach="material-0"
                        map={tex}
                        toneMapped={!envNight}
                        transparent={!envNight}
                        opacity={envNight ? 1 : 0.88}
                      />
                      <meshBasicMaterial
                        attach="material-1"
                        map={tex}
                        toneMapped={!envNight}
                        transparent={!envNight}
                        opacity={envNight ? 1 : 0.88}
                      />
                      <meshStandardMaterial
                        attach="material-2"
                        color={envNight ? ColorSceneFacade : ThemeLightGlassHead}
                        roughness={envNight ? 0.9 : 0.22}
                        metalness={envNight ? 0 : 0.12}
                        emissive={envNight ? '#0d1117' : ThemeLightSkyTop}
                        emissiveIntensity={envNight ? 0.5 : 0.25}
                      />
                      <meshStandardMaterial
                        attach="material-3"
                        color={envNight ? ColorSceneFacade : ThemeLightGlassHead}
                        roughness={envNight ? 0.9 : 0.22}
                        metalness={envNight ? 0 : 0.12}
                        emissive={envNight ? '#0d1117' : ThemeLightSkyTop}
                        emissiveIntensity={envNight ? 0.5 : 0.25}
                      />
                      <meshBasicMaterial
                        attach="material-4"
                        map={tex}
                        toneMapped={!envNight}
                        transparent={!envNight}
                        opacity={envNight ? 1 : 0.88}
                      />
                      <meshBasicMaterial
                        attach="material-5"
                        map={tex}
                        toneMapped={!envNight}
                        transparent={!envNight}
                        opacity={envNight ? 1 : 0.88}
                      />
                    </>
                  )
                })()}
              </mesh>
              {/* 孪生轮廓线框：勾出建筑体块结构（玻璃孪生的标志） */}
              {!envNight && (
                <lineSegments position={[0, h / 2, 0]}>
                  <edgesGeometry args={[new THREE.BoxGeometry(6.4, h, 5.2)]} />
                  <lineBasicMaterial color={ThemeLightWire} transparent opacity={0.55} />
                </lineSegments>
              )}
              {/* 底层玻璃幕墙 */}
              <mesh position={[0, 1.15, 2.66]}>
                <planeGeometry args={[5.8, 2.1]} />
                <meshBasicMaterial map={glassTexture(envNight ? 'night' : 'day')} toneMapped={!envNight} />
              </mesh>
              {/* 门楣 LED（公司名条，行业色发光） */}
              <mesh position={[0, 2.62, 2.70]}>
                <boxGeometry args={[2.9, 0.42, 0.1]} />
                <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.85} />
              </mesh>
              {/* 楼层灯带（高层建筑） */}
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
          <meshBasicMaterial color={envNight ? "#0a1a28" : "#2c3a48"} />
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
