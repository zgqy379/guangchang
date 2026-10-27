// 工时天空系统 v4（玻璃数字孪生 · 2026-10-26）
//
// v1.2 原版：由「公司下班时间参数」驱动天色（17:00 午后 → 18:00 夕阳 → 19:30 暮色 → 20:00 后月亮）。
// v4 变更：**语义分离**
//   - 环境时间（系统时钟）→ 决定天色与主题（"现在几点"）
//   - 参数时间（offworkTime）→ 仍驱动该公司的下班光效与文案（"这家几点下班"）
//   拖动下班时间滑杆不再改变天色——两者互不干扰。
//
// 主题：白天浅色（玻璃孪生，冷白天幕）/ 夜间深色（深靛 + 星空）。

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Stars } from '@react-three/drei'
import { sunPosition, moonPosition, isBelowHorizon } from '../engine/sunPosition'
import type { ThemeName } from '../engine/theme'
import {
  ThemeLightSkyTop,
  ThemeLightSkyMid,
  ThemeLightSkyHorizon,
  ThemeLightSun,
  ThemeLightSkyWarmMid,
  ThemeLightSkyWarmHor,
  ThemeLightSkyWarmBand,
  ThemeLightSunDusk,
  ThemeLightHemiSky,
  ThemeLightHemiGround,
  ThemeLightHemiSkyDusk,
  ThemeLightHemiGroundDusk,
  ThemeLightFog,
  ThemeDarkSkyTop,
  ThemeDarkSkyMid,
  ThemeDarkSkyHorizon,
  ThemeDarkMoon,
  ThemeDarkHemiSky,
  ThemeDarkHemiGround,
  ThemeDarkFog,
  TwinShadowMapSize,
  TwinShadowExtent,
  TwinShadowNormalBias,
  TwinShadowBias,
  TwinSunGlowDay,
  TwinSunGlowNight,
  TwinSunIntensityDay,
  TwinSunIntensityDusk,
  TwinHemiIntensityDay,
  TwinHemiIntensityNight,
  TwinFillIntensityDay,
  TwinFillIntensityNight,
} from '../../generated/design-tokens.output.mjs'

export interface SkyState {
  bg: string
  fog: string
  sunPos: [number, number, number]
  sunColor: string
  sunIntensity: number
  ambient: number
  night: boolean
  moonPos: [number, number, number]
  label: string
  /** 半球光天空色（白天冷天光 / 夜空深蓝） */
  hemiSky: string
  /** 半球光地面色 */
  hemiGround: string
  /** 天幕顶部色（渐变用） */
  topColor: string
  /** 天幕地平线色（渐变用） */
  horizonColor: string
  /** 地平线暖金余晖带（白天显影；夜间=地平线色） */
  bandColor: string
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const lerpColor = (c1: number[], c2: number[], t: number) =>
  '#' +
  c1
    .map((c, i) => Math.round(lerp(c, c2[i], t)).toString(16).padStart(2, '0'))
    .join('')

/** '#rrggbb' → [r,g,b]：让黄昏插值基底也来自设计令牌（白天「洗白」修复，见 skyFromEnv） */
const hexToRgb = (hex: string): number[] => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
]

/**
 * 按系统时间 + 主题生成天空状态。
 * @param envHour 系统小时（0-24）
 * @param theme 当前主题（light / dark）
 * @param now 目标时刻（用于真实太阳位置）
 */
