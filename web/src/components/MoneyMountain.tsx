// 薪酬钞票山：Instanced Mesh + 逐层隆起生长动画（M3 关键帧 A/D）
// 2026-10-25 重构：固定 3×3 层叠布局（金额差 = 高度差，真"山"）；
// 旧版 sqrt 布局任何金额都只堆一层（15万不可见 / 100万是地毯）
import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import {
  BILL,
  MOUNTAIN_HEIGHT_SCALE,
  MOUNTAIN_SCALE,
  layerLayout,
  yuanToStacks,
} from '../engine/params'
import {
  ColorSceneBillOrange,
  ColorSceneBillOrangeDark,
  ColorSceneBillRed,
  ColorSceneBillRedDark,
} from '../../generated/design-tokens.output.mjs'

const easeOutCubic = (k: number) => 1 - Math.pow(1 - k, 3)

// 纸币贴图：canvas 生成纹样+¥面额+角部团花（盲审修复：红色光板无纸币语言）
function billTexture(base: string, dark: string) {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 128
  const ctx = c.getContext('2d')!
  ctx.fillStyle = base
  ctx.fillRect(0, 0, 256, 128)
  ctx.strokeStyle = dark
  ctx.lineWidth = 5
  ctx.strokeRect(9, 9, 238, 110)
  ctx.lineWidth = 2
  ctx.strokeRect(18, 18, 220, 92)
  ctx.font = '700 58px "Microsoft YaHei", sans-serif'
  ctx.fillStyle = dark
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('¥', 128, 64)
  ctx.beginPath()
  ctx.arc(34, 34, 13, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(222, 94, 13, 0, Math.PI * 2)
  ctx.stroke()
  ctx.font = '600 16px sans-serif'
  ctx.fillText('逛厂币', 128, 108)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function InstancedBundles({
  positions,
  texture,
}: {
  positions: ReturnType<typeof layerLayout>
  texture: THREE.Texture
}) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const temp = useMemo(() => new THREE.Object3D(), [])
  const startRef = useRef<number | null>(null)
  // 逐实例朝向抖动（±1.5°，纸币堆叠的自然错落）
  const jitter = useMemo(
    () => positions.map((_, i) => (((i * 137) % 100) / 100 - 0.5) * 0.052),
    [positions]
  )

  // 生长动画：每层延迟 0.12s，从底部向上一层层隆起
  useFrame((state) => {
    const mesh = ref.current
    if (!mesh) return
    if (startRef.current === null) startRef.current = state.clock.elapsedTime
    const t = state.clock.elapsedTime - startRef.current
    positions.forEach((p, i) => {
      const k = Math.min(1, Math.max(0, (t - p.layer * 0.12) / 0.6))
      const e = easeOutCubic(k)
      // 从各自层的底部生长：中心随 ease 上移、高度随 ease 增加
      temp.position.set(
        p.pos[0],
        p.layer * BILL.stackH + BILL.stackH * e * 0.5,
        p.pos[2]
      )
      temp.rotation.y = jitter[i]
      temp.scale.set(1, Math.max(e, 0.001), 1)
      temp.updateMatrix()
      mesh.setMatrixAt(i, temp.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  })

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    // 布局已逐层居中；水平 2.5× 感知放大 + 高度感知增强（见场景内声明）
    mesh.position.set(-0.5, 0, -1.5)
    mesh.scale.set(MOUNTAIN_SCALE, MOUNTAIN_HEIGHT_SCALE, MOUNTAIN_SCALE)
  }, [positions])

  // 12 薪等场景无增量层：不渲染实例（count=1 的 identity 实例会在山脚留幽灵块）
  if (positions.length === 0) return null

  return (
    <instancedMesh
      key={positions.length}
      ref={ref}
      args={[undefined, undefined, Math.max(1, positions.length)]}
    >
      <boxGeometry args={[BILL.w, BILL.stackH, BILL.d]} />
      <meshStandardMaterial
        map={texture}
        color="#ffffff"
        roughness={0.62}
        metalness={0.06}
        emissive="#ffffff"
        emissiveMap={texture}
        emissiveIntensity={0.16}
      />
    </instancedMesh>
  )
}

export function MoneyMountain({
  baseYuan,
  incrementYuan,
}: {
  baseYuan: number
  incrementYuan: number
}) {
  // 防博弈：base 层与增量层（14/16 薪）必须分色分垒，不允许渲染成混合山
  const { base, increment } = useMemo(() => {
    const baseStacks = yuanToStacks(baseYuan)
    const incStacks = yuanToStacks(incrementYuan)
    const baseL = layerLayout(baseStacks, 0)
    const topLayer = baseL.length ? baseL[baseL.length - 1].layer + 1 : 0
    return { base: baseL, increment: incStacks > 0 ? layerLayout(incStacks, topLayer) : [] }
  }, [baseYuan, incrementYuan])

  const textures = useMemo(
    () => ({
      base: billTexture(ColorSceneBillRed, ColorSceneBillRedDark),
      inc: billTexture(ColorSceneBillOrange, ColorSceneBillOrangeDark),
    }),
    []
  )

  return (
    <group>
      <InstancedBundles positions={base} texture={textures.base} />
      <InstancedBundles positions={increment} texture={textures.inc} />
    </group>
  )
}
