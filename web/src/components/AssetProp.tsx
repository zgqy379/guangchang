import { useGLTF } from '@react-three/drei'

// Aholo 生成资产道具：首个真实 Lux3D 产物（逛厂币捆）进 Demo 场景
// 21MB 原始 GLB 经 gltf-transform（Draco+WebP）压到 2.2MB
// Draco 解码器走 jsdelivr（国内可达，实测于 10.26）
const DRACO_PATH = 'https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/libs/draco/gltf/'

export function AssetProp({
  url,
  position = [1.6, 0, 1.6] as [number, number, number],
  scale = 1,
}: {
  url: string
  position?: [number, number, number]
  scale?: number
}) {
  const { scene } = useGLTF(url, DRACO_PATH)
  return <primitive object={scene} position={position} scale={scale} />
}

useGLTF.preload('/assets/money/gc-bill-bundle.glb', DRACO_PATH)
