// 公司展台：钞票山 + 薛定谔钞票 + 五险切口 + 发光地砖路 + Avatar 漫游
// A/B 对比模式（project.md 4.4，Demo P0）：对比才有叙事——左山矮但夕阳，右山高但凌晨月亮
import { useEffect, useMemo } from 'react'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import {
  BILL,
  CompanyParams,
  incrementPackage,
  layerLayout,
  MOUNTAIN_HEIGHT_SCALE,
  totalPackage,
  yuanToStacks,
} from '../engine/params'
import {
  ColorBrandOrange,
  ColorSceneBooth,
  ColorSceneGate,
  ColorSceneSun,
} from '../../generated/design-tokens.output.mjs'
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

  // 展台描边几何：此前写在 JSX args 里 `new THREE.PlaneGeometry(6,6)` 每次渲染都新建，
  // 造成几何/GPU 资源反复创建且旧实例泄漏。这里缓存一次，卸载时 dispose。
  const edgePlane = useMemo(() => new THREE.PlaneGeometry(6, 6), [])
  useEffect(() => {
    return () => edgePlane.dispose()
  }, [edgePlane])

  // 山顶数据浮标：层数与渲染同源（引擎公式），高度 = 层数 × 层高 × 感知增强
  const mountainH = useMemo(() => {
    const baseL = layerLayout(yuanToStacks(params.annualBaseSalary), 0)
    const inc = incrementPackage(params)
    const incL = layerLayout(yuanToStacks(inc), baseL.length ? baseL[baseL.length - 1].layer + 1 : 0)
    const layers = baseL.length + (inc > 0 ? incL.length : 0)
    return layers * BILL.stackH * MOUNTAIN_HEIGHT_SCALE
  }, [params])

  // 数据浮标引线长度：低薪小山（0.16–0.32m）下旧定长 0.56m 是山体 3.5 倍，读作「断线+悬空标签」。
  // 改为随山高缩放并封顶旧值：小山 = 山高×0.5（比例锚定），大山 = 0.56（高薪大山行为与现状逐像素一致）。
  const leadLen = Math.min(0.56, mountainH * 0.5)

  return (
    <group position={position}>
      {/* 展台补光：夜色下把 Avatar/山体从暗地板上托出来（ColorSceneSun 暖白） */}
      <pointLight position={[0, 4.2, 1.5]} intensity={9} distance={11} decay={2} color={ColorSceneSun} />
      {/* 地基：每家公司一块 6×6m 的展台（漫游模式下点击=走过去） */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.01, 0]}
        receiveShadow
        onClick={roam ? handleGround : undefined}
      >
        <planeGeometry args={[6, 6]} />
        <meshStandardMaterial color={ColorSceneBooth} roughness={1} />
      </mesh>
      {/* 展台描边：视觉上框住舞台，避免大面积死黑（必须与地面同角度平铺） */}
      <lineSegments rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
        <edgesGeometry args={[edgePlane]} />
        <lineBasicMaterial color={ColorSceneGate} />
      </lineSegments>
      {/* key 换值 = 整组重挂载 = 生长动画重播 */}
      <group key={growthKey}>
        <MoneyMountain
          baseYuan={params.annualBaseSalary}
          incrementYuan={incrementPackage(params)}
        />
        <CarvedZone baseYuan={params.annualBaseSalary} ratio={params.socialInsuranceBaseRatio} />
        {/* 悬浮钞票带跟山：SchrodingerBills 内部把钞票铺在 y∈[1.6,3.2]（带底 1.6 是按旧构图定的绝对高度），
            外包 group 整体下移 1.6 → 带底恒 = 山顶。不变式：钞票带相对山顶恒定——
            山高 0.32m 时贴在山上而非半空，山高 2m 时仅整体上移 0.4m ≈ 现状。
            不做 max(0,·) 钳位：带底 = mountainH ≥ 0 永不入地；若钳位，山高 <1.6m 时带悬回 1.6–3.2 半空，复活脱接。
            外壳变换只做在这一层，不改 SchrodingerBills 内部。 */}
        <group position={[0, mountainH - 1.6, 0]}>
          <SchrodingerBills
            equityYuan={params.equityValue}
            baseYuan={params.annualBaseSalary}
          />
        </group>
        <GlowPath />
        {/* 首个 Aholo 真实资产：逛厂币捆（Lux3D 生成 → Draco 压缩 2.2MB） */}
        <AssetProp url={assetUrl("/assets/money/gc-bill-bundle.glb")} position={[1.7, 0, 1.1]} targetSize={0.55} />
      </group>
      {/* Avatar 演员：文生3D→绑骨→动画重定向→压缩 3.1MB，站在地砖路上（默认取景内） */}
      <AvatarActor
        position={[-1.9, 0, 2.0]}
        roam={roam}
        refs={roamRefs}
      />
      <Html position={[0, 2.6, -2.2]} center distanceFactor={12} zIndexRange={[10, 1]}>
        <div className="plot-label">{name}</div>
      </Html>
      {/* 山顶数据浮标：核心金额直接钉在山上 + 引线连到山尖（盲审：视线找不到主体） */}
      {!roam && (
        <>
          {/* 引线：底端仍埋入峰顶 0.01m，长度 leadLen（= 0.56 时与旧版逐像素等价） */}
          <mesh position={[-0.5, mountainH - 0.01 + leadLen / 2, -1.5]}>
            <boxGeometry args={[0.014, leadLen, 0.014]} />
            <meshBasicMaterial color={ColorBrandOrange} />
          </mesh>
          {/* 标签 y = 山顶 + 引线顶端（杆顶上方 0.03m，与旧版间距一致），随引线长度自动升降 */}
          <Html position={[-0.5, mountainH - 0.01 + leadLen + 0.03, -1.5]} center distanceFactor={13} zIndexRange={[10, 1]}>
            <div className="peak-tag">
              ¥{Math.round(totalPackage(params) / 10000)}万 · {params.salaryStructure}薪
            </div>
          </Html>
        </>
      )}
    </group>
  )
}
