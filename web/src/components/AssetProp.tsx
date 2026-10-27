import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useGLTF } from '@react-three/drei'
import { assetUrl } from '../engine/asset'

// Aholo 生成资产道具：首个真实 Lux3D 产物（逛厂币捆）进 Demo 场景
// 21MB 原始 GLB 经 gltf-transform（Draco+WebP）压到 2.2MB
// Draco 解码器自托管在 web/public/draco（避免第三方 CDN 单点）
// 生成模型原始尺寸不可控 → 统一归一化到 targetSize（最大边）
const DRACO_PATH = assetUrl('/draco/')

export function AssetProp({
  url,
  position = [1.6, 0, 1.6] as [number, number, number],
  targetSize = 0.55,
}: {
  url: string
  position?: [number, number, number]
  targetSize?: number
}) {
  const inner = useRef<THREE.Group>(null)
  const { scene } = useGLTF(url, DRACO_PATH)

  // A/B 对比模式会同时挂两个 <Canvas>，而 useGLTF 是**跨 Canvas 共享的全局缓存**：
  // 两个 <primitive object={scene}> 会把同一个 Object3D 从先挂的一方"搬"到后挂的一方，
  // 结果一侧道具凭空消失。克隆一份独立实例解决；静态道具用 scene.clone(true) 足够。
  // 材质一并克隆（本实例独有，卸载可安全释放）；几何仍共享缓存，**勿 dispose**。
  const model = useMemo(() => {
    const clone = scene.clone(true)
    clone.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (mesh.isMesh && mesh.material) {
        mesh.material = Array.isArray(mesh.material)
          ? mesh.material.map((m) => m.clone())
          : mesh.material.clone()
      }
    })
    return clone
  }, [scene])

  // 卸载释放本实例克隆出的材质（贴图/几何来自 useGLTF 缓存，由缓存统一管理，不在此 dispose）
  useEffect(() => {
    return () => {
      model.traverse((o) => {
        const mesh = o as THREE.Mesh
        if (mesh.isMesh && mesh.material) {
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
          mats.forEach((m) => m.dispose())
        }
      })
    }
  }, [model])

  useLayoutEffect(() => {
    const g = inner.current
    if (!g) return
    const box = new THREE.Box3().setFromObject(g)
    const size = box.getSize(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z) || 1
    const s = targetSize / maxDim
    g.scale.setScalar(s)
    // 底部贴地
    g.position.y = -box.min.y * s
  }, [model, targetSize])

  return (
    <group position={position}>
      <group ref={inner}>
        <primitive object={model} />
      </group>
    </group>
  )
}

// 不做模块级 useGLTF.preload：它在模块 import 时执行 → 该模块进首屏 chunk 就立刻拉资产。
// 实测首屏因此多拉 gc-bill-bundle.glb 2.23MB（超 5MB 红线）。
// 现在改由组件内 useGLTF 在渲染时才加载。
