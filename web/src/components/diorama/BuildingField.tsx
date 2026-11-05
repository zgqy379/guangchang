// 立体参数沙盘 · 64 栋参数楼的 InstancedMesh 实例池（D4 / 2026-11-05）
//
// 八个池各 64 实例：足额地基台 / 打折缺口台 / 楼身 / 增薪冠 / 期权顶珠 /
// 暖窗灯 / 冷黑窗 / 不可见命中盒。总增量 8 个 draw call（实测 20 上下，红线 150）。
//
// 四信道在这里真正落到参数上（D4 闭环 I-005 / I-006 / C-D4-01..03）：
//   · 体量   = 总包行业内归一化 → 高 × 宽联动（layout.ts）
//   · 钱构成 = 楼身主色（底薪）/ 冠（**有增薪才出现**）/ 顶珠（**有期权才出现**，大小随期权额）
//   · 累不累 = 早下班暖灯 emissive 发光 / 晚下班黑窗冷玻璃（两个独立材质池）
//   · 五险   = 足额完整方台 / 打折非对称「缺一条」的缩台（两个独立池）
// 不显示的构件用 scale=0 隐藏实例，池数量不变 → 不增加 draw call。
//
// 纪律（AGENTS.md / lessons.md）：
// · 矩阵一律写 useLayoutEffect —— 写 useMemo 首帧 ref 为空，实例全叠原点（64 盏路灯事故）。
// · setColorAt 染色时材质**不传 color、不开 vertexColors**，否则 instanceColor 与
//   缺失的顶点色属性相乘 → 纯黑（lessons §13.4）。
// · 共面贴片（窗灯）z 间隔 = LIFT = 0.04m ≥ 0.02m（T11）。
// · 颜色全部由调用方传入的 Diorama* 令牌调色板提供，本文件零硬编码色值。

import { useLayoutEffect, useRef } from 'react'
import * as THREE from 'three'
import { incrementPackage } from '../../engine/params'
import {
  BUILDINGS,
  BODY_BOTTOM,
  CROWN_H,
  PEARL_H,
  PAD_Y,
  PAD_H,
  PITCH,
  LIFT,
  TOP_SLOT,
} from './layout'

/** Palette 的结构子集；DAY/NIGHT 调色板可直接传入（TS 结构类型） */
export interface BuildingColors {
  foundationFull: string
  foundationCut: string
  buildings: readonly [string, string, string, string]
  raiseCrown: string
  equityPearl: string
  windowWarm: string
  windowCold: string
  contactShadow: string
  groundGlow: string
  windowFrame: string
  edgeLight: string
}

const COUNT = 64
/** 每栋 2 个窗（不同高度/宽度），打破 D5 评审点名的「64 栋同一模子」复制感 */
const WIN_COUNT = COUNT * 2

export interface BuildingFieldProps {
  colors: BuildingColors
  night: boolean
  /** hover 到的楼下标（null = 移出） */
  onHover: (index: number | null) => void
  /** 点选的楼下标 */
  onSelect: (index: number) => void
}

