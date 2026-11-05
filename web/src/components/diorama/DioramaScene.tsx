// 逛厂 · 立体参数沙盘（v1.5 · D2 64 栋参数楼 / 2026-11-05）
//
// 定位：整条街区压缩成一块桌上微缩模型，一屏看全、轨道环绕、不走路。
// D1 = 桌台 + 2×2 象限盘 + 骨架；D2 = 64 栋参数楼（体量=总包，高×宽联动）+ InstancedMesh 池。
// 布局与体量的唯一事实源是 ./layout.ts（渲染与 T9 包围盒验证共用，防数值漂移）。
//
// —— 纪律核对（逐条对应任务书 §3.3 暗坑清单） ——
// · 纯程序几何（Box / Cylinder / Cone）：零 GLB / PLY / SPZ / 零外部资产 URL /
//   零第三方 CDN → 天然规避 T7 / T12b 受限资产、T12 CDN；且没有资产路径，不吃 vite base（T8）。
// · 组件内零硬编码 hex 色值：所有颜色来自 generated 的 Diorama* 令牌。
//   浅色主题结构件一律中灰～中明度，不用近白（lessons §13.5「一排白药瓶」）。
//   D2 刻意不改 D1 配色（问题 I-002 / I-003 由 D4 统一收敛，避免盲审基线漂移）。
// · 共面装饰层间隔 ≥ 0.02m：统一用 LIFT = 0.04m（T11）。
// · InstancedMesh 矩阵写在 useLayoutEffect（AGENTS 铁律；useMemo 会全叠原点）。
// · setColorAt 染色时材质绝不开 vertexColors（lessons §13.4 纯黑事故）。
// · 初始机位对「桌台 + 四区地块 + 全部 64 栋楼」做 Box3 相交验证（T9，见 verifyCameraOutside）。
// · 首屏不挂 Canvas：本组件只由 App.tsx 的 lazy 动态 import 挂载；无模块级 preload。
// · Canvas 内无裸 DOM 元素、无 data-* / aria-* 属性（lessons §11.1）。
// · D2 仍不加 HUD 浮层；D3 若加浮层，必须垫实底并按最坏背景验算（lessons §10.1）。

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { ThemeName } from '../../engine/theme'
import { debugHooksEnabled } from '../../engine/debug'
import { BuildingField } from './BuildingField'
import { SelectionMarkers } from './SelectionMarkers'
import { DioramaHud } from './DioramaHud'
import {
  W, D, T, PITCH, SURFACE_H, SURFACE_Y, TOP_BASE, TOP_SURFACE,
  RIM_H, RIM_Y, ZONE_H, ZONE_Y, TOP_ZONE, SLOT_H, SLOT_Y,
  SURFACE_W, SURFACE_D, ZONE_SIZE, RIM_X, RIM_Z, ZONE_CENTERS,
  BODY_BOTTOM, BUILDINGS, buildingVolume, VOLUME_RANGE_REPORT, CHANNEL_STATS,
} from './layout'
// 注意：本文件位于 web/src/components/diorama/（比 WorkdaySky.tsx 深一层），
// 设计令牌输出在 web/generated/，故为三级 ../../../generated —— 不是两级。
// 所有 Diorama* 常量由 `npm run tokens` 从 design/tokens.json 的 diorama 段生成。
import {
  DioramaDayTableBase,
  DioramaDayTableRim,
  DioramaDayTableSurface,
  DioramaDayZoneInternet,
  DioramaDayZoneFinance,
  DioramaDayZoneManufacturing,
  DioramaDayZoneCulture,
  DioramaDayBuildingBase,
  DioramaDayBuildingInternet,
  DioramaDayBuildingFinance,
  DioramaDayBuildingManufacturing,
  DioramaDayBuildingCulture,
  DioramaDayRaiseCrown,
  DioramaDayEquityPearl,
  DioramaDayWindowWarm,
  DioramaDayWindowCold,
  DioramaDayFoundationFull,
  DioramaDayFoundationCut,
  DioramaDaySky,
  DioramaDayFog,
  DioramaDayAmbient,
  DioramaDaySun,
  DioramaNightTableBase,
  DioramaNightTableRim,
  DioramaNightTableSurface,
  DioramaNightZoneInternet,
  DioramaNightZoneFinance,
  DioramaNightZoneManufacturing,
  DioramaNightZoneCulture,
  DioramaNightBuildingBase,
  DioramaNightBuildingInternet,
  DioramaNightBuildingFinance,
  DioramaNightBuildingManufacturing,
  DioramaNightBuildingCulture,
  DioramaNightRaiseCrown,
  DioramaNightEquityPearl,
  DioramaNightWindowWarm,
  DioramaNightWindowCold,
  DioramaNightFoundationFull,
  DioramaNightFoundationCut,
  DioramaNightSky,
  DioramaNightFog,
  DioramaNightAmbient,
  DioramaNightSun,
  DioramaDayDeskTop,
  DioramaDayDeskShadow,
  DioramaDayTreeTrunk,
  DioramaDayTreeCanopy,
  DioramaNightDeskTop,
  DioramaNightDeskShadow,
  DioramaNightTreeTrunk,
  DioramaNightTreeCanopy,
  DioramaDayFocusMark,
  DioramaDayPin1,
  DioramaDayPin2,
  DioramaDayPin3,
  DioramaDayContactShadow,
  DioramaDayGroundGlow,
  DioramaNightFocusMark,
  DioramaNightPin1,
  DioramaNightPin2,
  DioramaNightPin3,
  DioramaNightContactShadow,
  DioramaNightGroundGlow,
  DioramaDayRulerBar,
  DioramaDayRulerTick,
  DioramaDayWindowFrame,
  DioramaDayEdgeLight,
  DioramaNightRulerBar,
  DioramaNightRulerTick,
  DioramaNightWindowFrame,
  DioramaNightEdgeLight,
  DioramaScaleCameraFov,
  DioramaScaleCameraHeight,
  DioramaScaleCameraDistance,
  DioramaScaleMinPolarAngle,
  DioramaScaleMaxPolarAngle,
  DioramaScaleMinDistance,
  DioramaScaleMaxDistance,
} from '../../../generated/design-tokens.output.mjs'

