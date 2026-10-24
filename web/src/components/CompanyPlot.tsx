// 公司展台：钞票山 + 薛定谔钞票 + 发光地砖路同框
// A/B 对比模式（project.md 4.4，Demo P0）：对比才有叙事——左山矮但夕阳，右山高但凌晨月亮
import { Html } from '@react-three/drei'
import { CompanyParams, incrementPackage } from '../engine/params'
import { MoneyMountain } from './MoneyMountain'
import { SchrodingerBills } from './SchrodingerBills'
import { GlowPath } from './GlowPath'
import { AssetProp } from './AssetProp'

export function CompanyPlot({
  position,
  name,
  params,
  growthKey = 0,
}: {
  position: [number, number, number]
  name: string
  params: CompanyParams
  growthKey?: number
}) {
  return (
    <group position={position}>
      {/* 地基：每家公司一块 6×6m 的展台 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[6, 6]} />
        <meshStandardMaterial color="#1c2126" roughness={1} />
      </mesh>
      {/* key 换值 = 整组重挂载 = 生长动画重播 */}
      <group key={growthKey}>
        <MoneyMountain
          baseYuan={params.annualBaseSalary}
          incrementYuan={incrementPackage(params)}
        />
        <SchrodingerBills
          equityYuan={params.equityValue}
          baseYuan={params.annualBaseSalary}
        />
        <GlowPath />
        {/* 首个 Aholo 真实资产：逛厂币捆（Lux3D 生成 → Draco 压缩 2.2MB） */}
        <AssetProp url="/assets/money/gc-bill-bundle.glb" position={[1.7, 0, 0.9]} scale={1.4} />
      </group>
      <Html position={[0, 0.1, 2.6]} center distanceFactor={10}>
        <div className="plot-label">{name}</div>
      </Html>
    </group>
  )
}
