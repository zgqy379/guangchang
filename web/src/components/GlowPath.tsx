// 发光地砖路：求职者贡献热力图的空间化（词典 glowPath，M3 关键帧 D）
// 从脚下逐块铺开；亮度=贡献密度，断档=三天打鱼（去水分叙事）
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import {
  ColorNeutral0,
  ColorSceneBarOff,
  ColorSceneBarOn,
  ColorSceneFloor,
  ColorStateSuccess,
} from '../../generated/design-tokens.output.mjs'

const TILE = 0.5
const GAP = 0.06
const STEP = TILE + GAP

// 确定性"热力图"：亮度 0=断档 1=稀疏 2=密集 3=高亮（伪随机但稳定）
function heatmap(n: number, seed = 7): number[] {
  let s = seed >>> 0
  const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 0xffffffff)
  return Array.from({ length: n }, (_, i) => {
    const r = rand()
    if (i > 4 && i < 7) return 0 // 一段"断更"的暗路
    if (r > 0.85) return 3
    if (r > 0.55) return 2
    return 1
  })
}

// 四档热力色阶全部取自设计令牌（暗 → 亮绿），避免硬编码色漂移
const LEVELS = [
  { color: ColorSceneFloor, emissive: ColorNeutral0, intensity: 0.1 }, // 0 断档
  { color: ColorSceneBarOff, emissive: ColorSceneBarOff, intensity: 0.4 }, // 1 稀疏
  { color: ColorSceneBarOn, emissive: ColorSceneBarOn, intensity: 0.9 }, // 2 密集
  { color: ColorStateSuccess, emissive: ColorStateSuccess, intensity: 1.5 }, // 3 高亮（降饱和，不抢山的主体）
]

const easeOutBack = (k: number) => {
  const c = 1.7
  return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2)
}

export function GlowPath({
  tiles = 26,
  position = [-1.9, 0, 3.2] as [number, number, number],
}: {
  tiles?: number
  position?: [number, number, number]
}) {
  const groupRef = useRef<THREE.Group>(null)
  const startRef = useRef<number | null>(null)
  const heat = useMemo(() => heatmap(tiles), [tiles])

  // 铺设动画：每块延迟 0.05s，向远处依次点亮（回弹式出现）
  useFrame((state) => {
    const group = groupRef.current
    if (!group) return
    if (startRef.current === null) startRef.current = state.clock.elapsedTime
    const t = state.clock.elapsedTime - startRef.current
    group.children.forEach((child, i) => {
      const k = Math.min(1, Math.max(0, (t - i * 0.05) / 0.35))
      const s = k <= 0 ? 0.001 : easeOutBack(k)
      child.scale.set(s, 1, s)
    })
  })

  return (
    <group ref={groupRef} position={position}>
      {heat.map((level, i) => {
        if (level === 0) {
          // 断档：只剩暗色路基
          return (
            <mesh key={i} position={[0, 0.02, -i * STEP]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[TILE * 0.6, TILE * 0.6]} />
              {/* 断档：只剩暗色路基（ColorSceneFloor 深灰基底） */}
              <meshStandardMaterial color={ColorSceneFloor} roughness={1} />
            </mesh>
          )
        }
        const lv = LEVELS[level]
        return (
          <mesh key={i} position={[0, 0.02, -i * STEP]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[TILE, TILE]} />
            <meshStandardMaterial
              color={lv.color}
              emissive={lv.emissive}
              emissiveIntensity={lv.intensity}
              roughness={0.4}
            />
          </mesh>
        )
      })}
    </group>
  )
}
