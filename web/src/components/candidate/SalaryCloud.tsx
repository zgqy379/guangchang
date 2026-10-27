// 求职者头顶要价云（P2 候选人侧）
//
// 词典 glowPath / salaryCloud：期望薪资 → 头顶云体体积/密度。
// 暴露模式分档：band（区间，保护隐私） / exact（精确值，求职者主动选择）。
//
// 参数：expected_salary（词典 candidate-dictionary.json，P0，implemented）
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import {
  ColorBrandGold,
  ColorSceneBillRed,
} from '../../../generated/design-tokens.output.mjs'

export type ExposeMode = 'band' | 'exact'

// 区间映射：期望薪资 → 云体体积等级（只给区间，不给精确数字）
function bandOf(yuan: number): { label: string; size: number; opacity: number; color: string } {
  if (yuan <= 150000)
    return { label: '15万以下', size: 0.8, opacity: 0.45, color: ColorSceneBillRed }
  if (yuan <= 300000)
    return { label: '15–30万', size: 1.1, opacity: 0.55, color: ColorSceneBillRed }
  if (yuan <= 500000)
    return { label: '30–50万', size: 1.4, opacity: 0.65, color: ColorBrandGold }
  if (yuan <= 800000)
    return { label: '50–80万', size: 1.7, opacity: 0.72, color: ColorBrandGold }
  return { label: '80万以上', size: 2.0, opacity: 0.78, color: ColorBrandGold }
}

interface SalaryCloudProps {
  /** 期望薪资（元） */
  salary: number
  /** 暴露模式：band 区间 / exact 精确 */
  exposeMode: ExposeMode
  /** 相对求职者脚下的偏移 [x, y, z] */
  position?: [number, number, number]
}

export function SalaryCloud({
  salary,
  exposeMode,
  position = [0, 2.6, 0],
}: SalaryCloudProps) {
  const { size, opacity, color } = useMemo(() => bandOf(salary), [salary])

  const cloudRef = useRef<THREE.Group>(null)
  const startRef = useRef<number | null>(null)

  // 呼吸浮动：云体上下微幅起伏
  useFrame((state) => {
    const group = cloudRef.current
    if (!group) return
    if (startRef.current === null) startRef.current = state.clock.elapsedTime
    const t = state.clock.elapsedTime - startRef.current
    group.position.y = position[1] + Math.sin(t * 2.2) * 0.08
    group.rotation.y = t * 0.15
  })

  // 云体由多个球体组成，体积随薪资等级增大
  const spheres = useMemo(() => {
    const count = exposeMode === 'exact' ? Math.min(Math.ceil(salary / 100000), 12) : Math.ceil(size * 6)
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2
      const r = 0.25 + Math.random() * 0.4
      const offsetR = 0.4 + Math.random() * (size * 0.5)
      const pos: [number, number, number] = [
        Math.cos(angle) * offsetR,
        (Math.random() - 0.5) * 0.3,
        Math.sin(angle) * offsetR,
      ]
      return {
        key: i,
        pos,
        size: r,
      }
    })
  }, [size, exposeMode, salary])

  return (
    <group ref={cloudRef} position={position}>
      {/* 云体：半透明发光球群，体积∝薪资等级 */}
      {spheres.map((s) => (
        <mesh key={s.key} position={s.pos}>
          <sphereGeometry args={[s.size, 16, 16]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={opacity * 0.6}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      ))}
      {/* 云心：更亮的核心光点 */}
      <mesh position={[0, 0.1, 0]}>
        <sphereGeometry args={[size * 0.35, 12, 12]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={opacity * 0.9}
          depthWrite={false}
        />
      </mesh>
      {/* 暴露标签（仅 exact 模式显示精确数字；band 模式只显示区间）。
          ⚠ 必须用 drei <Html>：裸 <div> 直接写在 Canvas 里会被 R3F 当 THREE intrinsic
          校验，报「Div is not part of the THREE namespace」并触发 SceneErrorBoundary（T13）。 */}
      {exposeMode === 'exact' && (
        <Html center position={[0, 0.55, 0]} distanceFactor={8}>
          <div style={{ color: color, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
            ¥{Math.round(salary / 10000)}万
          </div>
        </Html>
      )}
    </group>
  )
}
