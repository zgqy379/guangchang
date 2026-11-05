// 立体参数沙盘 · 桌台布局 + 64 栋参数楼的体量映射（D2 / 2026-11-05）
//
// 本模块是「布局与体量」的唯一事实源：渲染（BuildingField / TableDeck / SlotGrid）
// 与 T9 相机包围盒验证（DioramaScene.buildVolumes）都从这里取数，避免两套数值漂移。
//
// 纪律：
// · 64 个摊位是「已发布快照」，只在模块加载时算一次（BUILDINGS 常量），
//   不随渲染、主题、滑杆重算 —— AGENTS.md「滑杆只驱动建厂预览与对比页」。
// · 体量 = 总包在**行业内**归一化 → 高 × 宽联动。R19 实测 ±14% 读不出、
//   ±26% 才过线，故这里起手给足量程：高 0.6→3.6（6×）、宽 0.42→1.02（2.43×）。
// · 所有尺度常量来自 diorama.scale 令牌；颜色仍由 Diorama* 色令牌提供（本模块不含色值）。

import type { Industry } from '../../data/street-companies'
import { STREET_LOTS, type Lot } from '../../data/street-companies'
import { totalPackage, incrementPackage } from '../../engine/params'
import {
  DioramaScaleTableWidth,
  DioramaScaleTableDepth,
  DioramaScaleTableThickness,
  DioramaScaleZoneInset,
  DioramaScaleZoneGap,
  DioramaScaleSlotPitch,
  DioramaScaleCoplanarGap,
  DioramaScaleBuildingHeightMin,
  DioramaScaleBuildingHeightMax,
  DioramaScaleBuildingWidthMin,
  DioramaScaleBuildingWidthMax,
} from '../../../generated/design-tokens.output.mjs'

// ── 桌台几何（与 D1 完全同值，只是收口到单一来源）────────────────────
export const W = DioramaScaleTableWidth
export const D = DioramaScaleTableDepth
export const T = DioramaScaleTableThickness
export const INSET = DioramaScaleZoneInset
export const GAP = DioramaScaleZoneGap
export const PITCH = DioramaScaleSlotPitch
export const LIFT = DioramaScaleCoplanarGap // 0.04 ≥ 0.02m（T11）

export const TOP_BASE = T / 2
export const SURFACE_H = 0.12
export const SURFACE_Y = TOP_BASE + SURFACE_H / 2
export const TOP_SURFACE = TOP_BASE + SURFACE_H
export const RIM_H = 0.28
export const RIM_Y = TOP_SURFACE + RIM_H / 2
export const ZONE_H = 0.18
export const ZONE_Y = TOP_SURFACE + ZONE_H / 2
export const TOP_ZONE = TOP_SURFACE + ZONE_H
export const SLOT_H = 0.06
export const SLOT_Y = TOP_ZONE + LIFT + SLOT_H / 2
export const TOP_SLOT = TOP_ZONE + LIFT + SLOT_H

export const SURFACE_W = W - 2 * INSET
export const SURFACE_D = D - 2 * INSET
export const ZONE_SIZE = (SURFACE_W - GAP) / 2
export const ZONE_C = GAP / 2 + ZONE_SIZE / 2
export const RIM_X = W / 2 - 0.2
export const RIM_Z = D / 2 - 0.2

// ── 楼体部件几何 ─────────────────────────────────────────────────────
export const PAD_Y = TOP_SLOT + LIFT
export const PAD_H = 0.16
export const BODY_BOTTOM = PAD_Y + PAD_H
export const BASE_H = 0.3
export const CROWN_H = 0.28
export const PEARL_H = 0.44

// ── 体量量程（令牌）──────────────────────────────────────────────────
export const H_MIN = DioramaScaleBuildingHeightMin
export const H_MAX = DioramaScaleBuildingHeightMax
export const W_MIN = DioramaScaleBuildingWidthMin
export const W_MAX = DioramaScaleBuildingWidthMax

/** 2×2 象限：互联网 / 金融 / 智造 / 文创（顺序与 STREET_LOTS 的行业顺序一致） */
export const INDUSTRY_ORDER: readonly Industry[] = [
  'internet',
  'finance',
  'manufacturing',
  'culture',
]