// ─────────────────────────────────────────────────────────────
// 昼 / 夜两套调色板：同一语义色在昼/夜有明度差（浅色主题结构件不用近白）
// D2 未改动任何色值 —— 配色收敛是 D4 的 I-002/I-003 闭环范围。
// ─────────────────────────────────────────────────────────────
interface Palette {
  tableBase: string
  tableRim: string
  tableSurface: string
  zones: readonly [string, string, string, string]
  buildings: readonly [string, string, string, string]
  buildingBase: string
  raiseCrown: string
  equityPearl: string
  windowWarm: string
  windowCold: string
  foundationFull: string
  foundationCut: string
  sky: string
  fog: string
  ambient: string
  sun: string
  deskTop: string
  deskShadow: string
  treeTrunk: string
  treeCanopy: string
  focusMark: string
  pin1: string
  pin2: string
  pin3: string
  contactShadow: string
  groundGlow: string
  rulerBar: string
  rulerTick: string
  windowFrame: string
  edgeLight: string
}

const DAY: Palette = {
  tableBase: DioramaDayTableBase,
  tableRim: DioramaDayTableRim,
  tableSurface: DioramaDayTableSurface,
  zones: [DioramaDayZoneInternet, DioramaDayZoneFinance, DioramaDayZoneManufacturing, DioramaDayZoneCulture],
  buildings: [DioramaDayBuildingInternet, DioramaDayBuildingFinance, DioramaDayBuildingManufacturing, DioramaDayBuildingCulture],
  buildingBase: DioramaDayBuildingBase,
  raiseCrown: DioramaDayRaiseCrown,
  equityPearl: DioramaDayEquityPearl,
  windowWarm: DioramaDayWindowWarm,
  windowCold: DioramaDayWindowCold,
  foundationFull: DioramaDayFoundationFull,
  foundationCut: DioramaDayFoundationCut,
  sky: DioramaDaySky,
  fog: DioramaDayFog,
  ambient: DioramaDayAmbient,
  sun: DioramaDaySun,
  deskTop: DioramaDayDeskTop,
  deskShadow: DioramaDayDeskShadow,
  treeTrunk: DioramaDayTreeTrunk,
  treeCanopy: DioramaDayTreeCanopy,
  focusMark: DioramaDayFocusMark,
  pin1: DioramaDayPin1,
  pin2: DioramaDayPin2,
  pin3: DioramaDayPin3,
  contactShadow: DioramaDayContactShadow,
  groundGlow: DioramaDayGroundGlow,
  rulerBar: DioramaDayRulerBar,
  rulerTick: DioramaDayRulerTick,
  windowFrame: DioramaDayWindowFrame,
  edgeLight: DioramaDayEdgeLight,
}

