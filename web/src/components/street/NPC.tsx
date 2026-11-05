// NPC 求职者：复用玩家形象 + Walk 动画，沿人行道往返闲逛（街区人气）
// 2026-11-05：改 useGLTFState 手动加载（不走 Suspense）——useGLTF 的 rejection 会穿透
// ErrorBoundary 把整个街区刷成失败页（真机 5G 下实测），手动加载只翻状态、绝不抛出。
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useAnimations } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { assetUrl } from '../../engine/asset'
import { useGLTFState } from '../SafeGLTF'

const DRACO_PATH = assetUrl('/draco/')

export function NPC({ a, b, night }: { a: [number, number]; b: [number, number]; night?: boolean }) {
  const idle = useGLTFState(assetUrl('/assets/avatar/avatar-idle.glb'), DRACO_PATH)
  const walk = useGLTFState(assetUrl('/assets/avatar/avatar-walk.glb'), DRACO_PATH)
  const scene = idle.scene
  const animations = walk.animations
  const ref = useRef<THREE.Group>(null)
  const clone = useMemo(() => (scene ? skeletonClone(scene) : null), [scene])
  const { actions } = useAnimations(animations, ref)
  const t = useRef((a[0] + a[1]) % 7) // 各 NPC 相位错开

  useLayoutEffect(() => {
    const g = ref.current
    if (!g || !clone) return
    const box = new THREE.Box3().setFromObject(g)
    const size = box.getSize(new THREE.Vector3())
    const s = 1.6 / (size.y || 1)
    g.scale.setScalar(s)
    g.position.y = -box.min.y * s
    const clip = Object.keys(actions)[0]
    actions[clip]?.reset().play()
  }, [actions, clone])

  useFrame((_, rawDt) => {
    const g = ref.current
    if (!g) return
    t.current += rawDt * 0.22
    const k = (Math.sin(t.current) + 1) / 2
    const x = a[0] + (b[0] - a[0]) * k
    const z = a[1] + (b[1] - a[1]) * k
    g.position.x = x
    g.position.z = z
    // 朝向移动方向（数值微分）
    const dx = (b[0] - a[0]) * Math.cos(t.current)
    const dz = (b[1] - a[1]) * Math.cos(t.current)
    if (Math.abs(dx) + Math.abs(dz) > 1e-4) g.rotation.y = Math.atan2(dx, dz)
  })

  // 加载中/失败：不渲染该 NPC（静默降级，不拖垮街区）
  if (!clone) return null

  return (
    <group ref={ref} dispose={null}>
      <primitive object={clone} />
      {/* 夜间脚光环（决策纸⑥）：暖色 additive 光盘跟随 NPC——夜里「街区有人气」的最低成本叙事 */}
      {night && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <circleGeometry args={[0.34, 20]} />
          <meshBasicMaterial
            color="#ffd9a0"
            transparent
            opacity={0.3}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  )
}
