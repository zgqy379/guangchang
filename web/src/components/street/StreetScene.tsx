// 招聘街区场景：十字路口 + 四大领域街区 + 玩家漫游 + 就近名片（project.md v1.2 P0）
import { Suspense, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, ThreeEvent } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { WorkdaySky } from '../WorkdaySky'
import { AvatarActor, RoamRefs } from '../AvatarActor'
import { RoamCamera } from '../RoamCamera'
import { HRStand } from './HRStand'
import { NPC } from './NPC'
import { INDUSTRIES, Lot, placeLots, STREET_BOUNDS } from '../../data/street-companies'
import { totalPackage } from '../../engine/params'

const placed = placeLots()
const fmtClock = (h: number) => `${String(Math.floor(h)).padStart(2, '0')}:${h % 1 ? '30' : '00'}`

// ---------- 街景静态元素 ----------
function Roads() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[240, 240]} />
        <meshStandardMaterial color="#151b22" roughness={1} />
      </mesh>
      {/* 十字两条路（albedo 提亮一档，盲审：黑地不可读） */}
      {[0, Math.PI / 2].map((rot, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, rot]} position={[0, 0, 0]}>
          <planeGeometry args={[180, 10.4]} />
          <meshStandardMaterial color="#2b323b" roughness={0.9} />
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
        <meshStandardMaterial color="#232a32" roughness={0.9} />
      </mesh>
    </group>
  )
}

