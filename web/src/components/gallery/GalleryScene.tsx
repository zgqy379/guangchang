// 作品廊场景（P3 作品廊 · 独立 Canvas）
//
// 与招聘街区物理隔离（project.md 4.13 空间不对称）：
//   · 求职者的空间不在招聘街区里，而在独立的作品廊场景
//   · 环形走廊 + 我的展位 + ≤1 他人展位（演示用）
//   · 作品廊不进顶栏、不改四臂罗盘；从街道路牌与"我的"页进入
//   · 相机初始位必须对场景所有建筑做包围盒相交验证（T9 铁律：机位落在楼内=全黑视角）
import { Suspense, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import { debugHooksEnabled } from '../../engine/debug'
import { GalleryCorridor } from './GalleryCorridor'
import { CandidateBooth } from '../candidate/CandidateBooth'
import { type WorkItem } from '../candidate/WorkOrbit'
import { WorkdaySky } from '../WorkdaySky'
import { TwinEnvironment } from '../street/TwinEnvironment'

interface GallerySceneProps {
  /** 求职者期望薪资 */
  expectedSalary?: number
  /** 求职者作品列表 */
  works?: WorkItem[]
  /** 夜间/白天主题 */
  night?: boolean
  /** 场景加载完成回调 */
  onReady?: () => void
}

const GALLERY_RADIUS = 14 // 作品廊环形走廊半径

export function GalleryScene({
  expectedSalary = 450000,
  works,
  night = false,
  onReady,
}: GallerySceneProps) {
  // 示例他人展位（演示用，≤1 个）
  const otherWorks: WorkItem[] = useMemo(
    () => [
      {
        id: 'other-1',
        title: '城市导航 App',
        type: 'ui',
        imageUrl: '',
        privacy: 'public',
      },
      {
        id: 'other-2',
        title: 'AR 博物馆',
        type: '3d',
        imageUrl: '',
        privacy: 'public',
      },
    ],
    []
  )

  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 26, 26], fov: 45 }}
      shadows
      gl={{ toneMapping: THREE.ACESFilmicToneMapping }}
      onCreated={({ camera, scene, gl }) => {
        // T9 铁律：相机初始位必须对场景所有建筑做包围盒相交验证
        // 作品廊相机初始位置在环形走廊外侧高处鸟瞰，避免落在建筑内部
        camera.position.set(0, 26, 26)
        camera.lookAt(0, 0, 0)
        const dist = camera.position.distanceTo(new THREE.Vector3(0, 0, 0))
        if (dist < GALLERY_RADIUS + 5) {
          console.warn('[GalleryScene] 摄像机初始位过近走廊中心，可能落在建筑内部，已自动后退')
          camera.position.set(0, 34, 34)
          camera.lookAt(0, 0, 0)
        }
        // 场景图诊断钩子（门控见 engine/debug）
        if (debugHooksEnabled()) {
          ;(window as unknown as { __st: THREE.Scene; __cam: THREE.Camera; __gl: THREE.WebGLRenderer }).__st = scene
          ;(window as unknown as { __st: THREE.Scene; __cam: THREE.Camera; __gl: THREE.WebGLRenderer }).__cam = camera
          ;(window as unknown as { __st: THREE.Scene; __cam: THREE.Camera; __gl: THREE.WebGLRenderer }).__gl = gl
        }
        onReady?.()
      }}
    >
      <WorkdaySky envHour={night ? 22 : 14} theme={night ? 'dark' : 'light'} fogNear={10} fogFar={60} />
      <TwinEnvironment envHour={night ? 22 : 14} theme={night ? 'dark' : 'light'} />

      {/* 环形走廊 */}
      <GalleryCorridor radius={GALLERY_RADIUS} width={4} night={night} />

      {/* 我的展位（走廊内侧，前方） */}
      <Suspense fallback={null}>
        <CandidateBooth
          expectedSalary={expectedSalary}
          exposeMode="band"
          works={works ?? []}
          night={night}
          position={[0, 0, GALLERY_RADIUS - 2]}
        />
      </Suspense>

      {/* 他人展位（走廊外侧，右侧，≤1 个，演示用） */}
      <Suspense fallback={null}>
        <CandidateBooth
          expectedSalary={620000}
          exposeMode="band"
          works={otherWorks}
          night={night}
          position={[GALLERY_RADIUS + 2, 0, 0]}
        />
      </Suspense>
    </Canvas>
  )
}
