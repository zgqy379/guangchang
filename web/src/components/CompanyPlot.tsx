// 公司展台：钞票山 + 薛定谔钞票 + 五险切口 + 发光地砖路 + Avatar 漫游
// A/B 对比模式（project.md 4.4，Demo P0）：对比才有叙事——左山矮但夕阳，右山高但凌晨月亮
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import { CompanyParams, incrementPackage } from '../engine/params'
import { MoneyMountain } from './MoneyMountain'
import { SchrodingerBills } from './SchrodingerBills'
import { GlowPath } from './GlowPath'
import { AssetProp } from './AssetProp'
import { AvatarActor, RoamRefs } from './AvatarActor'
import { CarvedZone } from './CarvedZone'
import { assetUrl } from '../engine/asset'

export function CompanyPlot({
  position,
  name,
  params,
  growthKey = 0,
  roam = false,
  roamRefs,
  onGroundClick,
}: {
  position: [number, number, number]
  name: string
  params: CompanyParams
  growthKey?: number
  roam?: boolean
  roamRefs?: RoamRefs
  onGroundClick?: (point: { x: number; y: number; z: number }) => void
}) {
  const handleGround = (e: ThreeEvent<MouseEvent>) => {
    if (onGroundClick) {
      e.stopPropagation()
      onGroundClick({ x: e.point.x, y: e.point.y, z: e.point.z })
    }
  }

  return (
    <group position={position}>
      {/* 地基：每家公司一块 6×6m 的展台（漫游模式下点击=走过去） */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.01, 0]}
        receiveShadow
        onClick={roam ? handleGround : undefined}
      >
        <planeGeometry args={[6, 6]} />
        <meshStandardMaterial color="#252b32" roughness={1} />
      </mesh>
      {/* 展台描边：视觉上框住舞台，避免大面积死黑 */}
      <lineSegments position={[0, 0.002, 0]}>
        <edgesGeometry args={[new THREE.PlaneGeometry(6, 6)]} />
        <lineBasicMaterial color="#3d4650" />
      </lineSegments>
      {/* key 换值 = 整组重挂载 = 生长动画重播 */}
      <group key={growthKey}>
        <MoneyMountain
          baseYuan={params.annualBaseSalary}
          incrementYuan={incrementPackage(params)}
        />
        <CarvedZone baseYuan={params.annualBaseSalary} ratio={params.socialInsuranceBaseRatio} />
        <SchrodingerBills
          equityYuan={params.equityValue}
          baseYuan={params.annualBaseSalary}
        />
        <GlowPath />
        {/* 首个 Aholo 真实资产：逛厂币捆（Lux3D 生成 → Draco 压缩 2.2MB） */}
        <AssetProp url={assetUrl("/assets/money/gc-bill-bundle.glb")} position={[1.7, 0, 1.1]} targetSize={0.55} />
      </group>
      {/* Avatar 演员：文生3D→绑骨→动画重定向→压缩 3.1MB，站在地砖路起点 */}
      <AvatarActor
        position={[-1.9, 0, 3.4]}
        roam={roam}
        refs={roamRefs}
      />
      <Html position={[0, 0.1, 2.6]} center distanceFactor={10}>
        <div className="plot-label">{name}</div>
      </Html>
      {/* 诚实声明：感知放大系数（对抗审查 P2） */}
      <Html position={[-1.35, 0.7, 0.6]} center distanceFactor={12}>
        <div className="scale-note">钞票山等比放大 2.5× 展示<br />比例关系不变 · 真实换算见附录A</div>
      </Html>
    </group>
  )
}