const NIGHT: Palette = {
  tableBase: DioramaNightTableBase,
  tableRim: DioramaNightTableRim,
  tableSurface: DioramaNightTableSurface,
  zones: [DioramaNightZoneInternet, DioramaNightZoneFinance, DioramaNightZoneManufacturing, DioramaNightZoneCulture],
  buildings: [DioramaNightBuildingInternet, DioramaNightBuildingFinance, DioramaNightBuildingManufacturing, DioramaNightBuildingCulture],
  buildingBase: DioramaNightBuildingBase,
  raiseCrown: DioramaNightRaiseCrown,
  equityPearl: DioramaNightEquityPearl,
  windowWarm: DioramaNightWindowWarm,
  windowCold: DioramaNightWindowCold,
  foundationFull: DioramaNightFoundationFull,
  foundationCut: DioramaNightFoundationCut,
  sky: DioramaNightSky,
  fog: DioramaNightFog,
  ambient: DioramaNightAmbient,
  sun: DioramaNightSun,
  deskTop: DioramaNightDeskTop,
  deskShadow: DioramaNightDeskShadow,
  treeTrunk: DioramaNightTreeTrunk,
  treeCanopy: DioramaNightTreeCanopy,
  focusMark: DioramaNightFocusMark,
  pin1: DioramaNightPin1,
  pin2: DioramaNightPin2,
  pin3: DioramaNightPin3,
  contactShadow: DioramaNightContactShadow,
  groundGlow: DioramaNightGroundGlow,
  rulerBar: DioramaNightRulerBar,
  rulerTick: DioramaNightRulerTick,
  windowFrame: DioramaNightWindowFrame,
  edgeLight: DioramaNightEdgeLight,
}

// ─────────────────────────────────────────────────────────────
// 相机 / 光照
// ─────────────────────────────────────────────────────────────
const CAMERA_XZ = DioramaScaleCameraDistance / Math.SQRT2 // 40/√2 ≈ 28.284
const CAMERA_POS: [number, number, number] = [CAMERA_XZ, DioramaScaleCameraHeight, CAMERA_XZ]
const TARGET: [number, number, number] = [0, 1, 0]
// 俯角 = atan((30 - 1) / 40) ≈ 35.9°（规格 35–40°）；FOV 30° 长焦压缩透视出微缩感。
const FOG_NEAR = DioramaScaleCameraDistance * 1.5
const FOG_FAR = DioramaScaleCameraDistance * 5

// ─────────────────────────────────────────────────────────────
// T9：初始机位对全部体块包围盒做相交验证
// ─────────────────────────────────────────────────────────────
interface Volume {
  name: string
  box: THREE.Box3
}

const mkVolume = (name: string, min: [number, number, number], max: [number, number, number]): Volume => ({
  name,
  box: new THREE.Box3(new THREE.Vector3(...min), new THREE.Vector3(...max)),
})