// 路灯（每街两侧 8 盏 × 4 街 = 64，实例化）
function StreetLamps() {
  const ref = useRef<THREE.InstancedMesh>(null)
  const headRef = useRef<THREE.InstancedMesh>(null)
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
  useMemo(() => {
    const m = ref.current
    const h = headRef.current
    if (!m || !h) return
    const o = new THREE.Object3D()
    mats.forEach((p, i) => {
      o.position.set(p[0], 1.8, p[2])
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
      o.position.set(p[0], 3.68, p[2])
      o.updateMatrix()
      h.setMatrixAt(i, o.matrix)
    })
    m.instanceMatrix.needsUpdate = true
    h.instanceMatrix.needsUpdate = true
  }, [mats])
  return (
    <>
      <instancedMesh ref={ref} args={[undefined, undefined, mats.length]}>
        <cylinderGeometry args={[0.035, 0.05, 3.6, 6]} />
        <meshStandardMaterial color="#414b56" />
      </instancedMesh>
      {/* 灯头发光（盲审：路灯零发光） */}
      <instancedMesh ref={headRef} args={[undefined, undefined, mats.length]}>
        <sphereGeometry args={[0.17, 10, 8]} />
        <meshStandardMaterial color="#ffd9a0" emissive="#ffc46b" emissiveIntensity={2.6} />
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
  return (
    <group rotation={[0, axisX ? 0 : Math.PI / 2, 0]} position={[axisX ? sign * 12 : 0, 0, axisX ? 0 : sign * 12]}>
      {[-4.8, 4.8].map((x) => (
        <mesh key={x} position={[x, 2.75, 0]}>
          <boxGeometry args={[0.55, 5.5, 0.55]} />
          <meshStandardMaterial color="#2c343d" roughness={0.85} />
        </mesh>
      ))}
      <mesh position={[0, 5.75, 0]}>
        <boxGeometry args={[10.4, 1.0, 0.6]} />
        <meshStandardMaterial color="#2c343d" roughness={0.85} />
      </mesh>
      <mesh position={[0, 5.75, 0.34]}>
        <planeGeometry args={[9.2, 0.82]} />
        <meshBasicMaterial map={tex} />
      </mesh>
      <mesh position={[0, 5.75, -0.34]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[9.2, 0.82]} />
        <meshBasicMaterial map={tex} />
      </mesh>
    </group>
  )
}

// 投递飞袋：从玩家位置抛物线飞向摊位（投简历动画）
function DeliveryFX({
  d,
  onDone,
}: {
  d: { id: number; from: [number, number]; to: [number, number] }
  onDone: () => void
}) {
  const ref = useRef<THREE.Mesh>(null)
  const t = useRef(0)
  useFrame((_, dt) => {
    t.current += dt
    const k = Math.min(1, t.current / 0.9)
    const m = ref.current
    if (m) {
      m.position.set(
        d.from[0] + (d.to[0] - d.from[0]) * k,
        0.8 + Math.sin(k * Math.PI) * 2.4,
        d.from[1] + (d.to[1] - d.from[1]) * k
      )
      m.rotation.y += dt * 9
    }
    if (k >= 1) onDone()
  })
  return (
    <mesh ref={ref}>
      <boxGeometry args={[0.24, 0.09, 0.16]} />
      <meshStandardMaterial color="#c23a2b" emissive="#c23a2b" emissiveIntensity={0.45} />
    </mesh>
  )
}

// ---------- 就近名片：单实例 Html 跟随最近摊位 ----------
function NearestLotCard({
  refs,
  onEnterOffice,
  onDeliver,
  onAddBasket,
  delivered,
}: {
  refs: RoamRefs
  onEnterOffice: (lot: Lot) => void
  onDeliver: (lot: Lot) => void
  onAddBasket: (lot: Lot) => void
  delivered: Set<string>
}) {
  const [near, setNear] = useState<Lot | null>(null)
  const cooldown = useRef(0)
  useFrame((_, dt) => {
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
    if (best?.id !== near?.id) setNear(best)
  })
  if (!near) return null
  const pl = placed.find((x) => x.lot.id === near.id)!
  return (
    <Html position={[pl.position[0], 2.95, pl.position[2]]} center distanceFactor={14} zIndexRange={[10, 0]}>
      <div className="lot-card">
        <div className="lot-card-name">
          {near.name}
          <span style={{ color: INDUSTRIES[near.industry].color }}> {near.industryLabel}</span>
        </div>
        <div className="lot-card-line">
          总包 <b>{Math.round(totalPackage(near.params) / 10000)}万</b> · 下班{' '}
          {fmtClock(near.params.offworkTime)} ·{' '}
          {near.params.socialInsuranceBaseRatio === 'full' ? '五险全额' : `基数${near.params.socialInsuranceBaseRatio}`}
        </div>
        <div className="lot-card-tag">{near.tagline}</div>
        <div className="lot-card-actions">
          <button onClick={() => onEnterOffice(near)}>🏢 进办公室参观</button>
          {delivered.has(near.id) ? (
            <button className="ghost" disabled>
              ✓ 已投递
            </button>
          ) : (
            <button className="ghost" onClick={() => onDeliver(near)}>
              📮 投简历
            </button>
          )}
          <button className="ghost" onClick={() => onAddBasket(near)}>
            🧺 对比
          </button>
        </div>
      </div>
    </Html>
  )
}

// ---------- 中央导航柱：点击传送 ----------
function NavPillar({ refs }: { refs: RoamRefs }) {
  return (
    <group>
      <mesh position={[0, 1.1, 0]}>
        <cylinderGeometry args={[0.34, 0.44, 2.2, 12]} />
        <meshStandardMaterial color="#2c343d" roughness={0.85} />
      </mesh>
      {(Object.keys(INDUSTRIES) as (keyof typeof INDUSTRIES)[]).map((ind, i) => {
        const angle = (i * Math.PI) / 2 + Math.PI / 4
        return (
          <Html key={ind} position={[Math.sin(angle) * 1.15, 2.7, Math.cos(angle) * 1.15]} center distanceFactor={12}>
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
}: {
  offworkHour: number
  onEnterOffice: (lot: Lot) => void
  onAddBasket: (lot: Lot) => void
}) {
  const positionRef = useRef(new THREE.Vector3(8, 0, 2.6))
  const targetRef = useRef<THREE.Vector3 | null>(null)
  const teleportRef = useRef<THREE.Vector3 | null>(null)
  const refs = useMemo<RoamRefs>(
    () => ({ position: positionRef, target: targetRef, teleportTo: teleportRef }),
    []
  )
  const [deliveries, setDeliveries] = useState<
    { id: number; from: [number, number]; to: [number, number] }[]
  >([])
  const [delivered, setDelivered] = useState<Set<string>>(new Set())

  const handleDeliver = (lot: Lot) => {
    if (delivered.has(lot.id)) return
    const p = positionRef.current
    const pl = placed.find((x) => x.lot.id === lot.id)
    const to: [number, number] = pl ? [pl.position[0], pl.position[2]] : [0, 0]
    setDeliveries((d) => [...d, { id: Date.now(), from: [p.x, p.z], to }])
    setDelivered((s) => new Set([...s, lot.id]))
  }

  const handleGround = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    targetRef.current = new THREE.Vector3(e.point.x, 0, e.point.z)
  }

  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [13, 4.5, 9], fov: 50 }}
      gl={{ toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.15 }}
      onCreated={() => {
        // 首帧编译完成后再撤加载遮罩（避免黑屏窗口期）
        requestAnimationFrame(() =>
          requestAnimationFrame(() => window.dispatchEvent(new Event('street-ready')))
        )
      }}
    >
      <WorkdaySky offworkHour={offworkHour} fogNear={30} fogFar={170} />
      {/* 商业级光照基线：天光半球 + 月光平行光（盲审修复：黑地亮天断裂） */}
      <hemisphereLight args={['#ffb08a', '#1a2040', 0.5]} />
      <directionalLight position={[12, 14, 8]} color="#8fa8ff" intensity={0.75} />
      <Roads />
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
              <planeGeometry args={[len, 0.7]} />
              <meshStandardMaterial
                color={INDUSTRIES[ind].color}
                emissive={INDUSTRIES[ind].color}
                emissiveIntensity={0.22}
                transparent
                opacity={0.32}
              />
            </mesh>
          )
        })}
      {placed.map((pl) => (
        <group key={pl.lot.id} position={pl.position} rotation={[0, pl.rotationY, 0]}>
          <HRStand lot={pl.lot} onEnterOffice={onEnterOffice} />
        </group>
      ))}
      {/* 点击地面行走（透明事件面） */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} onClick={handleGround}>
        <planeGeometry args={[STREET_BOUNDS * 2, STREET_BOUNDS * 2]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <AvatarActor position={[0, 0, 4.5]} roam refs={refs} bounds={STREET_BOUNDS} />
      <RoamCamera enabled refs={refs} />
      <NearestLotCard
        refs={refs}
        onEnterOffice={onEnterOffice}
        onDeliver={handleDeliver}
        onAddBasket={onAddBasket}
        delivered={delivered}
      />
      {deliveries.map((d) => (
        <DeliveryFX key={d.id} d={d} onDone={() => setDeliveries((l) => l.filter((x) => x.id !== d.id))} />
      ))}
      <NavPillar refs={refs} />
      {/* 街区提示 */}
      <Html position={[0, 4.1, 0]} center distanceFactor={16}>
        <div className="street-banner">
          逛厂招聘街区 · 走到摊位前看名片 · 点击「进办公室参观」
        </div>
      </Html>
    </Canvas>
  )
}