export function skyFromEnv(
  envHour: number,
  theme: ThemeName,
  now: Date = new Date()
): SkyState {
  const night = theme === 'dark'

  if (night) {
    // —— 夜间：深靛天幕 + 星空 + 月亮 ——
    const moon = moonPosition(now)
    return {
      bg: ThemeDarkSkyMid,
      fog: ThemeDarkFog,
      sunPos: moon.position,
      sunColor: ThemeDarkMoon,
      sunIntensity: 0.95,
      ambient: 0.32,
      night: true,
      moonPos: moon.position,
      label: '夜间 · 深色孪生',
      hemiSky: ThemeDarkHemiSky,
      hemiGround: ThemeDarkHemiGround,
      // 夜间天幕：顶部更深、地平线略亮（城市辉光）
      topColor: ThemeDarkSkyTop,
      horizonColor: ThemeDarkSkyHorizon,
      bandColor: ThemeDarkSkyHorizon,
    }
  }

  // —— 白天（含黄昏）：冷白渐变 + 真实太阳位置 ——
  const sun = sunPosition(now)
  const below = isBelowHorizon(sun)

  // 暖金时段：15:25 起随真实太阳降低渐暖，18:30 全暖（低仰角长影 + 暖色温）。
  // 依据 art-style-options-v3 ①（长阴影 = 电影感来源）与 twin-style-spec-v4 §4；
  // 插值基底一律取自设计令牌——旧版硬编码调色板与令牌脱钩，是白天「洗白」根因之一。
  const duskT = Math.max(0, Math.min(1, (envHour - 15.25) / 3.25))
  const warm = duskT > 0

  const topRgb = hexToRgb(ThemeLightSkyTop)
  const midRgb = hexToRgb(ThemeLightSkyMid)
  const horRgb = hexToRgb(ThemeLightSkyHorizon)
  const warmMidRgb = hexToRgb(ThemeLightSkyWarmMid)
  const warmHorRgb = hexToRgb(ThemeLightSkyWarmHor)
  const warmBandRgb = hexToRgb(ThemeLightSkyWarmBand)

  const bg = warm
    ? lerpColor(midRgb, warmMidRgb, duskT)
    : ThemeLightSkyMid
  const bgTop = warm ? lerpColor(topRgb, warmMidRgb, duskT * 0.55) : ThemeLightSkyTop
  const bgHor = warm ? lerpColor(horRgb, warmHorRgb, duskT) : ThemeLightSkyHorizon
  // 地平线暖金余晖带：白天也保持一条淡暖带（≥0.35 起步），随暖度加深——
  // 给浅色天幕与白色楼体之间一层「空气厚度」（twin §3.1「明确暖带」）
  const bgBand = lerpColor(horRgb, warmBandRgb, Math.max(0.35, duskT))

  // —— 合成主光位 ——
  // 真实太阳落到地平线下时（黄昏后段，或用户把主题手动锁成"白天"），
  // 沿用真实太阳会让浅色主题**只剩环境光**：没有方向性光、没有阴影，
  // 路面读成一块平板 —— 这正是盲审第一项差距"路面偏平"的根因。
  // 这里给一个合成的 3/4 主光位：黄昏取西边落日、强制白天取西南角，
  // 方位要能让阴影**横切过广场**（落在建筑背后等于没画）。
  let sunPos = sun.position
  let sunIntensity = below
    ? 0.15
    : lerp(TwinSunIntensityDay, TwinSunIntensityDusk, Math.max(0, Math.min(1, duskT)))
  if (below) {
    const alt = warm ? lerp(0.42, 0.09, duskT) : 0.45
    const synthAz = warm ? 4.57 : 3.93
    const cosAlt = Math.cos(alt)
    const dist = 90
    sunPos = [
      cosAlt * Math.sin(synthAz) * dist,
      Math.sin(alt) * dist,
      cosAlt * Math.cos(synthAz) * dist,
    ]
    sunIntensity = warm ? lerp(1.15, 0.8, duskT) : 1.35
  }

  return {
    bg,
    fog: warm ? lerpColor(midRgb, warmHorRgb, duskT) : ThemeLightFog,
    sunPos,
    sunColor: warm
      ? lerpColor(hexToRgb(ThemeLightSun), hexToRgb(ThemeLightSunDusk), duskT)
      : ThemeLightSun,
    sunIntensity,
    ambient: below ? 0.5 : 0.85,
    night: false,
    moonPos: moonPosition(now).position,
    label: warm ? (envHour >= 17.5 ? '黄昏 · 暖金孪生' : '午后 · 暖金孪生') : '白天 · 浅色孪生',
    hemiSky: warm
      ? lerpColor(hexToRgb(ThemeLightHemiSky), hexToRgb(ThemeLightHemiSkyDusk), duskT)
      : ThemeLightHemiSky,
    hemiGround: warm
      ? lerpColor(hexToRgb(ThemeLightHemiGround), hexToRgb(ThemeLightHemiGroundDusk), duskT)
      : ThemeLightHemiGround,
    topColor: bgTop,
    horizonColor: bgHor,
    bandColor: bgBand,
  }
}

