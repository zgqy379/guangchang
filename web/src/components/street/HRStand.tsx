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
      {/* 门前细节（动森式 1m 细节，破同构）：咨询桌 + 地毯 + 区域色侧旗 */}
      <group position={[1.35, 0, 1.15]}>
        <mesh position={[0, 0.2, 0]}>
          <boxGeometry args={[0.95, 0.07, 0.55]} />
          <meshStandardMaterial color="#3b4450" roughness={0.8} />
        </mesh>
        <mesh position={[-0.4, 0.1, 0]}>
          <boxGeometry args={[0.06, 0.2, 0.5]} />
          <meshStandardMaterial color="#2b323b" />
        </mesh>
        <mesh position={[0.4, 0.1, 0]}>
          <boxGeometry args={[0.06, 0.2, 0.5]} />
          <meshStandardMaterial color="#2b323b" />
        </mesh>
      </group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.6, 0.015, 1.9]}>
        <planeGeometry args={[1.5, 1.0]} />
        <meshStandardMaterial color={color} roughness={0.95} />
      </mesh>
      <group position={[-1.5, 0, -0.4]} rotation={[0, 0, (parseInt(lot.id.slice(-2), 10) % 7) * 0.02 - 0.06]}>
        <mesh position={[0, 1.55, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 3.1, 6]} />
          <meshStandardMaterial color="#39424c" />
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
              <mesh position={[0, h / 2, 0]}>
                <boxGeometry args={[6.4, h, 5.2]} />
                <meshStandardMaterial color="#272f3a" roughness={0.9} emissive="#0d1117" emissiveIntensity={0.5} />
              </mesh>
              {/* 底层玻璃幕墙 */}
              <mesh position={[0, 1.15, 2.62]}>
                <planeGeometry args={[5.8, 2.1]} />
                <meshStandardMaterial color="#12314e" emissive="#1b4a78" emissiveIntensity={0.55} metalness={0.4} roughness={0.25} />
              </mesh>
              {/* 门楣 LED（公司名条，行业色发光） */}
              <mesh position={[0, 2.62, 2.66]}>
                <boxGeometry args={[2.9, 0.42, 0.1]} />
                <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.85} />
              </mesh>
              {/* 楼层灯带（高层建筑） */}
              {h > 6 &&
                [3.6, 5.2, 6.8, 8.4].filter((y) => y < h - 0.6).map((y) => (
                  <mesh key={y} position={[0, y, 2.63]}>
                    <planeGeometry args={[6.1, 0.09]} />
                    <meshStandardMaterial color="#ffd28a" emissive="#ffc46b" emissiveIntensity={0.8} />
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
                  <meshStandardMaterial color="#3a4450" metalness={0.5} roughness={0.35} />
                </mesh>
              )}
              {lot.industry === 'manufacturing' && (
                <group position={[2.1, h + 0.9, 0.9]}>
                  <mesh position={[0, 0.5, 0]}>
                    <cylinderGeometry args={[0.55, 0.62, 1.8, 10]} />
                    <meshStandardMaterial color="#39424c" roughness={0.85} />
                  </mesh>
                  <mesh position={[0, 1.5, 0]}>
                    <sphereGeometry args={[0.55, 12, 10]} />
                    <meshStandardMaterial color="#39424c" roughness={0.85} />
                  </mesh>
                </group>
              )}
              {lot.industry === 'culture' && (
                <mesh position={[0, h + 0.5, 0]} rotation={[0, Math.PI / 4, 0]}>
                  <coneGeometry args={[4.6, 1.1, 4]} />
                  <meshStandardMaterial color="#5a3a3a" roughness={0.9} />
                </mesh>
              )}
            </>
          )
        })()}
        {/* 发光窗（仅低层保留，高层用灯带替代） */}
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
        <mesh position={[0, 1.05, 2.66]}>
          <planeGeometry args={[1.1, 2.1]} />
          <meshStandardMaterial color="#0e2740" emissive="#1f5a96" emissiveIntensity={0.5} />
        </mesh>
        <mesh
          position={[0, 2.35, 2.68]}
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