export function BuildingField({ colors, night, onHover, onSelect }: BuildingFieldProps) {
  const padFullRef = useRef<THREE.InstancedMesh>(null)
  const padCutRef = useRef<THREE.InstancedMesh>(null)
  const bodyRef = useRef<THREE.InstancedMesh>(null)
  const crownRef = useRef<THREE.InstancedMesh>(null)
  const pearlRef = useRef<THREE.InstancedMesh>(null)
  const winWarmRef = useRef<THREE.InstancedMesh>(null)
  const winColdRef = useRef<THREE.InstancedMesh>(null)
  // I-004：不可见命中盒，尺寸显著大于楼体，放宽容差让 hover/点选可靠命中
  const hitRef = useRef<THREE.InstancedMesh>(null)
  // D6：楼级接触阴影 + 暖窗落地光池
  const shadowRef = useRef<THREE.InstancedMesh>(null)
  const glowRef = useRef<THREE.InstancedMesh>(null)
  // D7：窗框（每栋 2 个）+ 屋顶边缘亮线，打破「纯色柱体 + 挖空矩形窗」的纸片感
  const frameRef = useRef<THREE.InstancedMesh>(null)
  const edgeRef = useRef<THREE.InstancedMesh>(null)

  useLayoutEffect(() => {
    const padFull = padFullRef.current
    const padCut = padCutRef.current
    const body = bodyRef.current
    const crown = crownRef.current
    const pearl = pearlRef.current
    const winWarm = winWarmRef.current
    const winCold = winColdRef.current
    const hit = hitRef.current
    const shadow = shadowRef.current
    const glow = glowRef.current
    const frame = frameRef.current
    const edge = edgeRef.current
    if (!padFull || !padCut || !body || !crown || !pearl || !winWarm || !winCold || !hit || !shadow || !glow || !frame || !edge) return

    const matrix = new THREE.Matrix4()
    const quat = new THREE.Quaternion()
    const pos = new THREE.Vector3()
    const scale = new THREE.Vector3()
    const color = new THREE.Color()

    const set = (
      mesh: THREE.InstancedMesh, i: number,
      x: number, y: number, z: number,
      sx: number, sy: number, sz: number,
      hex: string
    ) => {
      pos.set(x, y, z)
      scale.set(sx, sy, sz)
      matrix.compose(pos, quat, scale)
      mesh.setMatrixAt(i, matrix)
      color.set(hex)
      mesh.setColorAt(i, color)
    }

    BUILDINGS.forEach((d, i) => {
      // —— 钱怎么构成：增薪冠 / 期权顶珠只在真有该项时才出现 ——
      const inc = incrementPackage(d.lot.params)
      const eq = d.lot.params.equityValue
      const hasCrown = inc > 0
      const hasPearl = eq > 0
      const pearlScale = hasPearl ? 0.55 + 0.65 * Math.min(1, eq / 1_200_000) : 0

      // ① 五险地基台：足额完整方台 / 打折 x 方向短一截的「缺口」缩台
      const fullW = d.width * 1.35
      const fv = d.fullInsurance ? 1 : 0
      set(padFull, i, d.x, PAD_Y + PAD_H / 2, d.z, fullW * fv, PAD_H, fullW * fv, colors.foundationFull)
      set(padCut, i, d.x, PAD_Y + PAD_H / 2, d.z,
        d.width * 0.72 * (1 - fv), PAD_H, fullW * (1 - fv), colors.foundationCut)

      // ② 楼身：高 × 宽联动，「谁给得多」一眼排序
      set(body, i, d.x, BODY_BOTTOM + d.height / 2, d.z,
        d.width, d.height, d.width, colors.buildings[d.zone])

      // ③ 增薪冠（12 薪 = 无增薪 = 不出现）
      const cs = hasCrown ? d.width : 0
      set(crown, i, d.x, BODY_BOTTOM + d.height + CROWN_H / 2, d.z,
        cs, hasCrown ? CROWN_H : 0, cs, colors.raiseCrown)

      // ④ 期权顶珠（equity=0 = 不出现；有期权时半径随金额分级）
      const ps = hasPearl ? d.width * pearlScale : 0
      set(pearl, i, d.x, BODY_BOTTOM + d.height + CROWN_H + PEARL_H / 2, d.z,
        ps, hasPearl ? PEARL_H : 0, ps, colors.equityPearl)

      // ⑤ 窗灯 + 窗框：暖/冷互斥；窗框与窗灯 z 间隔 ≥0.02m（T11）
      const frameZ = d.z + d.width / 2 + 0.01
      const wz = d.z + d.width / 2 + LIFT + 0.02
      const w = d.lateOff ? 0 : 1
      const c = 1 - w
      for (let j = 0; j < 2; j++) {
        const wy = BODY_BOTTOM + d.height * (j === 0 ? 0.38 : 0.72)
        const wx = d.width * (j === 0 ? 0.5 : 0.38)
        const wi = i * 2 + j
        set(frame, wi, d.x, wy, frameZ, wx * 1.32, 0.34, 0.02, colors.windowFrame)
        set(winWarm, wi, d.x, wy, wz, wx * w, 0.24 * w, 0.03 * w, colors.windowWarm)
        set(winCold, wi, d.x, wy, wz, wx * c, 0.24 * c, 0.03 * c, colors.windowCold)
      }
      // ⑥ 屋顶边缘亮线：一圈浅色薄边，拉开楼体与背景层次（评审：纯色柱体无倒角）
      set(edge, i, d.x, BODY_BOTTOM + d.height - 0.05, d.z,
        d.width * 1.1, 0.07, d.width * 1.1, colors.edgeLight)

      // ⑦ 楼级接触阴影：让楼「坐」在地块上（评审：楼体像浮在地面上）
      set(shadow, i, d.x, TOP_SLOT + 0.02, d.z,
        d.width * 1.5, 0.02, d.width * 1.5, colors.contactShadow)

      // ⑧ 暖窗落地光池：夜景不只是「调暗 + 贴亮条」
      const g = d.lateOff ? 0 : 1
      set(glow, i, d.x, TOP_SLOT + 0.03, d.z + d.width * 0.7,
        d.width * 1.1 * g, 0.02, d.width * 0.9 * g, colors.groundGlow)

      // ⑨ 不可见命中盒（I-004）
      const hitSize = Math.max(d.width * 1.6, PITCH * 0.82)
      set(hit, i, d.x, BODY_BOTTOM + d.height / 2, d.z,
        hitSize, d.height + 0.8, hitSize, '#000000')
    })

    for (const mesh of [padFull, padCut, body, crown, pearl, winWarm, winCold, hit, shadow, glow, frame, edge]) {
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      mesh.computeBoundingSphere()
    }
  }, [colors, night])

  return (
    <group>
      <instancedMesh ref={padFullRef} args={[undefined, undefined, COUNT]} frustumCulled={false} castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.92} />
      </instancedMesh>
      <instancedMesh ref={padCutRef} args={[undefined, undefined, COUNT]} frustumCulled={false} castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.92} />
      </instancedMesh>
      {/* D7：楼身/冠/顶珠做三级材质区分（哑光墙 → 金属冠 → 亮顶珠），
          并全部 castShadow，让方向主光投出真实落地阴影 */}
      <instancedMesh ref={bodyRef} args={[undefined, undefined, COUNT]} frustumCulled={false} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.62} metalness={0.12} />
      </instancedMesh>
      <instancedMesh ref={crownRef} args={[undefined, undefined, COUNT]} frustumCulled={false} castShadow>
        <cylinderGeometry args={[0.72, 0.62, 1, 6]} />
        <meshStandardMaterial roughness={0.32} metalness={0.55} />
      </instancedMesh>
      <instancedMesh ref={pearlRef} args={[undefined, undefined, COUNT]} frustumCulled={false} castShadow>
        <coneGeometry args={[0.2, 1, 6]} />
        <meshStandardMaterial roughness={0.25} metalness={0.45} />
      </instancedMesh>
      {/* D7 窗框 + 屋顶亮边：深色外框勾窗洞、浅色薄边破「纯色柱体」 */}
      <instancedMesh ref={frameRef} args={[undefined, undefined, WIN_COUNT]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.85} />
      </instancedMesh>
      <instancedMesh ref={edgeRef} args={[undefined, undefined, COUNT]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial />
      </instancedMesh>
      {/* emissive 是材质级参数，无法按实例变化 → 拆成暖/冷两个池 */}
      <instancedMesh ref={winWarmRef} args={[undefined, undefined, WIN_COUNT]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          emissive={colors.windowWarm}
          emissiveIntensity={night ? 1.25 : 0.85}
          roughness={0.35}
        />
      </instancedMesh>
      <instancedMesh ref={winColdRef} args={[undefined, undefined, WIN_COUNT]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          emissive={colors.windowCold}
          emissiveIntensity={0.04}
          roughness={0.72}
        />
      </instancedMesh>
      {/* 楼级接触阴影 / 暖窗落地光：贴地块顶面，间隔 ≥0.02m（T11） */}
      <instancedMesh ref={shadowRef} args={[undefined, undefined, COUNT]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial transparent opacity={0.32} depthWrite={false} />
      </instancedMesh>
      <instancedMesh ref={glowRef} args={[undefined, undefined, COUNT]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial transparent opacity={night ? 0.5 : 0.2} depthWrite={false} />
      </instancedMesh>
      {/* 拾取层放最后：R3F 事件带 instanceId，直接映射 BUILDINGS 下标 */}
      <instancedMesh
        ref={hitRef}
        args={[undefined, undefined, COUNT]}
        frustumCulled={false}
        onPointerMove={(e) => { e.stopPropagation(); onHover(e.instanceId ?? null) }}
        onPointerOut={() => onHover(null)}
        onClick={(e) => { e.stopPropagation(); if (e.instanceId != null) onSelect(e.instanceId) }}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial colorWrite={false} depthWrite={false} />
      </instancedMesh>
    </group>
  )
}