/** 天幕渐变贴图：三段（顶部压暗 → 中段本色 → 地平线提亮） */
export function skyGradientTexture(
  top: string,
  mid: string,
  horizon: string,
  warmBand?: string
): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 4
  c.height = 256
  const ctx = c.getContext('2d')!
  const grad = ctx.createLinearGradient(0, 0, 0, 256)
  grad.addColorStop(0, top)
  grad.addColorStop(0.4, mid)
  // 地平线上方的暖金余晖带（twin §3.1）：给浅色天幕一层「空气厚度」，
  // 让白色楼体与天幕分离；夜间不传则退化为地平线色
  grad.addColorStop(0.5, warmBand ?? horizon)
  grad.addColorStop(0.58, horizon)
  grad.addColorStop(1, mid)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 4, 256)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/**
 * 太阳/月亮辉光贴图（加性混合，给天空一个光源核心）。
 * 模块级单例缓存、跨实例复用：**不可 dispose**（否则其它实例/重挂载会拿到已释放纹理），
 * 生命周期与页面一致，仅随页面卸载回收。
 */
let SUN_GLOW_TEX: THREE.CanvasTexture | null = null
function sunGlowTexture() {
  if (SUN_GLOW_TEX) return SUN_GLOW_TEX
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.16, 'rgba(255,248,226,0.85)')
  g.addColorStop(0.42, 'rgba(255,236,190,0.24)')
  g.addColorStop(1, 'rgba(255,230,180,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  SUN_GLOW_TEX = new THREE.CanvasTexture(c)
  SUN_GLOW_TEX.colorSpace = THREE.SRGBColorSpace
  return SUN_GLOW_TEX
}

/**
 * 主平行光：阴影相机参数必须**命令式**设置。
 * R3F 的 `shadow-camera-left` 等属性走 applyProps 只改数值，
 * 而 OrthographicCamera 不会自动 updateProjectionMatrix → 参数实际不生效。
 * （本轮之前场景 2048 阴影图 + 60m 见方的默认相机，等于没有有效方向性阴影。）
 */
function SunLight({
  sunPos,
  sunColor,
  sunIntensity,
}: {
  sunPos: [number, number, number]
  sunColor: string
  sunIntensity: number
}) {
  const ref = useRef<THREE.DirectionalLight>(null)
  useLayoutEffect(() => {
    const l = ref.current
    if (!l) return
    const cam = l.shadow.camera as THREE.OrthographicCamera
    cam.left = -TwinShadowExtent
    cam.right = TwinShadowExtent
    cam.top = TwinShadowExtent
    cam.bottom = -TwinShadowExtent
    cam.near = 1
    cam.far = 260
    cam.updateProjectionMatrix()
    if (l.shadow.mapSize.x !== TwinShadowMapSize) {
      l.shadow.mapSize.set(TwinShadowMapSize, TwinShadowMapSize)
      l.shadow.map?.dispose()
      l.shadow.map = null
    }
    l.shadow.bias = TwinShadowBias
    l.shadow.normalBias = TwinShadowNormalBias
    // 太阳/月亮是静态的 → 阴影贴图**不必每帧重算**。
    // 场景里没有任何会动的投影体（玩家/NPC/HR 都不 castShadow，接地靠贴图），
    // 关掉 autoUpdate、只在光源位置变化时刷新一次即可：
    // 实测省掉整个 shadow pass（约 200 个 draw call + 一张 2048² 深度图）。
    l.shadow.autoUpdate = false
    l.shadow.needsUpdate = true
    // 懒加载建筑/HR 就位后阴影图需要二次烘焙：首帧烘焙时 lazy chunk 未挂载，
    // 阴影图里没有建筑物 → 昼间全场景无投影、平板化（盲审 R5 短板①）。
    // 场景静止（光源不动），二次烘焙后再关回 autoUpdate。
    const rebake = window.setTimeout(() => {
      l.shadow.needsUpdate = true
      window.setTimeout(() => { l.shadow.needsUpdate = true; l.shadow.autoUpdate = false }, 2500)
    }, 2500)
    return () => window.clearTimeout(rebake)
  }, [sunPos])
  return (
    <directionalLight
      ref={ref}
      position={sunPos}
      color={sunColor}
      intensity={sunIntensity}
      // 夜间也开阴影：月光方向性阴影是夜景唯一的"体积"来源
      // （此前夜间完全无阴影 → 盲审说的"夜景缺少光层次"）
      castShadow
    />
  )
}

