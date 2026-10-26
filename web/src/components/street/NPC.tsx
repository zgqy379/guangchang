// NPC 求职者：复用玩家形象 + Walk 动画，沿人行道往返闲逛（街区人气）
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useAnimations, useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { assetUrl } from '../../engine/asset'

const DRACO_PATH = assetUrl('/draco/')

export function NPC({ a, b }: { a: [number, number]; b: [number, number] }) {
  const { scene } = useGLTF(assetUrl('/assets/avatar/avatar-idle.glb'), DRACO_PATH)
  const { animations } = useGLTF(assetUrl('/assets/avatar/avatar-walk.glb'), DRACO_PATH)
  const ref = useRef<THREE.Group>(null)
  const clone = useMemo(() => skeletonClone(scene), [scene])
  const { actions } = useAnimations(animations, ref)
  const t = useRef((a[0] + a[1]) % 7) // 各 NPC 相位错开

  useLayoutEffect(() => {
    const g = ref.current
    if (!g) return
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

  return (
    <group ref={ref} dispose={null}>
      <primitive object={clone} />
    </group>
  )
}
