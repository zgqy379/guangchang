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
    const desired = new THREE.Vector3()
    const look = new THREE.Vector3()
    const focus = refs.focus?.current
    const moving = !!refs.target.current
    if (refs.heading && focus && !moving) {
      // 静止且靠近摊位：切到摊位 3/4 侧前方特写（名片/光环/HR 同框）
      const dx = focus.x - p.x
      const dz = focus.z - p.z
      const len = Math.hypot(dx, dz) || 1
      const fx = dx / len
      const fz = dz / len
      const sx = -fz
      const sz = fx
      const candA = { x: focus.x - fx * 5.8 + sx * 4.2, z: focus.z - fz * 5.8 + sz * 4.2 }
      const candB = { x: focus.x - fx * 5.8 - sx * 4.2, z: focus.z - fz * 5.8 - sz * 4.2 }
      // 优先落在道路廊道内（离任一道路中心线更近），避免钻进街角建筑
      const roadness = (c: { x: number; z: number }) => Math.min(Math.abs(c.x), Math.abs(c.z))
      const pick = roadness(candA) <= roadness(candB) ? candA : candB
      // 人眼高度：从雨棚下看进去，避免棚顶遮住 HR
      desired.set(pick.x, p.y + 1.85, pick.z)
      look.set(focus.x, p.y + 1.15, focus.z)
    } else if (refs.heading) {
      const h = refs.heading.current
      // 越肩视角：角色后上方 5.2m、右偏 2.2m，视线看向角色前方 3.2m
      desired.set(
        p.x - Math.sin(h) * 5.2 + Math.cos(h) * 1.6,
        p.y + 2.9,
        p.z - Math.cos(h) * 5.2 - Math.sin(h) * 1.6
      )
      look.set(p.x + Math.sin(h) * 3.2, p.y + 1.3, p.z + Math.cos(h) * 3.2)
    } else {
      desired.set(p.x, p.y + 2.2, p.z + 3.2)
      look.set(p.x, p.y + 1.2, p.z)
    }
    camera.position.lerp(desired, Math.min(1, dt * 3))
    lookAt.current.lerp(look, Math.min(1, dt * 4))
    camera.lookAt(lookAt.current)
  })

  return null
}