export function WorkdaySky({
  envHour,
  theme,
  fogNear = 18,
  fogFar = 60,
  now,
}: {
  envHour: number
  theme: ThemeName
  fogNear?: number
  fogFar?: number
  now?: Date
}) {
  const date = useMemo(() => now ?? new Date(), [now])
  const sky = useMemo(
    () => skyFromEnv(envHour, theme, date),
    [envHour, theme, date]
  )
  const topColor = sky.topColor
  const horizonColor = sky.horizonColor

  const skyTex = useMemo(
    () => skyGradientTexture(topColor, sky.bg, horizonColor, sky.bandColor),
    [topColor, sky.bg, horizonColor, sky.bandColor]
  )

  // 天幕渐变 CanvasTexture：依赖变化（主题/天色切换）时释放旧纹理，卸载时释放当前纹理，
  // 否则每次主题切换都会泄漏一张 GPU 纹理。needsUpdate 是副作用——用 useEffect 而非 useMemo。
  useEffect(() => {
    skyTex.needsUpdate = true
    return () => skyTex.dispose()
  }, [skyTex])

  const sunUp = sky.night ? true : sky.sunPos[1] > -2

  return (
    <>
      <color attach="background" args={[sky.bg]} />
      <mesh>
        <sphereGeometry args={[170, 24, 16]} />
        <meshBasicMaterial map={skyTex} side={THREE.BackSide} fog={false} />
      </mesh>
      <fog attach="fog" args={[sky.fog, fogNear, fogFar]} />
      {/* 半球光：白天冷天光，夜间深蓝 */}
      <hemisphereLight
        args={[sky.hemiSky, sky.hemiGround, sky.night ? TwinHemiIntensityNight : TwinHemiIntensityDay]}
      />
      {/* 主光（太阳/月亮）——位置来自真实天文计算，阴影相机参数见 SunLight */}
      <SunLight
        sunPos={sky.sunPos}
        sunColor={sky.sunColor}
        sunIntensity={sky.sunIntensity}
      />
      {/* 冷色补光：压暗背光面，制造体积感（"光即材料"） */}
      <directionalLight
        position={[-sky.sunPos[0] * 0.7, 30, -sky.sunPos[2] * 0.7]}
        color={sky.night ? '#5a76b8' : '#9fc0e0'}
        intensity={sky.night ? TwinFillIntensityNight : TwinFillIntensityDay}
      />
      {/* 太阳本体：位置即陈述——正午高悬，傍晚西斜 */}
      {!sky.night && sunUp && (
        <group position={sky.sunPos}>
          <mesh>
            <sphereGeometry args={[2.6, 16, 16]} />
            <meshBasicMaterial color={sky.sunColor} fog={false} />
          </mesh>
          {/* 光源辉光：给天空一个"核心"，远处的建筑轮廓不至于糊在天幕上 */}
          <sprite scale={[46, 46, 1]}>
            <spriteMaterial
              map={sunGlowTexture()}
              color={sky.sunColor}
              transparent
              opacity={TwinSunGlowDay}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              fog={false}
            />
          </sprite>
        </group>
      )}
      {sky.night && (
        <>
          <group position={sky.moonPos}>
            <mesh>
              <sphereGeometry args={[1.8, 16, 16]} />
              <meshBasicMaterial color={ThemeDarkMoon} fog={false} />
            </mesh>
            <sprite scale={[30, 30, 1]}>
              <spriteMaterial
                map={sunGlowTexture()}
                color={ThemeDarkMoon}
                transparent
                opacity={TwinSunGlowNight}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
                fog={false}
              />
            </sprite>
          </group>
          <Stars radius={80} depth={30} count={1200} factor={3} fade speed={0.4} />
        </>
      )}
    </>
  )
}
