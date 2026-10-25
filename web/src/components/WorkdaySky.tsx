// 工时天空系统：下班时间 → 夕阳/月亮实时切换
import { useMemo } from 'react'
import * as THREE from 'three'
import { Stars } from '@react-three/drei'
import { skyFromOffworkHour } from '../engine/sky'

export function WorkdaySky({
  offworkHour,
  fogNear = 18,
  fogFar = 60,
}: {
  offworkHour: number
  fogNear?: number
  fogFar?: number
}) {
  const sky = useMemo(() => skyFromOffworkHour(offworkHour), [offworkHour])
  // 三段渐变天幕（盲审：硬切水平线）——顶部压暗 → 地平线接入雾色
  const skyTex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 4
    c.height = 256
    const ctx = c.getContext('2d')!
    const hex = sky.bg.replace('#', '')
    const r = parseInt(hex.slice(0, 2), 16)
    const g = parseInt(hex.slice(2, 4), 16)
    const b = parseInt(hex.slice(4, 6), 16)
    const top = `rgb(${Math.round(r * 0.42)},${Math.round(g * 0.42)},${Math.round(b * 0.5)})`
    const grad = ctx.createLinearGradient(0, 0, 0, 256)
    grad.addColorStop(0, top)
    grad.addColorStop(0.6, sky.bg)
    grad.addColorStop(1, sky.bg)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 4, 256)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [sky.bg])
  return (
    <>
      <color attach="background" args={[sky.bg]} />
      <mesh>
        <sphereGeometry args={[170, 24, 16]} />
        <meshBasicMaterial map={skyTex} side={THREE.BackSide} fog={false} />
      </mesh>
      <fog attach="fog" args={[sky.fog, fogNear, fogFar]} />
      <ambientLight intensity={sky.ambient} />
      <directionalLight
        position={sky.night ? sky.moonPos : sky.sunPos}
        color={sky.sunColor}
        intensity={sky.sunIntensity}
      />
      {/* 太阳/月亮本体：位置即陈述——越晚月亮挂得越高 */}
      {!sky.night && (
        <mesh position={sky.sunPos}>
          <sphereGeometry args={[2.2, 16, 16]} />
          <meshBasicMaterial color={sky.sunColor} />
        </mesh>
      )}
      {sky.night && (
        <>
          <mesh position={sky.moonPos}>
            <sphereGeometry args={[1.8, 16, 16]} />
            <meshBasicMaterial color="#e8edf5" />
          </mesh>
          <Stars radius={80} depth={30} count={1200} factor={3} fade speed={0.4} />
        </>
      )}
    </>
  )
}
