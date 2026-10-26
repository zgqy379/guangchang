import { useLayoutEffect, useRef } from 'react'
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
  }, [scene, targetSize])

  return (
    <group position={position}>
      <group ref={inner}>
        <primitive object={scene} />
      </group>
    </group>
  )
}

useGLTF.preload(assetUrl('/assets/money/gc-bill-bundle.glb'), DRACO_PATH)
