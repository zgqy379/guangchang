// 招聘街区场景：十字路口 + 四大领域街区 + 玩家漫游 + 就近名片（project.md v1.2 P0）
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, ThreeEvent } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { WorkdaySky } from '../WorkdaySky'
import { AvatarActor, RoamRefs } from '../AvatarActor'
import { RoamCamera } from '../RoamCamera'
import { HRStand, preloadHRModels } from './HRStand'
import { NPC } from './NPC'
import { GameHud, rarityOf } from './GameHud'
import { GameMiniMap } from './GameMiniMap'
import { INDUSTRIES, Lot, placeLots, STREET_BOUNDS } from '../../data/street-companies'
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
} from '../../../generated/design-tokens.output.mjs'

const PROGRESS_KEY = 'gc-street-progress-v1'

function loadProgress(): { delivered: string[]; visited: string[] } {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY)
    if (raw) {
      const p = JSON.parse(raw) as { delivered?: unknown; visited?: unknown }
      return {
        delivered: Array.isArray(p.delivered) ? (p.delivered as string[]) : [],
        visited: Array.isArray(p.visited) ? (p.visited as string[]) : [],
      }
    }
  } catch {
    /* 隐私模式下 localStorage 不可用，退回空进度 */
  }
  return { delivered: [], visited: [] }
}

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

function Roads() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[240, 240]} />
        <meshStandardMaterial color={ColorSceneFloor} map={ASPHALT} roughness={1} />
      </mesh>
      {/* 十字两条路（albedo 提亮一档，盲审：黑地不可读） */}
      {[0, Math.PI / 2].map((rot, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, rot]} position={[0, 0, 0]}>
          <planeGeometry args={[180, 10.4]} />
          <meshStandardMaterial color={ColorSceneRoad} map={ASPHALT} roughness={0.85} />
        </mesh>
      ))}
      {/* 中央斑马线（收窄至 0.5m，尺度校正） */}
      {[0, Math.PI / 2].map((rot, i) => (
        <group key={`z${i}`} rotation={[0, rot, 0]}>
          {[-6.4, -5.8, -5.2, 5.2, 5.8, 6.4].map((z) => (
            <mesh key={z} rotation={[-Math.PI / 2, 0, 0]} position={[z, 0.005, 0]}>
              <planeGeometry args={[0.5, 9.6]} />
              <meshStandardMaterial color="#c8d2da" opacity={0.55} transparent />
            </mesh>
          ))}
        </group>
      ))}
      {/* 中央转盘基石 */}
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[3.4, 3.6, 0.12, 32]} />
        <meshStandardMaterial color={ColorSceneGateDark} roughness={0.9} />
      </mesh>
    </group>
  )
}

