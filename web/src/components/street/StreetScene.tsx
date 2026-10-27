// 招聘街区场景：十字路口 + 四大领域街区 + 玩家漫游 + 就近名片（project.md v1.2 P0）
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, ThreeEvent } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { WorkdaySky } from '../WorkdaySky'
import { TwinEnvironment } from './TwinEnvironment'
import { AvatarActor, RoamRefs } from '../AvatarActor'
import { RoamCamera } from '../RoamCamera'
import { HRStand, preloadHRModels } from './HRStand'
import { PlaceholderHRs } from './PlaceholderHRs'
import { OfficeFacadeInstanced } from './OfficeFacadeInstanced'
import { BoothHardwareInstanced } from './BoothHardwareInstanced'
import { CandidateBooth } from '../candidate/CandidateBooth'
import { BoothPoles, MoneyStacks } from './BoothProps'
import { LotBeacons, LotNumberDecals } from './LotMarkers'
import { NPC } from './NPC'
import { GameHud, rarityOf } from './GameHud'
import { GameMiniMap } from './GameMiniMap'
import { INDUSTRIES, Lot, LotPlacement, placeLots, STREET_BOUNDS } from '../../data/street-companies'
import { totalPackage } from '../../engine/params'
import {
  ColorBrandGold,
  ColorSceneBillRed,
  ColorSceneFloor,
  ColorSceneGate,
  ColorSceneGateDark,
  ColorSceneLamp,
  ColorSceneRoad,
  ColorStateInfo,
  ColorTextPrimary,
  ColorTextSecondary,
  ColorSceneBarOff,
  ColorSceneBarOn,
  ThemeLightGround,
  ThemeLightRoad,
  ThemeLightGlassHead,
  ThemeLightGlassBody,
  ThemeLightSkyTop,
  ThemeLightReflect,
  ThemeDarkReflect,
  TwinFogFar,
  TwinFogNear,
  TwinGroundEnvIntensity,
  TwinGridOpacityDay,
  TwinGridOpacityNight,
  TwinReflectOpacityDay,
  TwinReflectOpacityNight,
  TwinRoadRoughnessDay,
  TwinRoadRoughnessNight,
  TwinGroundRoughnessDay,
} from '../../../generated/design-tokens.output.mjs'
import type { ThemeName } from '../../engine/theme'
// 进度读写统一走 engine/progress.ts（另一路新建的持久化层）。
// 键名与结构与原来的 'gc-street-progress-v1' 完全一致 → 既有进度不丢、无需迁移。
import { loadStreetProgress, saveStreetProgress } from '../../engine/progress'

const placed = placeLots()
const fmtClock = (h: number) => `${String(Math.floor(h)).padStart(2, '0')}:${h % 1 ? '30' : '00'}`

// ---------- 街景静态元素 ----------
function asphaltTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 2600; i++) {
    const g = 200 + Math.floor(Math.random() * 45)
    ctx.fillStyle = `rgba(${g},${g},${g},${0.12 + Math.random() * 0.18})`
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 1.5, 1.5)
  }
  ctx.strokeStyle = 'rgba(120,130,145,0.28)'
  ctx.lineWidth = 1
  for (let i = 0; i < 4; i++) {
    const y = Math.random() * 256
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(256, y + (Math.random() - 0.5) * 8)
    ctx.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(24, 24)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}
const ASPHALT = asphaltTexture()

function Roads({ theme }: { theme: ThemeName }) {
  const night = theme === 'dark'
  return (
    <group>
      {/* 地面：低粗糙度 + 环境反射 → 磨砂玻璃般的反射（孪生风经典语汇） */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[240, 240]} />
        <meshStandardMaterial
          color={night ? ColorSceneFloor : ThemeLightGround}
          map={ASPHALT}
          roughness={night ? 0.9 : TwinGroundRoughnessDay}
          metalness={night ? 0 : 0.04}
          envMapIntensity={TwinGroundEnvIntensity}
        />
      </mesh>
      {/* 十字两条路（白天浅色沥青，夜间深色）；路面更光 → 读出"湿/磨砂"反射 */}
      {[0, Math.PI / 2].map((rot, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, rot]} position={[0, 0, 0]} receiveShadow>
          <planeGeometry args={[180, 10.4]} />
          <meshStandardMaterial
            color={night ? ColorSceneRoad : ThemeLightRoad}
            map={ASPHALT}
            roughness={night ? TwinRoadRoughnessNight : TwinRoadRoughnessDay}
            metalness={night ? 0 : 0.08}
            envMapIntensity={TwinGroundEnvIntensity}
          />
        </mesh>
      ))}
      {/* 天光反射带：路面上一条极淡的镜面渐变（给"湿地/磨砂玻璃"再补一层） */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]}>
        <planeGeometry args={[96, 96]} />
        <meshBasicMaterial
          map={reflectTexture()}
          color={night ? ThemeDarkReflect : ThemeLightReflect}
          transparent
          opacity={night ? TwinReflectOpacityNight : TwinReflectOpacityDay}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      {/* 中央斑马线（收窄至 0.5m，尺度校正） */}
      {[0, Math.PI / 2].map((rot, i) => (
        <group key={`z${i}`} rotation={[0, rot, 0]}>
          {[-6.4, -5.8, -5.2, 5.2, 5.8, 6.4].map((z) => (
            <mesh key={z} rotation={[-Math.PI / 2, 0, 0]} position={[z, 0.005, 0]}>
              <planeGeometry args={[0.5, 9.6]} />
              <meshStandardMaterial
                color={night ? '#c8d2da' : '#ffffff'}
                opacity={night ? 0.55 : 0.75}
                transparent
              />
            </mesh>
          ))}
        </group>
      ))}
      {/* 中央转盘基石 */}
      <mesh position={[0, 0.06, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[3.4, 3.6, 0.12, 32]} />
        <meshStandardMaterial
          color={night ? ColorSceneGateDark : ThemeLightGlassHead}
          roughness={0.85}
          envMapIntensity={TwinGroundEnvIntensity}
        />
      </mesh>
      {/* 孪生网格地面：淡青线框叠加（玻璃数字孪生的标志性元素） */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}>
        <planeGeometry args={[180, 180]} />
        <meshBasicMaterial
          map={twinGridTexture()}
          transparent
          opacity={night ? TwinGridOpacityNight : TwinGridOpacityDay}
          depthWrite={false}
        />
      </mesh>
      {/* 夜间湿反射带：沿十字路口道路方向延伸的拉长反射，模拟被路灯照亮的湿地面
          —— 夜间光层次的关键，电影感的主要来源。使用 InstancedMesh，64 盏路灯对应 64 个反射带，
          仅 2 个 draw call（X 轴 / Z 轴各 1 个）。 */}
      {night && (
        <>
          <WetReflectionBand axis={0} sign={1} />
          <WetReflectionBand axis={0} sign={-1} />
          <WetReflectionBand axis={1} sign={1} />
          <WetReflectionBand axis={1} sign={-1} />
        </>
      )}
    </group>
  )
}

