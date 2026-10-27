// 作品廊环形走廊（P3 作品廊）
//
// 独立 Canvas 场景，与招聘街区物理隔离（project.md 4.13 空间不对称）：
//   · 求职者的空间不在招聘街区里，而在独立的作品廊场景
//   · 环形走廊 + 展位，求职者展位 + ≤1 他人展位（演示用）
//   · 作品廊不进顶栏、不改四臂罗盘；从街道路牌与"我的"页进入
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'

interface GalleryCorridorProps {
  /** 走廊半径（米） */
  radius?: number
  /** 走廊宽度（米） */
  width?: number
  /** 夜间/白天主题 */
  night?: boolean
}

export function GalleryCorridor({ radius = 12, width = 3, night = false }: GalleryCorridorProps) {
  const segments = 64
  const innerR = radius - width / 2
  const outerR = radius + width / 2

  // 走廊地面：环形面
  const corridorGeo = useMemo(() => {
    const shape = new THREE.Shape()
    // 外圆
    shape.absarc(0, 0, outerR, 0, Math.PI * 2)
    // 内圆（挖空）
    const hole = new THREE.Path()
    hole.absarc(0, 0, innerR, 0, Math.PI * 2, true) // 反向绘制
    shape.holes.push(hole)
    return new THREE.ShapeGeometry(shape, segments)
  }, [innerR, outerR, segments])

  // 走廊墙面：环形墙，高度 3m
  const wallGeo = useMemo(() => {
    const shape = new THREE.Shape()
    shape.absarc(0, 0, outerR + 0.1, 0, Math.PI * 2)
    const hole = new THREE.Path()
    hole.absarc(0, 0, innerR - 0.1, 0, Math.PI * 2, true)
    shape.holes.push(hole)
    return new THREE.ExtrudeGeometry(shape, { depth: 3, bevelEnabled: false })
  }, [innerR, outerR, segments])

  // 中央庭院地面
  const courtGeo = useMemo(() => new THREE.CircleGeometry(innerR - 0.5, segments), [innerR, segments])

  // 材质按主题缓存（useMemo）+ 卸载/换主题时 dispose：
  // JSX props 里内联 new 材质会在每次重渲染泄漏 GPU 材质（同仓 WorkdaySky/CompanyPlot 的缓存纪律）
  const materials = useMemo(
    () => ({
      court: new THREE.MeshStandardMaterial({ color: night ? '#0f1a28' : '#eef3f8', roughness: 0.8 }),
      corridor: new THREE.MeshStandardMaterial({ color: night ? '#0a1420' : '#dbe7f0', roughness: 0.6 }),
      wall: new THREE.MeshStandardMaterial({ color: night ? '#1a2431' : '#c2d4e2', roughness: 0.7 }),
    }),
    [night]
  )
  useEffect(
    () => () => {
      materials.court.dispose()
      materials.corridor.dispose()
      materials.wall.dispose()
    },
    [materials]
  )

  return (
    <group>
      {/* 中央庭院 */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        geometry={courtGeo}
        material={materials.court}
      />
      {/* 走廊地面 */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        geometry={corridorGeo}
        material={materials.corridor}
      />
      {/* 走廊墙面（外侧） */}
      <mesh
        geometry={wallGeo}
        material={materials.wall}
        position={[0, 1.5, 0]}
      />
      {/* 走廊墙面（内侧，朝向庭院） */}
      <mesh
        geometry={wallGeo}
        material={materials.wall}
        position={[0, 1.5, 0]}
        scale={[-1, 1, 1]}
      />
      {/* 环形引导灯带：走廊边缘的微弱发光线 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[innerR + 0.1, outerR - 0.1, segments * 2]} />
        <meshBasicMaterial
          color={night ? '#4a90e2' : '#16C0B6'}
          transparent
          opacity={night ? 0.6 : 0.3}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}