/** 桌台基座 + 桌面 + 4 条桌沿 + 4 区地块 + **64 栋真实参数楼** = 74 个体块 */
function buildVolumes(): Volume[] {
  const vols: Volume[] = [
    mkVolume('桌台基座', [-W / 2, -T / 2, -D / 2], [W / 2, T / 2, D / 2]),
    mkVolume('桌面板', [-SURFACE_W / 2, TOP_BASE, -SURFACE_D / 2], [SURFACE_W / 2, TOP_SURFACE, SURFACE_D / 2]),
    mkVolume('桌沿-前', [-(W + 0.4) / 2, TOP_SURFACE, -RIM_Z - 0.2], [(W + 0.4) / 2, RIM_Y + RIM_H / 2, -RIM_Z + 0.2]),
    mkVolume('桌沿-后', [-(W + 0.4) / 2, TOP_SURFACE, RIM_Z - 0.2], [(W + 0.4) / 2, RIM_Y + RIM_H / 2, RIM_Z + 0.2]),
    mkVolume('桌沿-左', [-RIM_X - 0.2, TOP_SURFACE, -(D + 0.4) / 2], [-RIM_X + 0.2, RIM_Y + RIM_H / 2, (D + 0.4) / 2]),
    mkVolume('桌沿-右', [RIM_X - 0.2, TOP_SURFACE, -(D + 0.4) / 2], [RIM_X + 0.2, RIM_Y + RIM_H / 2, (D + 0.4) / 2]),
  ]
  ZONE_CENTERS.forEach(([cx, cz], i) => {
    vols.push(
      mkVolume(
        `地块-${i}`,
        [cx - ZONE_SIZE / 2, TOP_SURFACE, cz - ZONE_SIZE / 2],
        [cx + ZONE_SIZE / 2, TOP_ZONE, cz + ZONE_SIZE / 2]
      )
    )
  })
  // D2：逐栋覆盖真实 64 个体块（不再沿用 D1 那 4 栋示意楼的旧结论）
  BUILDINGS.forEach((d) => {
    const v = buildingVolume(d)
    vols.push(mkVolume(`参数楼-${d.index}`, v.min, v.max))
  })
  return vols
}

// —— T9 具体数值结论（2026-11-05 D2）——
// 74 个体块的联合包围盒：x/z ∈ [-12.2, 12.2]（桌沿与四区地块），
// y 上界 = BODY_BOTTOM(1.20) + H_MAX(3.6) + CROWN_H(0.28) + PEARL_H(0.44) = 5.52。
// 初始相机 (28.284, 30, 28.284)：y=30 > 5.52，x=z=28.284 > 12.2 → 三轴全在包围盒之外。
// 运行时仍逐盒 Box3.distanceToPoint 断言（minGap > 0、hits=0），结论挂
// window.__diorama 供采集脚本与审查取证；失败则抬机位到 y=48「机位宁高勿内」。
// 历史事故：R19 之前初进街区全黑，真相是初始相机 [13, 4.5, 9] 落在 lot0 办公楼包围盒内部。
function verifyCameraOutside(pos: THREE.Vector3) {
  const volumes = buildVolumes()
  const distances = volumes.map((v) => v.box.distanceToPoint(pos))
  const minGap = Math.min(...distances)
  const hits = volumes.filter((_, i) => distances[i] <= 0).map((v) => v.name)
  const cameraOutside = hits.length === 0
  if (!cameraOutside) {
    console.error(`[DioramaScene/T9] 初始相机落在体块内部：${hits.join(', ')}；已抬高机位`)
  }
  return { volumes, distances, minGap, cameraOutside }
}

interface DioramaDiagnostics {
  scene: THREE.Scene
  cameraPosition: [number, number, number]
  target: [number, number, number]
  cameraOutside: boolean
  minGap: number
  volumeCount: number
  volumeRange: typeof VOLUME_RANGE_REPORT
  channelStats: typeof CHANNEL_STATS
  volumes: {
    name: string
    min: [number, number, number]
    max: [number, number, number]
    distanceToCamera: number
  }[]
  readyAt: string
}

// ─────────────────────────────────────────────────────────────
// 子组件：桌台 / 网格位
// ─────────────────────────────────────────────────────────────