// 天光反射带贴图：中心亮、边缘淡的径向渐变（叠在路面上模拟磨砂玻璃反射）
let REFLECT_TEX: THREE.CanvasTexture | null = null
function reflectTexture() {
  if (REFLECT_TEX) return REFLECT_TEX
  const size = 256
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255,255,255,0.85)')
  g.addColorStop(0.35, 'rgba(255,255,255,0.34)')
  g.addColorStop(0.72, 'rgba(255,255,255,0.08)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  REFLECT_TEX = t
  return t
}

// 夜间湿反射带：沿单条道路方向排列 8 个拉长反射（对应 8 盏路灯），
// 模拟被路灯照亮的湿地面，夜间光层次的关键。
function WetReflectionBand({ axis, sign }: { axis: 0 | 1; sign: 1 | -1 }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const positions = useMemo(() => {
    const arr: [number, number, number][] = []
    for (let i = 0; i < 8; i++) {
      const along = 7 + i * 4.2
      const across = sign * 5.2
      // 沿 axis 方向延伸，反射带拉长方向与道路一致
      arr.push(axis === 0 ? [sign * along, 0.007, across] : [across, 0.007, sign * along])
    }
    return arr
  }, [axis, sign])
  useLayoutEffect(() => {
    const m = ref.current
    if (!m) return
    const o = new THREE.Object3D()
    positions.forEach((p, i) => {
      o.position.set(p[0], p[1], p[2])
      // 反射带沿道路方向拉长（X 轴道路 → 沿 X 拉长；Z 轴道路 → 沿 Z 拉长）
      o.rotation.set(axis === 0 ? 0 : Math.PI / 2, 0, 0)
      o.scale.set(axis === 0 ? 3.2 : 0.6, 0.5, axis === 0 ? 0.6 : 3.2)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
    })
    m.instanceMatrix.needsUpdate = true
  }, [positions, axis])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, positions.length]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        color={ColorBrandGold}
        transparent
        opacity={0.18}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </instancedMesh>
  )
}

// 孪生网格贴图：程序化生成淡青网格线（每 6m 一格）
let TWIN_GRID_TEX: THREE.CanvasTexture | null = null
function twinGridTexture() {
  if (TWIN_GRID_TEX) return TWIN_GRID_TEX
  const size = 256
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')!
  ctx.clearRect(0, 0, size, size)
  // 每张贴图覆盖 24m，4 格 → 6m 一格
  const cell = size / 4
  ctx.strokeStyle = 'rgba(107,158,196,0.55)'
  ctx.lineWidth = 1
  for (let i = 0; i <= 4; i++) {
    const p = Math.round(i * cell) + 0.5
    ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, size); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(size, p); ctx.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(180 / 24, 180 / 24)
  t.colorSpace = THREE.SRGBColorSpace
  TWIN_GRID_TEX = t
  return t
}

// 参数碑：碑高=总包、5 灯条=五险、顶灯=下班时间（4 个 InstancedMesh）
function ParamSteles({ theme }: { theme: ThemeName }) {
  const night = theme === 'dark'
  const body = useRef<THREE.InstancedMesh>(null)
  const band = useRef<THREE.InstancedMesh>(null)
  const bars = useRef<THREE.InstancedMesh>(null)
  const lamps = useRef<THREE.InstancedMesh>(null)
  const data = useMemo(
    () =>
      placed.map((p) => {
        const total = totalPackage(p.lot.params)
        const height = Math.min(2.6, 0.7 + (total / 1_000_000) * 1.7)
        const ratio = p.lot.params.socialInsuranceBaseRatio
        const lit = ratio === 'full' ? 5 : ratio === '0.8' ? 4 : 3
        const off = p.lot.params.offworkTime
        const lamp = off < 19 ? '#ffc46b' : off < 20 ? '#ff9a6a' : '#8fa8ff'
        return { pl: p, height, lit, lamp }
      }),
    []
  )
  useLayoutEffect(() => {
    const b = body.current
    const bd = band.current
    const br = bars.current
    const lp = lamps.current
    if (!b || !bd || !br || !lp) return
    const o = new THREE.Object3D()
    const col = new THREE.Color()
    const cos = Math.cos, sin = Math.sin
    let barIndex = 0
    data.forEach((d, i) => {
      const { pl, height, lit, lamp } = d
      const rot = pl.rotationY
      const c = cos(rot)
      const s = sin(rot)
      const lx = -1.05
      const lz = -0.55
      const wx = pl.position[0] + lx * c + lz * s
      const wz = pl.position[2] - lx * s + lz * c
      // 碑体
      o.position.set(wx, height / 2, wz)
      o.rotation.set(0, rot, 0)
      o.scale.set(0.3, height, 0.22)
      o.updateMatrix()
      b.setMatrixAt(i, o.matrix)
      // 顶部金带
      o.position.set(wx, height - 0.04, wz)
      o.scale.set(0.34, 0.04, 0.26)
      o.updateMatrix()
      bd.setMatrixAt(i, o.matrix)
      // 五险灯条（碑面）
      for (let j = 0; j < 5; j++) {
        const ly = 0.3 + (j * (height - 0.55)) / 5
        o.position.set(wx + 0 * c + 0.12 * s, ly, wz - 0 * s + 0.12 * c)
        o.scale.set(0.18, 0.06, 0.02)
        o.updateMatrix()
        br.setMatrixAt(barIndex, o.matrix)
        br.setColorAt(barIndex, col.set(j < lit ? ColorSceneBarOn : ColorSceneBarOff))
        barIndex++
      }
      // 顶灯
      o.position.set(wx, height + 0.12, wz)
      o.scale.set(1, 1, 1)
      o.updateMatrix()
      lp.setMatrixAt(i, o.matrix)
      lp.setColorAt(i, col.set(lamp))
    })
    b.instanceMatrix.needsUpdate = true
    bd.instanceMatrix.needsUpdate = true
    br.instanceMatrix.needsUpdate = true
    if (br.instanceColor) br.instanceColor.needsUpdate = true
    lp.instanceMatrix.needsUpdate = true
    if (lp.instanceColor) lp.instanceColor.needsUpdate = true
    ;(br.material as THREE.MeshBasicMaterial).needsUpdate = true
    ;(lp.material as THREE.MeshBasicMaterial).needsUpdate = true
  }, [data])
  return (
    <group>
      <instancedMesh ref={body} args={[undefined, undefined, data.length]} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={night ? ColorSceneGateDark : ThemeLightGlassHead} roughness={night ? 0.85 : 0.5} />
      </instancedMesh>
      <instancedMesh ref={band} args={[undefined, undefined, data.length]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color={ColorBrandGold} />
      </instancedMesh>
      <instancedMesh ref={bars} args={[undefined, undefined, data.length * 5]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial />
      </instancedMesh>
      <instancedMesh ref={lamps} args={[undefined, undefined, data.length]}>
        <sphereGeometry args={[0.09, 8, 8]} />
        <meshBasicMaterial />
      </instancedMesh>
    </group>
  )
}

// 世界级稀有度宝石：S 金 / A 蓝 / B 灰，悬在名牌上方（InstancedMesh 单 draw call）
function RarityGems() {
  const ref = useRef<THREE.InstancedMesh>(null)
  const data = useMemo(
    () =>
      placed.map((p) => {
        const total = totalPackage(p.lot.params)
        const color =
          total >= 800000 ? ColorBrandGold : total >= 400000 ? ColorStateInfo : ColorTextSecondary
        return { pos: p.position, color }
      }),
    []
  )
  useLayoutEffect(() => {
    const m = ref.current
    if (!m) return
    const o = new THREE.Object3D()
    const c = new THREE.Color()
    data.forEach((d, i) => {
      o.position.set(d.pos[0], 3.02, d.pos[2])
      o.rotation.set(0, 0, 0)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
      m.setColorAt(i, c.set(d.color))
    })
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    ;(m.material as THREE.MeshBasicMaterial).needsUpdate = true
  }, [data])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, data.length]}>
      <octahedronGeometry args={[0.16, 0]} />
      <meshBasicMaterial />
    </instancedMesh>
  )
}

