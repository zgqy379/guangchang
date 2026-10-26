// 摊位硬件实例化（2026-10-27 美术攻关 · draw call 预算）
//
// 背景：64 个摊位每个都自带雨棚立柱（4 根）与钱袋堆（2–7 层），
//      这两项在原实现里是 **独立 mesh**：256 + 约 290 = 546 个 draw call，
//      而它们的几何形状对所有摊位完全一致 —— 属于纯浪费。
//
// 本文件把两者改为 InstancedMesh：
//      雨棚立柱 256 根 → 1 个 draw call
//      钱袋堆（约 290 层）→ 2 个 draw call（普通版 / 增薪版两张贴图）
// 合计省下约 543 个 draw call，同时保持"层数 ∝ 总包"的语义不变。
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { placeLots } from '../../data/street-companies'
import { totalPackage } from '../../engine/params'
import { CASH_TEXTURES } from './HRStand'

const POLE_OFFSETS: [number, number][] = [
  [-1.08, -0.82],
  [1.08, -0.82],
  [-1.08, 0.82],
  [1.08, 0.82],
]

function localToWorld(
  pos: [number, number, number],
  rotY: number,
  lx: number,
  lz: number
): [number, number] {
  const c = Math.cos(rotY)
  const s = Math.sin(rotY)
  return [pos[0] + lx * c + lz * s, pos[2] - lx * s + lz * c]
}

/** 雨棚立柱：64 × 4 根 → 1 个 draw call */
export function BoothPoles({ night }: { night: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const placed = useMemo(() => placeLots(), [])
  useLayoutEffect(() => {
    const m = ref.current
    if (!m) return
    const o = new THREE.Object3D()
    let i = 0
    placed.forEach((p) => {
      POLE_OFFSETS.forEach(([lx, lz]) => {
        const [wx, wz] = localToWorld(p.position, p.rotationY, lx, lz)
        o.position.set(wx, 1.16, wz)
        o.rotation.set(0, p.rotationY, 0)
        o.scale.setScalar(1)
        o.updateMatrix()
        m.setMatrixAt(i++, o.matrix)
      })
    })
    m.instanceMatrix.needsUpdate = true
  }, [placed])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, placed.length * 4]} frustumCulled={false}>
      <cylinderGeometry args={[0.022, 0.022, 2.32, 6]} />
      <meshStandardMaterial color={night ? '#39424c' : '#aebfcc'} />
    </instancedMesh>
  )
}

/**
 * 钱袋堆：层数 ∝ 总包（总包越高，堆得越高）——与参数碑的"碑高=总包"呼应。
 * 顶层若 salaryStructure > 12 则换成增薪版贴图（橙色）。
 */
export function MoneyStacks() {
  const placed = useMemo(() => placeLots(), [])
  const data = useMemo(() => {
    const base: number[] = []
    const inc: number[] = []
    placed.forEach((p, idx) => {
      const total = totalPackage(p.lot.params)
      const layers = Math.max(2, Math.min(7, Math.round(total / 100000)))
      for (let i = 0; i < layers; i++) {
        const isTop = i === layers - 1
        const useInc = isTop && p.lot.params.salaryStructure > 12
        const [wx, wz] = localToWorld(p.position, p.rotationY, 0.62, 0.55)
        ;(useInc ? inc : base).push(wx, 0.14 + 0.06 + i * 0.12, wz, p.rotationY)
      }
      void idx
    })
    return { base, inc }
  }, [placed])

  const baseRef = useRef<THREE.InstancedMesh>(null)
  const incRef = useRef<THREE.InstancedMesh>(null)

  useLayoutEffect(() => {
    const apply = (mesh: THREE.InstancedMesh | null, arr: number[]) => {
      if (!mesh || !arr.length) return
      const o = new THREE.Object3D()
      for (let i = 0; i < arr.length; i += 4) {
        o.position.set(arr[i], arr[i + 1], arr[i + 2])
        o.rotation.set(0, arr[i + 3], 0)
        o.scale.set(1, 1, 1)
        o.updateMatrix()
        mesh.setMatrixAt(i / 4, o.matrix)
      }
      mesh.instanceMatrix.needsUpdate = true
    }
    apply(baseRef.current, data.base)
    apply(incRef.current, data.inc)
  }, [data])

  const mat = (tex: THREE.Texture) => (
    <meshStandardMaterial
      map={tex}
      emissiveMap={tex}
      emissive="#ffffff"
      emissiveIntensity={0.12}
      roughness={0.62}
    />
  )

  return (
    <>
      <instancedMesh
        ref={baseRef}
        args={[undefined, undefined, Math.max(1, data.base.length / 4)]}
        frustumCulled={false}
      >
        <boxGeometry args={[0.5, 0.115, 0.32]} />
        {mat(CASH_TEXTURES.base)}
      </instancedMesh>
      <instancedMesh
        ref={incRef}
        args={[undefined, undefined, Math.max(1, data.inc.length / 4)]}
        frustumCulled={false}
        visible={data.inc.length > 0}
      >
        <boxGeometry args={[0.5, 0.115, 0.32]} />
        {mat(CASH_TEXTURES.inc)}
      </instancedMesh>
    </>
  )
}