/** 桌台基座 + 桌面板 + 四条桌沿 + 四区地块色块（D7 全部接入真实投影） */
function TableDeck({ palette, night }: { palette: Palette; night: boolean }) {
  return (
    <group>
      <mesh position={[0, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[W, T, D]} />
        <meshStandardMaterial color={palette.tableBase} roughness={0.9} metalness={0.04} />
      </mesh>
      <mesh position={[0, SURFACE_Y, 0]} castShadow receiveShadow>
        <boxGeometry args={[SURFACE_W, SURFACE_H, SURFACE_D]} />
        <meshStandardMaterial color={palette.tableSurface} roughness={0.88} />
      </mesh>
      <mesh position={[0, RIM_Y, -RIM_Z]} castShadow receiveShadow>
        <boxGeometry args={[W + 0.4, RIM_H, 0.4]} />
        <meshStandardMaterial color={palette.tableRim} roughness={0.8} />
      </mesh>
      <mesh position={[0, RIM_Y, RIM_Z]} castShadow receiveShadow>
        <boxGeometry args={[W + 0.4, RIM_H, 0.4]} />
        <meshStandardMaterial color={palette.tableRim} roughness={0.8} />
      </mesh>
      <mesh position={[-RIM_X, RIM_Y, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.4, RIM_H, D + 0.4]} />
        <meshStandardMaterial color={palette.tableRim} roughness={0.8} />
      </mesh>
      <mesh position={[RIM_X, RIM_Y, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.4, RIM_H, D + 0.4]} />
        <meshStandardMaterial color={palette.tableRim} roughness={0.8} />
      </mesh>
      {ZONE_CENTERS.map(([cx, cz], i) => (
        <mesh key={`zone-${i}`} position={[cx, ZONE_Y, cz]} receiveShadow>
          <boxGeometry args={[ZONE_SIZE, ZONE_H, ZONE_SIZE]} />
          {/* D6：夜间四区地块自发光，保留分组色相差，修「夜景四区边界糊成一片」 */}
          <meshStandardMaterial
            color={palette.zones[i]}
            emissive={palette.zones[i]}
            emissiveIntensity={night ? 0.42 : 0}
            roughness={0.9}
          />
        </mesh>
      ))}
    </group>
  )
}

/**
 * D7 高度定量基准（第二轮评审 D 第 2 条：「高度只做相对隐喻、读不出量级」）。
 * 立在桌台左前外侧，5 档刻度 = 行业内总包分位 0/25/50/75/100%，
 * 与 HUD 公司卡的「行业分位 XX%」互证。**不标绝对金额**：体量是行业内
 * 归一化，标金额会误导跨行业比较（project.md v1.5 四信道设计）。
 */
function PercentRuler({ palette }: { palette: Palette }) {
  const X = -W / 2 - 0.85
  const Z = D / 2 - 1.0
  const BOTTOM = BODY_BOTTOM + 0.6 // 最矮楼身顶 = 1.8
  const TOP = BODY_BOTTOM + 4.4 // 最高楼身顶 = 5.6
  return (
    <group>
      <mesh position={[X, (BOTTOM + TOP) / 2 + 0.25, Z]} castShadow>
        <boxGeometry args={[0.14, TOP - BOTTOM + 0.9, 0.14]} />
        <meshStandardMaterial color={palette.rulerBar} roughness={0.9} />
      </mesh>
      {[0, 1, 2, 3, 4].map((k) => (
        <mesh key={k} position={[X + 0.2, BOTTOM + (k * (TOP - BOTTOM)) / 4, Z]}>
          <boxGeometry args={[k % 2 === 0 ? 0.42 : 0.26, 0.055, 0.09]} />
          <meshBasicMaterial color={palette.rulerTick} />
        </mesh>
      ))}
    </group>
  )
}

/**
 * 每区 4×4 = 16 个网格位，四区共 64 个薄片，一个 InstancedMesh 承载。
 * 矩阵必须写 useLayoutEffect；材质不传 color、绝不开 vertexColors（lessons §13.4）。
 */
function SlotGrid({ palette }: { palette: Palette }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const COUNT = 64
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const matrix = new THREE.Matrix4()
    const color = new THREE.Color()
    for (let q = 0; q < 4; q++) {
      const [cx, cz] = ZONE_CENTERS[q]
      color.set(palette.zones[q])
      for (let j = 0; j < 16; j++) {
        const gx = j % 4
        const gz = Math.floor(j / 4)
        const ox = (gx - 1.5) * PITCH
        const oz = (gz - 1.5) * PITCH
        const i = q * 16 + j
        matrix.makeTranslation(cx + ox, SLOT_Y, cz + oz)
        mesh.setMatrixAt(i, matrix)
        mesh.setColorAt(i, color)
      }
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [palette])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, COUNT]} frustumCulled={false}>
      {/* 尺寸跟随格距令牌，D3 放大 PITCH 后网格位不会变成零散小点 */}
      <boxGeometry args={[PITCH * 0.72, SLOT_H, PITCH * 0.72]} />
      <meshStandardMaterial roughness={0.85} metalness={0.05} />
    </instancedMesh>
  )
}