// 车道虚线：四街 × 两侧 × 9 段，单 InstancedMesh
function RoadLanes() {
  const ref = useRef<THREE.InstancedMesh>(null)
  const mats = useMemo(() => {
    const arr: { p: [number, number, number]; rot: number }[] = []
    for (const axis of [0, 1]) {
      for (const sign of [1, -1]) {
        for (const side of [1, -1]) {
          for (let i = 0; i < 9; i++) {
            const along = 8.5 + i * 3.6
            const across = side * 3.2
            arr.push({
              p: axis === 0 ? [sign * along, 0.012, across] : [across, 0.012, sign * along],
              rot: axis === 0 ? 0 : Math.PI / 2,
            })
          }
        }
      }
    }
    return arr
  }, [])
  useLayoutEffect(() => {
    const m = ref.current
    if (!m) return
    const o = new THREE.Object3D()
    mats.forEach((it, i) => {
      o.position.set(...it.p)
      o.rotation.set(-Math.PI / 2, 0, it.rot)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
    })
    m.instanceMatrix.needsUpdate = true
  }, [mats])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, mats.length]}>
      <planeGeometry args={[1.7, 0.13]} />
      <meshBasicMaterial color={ColorTextPrimary} transparent opacity={0.24} depthWrite={false} />
    </instancedMesh>
  )
}

// 路面区域路牌：把四区名字画进 3D 世界（不只靠小地图）
const DISTRICT_SIGN_TEX = new Map<string, THREE.CanvasTexture>()
function districtSignTexture(ind: keyof typeof INDUSTRIES) {
  const cached = DISTRICT_SIGN_TEX.get(ind)
  if (cached) return cached
  const { label, color } = INDUSTRIES[ind]
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 192
  const ctx = c.getContext('2d')!
  ctx.clearRect(0, 0, 512, 192)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = '800 78px "Microsoft YaHei", sans-serif'
  ctx.lineWidth = 10
  ctx.strokeStyle = 'rgba(6,10,15,0.85)'
  ctx.strokeText(label, 256, 82)
  ctx.fillStyle = color
  ctx.fillText(label, 256, 82)
  ctx.font = '600 24px "Microsoft YaHei", sans-serif'
  ctx.fillStyle = 'rgba(230,237,243,0.75)'
  ctx.fillText('RECRUITING STREET', 256, 150)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  DISTRICT_SIGN_TEX.set(ind, tex)
  return tex
}

