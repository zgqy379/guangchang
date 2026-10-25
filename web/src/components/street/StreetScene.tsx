// 招聘街区场景：十字路口 + 四大领域街区 + 玩家漫游 + 就近名片（project.md v1.2 P0）
import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, ThreeEvent } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { WorkdaySky } from '../WorkdaySky'
import { AvatarActor, RoamRefs } from '../AvatarActor'
import { RoamCamera } from '../RoamCamera'
import { HRStand } from './HRStand'
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
        <meshStandardMaterial color="#11161c" roughness={1} />
      </mesh>
      {/* 十字两条路 */}
      {[0, Math.PI / 2].map((rot, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, rot]} position={[0, 0, 0]}>
          <planeGeometry args={[180, 10.4]} />
          <meshStandardMaterial color="#1a2027" roughness={0.95} />
        </mesh>
      ))}
      {/* 中央斑马线 */}
      {[0, Math.PI / 2].map((rot, i) => (
        <group key={`z${i}`} rotation={[0, rot, 0]}>
          {[-6.2, -5.6, 5.6, 6.2].map((z) => (
            <mesh key={z} rotation={[-Math.PI / 2, 0, 0]} position={[z, 0.005, 0]}>
              <planeGeometry args={[1.1, 9.6]} />
              <meshStandardMaterial color="#a8b3bd" opacity={0.4} transparent />
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
    if (!m) return
    const o = new THREE.Object3D()
    mats.forEach((p, i) => {
      o.position.set(p[0], 1.8, p[2])
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
    })
    m.instanceMatrix.needsUpdate = true
  }, [mats])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, mats.length]}>
      <cylinderGeometry args={[0.05, 0.07, 3.6, 6]} />
      <meshStandardMaterial color="#39424c" />
    </instancedMesh>
  )
}

// ---------- 就近名片：单实例 Html 跟随最近摊位 ----------
function NearestLotCard({
  refs,
  onEnterOffice,
}: {
  refs: RoamRefs
  onEnterOffice: (lot: Lot) => void
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
          <button className="ghost">📮 投简历</button>
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
}: {
  offworkHour: number
  onEnterOffice: (lot: Lot) => void
}) {
  const positionRef = useRef(new THREE.Vector3(8, 0, 2.6))
  const targetRef = useRef<THREE.Vector3 | null>(null)
  const teleportRef = useRef<THREE.Vector3 | null>(null)
  const refs = useMemo<RoamRefs>(
    () => ({ position: positionRef, target: targetRef, teleportTo: teleportRef }),
    []
  )

  const handleGround = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    targetRef.current = new THREE.Vector3(e.point.x, 0, e.point.z)
  }

  return (
    <Canvas dpr={[1, 2]} camera={{ position: [13, 4.5, 9], fov: 50 }}>
      <WorkdaySky offworkHour={offworkHour} fogNear={30} fogFar={170} />
      <Roads />
      <StreetLamps />
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
      <NearestLotCard refs={refs} onEnterOffice={onEnterOffice} />
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
