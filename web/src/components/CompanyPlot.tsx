// A/B 公司对比模式（project.md 4.4，Demo P0）：
// 对比才有叙事——左山矮但夕阳，右山高但凌晨月亮
import { Html } from '@react-three/drei'
import { CompanyParams, incrementPackage } from '../engine/params'
import { MoneyMountain } from './MoneyMountain'
import { SchrodingerBills } from './SchrodingerBills'

export function CompanyPlot({
  position,
  name,
  params,
}: {
  position: [number, number, number]
  name: string
  params: CompanyParams
}) {
  return (
    <group position={position}>
      {/* 地基：每家公司一块 6×6m 的展台 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[6, 6]} />
        <meshStandardMaterial color="#1c2126" roughness={1} />
      </mesh>
      <MoneyMountain
        baseYuan={params.annualBaseSalary}
        incrementYuan={incrementPackage(params)}
      />
      <SchrodingerBills equityYuan={params.equityValue} baseYuan={params.annualBaseSalary} />
      <Html position={[0, 0.1, 2.6]} center distanceFactor={10}>
        <div className="plot-label">{name}</div>
      </Html>
    </group>
  )
}