/**
 * I-003：给微缩模型一个「放在桌上」的环境。
 * 桌面大平面 + 接地阴影 + 一圈低多边形树 + 半球补光；全部走 diorama.* 令牌。
 * 分层：桌面 y=-T/2-0.10、阴影 y=-T/2-0.06、桌台底 y=-T/2 —— 间隔 ≥0.02m（T11）。
 */
function DeskEnvironment({ palette, night }: { palette: Palette; night: boolean }) {
  const trunkRef = useRef<THREE.InstancedMesh>(null)
  const canopyRef = useRef<THREE.InstancedMesh>(null)
  const TREES = 28
  useLayoutEffect(() => {
    const trunk = trunkRef.current
    const canopy = canopyRef.current
    if (!trunk || !canopy) return
    const matrix = new THREE.Matrix4()
    const quat = new THREE.Quaternion()
    const pos = new THREE.Vector3()
    const scale = new THREE.Vector3()
    const color = new THREE.Color()
    for (let i = 0; i < TREES; i++) {
      const a = (i / TREES) * Math.PI * 2
      const r = 15.4 + (i % 3) * 0.8
      const x = Math.cos(a) * r
      const z = Math.sin(a) * r
      pos.set(x, -T / 2 + 0.45, z)
      scale.set(0.26, 0.9, 0.26)
      matrix.compose(pos, quat, scale)
      trunk.setMatrixAt(i, matrix)
      color.set(palette.treeTrunk)
      trunk.setColorAt(i, color)
      pos.set(x, -T / 2 + 1.35, z)
      scale.set(0.58, 1.0, 0.58)
      matrix.compose(pos, quat, scale)
      canopy.setMatrixAt(i, matrix)
      color.set(palette.treeCanopy)
      canopy.setColorAt(i, color)
    }
    for (const m of [trunk, canopy]) {
      m.instanceMatrix.needsUpdate = true
      if (m.instanceColor) m.instanceColor.needsUpdate = true
      m.computeBoundingSphere()
    }
  }, [palette])
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -T / 2 - 0.1, 0]} receiveShadow>
        <planeGeometry args={[120, 120]} />
        <meshStandardMaterial color={palette.deskTop} roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -T / 2 - 0.06, 0]}>
        <planeGeometry args={[W + 2.4, D + 2.4]} />
        <meshBasicMaterial color={palette.deskShadow} transparent opacity={0.55} depthWrite={false} />
      </mesh>
      <instancedMesh ref={trunkRef} args={[undefined, undefined, TREES]} frustumCulled={false} castShadow>
        <cylinderGeometry args={[1, 1, 1, 5]} />
        <meshStandardMaterial roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={canopyRef} args={[undefined, undefined, TREES]} frustumCulled={false} castShadow>
        <coneGeometry args={[1, 1, 6]} />
        <meshStandardMaterial roughness={0.9} />
      </instancedMesh>
      {/* 夜景补光：D7 再抬一档到 1.1，保住树/底座边框/楼体暗面轮廓 */}
      <hemisphereLight args={[palette.ambient, palette.deskShadow, night ? 1.1 : 0.55]} />
    </group>
  )
}

