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

const DRACO_PATH = 'https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/libs/draco/gltf/'
const HR_POOL = [
  'hr-f01', 'hr-f02', 'hr-f03', 'hr-f04', 'hr-f05',
  'hr-m01', 'hr-m02', 'hr-m03', 'hr-m04',
]
const NEAR = 18
const FAR = 26

// 真 HR 形象：SkeletonUtils 克隆共享场景（保蒙皮）+ 播放 Idle（重定向产物），身高归一 1.6m
function RealHR({ hrIndex }: { hrIndex: number }) {
  const file = HR_POOL[hrIndex % HR_POOL.length]
  const { scene, animations } = useGLTF(assetUrl(`/assets/hr/${file}-idle.glb`), DRACO_PATH)
  const ref = useRef<THREE.Group>(null)
  const clone = useMemo(() => skeletonClone(scene), [scene])
  const { actions } = useAnimations(animations, ref)

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

// 占位形象（远景/加载中）：低模色块人
function PlaceholderHR({ color, night }: { color: string; night: boolean }) {
  return (
    <group>
      <mesh position={[0, 0.62, 0]}>
        <capsuleGeometry args={[0.22, 0.62, 4, 10]} />
        <meshStandardMaterial color={color} roughness={0.75} />
      </mesh>
      <mesh position={[0, 1.28, 0]}>
        <sphereGeometry args={[0.19, 16, 14]} />
        <meshStandardMaterial color="#e8b98a" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.78, 0.2]}>
        <boxGeometry args={[0.12, 0.16, 0.02]} />
        <meshStandardMaterial color="#e6edf3" />
      </mesh>
      <mesh position={[0, 1.75, 0]}>
        <sphereGeometry args={[0.1, 12, 10]} />
        <meshBasicMaterial color={night ? '#e8edf5' : '#ffd4b0'} />
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

export function HRStand({ lot, onEnterOffice }: { lot: Lot; onEnterOffice: (lot: Lot) => void }) {
  const nameTex = useNameTexture(lot.name, lot.industry)
  const color = INDUSTRIES[lot.industry].color
  const total = totalPackage(lot.params)
  const layers = Math.max(2, Math.min(7, Math.round(total / 100000)))
  const night = lot.params.offworkTime >= 20

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
        <meshStandardMaterial color="#2a3138" roughness={0.9} />
      </mesh>
      {/* HR 形象（near 时真 GLB，Suspense 加载期回退占位） */}
      <group position={[0, 0.14, 0]}>
        {near ? (
          <Suspense fallback={<PlaceholderHR color={color} night={night} />}>
            <RealHR hrIndex={lot.hrIndex} />
          </Suspense>
        ) : (
          <PlaceholderHR color={color} night={night} />
        )}
      </group>
      {/* 名牌 */}
      <sprite position={[0, 2.35, 0]} scale={[1.3, 0.33, 1]}>
        <spriteMaterial map={nameTex} transparent />
      </sprite>
      {/* 参数具象化：总包钱袋堆 + 五险切口牌 */}
      <group position={[0.62, 0.14, 0.55]}>
        {Array.from({ length: layers }).map((_, i) => (
          <mesh key={i} position={[0, 0.04 + i * 0.075, 0]}>
            <boxGeometry args={[0.34, 0.07, 0.22]} />
            <meshStandardMaterial
              color={i === layers - 1 && lot.params.salaryStructure > 12 ? '#d98e32' : '#c23a2b'}
              emissive={i === layers - 1 && lot.params.salaryStructure > 12 ? '#d98e32' : '#c23a2b'}
              emissiveIntensity={0.25}
            />
          </mesh>
        ))}
      </group>
      <group position={[-0.62, 0.14, 0.55]}>
        <mesh position={[0, 0.16, 0]}>
          <boxGeometry args={[0.3, 0.32, 0.06]} />
          <meshStandardMaterial color="#3d4650" />
        </mesh>
        <mesh position={[0, 0.16 + (lot.params.socialInsuranceBaseRatio === 'full' ? 0.12 : 0.05), 0.031]}>
          <boxGeometry args={[0.24, lot.params.socialInsuranceBaseRatio === 'full' ? 0.08 : 0.22, 0.01]} />
          <meshStandardMaterial color="#8b949e" />
        </mesh>
      </group>
      {/* 办公空间门面 */}
      <group position={[0, 0, -3.6]}>
        <mesh position={[0, 2.5, 0]}>
          <boxGeometry args={[6.4, 5, 5.2]} />
          <meshStandardMaterial color="#1d232a" roughness={0.95} />
        </mesh>
        {[-2.2, -0.9, 0.9, 2.2].map((wx, i) =>
          [1.4, 2.9].map((wy, j) => (
            <mesh key={`${i}-${j}`} position={[wx, wy, 2.62]}>
              <planeGeometry args={[0.9, 0.8]} />
              <meshStandardMaterial
                color={(i + j) % 3 === 0 ? '#ffd28a' : '#22303c'}
                emissive={(i + j) % 3 === 0 ? '#ffb45e' : '#0a121a'}
                emissiveIntensity={(i + j) % 3 === 0 ? 0.9 : 0.15}
              />
            </mesh>
          ))
        )}
        <mesh position={[0, 1.05, 2.62]}>
          <planeGeometry args={[1.1, 2.1]} />
          <meshStandardMaterial color="#0e2740" emissive="#1f5a96" emissiveIntensity={0.5} />
        </mesh>
        <mesh
          position={[0, 2.35, 2.64]}
          onClick={(e) => {
            e.stopPropagation()
            onEnterOffice(lot)
          }}
          onPointerOver={() => (document.body.style.cursor = 'pointer')}
          onPointerOut={() => (document.body.style.cursor = 'default')}
        >
          <planeGeometry args={[1.6, 0.42]} />
          <meshBasicMaterial color="#58a6ff" transparent opacity={0.92} />
        </mesh>
      </group>
    </group>
  )
}
