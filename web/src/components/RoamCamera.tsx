// 漫游相机：第三人称平滑跟随 Avatar（roam 模式启用，替代 OrbitControls）
import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import type { RoamRefs } from './AvatarActor'

export function RoamCamera({ enabled, refs }: { enabled: boolean; refs: RoamRefs }) {
  const camera = useThree((s) => s.camera)
  const lookAt = useRef(new THREE.Vector3())

  useFrame((_, dt) => {
    if (!enabled) return
    const p = refs.position.current
    // 相机在 Avatar 后上方 3.2m、高 2.2m 处平滑跟随
    const back = new THREE.Vector3(Math.sin(0), 0, Math.cos(0))
    const desired = new THREE.Vector3(
      p.x - back.x * 3.2,
      p.y + 2.2,
      p.z + 3.2
    )
    camera.position.lerp(desired, Math.min(1, dt * 3))
    lookAt.current.lerp(new THREE.Vector3(p.x, p.y + 1.2, p.z), Math.min(1, dt * 4))
    camera.lookAt(lookAt.current)
  })

  return null
}