/**
 * 点选后平滑聚焦：只改 OrbitControls.target 与相机位置，不接管用户后续拖拽。
 * 偏移距离 ≈19.7m > minDistance(18)，否则 controls.update() 会把相机推回、
 * lerp 永远收敛不了（focus 卡死）。
 */
function CameraFocus({ selected }: { selected: number | null }) {
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as unknown as {
    target: THREE.Vector3
    update: () => void
  } | null
  const goal = useRef<{ pos: THREE.Vector3; target: THREE.Vector3 } | null>(null)

  useEffect(() => {
    if (selected == null) return
    const d = BUILDINGS[selected]
    if (!d) return
    const target = new THREE.Vector3(d.x, BODY_BOTTOM + d.height * 0.5, d.z)
    goal.current = {
      target,
      pos: new THREE.Vector3(d.x + 12, target.y + 10, d.z + 12),
    }
  }, [selected])

  useFrame(() => {
    if (!goal.current || !controls) return
    camera.position.lerp(goal.current.pos, 0.09)
    controls.target.lerp(goal.current.target, 0.09)
    controls.update()
    if (camera.position.distanceTo(goal.current.pos) < 0.06) goal.current = null
  })
  return null
}

// ─────────────────────────────────────────────────────────────
// 场景主体：唯一 Canvas，lazy 挂载
// ─────────────────────────────────────────────────────────────
export function DioramaScene({ envHour, theme }: { envHour: number; theme: ThemeName }) {
  const night = theme === 'dark'
  const palette = night ? NIGHT : DAY

  // envHour 用于主光方位（?hour=10 冻结后截图可复现）
  const sunAzimuth = ((envHour - 6) / 12) * Math.PI
  const sunX = Math.cos(sunAzimuth) * 24
  const sunZ = Math.sin(sunAzimuth) * 24

  // —— D3 交互状态（全部留在场景内，不上升到 App，避免污染 R19 其它模式）——
  const [hovered, setHovered] = useState<number | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [pinned, setPinned] = useState<number[]>([])
  const visitedRef = useRef<Set<number>>(new Set())
  const [visited, setVisited] = useState(0)

  const handleHover = useCallback((i: number | null) => {
    setHovered(i)
    // 真实计数：只统计实际 hover 过的公司，不做假进度
    if (i != null && !visitedRef.current.has(i)) {
      visitedRef.current.add(i)
      setVisited(visitedRef.current.size)
    }
  }, [])
  const handleSelect = useCallback((i: number) => setSelected(i), [])
  const handlePin = useCallback(
    (i: number) => setPinned((prev) => (prev.includes(i) || prev.length >= 3 ? prev : [...prev, i])),
    []
  )
  const handleUnpin = useCallback((i: number) => setPinned((prev) => prev.filter((x) => x !== i)), [])
  const handleClearPins = useCallback(() => setPinned([]), [])
  const industryLabels = [0, 1, 2, 3].map((z) => BUILDINGS[z * 16]?.lot.industryLabel ?? '')

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ fov: DioramaScaleCameraFov, position: CAMERA_POS, near: 0.1, far: 400 }}
        onCreated={({ camera, scene, gl }) => {
          const diag = verifyCameraOutside(new THREE.Vector3(...CAMERA_POS))
          if (debugHooksEnabled()) {
            const w = window as unknown as {
              __gl?: THREE.WebGLRenderer
              __diorama?: DioramaDiagnostics
              __dioramaProject?: () => { index: number; x: number; y: number }[]
            }
            // 采集脚本轮询 window.__gl.info.render.calls > 0 判定首帧（lessons §13.7）
            w.__gl = gl
            // 交互验收钩子：把 64 栋楼中心投影成屏幕像素，供 egolite 精确 hover/click
            w.__dioramaProject = () => {
              camera.updateMatrixWorld()
              const rect = gl.domElement.getBoundingClientRect()
              return BUILDINGS.map((d) => {
                const v = new THREE.Vector3(d.x, BODY_BOTTOM + d.height / 2, d.z).project(camera)
                return {
                  index: d.index,
                  x: rect.left + (v.x * 0.5 + 0.5) * rect.width,
                  y: rect.top + (-v.y * 0.5 + 0.5) * rect.height,
                }
              })
            }
            w.__diorama = {
              scene,
              cameraPosition: CAMERA_POS,
              target: TARGET,
              cameraOutside: diag.cameraOutside,
              minGap: diag.minGap,
              volumeCount: diag.volumes.length,
              volumeRange: VOLUME_RANGE_REPORT,
              channelStats: CHANNEL_STATS,
              volumes: diag.volumes.map((v, i) => ({
                name: v.name,
                min: v.box.min.toArray() as [number, number, number],
                max: v.box.max.toArray() as [number, number, number],
                distanceToCamera: diag.distances[i],
              })),
              readyAt: new Date().toISOString(),
            }
          }
          if (!diag.cameraOutside) {
            camera.position.set(CAMERA_XZ, 48, CAMERA_XZ)
            camera.lookAt(...TARGET)
          }
          requestAnimationFrame(() =>
            requestAnimationFrame(() => window.dispatchEvent(new Event('diorama-ready')))
          )
        }}
      >
        <color attach="background" args={[palette.sky]} />
        <fog attach="fog" args={[palette.fog, FOG_NEAR, FOG_FAR]} />
        {/* D6：昼景拉开光比（ambient 0.95→0.68 / 主光 1.55→2.05），修「灰平、无主光方向」 */}
        <ambientLight color={palette.ambient} intensity={night ? 1.1 : 0.68} />
        {/* D7：真实落地投影（四位评审反复点名「楼像浮在地面上」）。
            阴影相机 ±20m 覆盖 24m 桌台，2048 贴图；draw calls 会随阴影 pass 上升但仍远低于红线 150 */}
        <directionalLight
          color={palette.sun}
          position={[sunX, 34, sunZ]}
          intensity={night ? 1.3 : 2.05}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-20}
          shadow-camera-right={20}
          shadow-camera-top={20}
          shadow-camera-bottom={-20}
          shadow-camera-near={1}
          shadow-camera-far={110}
          shadow-bias={-0.0005}
        />
        <DeskEnvironment palette={palette} night={night} />
        <TableDeck palette={palette} night={night} />
        <PercentRuler palette={palette} />
        <SlotGrid palette={palette} />
        <BuildingField colors={palette} night={night} onHover={handleHover} onSelect={handleSelect} />
        <SelectionMarkers selected={selected} pinned={pinned} palette={palette} />
        <CameraFocus selected={selected} />
        {/* 轨道环绕：只限制俯角与缩放距离，不接任何走路/跟随相机 */}
        <OrbitControls
          makeDefault
          target={TARGET}
          minPolarAngle={DioramaScaleMinPolarAngle}
          maxPolarAngle={DioramaScaleMaxPolarAngle}
          minDistance={DioramaScaleMinDistance}
          maxDistance={DioramaScaleMaxDistance}
          enablePan={false}
          enableDamping={false}
        />
      </Canvas>
      <DioramaHud
        hovered={hovered != null ? BUILDINGS[hovered] ?? null : null}
        selected={selected != null ? BUILDINGS[selected] ?? null : null}
        pinned={pinned.map((i) => BUILDINGS[i]).filter((d): d is (typeof BUILDINGS)[number] => d != null)}
        visited={visited}
        total={BUILDINGS.length}
        zoneColors={palette.zones}
        pinColors={[palette.pin1, palette.pin2, palette.pin3]}
        industryLabels={industryLabels}
        onPin={handlePin}
        onUnpin={handleUnpin}
        onClearPins={handleClearPins}
      />
    </div>
  )
}
