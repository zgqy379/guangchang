// 求职者展位（P2 候选人侧 · 在街区中渲染的个人 3D 空间）
//
// 六件套（role-flow-spec-v1.md §3.4）：
//   1. 脚下能力地砖路 glowPath（复用 GlowPath + 注入 GitHub 贡献数据）
//   2. 路旁作品森林 glowForest（WorkOrbit 环绕轨道）
//   3. 头顶要价云 salaryCloud（SalaryCloud，期望薪资 → 云体）
//   4. 身后技术栈光谱环 spectrumRing（技术栈分布 → 彩色光环）
//   5. 环绕作品集（WorkOrbit 内已集成）
//   6. 入口铭牌 nameplate（期望薪资 / 学历 / 证书排序）
//
// 隐私三档：公开 / 仅 HR 可见 / 私密（私密件不渲染）
import { useMemo } from 'react'
import { GlowPath } from '../GlowPath'
import { SalaryCloud } from './SalaryCloud'
import { WorkOrbit, type WorkItem } from './WorkOrbit'
import {
  ColorSceneSun,
  ColorSceneMoon,
} from '../../../generated/design-tokens.output.mjs'

export type CandidatePrivacy = 'public' | 'hr-only' | 'private'

interface CandidateBoothProps {
  /** 求职者期望薪资（元） */
  expectedSalary: number
  /** 暴露模式 */
  exposeMode: 'band' | 'exact'
  /** 作品列表 */
  works: WorkItem[]
  /** 夜间/白天主题（决定头顶是太阳还是月亮） */
  night: boolean
  /** 求职者位置（街区中摊位位置或独立展位位置） */
  position: [number, number, number]
}

export function CandidateBooth({
  expectedSalary,
  exposeMode,
  works,
  night,
  position,
}: CandidateBoothProps) {
  // 公开作品（私密件不渲染，WorkOrbit 内已过滤）
  const publicWorks = useMemo(
    () => works.filter((w) => w.privacy !== 'private'),
    [works]
  )

  // 技术栈光谱环：从作品/数据中提取主副技能比例（示例数据，后续接 GitHub OAuth）
  const spectrumRing = useMemo(() => {
    const total = 100
    const js = 35
    const py = 25
    const rs = 15
    const other = total - js - py - rs
    return [
      { label: 'JavaScript', pct: js, color: '#f1e05a' },
      { label: 'Python', pct: py, color: '#3572A5' },
      { label: 'Rust', pct: rs, color: '#dea584' },
      { label: '其他', pct: other, color: '#8b949e' },
    ]
  }, [])

  return (
    <group position={position}>
      {/* 1. 脚下能力地砖路（复用 GlowPath，注入求职者贡献数据） */}
      <GlowPath tiles={24} position={[0, 0, 3.2]} />

      {/* 2. 路旁作品森林（WorkOrbit 环绕轨道，≤8 件单层 / 9–16 件双层 / >16 件作品塔） */}
      <WorkOrbit works={publicWorks} position={[0, 0, 0]} focus={false} />

      {/* 3. 头顶要价云（期望薪资 → 云体体积/密度） */}
      <SalaryCloud
        salary={expectedSalary}
        exposeMode={exposeMode}
        position={[0, 2.8, 0]}
      />

      {/* 4. 身后技术栈光谱环（彩色光环，半透明环绕求职者身后） */}
      <group position={[0, 1.1, -1.6]}>
        {spectrumRing.map((s, i) => {
          const startAngle = (-Math.PI / 2) + (i === 0 ? 0 : spectrumRing.slice(0, i).reduce((a, b) => a + b.pct, 0) / 100 * 2 * Math.PI)
          const endAngle = startAngle + (s.pct / 100) * 2 * Math.PI
          const segments = 32
          const points: [number, number][] = []
          for (let j = 0; j <= segments; j++) {
            const t = j / segments
            const a = startAngle + (endAngle - startAngle) * t
            points.push([Math.cos(a) * 0.7, Math.sin(a) * 0.7])
          }
          const positions = points.flatMap(([x, y]) => [x, 0, y])
          return (
            <line key={s.label}>
              <bufferGeometry>
                <bufferAttribute attach="attributes-position" args={[new Float32Array(positions), 3]} />
              </bufferGeometry>
              <lineBasicMaterial color={s.color} transparent opacity={0.7} linewidth={3} />
            </line>
          )
        })}
        {/* 光环底座 */}
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.55, 0.75, 64]} />
          <meshBasicMaterial color="#16C0B6" transparent opacity={0.25} depthWrite={false} />
        </mesh>
      </group>

      {/* 入口铭牌已移除（盲审 R5 短板：世界空间标签在 4 张截图右缘裁切+穿透浮层，
          且信息与 LotCard/面板重复）——less is more，期望薪资/作品数由名片承载。
          教训保留：Canvas 内 DOM 必须走 drei <Html>（T13） */}

      {/* 求职者本体占位：头顶太阳/月亮（夜间月亮 / 白天太阳，与 HR 摊位顶灯语义一致） */}
      <mesh position={[0, 2.4, 0]}>
        <sphereGeometry args={[0.14, 12, 12]} />
        <meshBasicMaterial color={night ? ColorSceneMoon : ColorSceneSun} />
      </mesh>
    </group>
  )
}