function DistrictRoadSigns() {
  const arms: { ind: keyof typeof INDUSTRIES; x: number; z: number; rot: number }[] = [
    { ind: 'internet', x: 13.5, z: 0, rot: Math.PI / 2 },
    { ind: 'finance', x: -13.5, z: 0, rot: -Math.PI / 2 },
    { ind: 'manufacturing', x: 0, z: 13.5, rot: 0 },
    { ind: 'culture', x: 0, z: -13.5, rot: Math.PI },
  ]
  return (
    <group>
      {arms.map((a) => (
        <mesh key={a.ind} rotation={[-Math.PI / 2, 0, a.rot]} position={[a.x, 0.026, a.z]}>
          <planeGeometry args={[5.2, 1.95]} />
          <meshBasicMaterial map={districtSignTexture(a.ind)} transparent opacity={0.62} depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}

// 远景天际线：四街尽头的灯塔塔楼 + 斜向中层楼群（雾中剪影）
function DistantSkyline({ theme }: { theme: ThemeName }) {
  const night = theme === 'dark'
  const bodies = useRef<THREE.InstancedMesh>(null)
  const { list } = useMemo(() => {
    const list: { x: number; z: number; w: number; h: number; d: number }[] = []
    const angles = [28, 62, 118, 152, 208, 242, 298, 332]
    angles.forEach((deg, i) => {
      const a = (deg * Math.PI) / 180
      const r = 60 + (i % 3) * 5
      list.push({
        x: Math.cos(a) * r,
        z: Math.sin(a) * r,
        w: 7 + (i % 4) * 2,
        h: 12 + ((i * 7) % 17),
        d: 7 + ((i * 3) % 6),
      })
    })
    return { list }
  }, [])
  useLayoutEffect(() => {
    const b = bodies.current
    if (!b) return
    const o = new THREE.Object3D()
    list.forEach((t, i) => {
      o.position.set(t.x, t.h / 2, t.z)
      o.rotation.set(0, 0, 0)
      o.scale.set(t.w, t.h, t.d)
      o.updateMatrix()
      b.setMatrixAt(i, o.matrix)
    })
    b.instanceMatrix.needsUpdate = true
  }, [list])
  return (
    <instancedMesh ref={bodies} args={[undefined, undefined, list.length]}>
      <boxGeometry args={[1, 1, 1]} />
      {/* 白天：冷白玻璃远景（融入浅色天幕）；夜间：深蓝剪影 */}
      <meshStandardMaterial
        color={night ? ColorSceneFloor : ThemeLightGlassBody}
        roughness={night ? 0.95 : 0.5}
        transparent={!night}
        opacity={night ? 1 : 0.72}
        emissive={night ? '#0e1622' : ThemeLightSkyTop}
        emissiveIntensity={night ? 0.6 : 0.12}
      />
    </instancedMesh>
  )
}

// 路灯（每街两侧 8 盏 × 4 街 = 64，实例化）
let LAMP_GLOW_TEX: THREE.CanvasTexture | null = null
function lampGlowTexture() {
  if (LAMP_GLOW_TEX) return LAMP_GLOW_TEX
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0, 'rgba(255,220,170,1)')
  g.addColorStop(0.35, 'rgba(255,190,120,0.55)')
  g.addColorStop(1, 'rgba(255,170,90,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 64)
  LAMP_GLOW_TEX = new THREE.CanvasTexture(c)
  return LAMP_GLOW_TEX
}

function StreetLamps({ theme }: { theme: ThemeName }) {
  const night = theme === 'dark'
  const ref = useRef<THREE.InstancedMesh>(null)
  const headRef = useRef<THREE.InstancedMesh>(null)
  const poolRef = useRef<THREE.InstancedMesh>(null)
  const mats = useMemo(() => {
    const arr: [number, number, number][] = []
    for (const axis of [0, 1]) {
      for (const sign of [1, -1]) {
        for (const side of [1, -1]) {
          for (let i = 0; i < 8; i++) {
            const along = 7 + i * 4.2
            const across = side * 6.4
            arr.push(axis === 0 ? [sign * along, 0, across] : [across, 0, sign * along])
          }
        }
      }
    }
    return arr
  }, [])
  const poolTex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 128
    const ctx = c.getContext('2d')!
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
    g.addColorStop(0, 'rgba(255,190,120,0.55)')
    g.addColorStop(0.55, 'rgba(255,160,90,0.18)')
    g.addColorStop(1, 'rgba(255,150,80,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 128, 128)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [])
  const glowPositions = useMemo(() => {
    const arr = new Float32Array(mats.length * 3)
    mats.forEach((p, i) => {
      arr[i * 3] = p[0]
      arr[i * 3 + 1] = 3.68
      arr[i * 3 + 2] = p[2]
    })
    return arr
  }, [mats])
  useLayoutEffect(() => {
    const m = ref.current
    const h = headRef.current
    const pool = poolRef.current
    if (!m || !h || !pool) return
    const o = new THREE.Object3D()
    mats.forEach((p, i) => {
      o.position.set(p[0], 1.8, p[2])
      o.rotation.set(0, 0, 0)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
      o.position.set(p[0], 3.68, p[2])
      o.updateMatrix()
      h.setMatrixAt(i, o.matrix)
      o.position.set(p[0], 0.015, p[2])
      o.rotation.set(-Math.PI / 2, 0, 0)
      o.updateMatrix()
      pool.setMatrixAt(i, o.matrix)
    })
    m.instanceMatrix.needsUpdate = true
    h.instanceMatrix.needsUpdate = true
    pool.instanceMatrix.needsUpdate = true
  }, [mats])
  return (
    <>
      <instancedMesh ref={ref} args={[undefined, undefined, mats.length]}>
        <cylinderGeometry args={[0.035, 0.05, 3.6, 6]} />
        <meshStandardMaterial color={night ? ColorSceneGate : ThemeLightGlassHead} />
      </instancedMesh>
      {/* 灯头发光（仅夜间；白天关灯，靠日光塑形） */}
      <instancedMesh ref={headRef} args={[undefined, undefined, mats.length]}>
        <sphereGeometry args={[0.17, 10, 8]} />
        <meshStandardMaterial
          color={night ? ColorSceneLamp : '#b9c6d2'}
          emissive={night ? ColorSceneLamp : '#000000'}
          emissiveIntensity={night ? 2.6 : 0}
        />
      </instancedMesh>
      {/* 灯头光晕：点精灵，64 盏一次 draw call（仅夜间） */}
      {night && (
        <points>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[glowPositions, 3]} />
          </bufferGeometry>
          <pointsMaterial
            map={lampGlowTexture()}
            color={ColorSceneLamp}
            size={1.4}
            sizeAttenuation
            transparent
            opacity={1.0}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </points>
      )}
      {/* 地面暖光池（廉价假光，替代 64 个点光源；仅夜间） */}
      {night && (
        <instancedMesh ref={poolRef} args={[undefined, undefined, mats.length]}>
          <planeGeometry args={[4.2, 4.2]} />
          <meshBasicMaterial
            map={poolTex}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            opacity={0.75}
          />
        </instancedMesh>
      )}
    </>
  )
}

// ---------- 区域入口牌坊（两级导航第二级）：跨街立柱 + 发光区名 ----------
function labelTexture(text: string, color: string) {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 96
  const ctx = c.getContext('2d')!
  ctx.fillStyle = 'rgba(10,14,26,0.92)'
  ctx.fillRect(0, 0, 512, 96)
  ctx.strokeStyle = color
  ctx.lineWidth = 5
  ctx.strokeRect(6, 6, 500, 84)
  ctx.fillStyle = color
  ctx.font = '700 44px "Microsoft YaHei", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 256, 50)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function ArchWay({ industry, axisX, sign, theme }: { industry: keyof typeof INDUSTRIES; axisX: boolean; sign: 1 | -1; theme: ThemeName }) {
  const tex = useMemo(() => labelTexture(INDUSTRIES[industry].label, INDUSTRIES[industry].color), [industry])
  const color = INDUSTRIES[industry].color
  const night = theme === 'dark'
  return (
    <group rotation={[0, axisX ? Math.PI / 2 : 0, 0]} position={[axisX ? sign * 22 : 0, 0, axisX ? 0 : sign * 22]}>
      {[-4.8, 4.8].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh position={[0, 2.65, 0]} castShadow>
            <boxGeometry args={[0.42, 5.3, 0.42]} />
            <meshStandardMaterial color={night ? ColorSceneGate : ThemeLightGlassHead} roughness={night ? 0.7 : 0.35} metalness={night ? 0 : 0.1} emissive={color} emissiveIntensity={night ? 0.12 : 0.35} />
          </mesh>
          {/* 行业色发光边条：夜间把牌坊读成“区门”，而不是黑柱 */}
          <mesh position={[0, 2.65, 0.23]}>
            <boxGeometry args={[0.06, 4.9, 0.02]} />
            <meshBasicMaterial color={color} />
          </mesh>
          <mesh position={[0, 2.65, -0.23]}>
            <boxGeometry args={[0.06, 4.9, 0.02]} />
            <meshBasicMaterial color={color} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 5.6, 0]} castShadow>
        <boxGeometry args={[10.4, 1.0, 0.6]} />
        <meshStandardMaterial color={night ? ColorSceneGate : ThemeLightGlassHead} roughness={night ? 0.7 : 0.35} metalness={night ? 0 : 0.1} emissive={color} emissiveIntensity={night ? 0.1 : 0.3} />
      </mesh>
      {/* 区色信标：从鸟瞰/远端也能定位四区入口 */}
      <mesh position={[4.8, 4.6, 0]}>
        <boxGeometry args={[0.08, 9.2, 0.08]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh position={[4.8, 9.3, 0]}>
        <sphereGeometry args={[0.22, 8, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh position={[0, 5.08, 0]}>
        <boxGeometry args={[10.0, 0.05, 0.64]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh position={[0, 5.6, 0.34]}>
        <planeGeometry args={[9.2, 0.82]} />
        <meshBasicMaterial map={tex} />
      </mesh>
      <mesh position={[0, 5.6, -0.34]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[9.2, 0.82]} />
        <meshBasicMaterial map={tex} />
      </mesh>
    </group>
  )
}

// 金色粒子爆发：投递落点的世界层强化（design-audit 四轮 8+ 清单 #3）。
// 16 粒加性混合点精灵，仅在 DeliveryFX 存活的 ~1.15s 内 +1 draw call，随后随组件卸载归零。
const GOLD_BURST_N = 16
function GoldBurst({ x, z }: { x: number; z: number }) {
  const ref = useRef<THREE.Points>(null)
  const t = useRef(0)
  // 确定性伪随机（不引随机数种子库）：初速方向/大小由索引决定，每次投递同一朵「金花」
  const seeds = useMemo(
    () =>
      Array.from({ length: GOLD_BURST_N }, (_, i) => {
        const a = (i / GOLD_BURST_N) * Math.PI * 2 + (i % 3) * 0.4
        const r = 0.22 + ((i * 37) % 11) / 24
        return { vx: Math.cos(a) * r, vy: 0.9 + ((i * 53) % 13) / 10, vz: Math.sin(a) * r }
      }),
    []
  )
  useFrame((_, dt) => {
    t.current += dt
    const pts = ref.current
    if (!pts) return
    // 与金环同拍：t∈[0.7,1.15] 才爆发（飞袋落位之后）
    const life = Math.min(1, Math.max(0, (t.current - 0.7) / 0.45))
    const pos = pts.geometry.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < GOLD_BURST_N; i++) {
      const s = seeds[i]
      const d = life * 0.9
      pos.setXYZ(i, x + s.vx * d, 0.5 + s.vy * d - 1.4 * d * d, z + s.vz * d)
    }
    pos.needsUpdate = true
    const mat = pts.material as THREE.PointsMaterial
    mat.opacity = 1 - life
    pts.visible = life > 0 && life < 1
  })
  return (
    <points ref={ref} visible={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[new Float32Array(GOLD_BURST_N * 3), 3]} />
      </bufferGeometry>
      <pointsMaterial
        color={ColorBrandGold}
        size={0.16}
        sizeAttenuation
        transparent
        opacity={1}
        map={lampGlowTexture()}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

// 投递飞袋：抛物线飞向摊位 + 落点金环爆开 + 瞬时补光（世界层反馈）
function DeliveryFX({
  d,
  onDone,
}: {
  d: { id: number; from: [number, number]; to: [number, number] }
  onDone: () => void
}) {
  const ref = useRef<THREE.Mesh>(null)
  const ring = useRef<THREE.Mesh>(null)
  const ringMat = useRef<THREE.MeshBasicMaterial>(null)
  const light = useRef<THREE.PointLight>(null)
  const t = useRef(0)
  useFrame((_, dt) => {
    t.current += dt
    const fly = Math.min(1, t.current / 0.85)
    const m = ref.current
    if (m) {
      m.position.set(
        d.from[0] + (d.to[0] - d.from[0]) * fly,
        0.9 + Math.sin(fly * Math.PI) * 3.0,
        d.from[1] + (d.to[1] - d.from[1]) * fly
      )
      m.rotation.y += dt * 9
      m.visible = fly < 1
    }
    const burst = Math.min(1, Math.max(0, (t.current - 0.7) / 0.45))
    if (ring.current) ring.current.scale.setScalar(0.55 + burst * 1.9)
    if (ringMat.current) ringMat.current.opacity = burst > 0 ? (1 - burst) * 0.85 : 0
    if (light.current) light.current.intensity = burst > 0 ? (1 - burst) * 26 : 0
    if (t.current >= 1.15) onDone()
  })
  return (
    <group>
      <mesh ref={ref}>
        <boxGeometry args={[0.34, 0.12, 0.22]} />
        <meshStandardMaterial
          color={ColorSceneBillRed}
          emissive={ColorBrandGold}
          emissiveIntensity={0.9}
          roughness={0.45}
        />
      </mesh>
      <mesh ref={ring} position={[d.to[0], 0.06, d.to[1]]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.5, 0.72, 48]} />
        <meshBasicMaterial
          ref={ringMat}
          color={ColorBrandGold}
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <pointLight ref={light} position={[d.to[0], 1.6, d.to[1]]} color={ColorBrandGold} intensity={0} distance={8} />
      <GoldBurst x={d.to[0]} z={d.to[1]} />
    </group>
  )
}

// ---------- 就近摊位采样：R3F 内每 0.25s 找最近 lot，交 DOM 层渲染名片 ----------
// 参观计数规格（role-flow-spec §5.2.4 / master §402）：**停留 ≥8s 且位移 ≥3m** 才计一次，
// 点开即退不计入。旧实现"进入 8.5m 即算参观"过宽，与规格不符，此处按规格实现。
function NearSampler({
  refs,
  onVisit,
  onNear,
  active,
}: {
  refs: RoamRefs
  onVisit: (lot: Lot) => void
  onNear: (lot: Lot | null) => void
  active: boolean
}) {
  const cooldown = useRef(0)
  const reported = useRef(new Set<string>())
  const last = useRef<string | null>(null)
  // 参观跟踪：进入某摊位邻近区后开始计时 + 累计位移；离开或换摊位即重置
  const track = useRef<{ id: string | null; enterAt: number; lastX: number; lastZ: number; travel: number }>({
    id: null,
    enterAt: 0,
    lastX: 0,
    lastZ: 0,
    travel: 0,
  })
  useFrame((state, dt) => {
    if (!active) return
    const p = refs.position.current
    const now = state.clock.getElapsedTime()

    // 位移按帧累加（真实路径长度），仅当已跟踪某摊位时累计 —— 保证 ≥3m 判定准确
    const tk = track.current
    if (tk.id) {
      tk.travel += Math.hypot(p.x - tk.lastX, p.z - tk.lastZ)
      tk.lastX = p.x
      tk.lastZ = p.z
    }

    cooldown.current -= dt
    if (cooldown.current > 0) return
    cooldown.current = 0.25

    // 找最近摊位（8.5m 内）
    let best: Lot | null = null
    let bestD = 8.5
    for (const pl of placed) {
      const d = Math.hypot(p.x - pl.position[0], p.z - pl.position[2])
      if (d < bestD) {
        bestD = d
        best = pl.lot
      }
    }

    // 跟踪切换（进入新摊位 / 离开）：重置停留计时与位移
    const bestId = best?.id ?? null
    if (bestId !== tk.id) {
      tk.id = bestId
      tk.enterAt = now
      tk.lastX = p.x
      tk.lastZ = p.z
      tk.travel = 0
    }

    // 参观达成：停留 ≥8s 且位移 ≥3m，且该摊位未计数过
    if (best && !reported.current.has(best.id) && now - tk.enterAt >= 8 && tk.travel >= 3) {
      reported.current.add(best.id)
      onVisit(best)
    }

    // 就近名片 / focus（沿用原逻辑）
    if (bestId !== last.current) {
      last.current = bestId
      if (refs.focus) {
        const pl = best ? placed.find((x) => x.lot.id === best!.id) : null
        refs.focus.current = pl ? new THREE.Vector3(pl.position[0], 0, pl.position[2]) : null
      }
      onNear(best)
    }
  })
  return null
}

// ---------- 就近光环：把屏幕名片锁回世界里的那个摊位 ----------
function NearRing({ lot }: { lot: Lot }) {
  const pl = placed.find((p) => p.lot.id === lot.id)
  const ring = useRef<THREE.Mesh>(null)
  const outer = useRef<THREE.Mesh>(null)
  const focusTarget = useMemo(() => new THREE.Object3D(), [])
  useFrame((state, dt) => {
    const t = state.clock.elapsedTime
    if (ring.current) ring.current.scale.setScalar(1 + Math.sin(t * 3) * 0.05)
    if (outer.current) outer.current.rotation.z += dt * 0.25
  })
  if (!pl) return null
  return (
    <group position={[pl.position[0], 0.03, pl.position[2]]}>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.55, 1.75, 48]} />
        <meshBasicMaterial color={ColorBrandGold} transparent opacity={0.6} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh ref={outer} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.05, 2.12, 64]} />
        <meshBasicMaterial
          color={INDUSTRIES[lot.industry].color}
          transparent
          opacity={0.42}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {/* 选中摊位：45° 暖主光打在 HR 正面 + 后方冷轮廓光 + 脚下接影 */}
      <primitive object={focusTarget} position={[0, 1.0, 0]} />
      <spotLight
        position={[Math.sin(pl.rotationY) * 1.8, 2.6, Math.cos(pl.rotationY) * 1.8]}
        target={focusTarget}
        color="#ffd7b0"
        intensity={45}
        distance={8}
        angle={0.5}
        penumbra={0.7}
        decay={2}
      />
      <pointLight
        position={[Math.sin(pl.rotationY) * -1.1, 1.7, Math.cos(pl.rotationY) * -1.1]}
        color="#6ea8ff"
        intensity={8}
        distance={4}
        decay={2}
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.155, 0]}>
        <circleGeometry args={[0.4, 24]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.42} depthWrite={false} />
      </mesh>
    </group>
  )
}

// ---------- 就近名片（屏幕停靠，不随 3D 距离缩放）----------
function LotCard({
  lot,
  delivered,
  onEnterOffice,
  onDeliver,
  onAddBasket,
}: {
  lot: Lot
  delivered: Set<string>
  onEnterOffice: (lot: Lot) => void
  onDeliver: (lot: Lot) => void
  onAddBasket: (lot: Lot) => void
}) {
  const rarity = rarityOf(totalPackage(lot.params))
  return (
    <div className="lot-card lot-card-dock" style={{ borderColor: rarity.color }}>
      <div className="lot-card-name">
        <span className="rarity-chip" style={{ background: rarity.color }}>
          {rarity.label}
        </span>
        {lot.name}
        <span style={{ color: INDUSTRIES[lot.industry].color }}> {lot.industryLabel}</span>
      </div>
      <div className="lot-card-stats">
        <div className="lot-card-stat">
          <span className="k">总包</span>
          <span className="v">
            {Math.round(totalPackage(lot.params) / 10000)}
            <small>万</small>
          </span>
        </div>
        <div className="lot-card-stat">
          <span className="k">下班</span>
          <span className="v">{fmtClock(lot.params.offworkTime)}</span>
        </div>
        <div className="lot-card-stat">
          <span className="k">五险</span>
          <span className="v">
            {lot.params.socialInsuranceBaseRatio === 'full'
              ? '全额'
              : `基数${lot.params.socialInsuranceBaseRatio}`}
          </span>
        </div>
      </div>
      <div className="lot-card-tag">{lot.tagline}</div>
      <div className="lot-card-actions">
        <button onClick={() => onEnterOffice(lot)}>🏢 进办公室参观</button>
        {delivered.has(lot.id) ? (
          <button className="delivered" disabled>
            ✓ 已投递
          </button>
        ) : (
          <button className="ghost" onClick={() => onDeliver(lot)}>
            📮 投简历
          </button>
        )}
        <button className="ghost" onClick={() => onAddBasket(lot)}>
          🧺 对比
        </button>
      </div>
    </div>
  )
}

// ---------- 中央导航柱：点击传送 ----------
function NavPillar({
  refs,
  onInteract,
  visible,
  theme,
}: {
  refs: RoamRefs
  onInteract: () => void
  visible: boolean
  theme: ThemeName
}) {
  const night = theme === 'dark'
  const cap = useRef<THREE.Mesh>(null)
  const outerRing = useRef<THREE.Mesh>(null)
  useFrame((_, dt) => {
    if (cap.current) {
      cap.current.rotation.y += dt * 0.7
      cap.current.position.y = 5.35 + Math.sin(performance.now() * 0.0012) * 0.08
    }
    if (outerRing.current) outerRing.current.rotation.z += dt * 0.3
  })
  return (
    <group>
      {/* 中央四区图腾：五米灯柱 + 四区色棱线 + 顶部金色地标 */}
      <mesh position={[0, 2.5, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.42, 0.62, 5, 8]} />
        <meshStandardMaterial color={night ? ColorSceneGateDark : ThemeLightGlassHead} roughness={night ? 0.7 : 0.3} metalness={night ? 0 : 0.15} emissive={night ? "#1a2230" : ThemeLightSkyTop} emissiveIntensity={night ? 0.5 : 0.3} />
      </mesh>
      {(Object.keys(INDUSTRIES) as (keyof typeof INDUSTRIES)[]).map((ind, i) => {
        const angle = (i * Math.PI) / 2 + Math.PI / 4
        return (
          <mesh
            key={ind}
            position={[Math.sin(angle) * 0.5, 2.5, Math.cos(angle) * 0.5]}
            rotation={[0, angle, 0]}
          >
            <boxGeometry args={[0.07, 4.2, 0.02]} />
            <meshBasicMaterial color={INDUSTRIES[ind].color} />
          </mesh>
        )
      })}
      <mesh ref={cap} position={[0, 5.35, 0]}>
        <octahedronGeometry args={[0.48, 0]} />
        <meshStandardMaterial
          color={ColorBrandGold}
          emissive={ColorBrandGold}
          emissiveIntensity={night ? 2.4 : 0.6}
          roughness={0.3}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.13, 0]}>
        <ringGeometry args={[3.28, 3.52, 48]} />
        <meshBasicMaterial color={ColorBrandGold} transparent opacity={0.55} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={outerRing} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.11, 0]}>
        <ringGeometry args={[4.15, 4.24, 64]} />
        <meshBasicMaterial color={ColorBrandGold} transparent opacity={0.22} side={THREE.DoubleSide} />
      </mesh>
      {/* 中央光柱：20m 高，街区外也能定位广场 */}
      <mesh position={[0, 13, 0]}>
        <cylinderGeometry args={[0.14, 0.14, 15, 8, 1, true]} />
        <meshBasicMaterial
          color={ColorBrandGold}
          transparent
          opacity={0.12}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[0, 13, 0]}>
        <cylinderGeometry args={[0.38, 0.38, 15, 8, 1, true]} />
        <meshBasicMaterial
          color={ColorBrandGold}
          transparent
          opacity={0.05}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      {(Object.keys(INDUSTRIES) as (keyof typeof INDUSTRIES)[]).map((ind, i) => {
        if (!visible) return null
        const angle = (i * Math.PI) / 2 + Math.PI / 4
        return (
          <Html
            key={ind}
            position={[Math.sin(angle) * 2.2, 3.7, Math.cos(angle) * 2.2]}
            center
            zIndexRange={[9, 0]}
          >
            <button
              className="nav-pill"
              style={{ borderColor: INDUSTRIES[ind].color, color: INDUSTRIES[ind].color }}
              onClick={() => {
                const pl = placed.find((p) => p.lot.industry === ind)
                if (pl) {
                  refs.teleportTo!.current = new THREE.Vector3(
                    pl.position[0] * 0.4,
                    0,
                    pl.position[2] * 0.4
                  )
                  onInteract()
                }
              }}
            >
              {INDUSTRIES[ind].label}
            </button>
          </Html>
        )
      })}
    </group>
  )
}

