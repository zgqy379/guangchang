// 玻璃数字孪生 · 环境光照（IBL）与渲染器参数（2026-10-27 美术攻关）
//
// 为什么必须有这个组件：
//   盲审第一项差距 = "光层次缺失 / 路面偏平"。根因不是灯光数量不足，而是
//   **没有任何环境光照（IBL）**：半透明玻璃体块只能靠一盏平行光的漫反射塑形，
//   于是读成"一块白板"；地面 roughness 高、无环境反射，于是读成"一块灰板"。
//
// 做法（不引入任何外部 HDR 资产 —— 铁律：禁止运行时第三方 CDN 依赖）：
//   用场景自己的**程序化天幕贴图**经 PMREMGenerator 烘成环境贴图，
//   挂到 scene.environment。全场景 MeshStandardMaterial 立刻获得天光/地色反射：
//     · 玻璃体块 → 有了环境高光与轮廓亮度（配合 rim light 读出边缘）
//     · 路面     → 低粗糙度下出现磨砂玻璃般的反射（孪生风经典语汇）
//   成本：主题切换时烘一次（几十毫秒），**不增加任何 draw call**。
//
// 另外统一管理曝光：浅色场景比夜景需要更低曝光，否则玻璃白块糊成一片。

import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useThree } from '@react-three/fiber'
import { skyFromEnv, skyGradientTexture } from '../WorkdaySky'
import { sceneNow } from '../../engine/time'
import type { ThemeName } from '../../engine/theme'
import {
  ThemeDarkHemiGround,
  ThemeLightHemiGround,
  TwinEnvIntensityDay,
  TwinEnvIntensityNight,
  TwinExposureDay,
  TwinExposureNight,
} from '../../../generated/design-tokens.output.mjs'

export function TwinEnvironment({
  envHour,
  theme,
  now,
}: {
  envHour: number
  theme: ThemeName
  now?: Date
}) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  // ?hour= 冻结（截图确定性）优先，否则真实时钟——统一走 engine/time.ts
  const date = useMemo(() => now ?? sceneNow(), [now])
  const sky = useMemo(() => skyFromEnv(envHour, theme, date), [envHour, theme, date])
  const night = theme === 'dark'

  // 曝光：浅色场景压低曝光换对比（否则白玻璃 + 白地面全糊在一档）
  useEffect(() => {
    gl.toneMappingExposure = night ? TwinExposureNight : TwinExposureDay
  }, [gl, night])

  // IBL：程序化天幕 → PMREM → scene.environment
  useEffect(() => {
    const envScene = new THREE.Scene()

    const skyTex = skyGradientTexture(sky.topColor, sky.bg, sky.horizonColor)
    const domeMat = new THREE.MeshBasicMaterial({
      map: skyTex,
      side: THREE.BackSide,
      fog: false,
    })
    const dome = new THREE.Mesh(new THREE.SphereGeometry(60, 24, 16), domeMat)
    envScene.add(dome)

    // 地面半球：给下半球一个反射底色，否则玻璃体底面全黑、没有"落地感"
    const groundMat = new THREE.MeshBasicMaterial({
      color: night ? ThemeDarkHemiGround : ThemeLightHemiGround,
      side: THREE.DoubleSide,
    })
    const ground = new THREE.Mesh(new THREE.CircleGeometry(70, 24), groundMat)
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -2
    envScene.add(ground)

    // 太阳/月亮亮斑：给高光一个明确方向（玻璃面上那一点"星芒"）
    const lightPos = night ? sky.moonPos : sky.sunPos
    const glowMat = new THREE.MeshBasicMaterial({ color: night ? '#dce6f5' : '#fff6e0' })
    const glow = new THREE.Mesh(new THREE.SphereGeometry(6, 12, 10), glowMat)
    glow.position.set(lightPos[0] * 0.55, lightPos[1] * 0.55, lightPos[2] * 0.55)
    envScene.add(glow)

    const pmrem = new THREE.PMREMGenerator(gl)
    const rt = pmrem.fromScene(envScene, 0.04, 0.1, 220)
    scene.environment = rt.texture
    scene.environmentIntensity = night ? TwinEnvIntensityNight : TwinEnvIntensityDay

    return () => {
      if (scene.environment === rt.texture) scene.environment = null
      rt.dispose()
      pmrem.dispose()
      dome.geometry.dispose()
      domeMat.dispose()
      skyTex.dispose()
      ground.geometry.dispose()
      groundMat.dispose()
      glow.geometry.dispose()
      glowMat.dispose()
    }
  }, [gl, scene, sky, night])

  return null
}
