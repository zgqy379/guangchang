// HR 摊位：占位形象（批量生成的 GLB 就绪后替换）+ 参数具象化悬浮 + 公司名牌
// 三件套：①HR 形象 ②参数悬浮（钱袋/切口牌/日月光）③身后办公空间门面
import { useMemo } from 'react'
import * as THREE from 'three'
import type { Lot } from '../../data/street-companies'
import { INDUSTRIES } from '../../data/street-companies'
import { totalPackage } from '../../engine/params'

// 公司名牌：CanvasTexture 精灵（无 DOM，64 个摊位也便宜）
function useNameTexture(name: string, industry: string) {
  return useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 64
    const ctx = c.getContext('2d')!
    ctx.fillStyle = 'rgba(13,17,23,0.88)'
    ctx.beginPath()
    ctx.roundRect(2, 2, 252, 60, 8)
    ctx.fill()
    ctx.strokeStyle = INDUSTRIES[industry as keyof typeof INDUSTRIES]?.color ?? '#30363d'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.fillStyle = '#e6edf3'
    ctx.font = '600 26px "Microsoft YaHei", sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(name.slice(0, 8), 128, 34)
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }, [name, industry])
}

export function HRStand({ lot, onEnterOffice }: { lot: Lot; onEnterOffice: (lot: Lot) => void }) {
  const nameTex = useNameTexture(lot.name, lot.industry)
  const color = INDUSTRIES[lot.industry].color
  const total = totalPackage(lot.params)
  // 钱袋堆层数：每 10 万一层，2–7 层封顶（行业间的总包差一眼可见）
  const layers = Math.max(2, Math.min(7, Math.round(total / 100000)))
  const night = lot.params.offworkTime >= 20

  return (
    <group>
      {/* 摊位台 */}
      <mesh position={[0, 0.07, 0]} receiveShadow>
        <boxGeometry args={[2.2, 0.14, 2.2]} />
        <meshStandardMaterial color="#2a3138" roughness={0.9} />
      </mesh>
      {/* HR 占位形象（GLB 就绪后由 HRActor 替换）：身体/头/工牌，面向道路 */}
      <group position={[0, 0.14, 0]}>
        <mesh position={[0, 0.62, 0]}>
          <capsuleGeometry args={[0.22, 0.62, 4, 10]} />
          <meshStandardMaterial color={color} roughness={0.75} />
        </mesh>
        <mesh position={[0, 1.28, 0]}>
          <sphereGeometry args={[0.19, 16, 14]} />
          <meshStandardMaterial color="#e8b98a" roughness={0.6} />
        </mesh>
        {/* 工牌挂绳 */}
        <mesh position={[0, 0.78, 0.2]}>
          <boxGeometry args={[0.12, 0.16, 0.02]} />
          <meshStandardMaterial color="#e6edf3" />
        </mesh>
        {/* mini 日月：下班时间 → 太阳/月亮悬在头顶 */}
        <mesh position={[0, 1.75, 0]}>
          <sphereGeometry args={[0.1, 12, 10]} />
          <meshBasicMaterial color={night ? '#e8edf5' : '#ffd4b0'} />
        </mesh>
      </group>
      {/* 名牌（面向道路外侧，玩家从路上看到） */}
      <sprite position={[0, 2.35, 0]} scale={[1.3, 0.33, 1]}>
        <spriteMaterial map={nameTex} transparent />
      </sprite>
      {/* 参数具象化：总包钱袋堆（尺寸随总包）+ 五险切口牌 */}
      <group position={[0.62, 0.14, 0.55]}>
        {Array.from({ length: layers }).map((_, i) => (
          <mesh key={i} position={[0, 0.04 + i * 0.075, 0]}>
            <boxGeometry args={[0.34, 0.07, 0.22]} />
            <meshStandardMaterial
              color={i === layers - 1 && lot.params.salaryStructure > 12 ? '#d98e32' : '#c23a2b'}
              emissive={i === layers - 1 && lot.params.salaryStructure > 12 ? '#d98e32' : '#c23a2b'}
              emissiveIntensity={0.25}
            />
          </mesh>
        ))}
      </group>
      {/* 五险切口牌：低基数 → 缺口更大（灰色被切走的部分） */}
      <group position={[-0.62, 0.14, 0.55]} rotation={[0, 0, 0]}>
        <mesh position={[0, 0.16, 0]}>
          <boxGeometry args={[0.3, 0.32, 0.06]} />
          <meshStandardMaterial color="#3d4650" />
        </mesh>
        <mesh
          position={[0, 0.16 + (lot.params.socialInsuranceBaseRatio === 'full' ? 0.12 : 0.05), 0.031]}
        >
          <boxGeometry
            args={[0.24, lot.params.socialInsuranceBaseRatio === 'full' ? 0.08 : 0.22, 0.01]}
          />
          <meshStandardMaterial color="#8b949e" />
        </mesh>
      </group>
      {/* 办公空间门面：背后建筑 + 发光窗 + 门（点击进入） */}
      <group position={[0, 0, -3.6]}>
        <mesh position={[0, 2.5, 0]}>
          <boxGeometry args={[6.4, 5, 5.2]} />
          <meshStandardMaterial color="#1d232a" roughness={0.95} />
        </mesh>
        {/* 窗（发光条，随机几扇亮） */}
        {[-2.2, -0.9, 0.9, 2.2].map((wx, i) =>
          [1.4, 2.9].map((wy, j) => (
            <mesh key={`${i}-${j}`} position={[wx, wy, 2.62]}>
              <planeGeometry args={[0.9, 0.8]} />
              <meshStandardMaterial
                color={(i + j) % 3 === 0 ? '#ffd28a' : '#22303c'}
                emissive={(i + j) % 3 === 0 ? '#ffb45e' : '#0a121a'}
                emissiveIntensity={(i + j) % 3 === 0 ? 0.9 : 0.15}
              />
            </mesh>
          ))
        )}
        {/* 门（点击进入参观） */}
        <mesh position={[0, 1.05, 2.62]}>
          <planeGeometry args={[1.1, 2.1]} />
          <meshStandardMaterial color="#0e2740" emissive="#1f5a96" emissiveIntensity={0.5} />
        </mesh>
        <mesh
          position={[0, 2.35, 2.64]}
          onClick={(e) => {
            e.stopPropagation()
            onEnterOffice(lot)
          }}
          onPointerOver={() => (document.body.style.cursor = 'pointer')}
          onPointerOut={() => (document.body.style.cursor = 'default')}
        >
          <planeGeometry args={[1.6, 0.42]} />
          <meshBasicMaterial color="#58a6ff" transparent opacity={0.92} />
        </mesh>
      </group>
    </group>
  )
}
