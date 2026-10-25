import { useLayoutEffect, useRef } from 'react'
import * as THREE from 'three'
import { useAnimations, useGLTF } from '@react-three/drei'

// Avatar 演员：Lux3D 生成 → 自动绑骨 → 动画重定向 → Draco 压缩的完整产物
// 43MB → 3.08MB；待机动画直接播放（"有趣"维度：Demo 里的人是活的）
// 生成模型原始身高不可控 → 归一化到 targetHeight（默认 1.6m，Z 世代平均感）
const DRACO_PATH = 'https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/libs/draco/gltf/'

export function AvatarActor({
  position = [-1.2, 0, 1.8] as [number, number, number],
  rotationY = 0.6,
  targetHeight = 1.6,
  clip = 0,
}: {
  position?: [number, number, number]
  rotationY?: number
  targetHeight?: number
  clip?: number
}) {
  const root = useRef<THREE.Group>(null)
  const inner = useRef<THREE.Group>(null)
  const { scene, animations } = useGLTF('/assets/avatar/avatar-idle.glb', DRACO_PATH)
  const { actions } = useAnimations(animations, root)

  useLayoutEffect(() => {
    const g = inner.current
    if (!g) return
    const box = new THREE.Box3().setFromObject(g)
    const size = box.getSize(new THREE.Vector3())
    const s = targetHeight / (size.y || 1)
    g.scale.setScalar(s)
    g.position.y = -box.min.y * s
  }, [scene, targetHeight])

  useLayoutEffect(() => {
    const names = Object.keys(actions)
    if (names.length > 0) {
      const name = names[Math.min(clip, names.length - 1)]
      actions[name]?.reset().fadeIn(0.3).play()
    }
  }, [actions, clip])

  return (
    <group ref={root} position={position} rotation-y={rotationY}>
      <group ref={inner}>
        <primitive object={scene} />
      </group>
    </group>
  )
}

useGLTF.preload('/assets/avatar/avatar-idle.glb', DRACO_PATH)
