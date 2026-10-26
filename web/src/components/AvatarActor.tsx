// Avatar 漫游演员：点击地面行走 + WASD + Walk/Idle 动画切换（P0：漫游+第三人称）
// 完整管线产物：Lux3D 文生 → auto-rig → retarget（Idle/Walk）→ Draco 3.1MB×2
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useAnimations, useGLTF } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { assetUrl } from '../engine/asset'

const DRACO_PATH = 'https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/libs/draco/gltf/'
const SPEED = 1.35 // m/s，自然步速
const HEIGHT = 1.6

export interface RoamRefs {
  /** 当前位置（可变 ref，供相机跟随读取） */
  position: React.MutableRefObject<THREE.Vector3>
  /** 行走目标点（null = 站定）；地面点击写入 */
  target: React.MutableRefObject<THREE.Vector3 | null>
  /** 传送指令（外部写入目标点，Actor 应用后置 null）——街区导航柱用 */
  teleportTo?: React.MutableRefObject<THREE.Vector3 | null>
  /** 朝向角（弧度，随移动方向更新）——第三人称相机拖尾用 */
  heading?: React.MutableRefObject<number>
  /** 就近摊位（静止时相机切 3/4 特写） */
  focus?: React.MutableRefObject<THREE.Vector3 | null>
}

export function AvatarActor({
  position = [-1.9, 0, 2.0] as [number, number, number],
  facing = 0.35,
  roam = false,
  refs,
  bounds = 2.8,
}: {
  position?: [number, number, number]
  facing?: number
  roam?: boolean
  refs?: RoamRefs
  /** 漫游边界 clamp（默认单街区展台 ±2.8m；街区模式传更大值） */
  bounds?: number
}) {
  const root = useRef<THREE.Group>(null)
  const inner = useRef<THREE.Group>(null)
  const camera = useThree((s) => s.camera)

  const { scene: idleScene, animations: idleAnims } = useGLTF(
    assetUrl('/assets/avatar/avatar-idle.glb'),
    DRACO_PATH
  )
  const { animations: walkAnims } = useGLTF(assetUrl('/assets/avatar/avatar-walk.glb'), DRACO_PATH)

  // 合并两份动画并重命名，避免同名冲突：IDLE / WALK
  const clips = useMemo(() => {
    const idle = idleAnims[0]?.clone()
    const walk = walkAnims[0]?.clone()
    if (idle) idle.name = 'IDLE'
    if (walk) walk.name = 'WALK'
    return [idle, walk].filter(Boolean) as THREE.AnimationClip[]
  }, [idleAnims, walkAnims])

  const { actions } = useAnimations(clips, root)

  // 初始就播 IDLE：否则停在绑定姿势（T-pose）直到第一次状态切换
  useEffect(() => {
    actions['IDLE']?.reset().fadeIn(0.2).play()
    return () => {
      actions['IDLE']?.stop()
    }
  }, [actions])

  // 模型尺寸归一化：目标身高 1.6m，脚底贴地
  useLayoutEffect(() => {
    const g = inner.current
    if (!g) return
    const box = new THREE.Box3().setFromObject(g)
    const size = box.getSize(new THREE.Vector3())
    const s = HEIGHT / (size.y || 1)
    g.scale.setScalar(s)
    g.position.y = -box.min.y * s
  }, [idleScene])

  // WASD 键盘状态（roam 时生效）
  const keys = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (!roam) {
      keys.current.clear()
      return
    }
    const down = (e: KeyboardEvent) => keys.current.add(e.key.toLowerCase())
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase())
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [roam])

  // 漫游主循环：WASD（相机朝向相对）或走向点击目标；移动时播 WALK
  const curAnim = useRef<'IDLE' | 'WALK'>('IDLE')
  useFrame((_state, rawDt) => {
    const g = root.current
    if (!g) return
    const dt = Math.min(rawDt, 0.05)
    const dir = new THREE.Vector3()

    if (roam) {
      const k = keys.current
      // 传送指令优先：直接落位（导航柱等场景导航用）
      if (refs?.teleportTo?.current) {
        g.position.copy(refs.teleportTo.current)
        refs.target.current = null
        refs.teleportTo.current = null
      }
      const cameraForward = new THREE.Vector3()
      camera.getWorldDirection(cameraForward)
      cameraForward.y = 0
      cameraForward.normalize()
      const cameraRight = new THREE.Vector3().crossVectors(
        new THREE.Vector3(0, 1, 0),
        cameraForward
      )
      if (k.has('w') || k.has('arrowup')) dir.add(cameraForward)
      if (k.has('s') || k.has('arrowdown')) dir.sub(cameraForward)
      if (k.has('a') || k.has('arrowleft')) dir.sub(cameraRight)
      if (k.has('d') || k.has('arrowright')) dir.add(cameraRight)

      // 没按键但有目标点 → 走过去
      if (dir.lengthSq() < 0.001 && refs?.target.current) {
        const toTarget = refs.target.current.clone().sub(g.position)
        toTarget.y = 0
        if (toTarget.length() < 0.08) {
          refs.target.current = null
        } else {
          dir.copy(toTarget.normalize())
        }
      } else if (dir.lengthSq() > 0.001 && refs) {
        refs.target.current = null // 手动接管
      }
    }

    const moving = dir.lengthSq() > 0.001
    // 特写机位时收起玩家，避免后背挡住 HR/摊位（移动立即恢复）
    if (roam) g.visible = !(refs?.focus?.current && !moving)
    if (moving) {
      dir.normalize()
      g.position.addScaledVector(dir, SPEED * dt)
      // 边界 clamp（单街区 ±2.8m / 街区模式 ±STREET_BOUNDS）——防走出场景
      g.position.x = THREE.MathUtils.clamp(g.position.x, -bounds, bounds)
      g.position.z = THREE.MathUtils.clamp(g.position.z, -bounds, bounds)
      // 平滑转向移动方向
      const targetRot = Math.atan2(dir.x, dir.z)
      let diff = targetRot - g.rotation.y
      while (diff > Math.PI) diff -= Math.PI * 2
      while (diff < -Math.PI) diff += Math.PI * 2
      g.rotation.y += diff * Math.min(1, dt * 10)
    }
    if (refs) {
      refs.position.current.copy(g.position)
      if (refs.heading) refs.heading.current = g.rotation.y
    }

    // 动画切换（0.25s 交叉淡化）
    const want = moving ? 'WALK' : 'IDLE'
    if (want !== curAnim.current && actions[want] && actions[curAnim.current]) {
      actions[want]?.reset().fadeIn(0.25).play()
      actions[curAnim.current]?.fadeOut(0.25)
      curAnim.current = want
    }
  })

  return (
    <group ref={root} position={position} rotation-y={facing}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[0.42, 24]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.32} depthWrite={false} />
      </mesh>
      <group ref={inner}>
        <primitive object={idleScene} />
      </group>
    </group>
  )
}

useGLTF.preload(assetUrl('/assets/avatar/avatar-idle.glb'), DRACO_PATH)
// walk 动画不预加载：仅在漫游模式（useGLTF 实际引用）时拉取，省 3.1MB 首屏流量