export const ZONE_CENTERS: readonly (readonly [number, number])[] = [
  [-ZONE_C, -ZONE_C],
  [ZONE_C, -ZONE_C],
  [-ZONE_C, ZONE_C],
  [ZONE_C, ZONE_C],
]

export interface BuildingDatum {
  lot: Lot
  /** 0..63，与 InstancedMesh 实例下标一致 */
  index: number
  /** 0..3 象限（也是行业索引、色带索引） */
  zone: number
  /** 0..15 区内网格位 */
  slot: number
  x: number
  z: number
  /** 行业内总包归一化 0..1 */
  norm: number
  height: number
  width: number
  /** 晚下班 → 黑窗冷玻璃（D4 精修） */
  lateOff: boolean
  /** 五险足额 → 完整石台（D4 精修） */
  fullInsurance: boolean
}

/**
 * 64 栋参数楼快照。总包在**行业内**归一化（不跨行业比绝对值：互联网与文创的
 * 量级差是行业属性，不该被读成「文创都给得少」），再联动高与宽。
 */
export const BUILDINGS: readonly BuildingDatum[] = (() => {
  const ranges = {} as Record<Industry, [number, number]>
  INDUSTRY_ORDER.forEach((ind) => {
    ranges[ind] = [Infinity, -Infinity]
  })
  STREET_LOTS.forEach((lot) => {
    const t = totalPackage(lot.params)
    const r = ranges[lot.industry]
    if (t < r[0]) r[0] = t
    if (t > r[1]) r[1] = t
  })

  const out: BuildingDatum[] = []
  INDUSTRY_ORDER.forEach((ind, zone) => {
    const lots = STREET_LOTS.filter((l) => l.industry === ind)
    const [min, max] = ranges[ind]
    const [cx, cz] = ZONE_CENTERS[zone]
    lots.forEach((lot, slot) => {
      const t = totalPackage(lot.params)
      const norm = max > min ? (t - min) / (max - min) : 0.5
      const gx = slot % 4
      const gz = Math.floor(slot / 4)
      out.push({
        lot,
        index: zone * 16 + slot,
        zone,
        slot,
        x: cx + (gx - 1.5) * PITCH,
        z: cz + (gz - 1.5) * PITCH,
        norm,
        height: H_MIN + (H_MAX - H_MIN) * norm,
        width: W_MIN + (W_MAX - W_MIN) * norm,
        lateOff: lot.params.offworkTime > 19.5,
        fullInsurance: lot.params.socialInsuranceBaseRatio === 'full',
      })
    })
  })
  return out
})()

/**
 * 单栋楼的包围盒（含地基台、楼身、冠、顶珠）。T9 用这个逐栋验相机不相交，
 * 保证 D2 的 64 栋真实体块被覆盖，而不是沿用 D1 那 4 栋示意楼的旧结论。
 */
export function buildingVolume(d: BuildingDatum): {
  min: [number, number, number]
  max: [number, number, number]
} {
  // 冠半径 = 0.72 × width（见 BuildingField 的 cylinderGeometry），取 0.75 留余量
  const half = d.width * 0.75
  return {
    min: [d.x - half, PAD_Y, d.z - half],
    max: [d.x + half, BODY_BOTTOM + d.height + CROWN_H + PEARL_H, d.z + half],
  }
}

/** 四信道在 64 栋楼里的真实分布（D4 审查取证用，不参与渲染） */
export const CHANNEL_STATS = {
  crown: BUILDINGS.filter((d) => incrementPackage(d.lot.params) > 0).length,
  pearl: BUILDINGS.filter((d) => d.lot.params.equityValue > 0).length,
  warmWindows: BUILDINGS.filter((d) => !d.lateOff).length,
  coldWindows: BUILDINGS.filter((d) => d.lateOff).length,
  fullInsurance: BUILDINGS.filter((d) => d.fullInsurance).length,
  cutInsurance: BUILDINGS.filter((d) => !d.fullInsurance).length,
}

/** 供审查/自检读取的量程说明（不参与渲染） */
export const VOLUME_RANGE_REPORT = {
  height: [H_MIN, H_MAX] as [number, number],
  width: [W_MIN, W_MAX] as [number, number],
  heightRatio: Number((H_MAX / H_MIN).toFixed(2)),
  widthRatio: Number((W_MAX / W_MIN).toFixed(2)),
  count: BUILDINGS.length,
}
