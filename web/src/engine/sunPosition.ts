// 真实天文太阳/月亮位置（v4 玻璃数字孪生 · 2026-10-26）
//
// 做法参照全网案例：太阳位置由「纬度 + 真实钟点」经 NOAA/SunCalc 简化公式算出，
// 而非随手设置一个固定角度——这样场景才读作"某个具体时刻的某个具体地方"。
//
// 公式（简化版 NOAA Solar Position）：
//   1. 计算日序角 γ = 2π/365 · (dayOfYear - 1 + (hour-12)/24)
//   2. 赤纬 δ = 0.006918 - 0.399912cosγ + 0.070257sinγ - 0.006758cos2γ + ...
//   3. 时角 H = 15° · (solarTime - 12)
//   4. 高度角：sin(alt) = sinφ·sinδ + cosφ·cosδ·cosH
//   5. 方位角：cos(az) = (sinδ - sinφ·sin(alt)) / (cosφ·cos(alt))
//   6. 再按经度/时区修正（简化：直接用本地钟点 + 经度偏移）

import * as THREE from 'three'

/** 上海附近纬度（可按用户所在地调整） */
export const DEFAULT_LATITUDE = 31.23
/** 东八区中央经线 */
export const DEFAULT_LONGITUDE = 120.0

export interface SunPosition {
  /** 太阳/月亮的三维位置（世界坐标，Y 向上） */
  position: [number, number, number]
  /** 高度角（弧度）：负值表示在地平线以下 */
  altitude: number
  /** 方位角（弧度）：0 = 正北，顺时针 */
  azimuth: number
}

const DEG = Math.PI / 180

/**
 * 计算指定时刻的太阳位置。
 * @param date 目标时刻（默认当前）
 * @param latitude 纬度（度）
 * @param longitude 经度（度）
 * @param sceneRotation 场景朝向修正（弧度）：让太阳从场景的一侧升起
 */
export function sunPosition(
  date: Date = new Date(),
  latitude: number = DEFAULT_LATITUDE,
  longitude: number = DEFAULT_LONGITUDE,
  sceneRotation = 0
): SunPosition {
  const start = new Date(date.getFullYear(), 0, 0)
  const dayOfYear = Math.floor((date.getTime() - start.getTime()) / 86400000)

  const hour = date.getHours() + date.getMinutes() / 60
  // 简化太阳时：本地钟点 + 经度与标准经线的时差（每 15° 为 1 小时）
  const standardMeridian = Math.round(longitude / 15) * 15
  const timeOffset = (longitude - standardMeridian) * 4 // 分钟
  const solarTime = hour + timeOffset / 60

  // 步骤 1：日序角
  const gamma = ((2 * Math.PI) / 365) * (dayOfYear - 1 + (solarTime - 12) / 24)

  // 步骤 2：赤纬与均时差
  const eqTime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma))
  const decl =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma)

  // 步骤 3：真太阳时与时角
  // 注意：solarTime 已含经度时差修正，此处不可再叠加 4×longitude（否则重复修正）
  const trueSolarTime = (solarTime * 60 + eqTime) % 1440
  const hourAngle = trueSolarTime / 4 - 180

  const latRad = latitude * DEG
  const haRad = hourAngle * DEG

  // 步骤 4：高度角
  const cosZenith =
    Math.sin(latRad) * Math.sin(decl) + Math.cos(latRad) * Math.cos(decl) * Math.cos(haRad)
  const zenith = Math.acos(Math.max(-1, Math.min(1, cosZenith)))
  const altitude = Math.PI / 2 - zenith

  // 步骤 5：方位角
  let azimuth: number
  const sinZenith = Math.sin(zenith)
  if (Math.abs(sinZenith) < 1e-6) {
    azimuth = 0
  } else {
    let cosAz =
      (Math.sin(decl) - Math.sin(latRad) * cosZenith) /
      (Math.cos(latRad) * sinZenith)
    cosAz = Math.max(-1, Math.min(1, cosAz))
    azimuth = Math.acos(cosAz)
    // 上午在东（azimuth < π），下午在西（> π）
    if (hourAngle > 0) azimuth = 2 * Math.PI - azimuth
  }

  // 步骤 6：转为世界坐标（Y 向上，Z 向北，X 向东）
  const alt = altitude
  const az = azimuth
  const cosAlt = Math.cos(alt)
  const x = cosAlt * Math.sin(az)
  const z = cosAlt * Math.cos(az)
  const y = Math.sin(alt)

  // 场景朝向修正 + 距离缩放
  const dist = 90
  const rx = x * Math.cos(sceneRotation) - z * Math.sin(sceneRotation)
  const rz = x * Math.sin(sceneRotation) + z * Math.cos(sceneRotation)

  return {
    position: [rx * dist, y * dist, rz * dist],
    altitude,
    azimuth: az,
  }
}

/**
 * 月亮位置：简化模型——太阳落山后从东方升起，午夜最高。
 * 不追求天文精确，但方位与高度关系合理（越夜深挂得越高）。
 */
export function moonPosition(
  date: Date = new Date(),
  sceneRotation = 0
): SunPosition {
  const hour = date.getHours() + date.getMinutes() / 60
  // 夜间相位：19:00 升起 → 次日 00:00 最高 → 05:00 落下，映射到 t∈[0,1]
  // 仅此 10 小时窗口为夜间；其余时刻月亮在地平线下（altitude=0），不参与渲染。
  // （旧式 (hour-19+24)%24/10 会把 18:00 及整个白天错判为最高相位）
  const phase = ((hour - 19 + 24) % 24) / 10
  const isNight = phase <= 1
  const t = isNight ? phase : 0
  // 弧线映射：t=0(19:00 升起)→0、t=0.5(次日 00:00 最高)→π/2、t=1(05:00 落下)→0，
  // 峰值落在午夜且始终 ∈[0, π/2]（旧式 0.92π 线性会越过天顶倒挂）
  const altitude = Math.sin(t * Math.PI) * (Math.PI / 2)
  // 从东偏北升到西偏北
  const azimuth = (100 + t * 160) * DEG

  const cosAlt = Math.cos(altitude)
  const x = cosAlt * Math.sin(azimuth)
  const z = cosAlt * Math.cos(azimuth)
  const y = Math.sin(altitude)
  const dist = 80

  const rx = x * Math.cos(sceneRotation) - z * Math.sin(sceneRotation)
  const rz = x * Math.sin(sceneRotation) + z * Math.cos(sceneRotation)

  return { position: [rx * dist, y * dist, rz * dist], altitude, azimuth }
}

/** 太阳是否在地平线以下（用于关闭太阳本体与阴影） */
export function isBelowHorizon(sun: SunPosition): boolean {
  return sun.altitude < 0
}

/** 把太阳位置转成 THREE.Vector3（便于相机跟随/阴影相机定位） */
export function toVector3(pos: [number, number, number]): THREE.Vector3 {
  return new THREE.Vector3(pos[0], pos[1], pos[2])
}
