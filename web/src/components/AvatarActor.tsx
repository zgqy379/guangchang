// Avatar 漫游演员：点击地面行走 + WASD + Walk/Idle 动画切换（P0：漫游+第三人称）
// 完整管线产物：Lux3D 文生 → auto-rig → retarget（Idle/Walk）→ Draco 3.1MB×2
import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useAnimations, useGLTF } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
// 骨骼克隆：静态 scene.clone(true) 会复制 SkinnedMesh 却共享 Skeleton/Bone，
// 两个实例互相覆盖蒙皮；含骨骼模型必须用 SkeletonUtils.clone（重建 Skeleton 层级）。
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { assetUrl } from '../engine/asset'

const DRACO_PATH = assetUrl('/draco/')
const IDLE_URL = assetUrl('/assets/avatar/avatar-idle.glb')
const WALK_URL = assetUrl('/assets/avatar/avatar-walk.glb')
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

/**
 * walk 剪辑的惰性加载器：只在 roam 时挂载，加载完回填给父组件。
 * 非漫游（single/compare 默认态）不加载 walk.glb，省 3.1MB 首屏体积。
 * 用局部 Suspense（fallback=null）包裹，避免异步加载期间拖累整个场景。
 */
function WalkClipLoader({ onLoaded }: { onLoaded: (clips: THREE.AnimationClip[]) => void }) {
  const { animations } = useGLTF(WALK_URL, DRACO_PATH)
  useEffect(() => {
    onLoaded(animations)
  }, [animations, onLoaded])
  return null
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

  const { scene: idleScene, animations: idleAnims } = useGLTF(IDLE_URL, DRACO_PATH)
  // walk 剪辑惰性回填：初始为空 → 非漫游不触发 walk.glb 请求
  const [walkAnims, setWalkAnims] = useState<THREE.AnimationClip[]>([])
  // walk.glb 是否已回填完成。缺剪辑告警必须以「加载完毕」为前提：
  // walk.glb 惰性加载约 1.6s，加载完成前 walkAnims 必然为空，
  // 早于加载完成就告警＝把"还没到"误报成"没有"（假警报比没告警更坏）。
  const [walkLoaded, setWalkLoaded] = useState(false)
  const handleWalkAnims = useCallback((clips: THREE.AnimationClip[]) => {
    setWalkAnims(clips)
    setWalkLoaded(true)
  }, [])

  // A/B 对比模式两个 <Canvas> 共享 useGLTF 全局缓存的同一 scene：
  // 直接把同一 Object3D 挂进两处 <primitive> 会让后者把它搬走 → 一侧 Avatar 消失。
  // skeletonClone 重建独立骨骼层级；材质一并克隆（本实例独有，卸载可安全释放）。
  const model = useMemo(() => {
    const clone = skeletonClone(idleScene)
    clone.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (mesh.isMesh && mesh.material) {
        mesh.material = Array.isArray(mesh.material)
          ? mesh.material.map((m) => m.clone())
          : mesh.material.clone()
      }
    })
    return clone
  }, [idleScene])

  // 合并两份动画并重命名，避免同名冲突：IDLE / WALK
  const clips = useMemo(() => {
    const idle = idleAnims[0]?.clone()
    const walk = walkAnims[0]?.clone()
    if (idle) idle.name = 'IDLE'
    if (walk) walk.name = 'WALK'
    return [idle, walk].filter(Boolean) as THREE.AnimationClip[]
  }, [idleAnims, walkAnims])

  const { actions } = useAnimations(clips, root)
  const curAnim = useRef<'IDLE' | 'WALK'>('IDLE')

  // 缺剪辑检测：GLB 无动画会静默停在绑定姿势（T-pose），必须显式告警而非无声。
  // walk 侧以 walkLoaded 为门槛——惰性加载未完成不是"缺剪辑"。
  useEffect(() => {
    if (!idleAnims[0]) {
      console.warn('[AvatarActor] avatar-idle.glb 缺少动画剪辑 → 将停在绑定姿势（T-pose）')
    }
    if (roam && walkLoaded && !walkAnims[0]) {
      console.warn('[AvatarActor] avatar-walk.glb 缺少动画剪辑 → WALK 不可用')
    }
  }, [idleAnims, walkAnims, walkLoaded, roam])

  // 初始播 IDLE；clips/walk 加载导致 actions 重建后，恢复**当前**动画而非硬切回 IDLE
  useEffect(() => {
    const want = curAnim.current
    const a = actions[want] ?? actions['IDLE']
    a?.reset().fadeIn(0.2).play()
    return () => {
      a?.stop()
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
  }, [model])

  // 卸载释放：骨骼（GPU boneTexture）+ 本实例克隆的材质。
  // 几何/贴图来自 useGLTF 缓存，由缓存统一管理，不在此 dispose（否则会破坏另一侧 Canvas）。
  useEffect(() => {
    return () => {
      model.traverse((o) => {
        const skinned = o as THREE.SkinnedMesh
        if (skinned.isSkinnedMesh) skinned.skeleton?.dispose()
        const mesh = o as THREE.Mesh
        if (mesh.isMesh && mesh.material) {
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
          mats.forEach((m) => m.dispose())
        }
      })
    }
  }, [model])

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
        {/* 接地阴影：纯黑颜料、非设计令牌（阴影=无光，与主题无关，故保留常量） */}
        <meshBasicMaterial color="#000000" transparent opacity={0.32} depthWrite={false} />
      </mesh>
      <group ref={inner}>
        <primitive object={model} />
      </group>
      {/* 漫游时才加载 walk.glb（惰性），局部 Suspense 防整场景闪烁 */}
      {roam && (
        <Suspense fallback={null}>
          <WalkClipLoader onLoaded={handleWalkAnims} />
        </Suspense>
      )}
    </group>
  )
}

// 不做模块级 useGLTF.preload：它在模块 import 时执行 → 该模块进首屏 chunk 就立刻拉资产。
// 实测首屏因此多拉 avatar-idle.glb 3.08MB（超 5MB 红线）。
// 现在改由组件内 useGLTF 在渲染时才加载（进入 single 模式或街区时）。
// walk 动画进一步惰性：仅在 roam 时挂载 <WalkClipLoader> 才请求，非漫游省 3.1MB。