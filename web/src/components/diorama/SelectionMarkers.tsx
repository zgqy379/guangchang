// 立体参数沙盘 · 选中/钉选态的 3D 反馈（D6 定向修复 / 2026-11-05）
//
// D5 双盲审两位评审共同点名的头号短板：「底部列了 3 家公司，64 栋楼却没有
// 任何一栋被高亮/描边/编号，交互状态不自解释」。功能逻辑是对的，但评审只看图。
//
// 这里把状态做回 3D 主体：被钉选的楼有「地面光圈 + 半透光柱 + 顶部锥标」，
// 三种颜色分别对应底部对比栏的 ①②③（双向对应）；被点选但未钉选的楼用 focusMark 色。
// 颜色全部来自 diorama.* 令牌，零硬编码。

import * as THREE from 'three'
import { BUILDINGS, BODY_BOTTOM, CROWN_H, PEARL_H, TOP_ZONE } from './layout'

export interface SelectionPalette {
  focusMark: string
  pin1: string
  pin2: string
  pin3: string
}

interface Mark {
  x: number
  z: number
  width: number
  height: number
  color: string
  key: string
}

export function SelectionMarkers({
  selected,
  pinned,
  palette,
}: {
  selected: number | null
  pinned: number[]
  palette: SelectionPalette
}) {
  const colors = [palette.pin1, palette.pin2, palette.pin3]
  const marks: Mark[] = []

  pinned.forEach((index, order) => {
    const d = BUILDINGS[index]
    if (!d) return
    marks.push({
      x: d.x, z: d.z, width: d.width, height: d.height,
      color: colors[order] ?? palette.focusMark,
      key: `pin-${index}`,
    })
  })
  if (selected != null && !pinned.includes(selected)) {
    const d = BUILDINGS[selected]
    if (d) {
      marks.push({
        x: d.x, z: d.z, width: d.width, height: d.height,
        color: palette.focusMark,
        key: `focus-${selected}`,
      })
    }
  }

  return (
    <group>
      {marks.map((m) => (
        <group key={m.key}>
          {/* 地面色盘 + 亮环：俯视角下必须明显大于楼体投影，否则被楼身完全挡住。
              贴地块顶面，间隔 0.07/0.09m ≥ 0.02m（T11） */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[m.x, TOP_ZONE + 0.07, m.z]}>
            <circleGeometry args={[m.width * 2.4, 32]} />
            <meshBasicMaterial color={m.color} transparent opacity={0.3} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[m.x, TOP_ZONE + 0.09, m.z]}>
            <ringGeometry args={[m.width * 2.2, m.width * 2.6, 32]} />
            <meshBasicMaterial color={m.color} transparent opacity={0.95} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
          {/* 半透光柱：远处也能一眼定位是哪一栋 */}
          <mesh position={[m.x, BODY_BOTTOM + m.height / 2, m.z]}>
            <cylinderGeometry args={[m.width * 0.78, m.width * 0.78, m.height, 12, 1, true]} />
            <meshBasicMaterial color={m.color} transparent opacity={0.22} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
          {/* 顶部锥标：与对比栏 ①②③ 同色；外加同色半透明光晕，
              让紫色标记不至于融进紫色楼群（第二轮评审点名） */}
          <mesh position={[m.x, BODY_BOTTOM + m.height + CROWN_H + PEARL_H + 0.62, m.z]}>
            <coneGeometry args={[0.32, 0.7, 5]} />
            <meshBasicMaterial color={m.color} />
          </mesh>
          <mesh position={[m.x, BODY_BOTTOM + m.height + CROWN_H + PEARL_H + 0.62, m.z]}>
            <sphereGeometry args={[0.5, 10, 8]} />
            <meshBasicMaterial color={m.color} transparent opacity={0.3} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </group>
  )
}