// 参数碑：碑高=总包、5 灯条=五险、顶灯=下班时间（4 个 InstancedMesh）
function ParamSteles() {
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
      <instancedMesh ref={body} args={[undefined, undefined, data.length]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={ColorSceneGateDark} roughness={0.85} />
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

// 远景天际线：四街尽头的灯塔塔楼 + 斜向中层楼群（雾中剪影）
function DistantSkyline() {
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
      <meshStandardMaterial color={ColorSceneFloor} roughness={0.95} emissive="#0e1622" emissiveIntensity={0.6} />
    </instancedMesh>
  )
}

// 路灯（每街两侧 8 盏 × 4 街 = 64，实例化）
function StreetLamps() {
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
        <meshStandardMaterial color={ColorSceneGate} />
      </instancedMesh>
      {/* 灯头发光（盲审：路灯零发光） */}
      <instancedMesh ref={headRef} args={[undefined, undefined, mats.length]}>
        <sphereGeometry args={[0.17, 10, 8]} />
        <meshStandardMaterial color={ColorSceneLamp} emissive={ColorSceneLamp} emissiveIntensity={2.6} />
      </instancedMesh>
      {/* 地面暖光池（廉价假光，替代 64 个点光源） */}
      <instancedMesh ref={poolRef} args={[undefined, undefined, mats.length]}>
        <planeGeometry args={[3.4, 3.4]} />
        <meshBasicMaterial
          map={poolTex}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          opacity={0.55}
        />
      </instancedMesh>
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

function ArchWay({ industry, axisX, sign }: { industry: keyof typeof INDUSTRIES; axisX: boolean; sign: 1 | -1 }) {
  const tex = useMemo(() => labelTexture(INDUSTRIES[industry].label, INDUSTRIES[industry].color), [industry])
  const color = INDUSTRIES[industry].color
  return (
    <group rotation={[0, axisX ? Math.PI / 2 : 0, 0]} position={[axisX ? sign * 22 : 0, 0, axisX ? 0 : sign * 22]}>
      {[-4.8, 4.8].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh position={[0, 2.65, 0]}>
            <boxGeometry args={[0.42, 5.3, 0.42]} />
            <meshStandardMaterial color={ColorSceneGate} roughness={0.7} emissive={color} emissiveIntensity={0.12} />
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
      <mesh position={[0, 5.6, 0]}>
        <boxGeometry args={[10.4, 1.0, 0.6]} />
        <meshStandardMaterial color={ColorSceneGate} roughness={0.7} emissive={color} emissiveIntensity={0.1} />
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
    </group>
  )
}

// ---------- 就近摊位采样：R3F 内每 0.25s 找最近 lot，交 DOM 层渲染名片 ----------
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
  useFrame((_, dt) => {
    if (!active) return
    cooldown.current -= dt
    if (cooldown.current > 0) return
    cooldown.current = 0.25
    const p = refs.position.current
    let best: Lot | null = null
    let bestD = 8.5
    for (const pl of placed) {
      const d = Math.hypot(p.x - pl.position[0], p.z - pl.position[2])
      if (d < bestD) {
        bestD = d
        best = pl.lot
      }
    }
    if (best && !reported.current.has(best.id)) {
      reported.current.add(best.id)
      onVisit(best)
    }
    if ((best?.id ?? null) !== last.current) {
      last.current = best?.id ?? null
      if (refs.focus) {
        const pl = best ? placed.find((p) => p.lot.id === best!.id) : null
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
      <div className="lot-card-line">
        总包 <b>{Math.round(totalPackage(lot.params) / 10000)}万</b> · 下班{' '}
        {fmtClock(lot.params.offworkTime)} ·{' '}
        {lot.params.socialInsuranceBaseRatio === 'full'
          ? '五险全额'
          : `基数${lot.params.socialInsuranceBaseRatio}`}
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
}: {
  refs: RoamRefs
  onInteract: () => void
  visible: boolean
}) {
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
      <mesh position={[0, 2.5, 0]}>
        <cylinderGeometry args={[0.42, 0.62, 5, 8]} />
        <meshStandardMaterial color={ColorSceneGateDark} roughness={0.7} emissive="#1a2230" emissiveIntensity={0.5} />
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
          emissiveIntensity={2.4}
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
export function StreetScene({
  offworkHour,
  onEnterOffice,
  onAddBasket,
  basketIds,
}: {
  offworkHour: number
  onEnterOffice: (lot: Lot) => void
  onAddBasket: (lot: Lot) => void
  basketIds: string[]
}) {
  const positionRef = useRef(new THREE.Vector3(8, 0, 2))
  const targetRef = useRef<THREE.Vector3 | null>(null)
  const teleportRef = useRef<THREE.Vector3 | null>(null)
  const headingRef = useRef(0.55)
  const focusRef = useRef<THREE.Vector3 | null>(null)
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
  // 相机两段式（用户规格）：初始=鸟瞰全景（避免初始机位落进建筑内部），
  // 首次交互（点击地面/导航柱）后切换为第三人称跟随
  const [follow, setFollow] = useState(false)
  useEffect(() => {
    if (follow) preloadHRModels()
  }, [follow])
  const [deliveries, setDeliveries] = useState<
    { id: number; from: [number, number]; to: [number, number] }[]
  >([])
  const [initialProgress] = useState(loadProgress)
  const [delivered, setDelivered] = useState<Set<string>>(() => new Set(initialProgress.delivered))
  const [visited, setVisited] = useState<string[]>(initialProgress.visited)
  const [xpFlash, setXpFlash] = useState(0)
  useEffect(() => {
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify({ delivered: [...delivered], visited }))
    } catch {
      /* 隐私模式下不可写，忽略 */
    }
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

  const perIndustry = useMemo(() => {
    const acc: Record<string, number> = {}
    for (const id of visited) {
      const ind = id.split('-')[0]
      acc[ind] = (acc[ind] ?? 0) + 1
    }
    return acc
  }, [visited])

  const hudState = {
    delivered: [...delivered],
    basket: basketIds,
    visited,
    perIndustry,
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
      gl={{ toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.4 }}
      onCreated={({ camera, scene }) => {
        // 场景图诊断钩子（T9 排查工具链沿用）：window.__st / __cam
        ;(window as unknown as { __st: THREE.Scene; __cam: THREE.Camera }).__st = scene
        ;(window as unknown as { __st: THREE.Scene; __cam: THREE.Camera }).__cam = camera
        // 初始鸟瞰：俯瞰十字路口全景（用户规格——原初始机位落在 lot0 建筑内部=全黑）
        camera.lookAt(0, 0, 0)
        // 首帧编译完成后再撤加载遮罩（避免黑屏窗口期）
        requestAnimationFrame(() =>
          requestAnimationFrame(() => window.dispatchEvent(new Event('street-ready')))
        )
      }}
    >
      <WorkdaySky offworkHour={offworkHour} fogNear={30} fogFar={170} />
      {/* 商业级光照基线：天光半球 + 月光平行光 + 暖色反向补光（压暗侧立面可读） */}
      <hemisphereLight args={['#ffc3a0', '#243049', 0.65]} />
      <directionalLight position={[12, 14, 8]} color="#8fa8ff" intensity={0.75} />
      <directionalLight position={[-16, 9, 12]} color="#ffb08a" intensity={0.4} />
      <Roads />
      <RoadLanes />
      <DistantSkyline />
      <StreetLamps />
      <ArchWay industry="internet" axisX sign={1} />
      <ArchWay industry="finance" axisX sign={-1} />
      <ArchWay industry="manufacturing" axisX={false} sign={1} />
      <ArchWay industry="culture" axisX={false} sign={-1} />
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
              <planeGeometry args={[len, 0.8]} />
              <meshStandardMaterial
                color={INDUSTRIES[ind].color}
                emissive={INDUSTRIES[ind].color}
                emissiveIntensity={0.3}
                transparent
                opacity={0.35}
              />
            </mesh>
          )
        })}
      {placed.map((pl) => (
        <group key={pl.lot.id} position={pl.position} rotation={[0, pl.rotationY, 0]}>
          <HRStand lot={pl.lot} onEnterOffice={onEnterOffice} />
        </group>
      ))}
      <ParamSteles />
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
      <NavPillar refs={refs} onInteract={() => setFollow(true)} visible={follow} />
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
      {follow && <GameMiniMap refs={refs} delivered={delivered} />}
      {!follow && (
        <button className="street-cta" onClick={() => setFollow(true)}>
          点击地面开始逛 · 四区街道任你走
        </button>
      )}
      </div>
  )
}
