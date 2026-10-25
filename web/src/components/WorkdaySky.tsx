// 工时天空系统：下班时间 → 夕阳/月亮实时切换
import { useMemo } from 'react'
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
  return (
    <>
      <color attach="background" args={[sky.bg]} />
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
