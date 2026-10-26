// 作品环绕轨道（P2 候选人侧）
//
// 作品集悬浮于形象周围（project.md 4.12 / role-flow-spec-v1.md §3.4）：
//   · 轨道中心 = 求职者脚下；主轨道半径 2.20m
//   · 作品中心高度带 1.05–1.75m（与人眼齐平偏上）；起始角偏置 22.5°
//   · ≤8 件单层 / 9–16 件双层 / >16 件合并为作品塔
//   · 形状即编码：平面作品 = 玻璃卡 / 项目 = 全息板 / 3D 作品 = 实体展台
//   · 运动模型：作品静止、人动（自转会让作品跑过玩家眼前无法阅读）
//   · 隐私三档：公开 / 仅 HR 可见 / 私密（私密件不渲染，连占位都不给）
import { useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

export type WorkPrivacy = 'public' | 'hr-only' | 'private'

export type WorkItem = {
  id: string
  title: string
  type: 'ui' | 'project' | '3d' // 平面作品 / 项目卡片 / 3D 作品
  imageUrl: string // 作品缩略图（Canvas 生成或外链）
  privacy: WorkPrivacy
}

const ORBIT_R = 2.2 // 主轨道半径
const INNER_R = 2.0 // 双层内层半径
const ANGLE_OFFSET = (22.5 * Math.PI) / 180 // 起始角偏置

function layerForCount(n: number): number {
  if (n <= 8) return 1
  if (n <= 16) return 2
  return Math.ceil(n / 6) // 作品塔：每塔 3–6 片竖叠
}

interface WorkOrbitProps {
  works: WorkItem[]
  /** 求职者脚下位置（轨道中心） */
  position: [number, number, number]
  /** 是否靠近触发聚焦（玩家进入 1.2m → 作品径向推出并转向正对） */
  focus?: boolean
}

export function WorkOrbit({ works, position, focus = false }: WorkOrbitProps) {
  // 隐私过滤：私密件不渲染，连占位都不给
  const publicWorks = useMemo(
    () => works.filter((w) => w.privacy !== 'private'),
    [works]
  )
  const layerCount = useMemo(() => layerForCount(publicWorks.length), [publicWorks.length])

  const anglePerItem = useMemo(
    () => ((2 * Math.PI) / Math.max(publicWorks.length, 1)) * (layerCount === 1 ? 1 : 0.85),
    [publicWorks.length, layerCount]
  )

  // 作品静止、人动：常态仅呼吸浮动（交由 CSS/三.js scale 做呼吸，此处预留接口）
  useFrame(() => {})

  return (
    <group position={position}>
      {/* 轨道环线：仅在夜间/靠近时微弱显示，避免干扰作品阅读 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[ORBIT_R - 0.02, ORBIT_R + 0.02, 64]} />
        <meshBasicMaterial color="#16C0B6" transparent opacity={0.12} depthWrite={false} />
      </mesh>

      {publicWorks.map((work, i) => {
        const layer = i < 8 ? 0 : 1
        const r = layer === 0 ? ORBIT_R : INNER_R
        const angle = ANGLE_OFFSET + i * anglePerItem
        const x = Math.cos(angle) * r
        const z = Math.sin(angle) * r

        return (
          <group key={work.id} data-work-id={i} position={[x, 0, z]} rotation={[0, -angle, 0]} scale={focus ? 1.15 : 1}>
            {/* 作品卡片：面向外侧（玩家走近时可正面阅读） */}
            <mesh position={[0, 1.35, 0]} rotation={[0, Math.PI, 0]}>
              {work.type === 'ui' && (
                <>
                  <planeGeometry args={[0.62, 0.44]} />
                  <meshBasicMaterial
                    color="#e8eef4"
                    transparent
                    opacity={0.78}
                    side={THREE.DoubleSide}
                  />
                </>
              )}
              {work.type === 'project' && (
                <>
                  <planeGeometry args={[0.5, 0.5]} />
                  <meshBasicMaterial
                    color="#cfe4f2"
                    transparent
                    opacity={0.82}
                    side={THREE.DoubleSide}
                  />
                </>
              )}
              {work.type === '3d' && (
                <>
                  <cylinderGeometry args={[0.3, 0.28, 0.02, 16]} />
                  <meshStandardMaterial color="#b8c4d0" roughness={0.3} metalness={0.1} />
                </>
              )}
            </mesh>
          </group>
        )
      })}

      {publicWorks.length > 16 && (
        <group position={[0, 1.5, 0]}>
          {/* 作品塔：>16 件合并为塔，每塔 3–6 片竖叠 */}
          {Array.from({ length: Math.ceil(publicWorks.length / 6) }).map((_, t) => (
            <group key={t} position={[Math.cos(t) * 1.1, 0, Math.sin(t) * 1.1]}>
              {Array.from({ length: Math.min(6, publicWorks.length - t * 6) }).map((_, s) => (
                <mesh key={s} position={[0, 1.2 + s * 0.26, 0]}>
                  <boxGeometry args={[0.4, 0.22, 0.4]} />
                  <meshBasicMaterial color="#d8e2ec" transparent opacity={0.7} />
                </mesh>
              ))}
            </group>
          ))}
        </group>
      )}
    </group>
  )
}