// ---------- 主场景 ----------
// Canvas 内部组件：在 Canvas 上下文中使用 useFrame，计算近景摊位集合。
// 关键：结果必须**上抛为 React state**（Set 引用变化才触发 PlaceholderHRs 重渲染）。
// 若改用 ref 传递（每帧替换 .current 但不触发重渲染），PlaceholderHRs 永远拿不到新集合
// → 近景占位人形不剔除，与近景真 HR 重叠（占位剔除失效事故）。
function NearTracker({
  placements,
  onNearChange,
}: {
  placements: LotPlacement[]
  onNearChange: (s: Set<string>) => void
}) {
  const prev = useRef<Set<string>>(new Set())
  useFrame((state) => {
    const cam = state.camera.position
    const next = new Set<string>()
    for (const pl of placements) {
      const dx = cam.x - pl.position[0]
      const dy = cam.y // 摊位根世界位置 y≈0，dy 即相机高度差（与 HRStand 的 3D 距离判定同语义）
      const dz = cam.z - pl.position[2]
      if (Math.sqrt(dx * dx + dy * dy + dz * dz) < 26) next.add(pl.lot.id)
    }
    // 仅当集合内容真正变化时才上抛，避免每帧 setState 引发整场景重渲染
    const p = prev.current
    if (next.size === p.size && [...next].every((id) => p.has(id))) return
    prev.current = next
    onNearChange(next)
  })
  return null
}

export function StreetScene({
  envHour,
  theme,
  onEnterOffice,
  onEnterGallery,
  onAddBasket,
  basketIds,
}: {
  envHour: number
  theme: ThemeName
  onEnterOffice: (lot: Lot) => void
  onEnterGallery?: () => void
  onAddBasket: (lot: Lot) => void
  basketIds: string[]
}) {
  const positionRef = useRef(new THREE.Vector3(8, 0, 2))
  const targetRef = useRef<THREE.Vector3 | null>(null)
  const teleportRef = useRef<THREE.Vector3 | null>(null)
  const headingRef = useRef(0.55)
  const focusRef = useRef<THREE.Vector3 | null>(null)
  const cameraRef = useRef<THREE.Camera | null>(null)
  /**
   * 近景摊位 id 集合（与 HRStand 的 NEAR=26 一致，用于 PlaceholderHRs 判断哪些实例移出视野）。
   * 以 **React state** 承载：NearTracker 在集合内容变化时上抛新 Set，引用变化触发
   * PlaceholderHRs 重渲染 —— 用 ref 承载则不触发重渲染，近景占位会与真 HR 重叠。
   */
  const [nearSet, setNearSet] = useState<Set<string>>(() => new Set())
  const refs = useMemo<RoamRefs>(
    () => ({
      position: positionRef,
      target: targetRef,
      teleportTo: teleportRef,
      heading: headingRef,
      focus: focusRef,
    }),
    []
  )
  // 诊断钩子：漫游状态（target / focus / position）——排查特写相机为何没切过去
  useEffect(() => {
    ;(window as unknown as { __roam: RoamRefs }).__roam = refs
  }, [refs])
  // 相机两段式（用户规格）：初始=鸟瞰全景（避免初始机位落进建筑内部），
  // 首次交互（点击地面/导航柱）后切换为第三人称跟随
  const [follow, setFollow] = useState(false)
  useEffect(() => {
    if (follow) preloadHRModels()
  }, [follow])
  // 计算近景摊位集合（与 HRStand 的 NEAR=26 一致），供 PlaceholderHRs 判断哪些占位实例移出视野
  // 注意：useFrame 必须在 <Canvas> 内部调用，故通过 NearTracker 子组件在 Canvas 内运行。
  const [deliveries, setDeliveries] = useState<
    { id: number; from: [number, number]; to: [number, number] }[]
  >([])
  const [initialProgress] = useState(loadStreetProgress)
  const [delivered, setDelivered] = useState<Set<string>>(() => new Set(initialProgress.delivered))
  const [visited, setVisited] = useState<string[]>(initialProgress.visited)
  const [xpFlash, setXpFlash] = useState(0)
  useEffect(() => {
    saveStreetProgress({ delivered: [...delivered], visited })
  }, [delivered, visited])
  const [nearLot, setNearLot] = useState<Lot | null>(null)
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null)
  const toastTimer = useRef<number | null>(null)
  useEffect(() => () => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
  }, [])
  const showToast = (text: string) => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    setToast({ id: Date.now(), text })
    toastTimer.current = window.setTimeout(() => setToast(null), 2400)
  }

  const handleVisit = (lot: Lot) => {
    setVisited((v) => (v.includes(lot.id) ? v : [...v, lot.id]))
  }

  // 四区进度已由导航器 GcNavigator 承担（§8.3 浮层职责互斥），HUD 只留"我的进度"
  const hudState = {
    delivered: [...delivered],
    basket: basketIds,
    visited,
    xpFlash,
  }

  const handleDeliver = (lot: Lot) => {
    if (delivered.has(lot.id)) return
    const p = positionRef.current
    const pl = placed.find((x) => x.lot.id === lot.id)
    const to: [number, number] = pl ? [pl.position[0], pl.position[2]] : [0, 0]
    setDeliveries((d) => [...d, { id: Date.now(), from: [p.x, p.z], to }])
    setDelivered((s) => new Set([...s, lot.id]))
    setXpFlash((f) => f + 1)
    showToast(`简历已投递 · ${lot.name}`)
  }

  const handleGround = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    setFollow(true)
    targetRef.current = new THREE.Vector3(e.point.x, 0, e.point.z)
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [22, 44, 22], fov: 45 }}
      // 阴影：此前 Canvas 未开 shadows → 整场景**零阴影**（地面全靠假光池）
      shadows
      gl={{ toneMapping: THREE.ACESFilmicToneMapping }}
      onCreated={({ camera, scene, gl }) => {
        cameraRef.current = camera
        // 场景图诊断钩子（T9 排查工具链沿用）：window.__st / __cam / __gl
        ;(window as unknown as { __st: THREE.Scene; __cam: THREE.Camera; __gl: THREE.WebGLRenderer }).__st = scene
        ;(window as unknown as { __st: THREE.Scene; __cam: THREE.Camera; __gl: THREE.WebGLRenderer }).__cam = camera
        ;(window as unknown as { __st: THREE.Scene; __cam: THREE.Camera; __gl: THREE.WebGLRenderer }).__gl = gl
        // 初始鸟瞰：俯瞰十字路口全景（用户规格——原初始机位落在 lot0 建筑内部=全黑）
        camera.lookAt(0, 0, 0)
        // 首帧编译完成后再撤加载遮罩（避免黑屏窗口期）
        requestAnimationFrame(() =>
          requestAnimationFrame(() => window.dispatchEvent(new Event('street-ready')))
        )
      }}
    >
      {/* v4 玻璃数字孪生：天空/主光/补光/阴影/雾全部由 WorkdaySky 按系统时间统一管理 */}
      <WorkdaySky envHour={envHour} theme={theme} fogNear={TwinFogNear} fogFar={TwinFogFar} />
      {/* IBL：程序化天幕烘成环境贴图 → 玻璃体块有天光反射、路面有磨砂反射（不增 draw call） */}
      <TwinEnvironment envHour={envHour} theme={theme} />
      <Roads theme={theme} />
      <RoadLanes />
      <DistrictRoadSigns />
      <DistantSkyline theme={theme} />
      <StreetLamps theme={theme} />
      <ArchWay industry="internet" axisX sign={1} theme={theme} />
      <ArchWay industry="finance" axisX sign={-1} theme={theme} />
      <ArchWay industry="manufacturing" axisX={false} sign={1} theme={theme} />
      <ArchWay industry="culture" axisX={false} sign={-1} theme={theme} />
      {/* NPC 求职者闲逛（人行道往返，街区人气） */}
      <Suspense fallback={null}>
        <NPC a={[12, 4.2]} b={[30, 4.2]} />
        <NPC a={[-12, -4.2]} b={[-30, -4.2]} />
        <NPC a={[4.2, 12]} b={[4.2, 30]} />
        <NPC a={[-4.2, -12]} b={[-4.2, -30]} />
      </Suspense>
      {/* 地面引导带：四街区域色（动线可读性，盲审修复） */}
      {placed.length > 0 &&
        (['internet', 'finance', 'manufacturing', 'culture'] as const).map((ind, i) => {
          const sign = i < 2 ? 1 : -1
          const axisX = i % 2 === 0
          const len = 34
          const cx = axisX ? (sign * (8 + len / 2)) : 0
          const cz = axisX ? 0 : sign * (8 + len / 2)
          return (
            <mesh key={ind} rotation={[-Math.PI / 2, 0, axisX ? 0 : Math.PI / 2]} position={[cx, 0.02, cz]}>
              <planeGeometry args={[len, 0.16]} />
              <meshStandardMaterial
                color={INDUSTRIES[ind].color}
                emissive={INDUSTRIES[ind].color}
                emissiveIntensity={0.32}
                transparent
                opacity={0.45}
              />
            </mesh>
          )
        })}
      {placed.map((pl) => (
        <group key={pl.lot.id} position={pl.position} rotation={[0, pl.rotationY, 0]}>
          <HRStand lot={pl.lot} onEnterOffice={onEnterOffice} delivered={delivered.has(pl.lot.id)} theme={theme} />
        </group>
      ))}
      {/* M6a：远景占位人形 InstancedMesh 池（替代每个摊位 11 个独立 mesh 的 PlaceholderHR） */}
      <PlaceholderHRs placements={placed} near={nearSet} night={theme === 'dark'} />
      {/* M6a：在 Canvas 内部使用 useFrame 计算近景摊位集合（变化时以 state 上抛） */}
      <NearTracker placements={placed} onNearChange={setNearSet} />
      {/* M6b：办公空间门面 InstancedMesh 池（替代每个摊位门面的多个独立 mesh） */}
      <OfficeFacadeInstanced placements={placed} theme={theme} night={theme === 'dark'} />
      {/* M6c：摊位硬件 InstancedMesh 池（替代每个摊位的摊位台/雨棚/侧招/参数具象化/门前细节） */}
      <BoothHardwareInstanced placements={placed} theme={theme} night={theme === 'dark'} delivered={delivered} />
      {/* 个体识别：地面编号牌（01–64）+ 行业色信标鳍 —— 共 2 个 draw call */}
      <LotNumberDecals />
      <LotBeacons />
      {/* 摊位硬件实例化：雨棚立柱 256 根 → 1 个 draw call；钱袋堆 → 2 个 draw call */}
      <BoothPoles night={theme === 'dark'} />
      <MoneyStacks />
      <ParamSteles theme={theme} />
      <RarityGems />
      {/* 点击地面行走（透明事件面） */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} onClick={handleGround}>
        <planeGeometry args={[STREET_BOUNDS * 2, STREET_BOUNDS * 2]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <AvatarActor position={[8, 0, 2]} facing={0.55} roam refs={refs} bounds={STREET_BOUNDS} />
      {/* 第三人称跟随：首次交互后才启用（相机从鸟瞰平滑俯冲入场） */}
      <RoamCamera enabled={follow} refs={refs} />
      <NearSampler
        refs={refs}
        onVisit={handleVisit}
        onNear={setNearLot}
        active={follow}
      />
      {nearLot && <NearRing lot={nearLot} />}
      {deliveries.map((d) => (
        <DeliveryFX key={d.id} d={d} onDone={() => setDeliveries((l) => l.filter((x) => x.id !== d.id))} />
      ))}
      <NavPillar refs={refs} onInteract={() => setFollow(true)} visible={follow} theme={theme} />
      {/* 求职者展位示例（P2 候选人侧）：街区中央附近，展示求职者 3D 形象、作品环绕、要价云 */}
      <CandidateBooth
        expectedSalary={450000}
        exposeMode="band"
        works={[
          { id: 'w1', title: '电商平台重构', type: 'ui', imageUrl: '', privacy: 'public' },
          { id: 'w2', title: '实时数据看板', type: 'project', imageUrl: '', privacy: 'public' },
          { id: 'w3', title: '3D 产品展台', type: '3d', imageUrl: '', privacy: 'public' },
        ]}
        night={theme === 'dark'}
        position={[0, 0, 14]}
      />
      {/* 作品廊入口（v1.4 双角色体系）：求职者空间独立入口，不进顶栏，从街道路牌进入 */}
      <mesh
        position={[0, 1.5, 20]}
        onClick={onEnterGallery}
        onPointerOver={() => (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = 'default')}
      >
        <cylinderGeometry args={[0.6, 3, 0.6]} />
        <meshStandardMaterial
          color="#16C0B6"
          emissive="#16C0B6"
          emissiveIntensity={theme === 'dark' ? 1.5 : 0.5}
          transparent
          opacity={0.9}
        />
      </mesh>
      <Html position={[0, 3.5, 20]} center>
        <div style={{ color: '#16C0B6', fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap' }}>
          作品廊 · 求职者独立空间
        </div>
      </Html>
      </Canvas>
      <div className="scene-vignette" aria-hidden />
      <GameHud state={hudState} />
      {toast && (
        <div key={toast.id} className="game-toast">
          {toast.text} <b>+10 XP</b>
        </div>
      )}
      {follow && nearLot && (
        <LotCard
          lot={nearLot}
          delivered={delivered}
          onEnterOffice={onEnterOffice}
          onDeliver={handleDeliver}
          onAddBasket={onAddBasket}
        />
      )}
      {follow && (
        <GameMiniMap
          refs={refs}
          delivered={delivered}
          visited={visited}
          basket={basketIds}
        />
      )}
      {!follow && (
        <button className="street-cta" onClick={() => setFollow(true)}>
          点击地面开始逛 · 四区街道任你走
        </button>
      )}
      </div>
  )
}
