// 摊位硬件 InstancedMesh 池（M6c：draw call 优化）
//
// 将 HRStand 中每个摊位重复的非交互硬件元素合并为 InstancedMesh，
// 替代每个摊位 10+ 个独立 mesh（64 摊位 ≈ 700+ draw call → 几十个）。
//
// 只处理无 per-instance 交互的元素；门（onClick）、名牌（per-cot 纹理）、
// HR 形象（近景 GLB/远景 PlaceholderHRs）仍保留在 HRStand 中。
//
// 合并的元素（共 13 个 InstancedMesh，13 个 draw call，替代 ~640）：
//   1. booth  摊位台 box
//   2. shadow 地面阴影 plane
//   3. glow   雨棚下光环 plane（per-instance 颜色：delivered 绿 / 行业色）
//   4. pole   侧招立柱 box
//   5. sign   侧招灯条 plane（per-instance 颜色：行业色）
//   6. moneyBase 参数具象化钱袋底座 box
//   7. moneyCut 参数具象化五险切口牌 box（per-instance 高度：full/0.8/0.6）
//   8. desk   门前咨询桌 box
//   9. carpet 门前地毯 box（×2 实例）
//  10. flagPole 区域色侧旗柱 cylinder
//  11. flag    区域色侧旗旗帜 plane（per-instance 颜色：行业色）
//  12-15. roof 雨棚顶（按 4 种行业变体分组，4 个 InstancedMesh）
import { useLayoutEffect, useRef } from 'react'
import * as THREE from 'three'
import type { LotPlacement } from '../../data/street-companies'
import { INDUSTRIES } from '../../data/street-companies'
import type { Industry } from '../../data/street-companies'
import type { ThemeName } from '../../engine/theme'
import { ColorStateSuccess } from '../../../generated/design-tokens.output.mjs'
import { applyLotJitter, posterTexture } from './OfficeFacadeInstanced'
import { shadowTexture } from './HRStand'

const tempObject = new THREE.Object3D()
const tempColor = new THREE.Color()

function instanceMatrixFor(
  pl: LotPlacement,
  x: number,
  y: number,
  z: number,
  sx = 1,
  sy = 1,
  sz = 1,
  rotY = 0,
) {
  const r = pl.rotationY + rotY
  const c = Math.cos(r)
  const s = Math.sin(r)
  const wx = pl.position[0] + x * c - z * s
  const wz = pl.position[2] + x * s + z * c
  tempObject.position.set(wx, y, wz)
  tempObject.rotation.set(0, r, 0)
  tempObject.scale.set(sx, sy, sz)
  tempObject.updateMatrix()
  return tempObject.matrix
}

// 行业 → 雨棚变体索引
function roofVariant(industry: Industry): number {
  switch (industry) {
    case 'internet':
      return 0
    case 'finance':
      return 1
    case 'manufacturing':
      return 2
    case 'culture':
      return 3
  }
}

function roofGeometry(variant: number) {
  switch (variant) {
    case 0: // internet 平顶大板
      return <boxGeometry args={[2.86, 0.08, 2.3]} />
    case 1: // finance 尖顶金字塔
      return <coneGeometry args={[1.52, 0.88, 4]} />
    case 2: // manufacturing 单坡厂棚
      return <boxGeometry args={[2.72, 0.08, 2.24]} />
    case 3: // culture 菱形坡顶
      return <boxGeometry args={[1.96, 0.1, 1.96]} />
  }
}

export function BoothHardwareInstanced({
  placements,
  theme,
  night,
  delivered,
}: {
  placements: LotPlacement[]
  theme: ThemeName
  night: boolean
  delivered: Set<string>
}) {
  const count = placements.length
  const envNight = theme === 'dark'
  const countRef = useRef(0)

  const boothRef = useRef<THREE.InstancedMesh>(null)
  const shadowRef = useRef<THREE.InstancedMesh>(null)
  const glowRef = useRef<THREE.InstancedMesh>(null)
  const poleRef = useRef<THREE.InstancedMesh>(null)
  const signRef = useRef<THREE.InstancedMesh>(null)
  const moneyBaseRef = useRef<THREE.InstancedMesh>(null)
  const moneyCutRef = useRef<THREE.InstancedMesh>(null)
  const deskRef = useRef<THREE.InstancedMesh>(null)
  const carpetRef = useRef<THREE.InstancedMesh>(null)
  const flagPoleRef = useRef<THREE.InstancedMesh>(null)
  const flagRef = useRef<THREE.InstancedMesh>(null)
  const screenRef = useRef<THREE.InstancedMesh>(null)

  const roofRefs = {
    internet: useRef<THREE.InstancedMesh>(null),
    finance: useRef<THREE.InstancedMesh>(null),
    manufacturing: useRef<THREE.InstancedMesh>(null),
    culture: useRef<THREE.InstancedMesh>(null),
  } as const

  const industryList: Industry[] = ['internet', 'finance', 'manufacturing', 'culture']

  // ---------- 初始化 count ----------
  // 必须 useLayoutEffect：写在 useEffect 会在首帧渲染之后才设置 count，
  // 首帧全部实例矩阵尚未写入 → 全叠原点（AGENTS 铁律：InstancedMesh 矩阵走 useLayoutEffect）
  useLayoutEffect(() => {
    countRef.current = count
    const setCount = (ref: React.RefObject<THREE.InstancedMesh> | null, n: number) => {
      const m = ref?.current
      if (m) m.count = n
    }
    setCount(boothRef, count)
    setCount(shadowRef, count)
    setCount(glowRef, count)
    setCount(poleRef, count)
    setCount(signRef, count)
    setCount(moneyBaseRef, count)
    setCount(moneyCutRef, count)
    setCount(deskRef, count)
    setCount(carpetRef, count * 2)
    setCount(flagPoleRef, count)
    setCount(flagRef, count)
    industryList.forEach((ind) => setCount(roofRefs[ind], count))
  }, [count])

  // ---------- 每帧更新 matrix / 颜色 ----------
  // 改 useLayoutEffect：矩阵必须在首帧提交前写入，否则首帧全叠原点（T 事故同源）
  useLayoutEffect(() => {
    const setMat = (ref: React.RefObject<THREE.InstancedMesh>, fn: (m: THREE.InstancedMesh) => void) => {
      const m = ref.current
      if (m) fn(m)
    }

    // booth
    setMat(boothRef, (m) => {
      placements.forEach((pl, i) => {
        m.setMatrixAt(i, instanceMatrixFor(pl, 0, 0.07, 0, 2.2, 0.14, 2.2))
        // 个体识别：台面中性明度微扰（±3%），instanceColor 乘法通道，不开 vertexColors（T14 教训：无 color 属性时 USE_COLOR 会乘成纯黑）
        const seed = parseInt(pl.lot.id.slice(-2), 10) || 0
        tempColor.set('#ffffff').offsetHSL(0, 0, ((seed % 5) - 2) * 0.03)
        m.setColorAt(i, tempColor)
      })
      m.instanceMatrix.needsUpdate = true
      if (m.instanceColor) m.instanceColor.needsUpdate = true
    })

    // shadow
    setMat(shadowRef, (m) => {
      placements.forEach((pl, i) => {
        m.setMatrixAt(i, instanceMatrixFor(pl, 0, 0.013, 0.12, 3.2, 3.2, 1, -Math.PI / 2))
      })
      m.instanceMatrix.needsUpdate = true
    })

    // glow（per-instance 颜色）
    setMat(glowRef, (m) => {
      placements.forEach((pl, i) => {
        m.setMatrixAt(i, instanceMatrixFor(pl, 0, 2.31, 0, 2.18, 1.72, 1, Math.PI / 2))
        if (delivered.has(pl.lot.id)) {
          tempColor.set(ColorStateSuccess)
        } else {
          // 个体识别：光环行业色 × lotNo 微扰（已投递绿章不扰，状态色不参与装饰变换）
          applyLotJitter(tempColor.set(INDUSTRIES[pl.lot.industry].color), pl.lot.id)
        }
        m.setColorAt(i, tempColor)
      })
      m.instanceMatrix.needsUpdate = true
      m.instanceColor!.needsUpdate = true
    })

    // pole
    setMat(poleRef, (m) => {
      placements.forEach((pl, i) => {
        m.setMatrixAt(i, instanceMatrixFor(pl, -1.3, 1.52, 0.5, 0.14, 1.86, 0.42))
      })
      m.instanceMatrix.needsUpdate = true
    })

    // sign（per-instance 颜色：行业色）
    setMat(signRef, (m) => {
      placements.forEach((pl, i) => {
        m.setMatrixAt(i, instanceMatrixFor(pl, -1.225, 1.52, 0.5, 0.18, 1.46, 1))
        // 个体识别：侧招灯条不再全街同色（lotNo 微扰，0 DC）
        applyLotJitter(tempColor.set(INDUSTRIES[pl.lot.industry].color), pl.lot.id)
        m.setColorAt(i, tempColor)
      })
      m.instanceMatrix.needsUpdate = true
      m.instanceColor!.needsUpdate = true
    })

    // moneyBase / moneyCut
    setMat(moneyBaseRef, (m) => {
      placements.forEach((pl, i) => {
        m.setMatrixAt(i, instanceMatrixFor(pl, -0.62, 0.24, 0.55, 0.42, 0.48, 0.08))
      })
      m.instanceMatrix.needsUpdate = true
    })
    setMat(moneyCutRef, (m) => {
      placements.forEach((pl, i) => {
        const ratio = pl.lot.params.socialInsuranceBaseRatio
        const cutH = ratio === 'full' ? 0.12 : 0.34
        const cutY = 0.24 + (ratio === 'full' ? 0.18 : 0.08)
        m.setMatrixAt(i, instanceMatrixFor(pl, -0.62, cutY, 0.571, 0.34, cutH, 0.02))
      })
      m.instanceMatrix.needsUpdate = true
    })

    // desk / carpet（carpet ×2 实例）
    setMat(deskRef, (m) => {
      placements.forEach((pl, i) => {
        m.setMatrixAt(i, instanceMatrixFor(pl, 1.35, 0.2, 1.15, 0.95, 0.07, 0.55))
      })
      m.instanceMatrix.needsUpdate = true
    })
    setMat(carpetRef, (m) => {
      placements.forEach((pl, i) => {
        m.setMatrixAt(i, instanceMatrixFor(pl, -0.4, 0.1, 1.15, 0.06, 0.2, 0.5))
        m.setMatrixAt(i + count, instanceMatrixFor(pl, 0.4, 0.1, 1.15, 0.06, 0.2, 0.5))
      })
      m.instanceMatrix.needsUpdate = true
    })

    // flagPole / flag（per-instance 颜色：行业色）
    setMat(flagPoleRef, (m) => {
      placements.forEach((pl, i) => {
        const rotY = (parseInt(pl.lot.id.slice(-2), 10) % 7) * 0.02 - 0.06
        m.setMatrixAt(i, instanceMatrixFor(pl, -1.5, 1.55, -0.4, 0.03, 3.1, 0.03, rotY))
      })
      m.instanceMatrix.needsUpdate = true
    })
    setMat(flagRef, (m) => {
      placements.forEach((pl, i) => {
        const rotY = (parseInt(pl.lot.id.slice(-2), 10) % 7) * 0.02 - 0.06
        m.setMatrixAt(i, instanceMatrixFor(pl, -1.24, 2.5, -0.4, 0.52, 1.5, 1, rotY))
        // 个体识别：侧旗同色系微扰
        applyLotJitter(tempColor.set(INDUSTRIES[pl.lot.industry].color), pl.lot.id)
        m.setColorAt(i, tempColor)
      })
      m.instanceMatrix.needsUpdate = true
      m.instanceColor!.needsUpdate = true
    })

    // screen（决策纸④b · R12 评审处方「柜台补屏幕」）：摊位台前沿立式业务屏，
    // 深底屏幕贴图 × 行业色染色——特写帧里「这家人做什么的」的视觉答案。1 DC。
    setMat(screenRef, (m) => {
      const tex = posterTexture()
      const mat = m.material as THREE.MeshBasicMaterial
      if (mat.map !== tex) mat.map = tex
      mat.needsUpdate = true
      placements.forEach((pl, i) => {
        m.setMatrixAt(i, instanceMatrixFor(pl, 0.72, 0.86, 0.78, 0.78, 0.52, 1, -0.06))
        m.setColorAt(i, tempColor.set(INDUSTRIES[pl.lot.industry].color).lerp(new THREE.Color('#f2f5f8'), 0.45))
      })
      m.instanceMatrix.needsUpdate = true
      if (m.instanceColor) m.instanceColor.needsUpdate = true
    })

    // roof 按行业分组
    industryList.forEach((ind) => {
      const mesh = roofRefs[ind].current
      if (!mesh) return
      const indices: number[] = []
      placements.forEach((pl, i) => {
        if (roofVariant(pl.lot.industry) === roofVariant(ind)) indices.push(i)
      })
      mesh.count = indices.length
      indices.forEach((jj, idx) => {
        const pl = placements[jj]
        const v = roofVariant(pl.lot.industry)
        const rotY = v === 1 ? Math.PI / 4 : v === 2 ? -0.17 : v === 3 ? Math.PI / 4 : 0
        const [sx, sy, sz] =
          v === 0 ? [2.86, 0.08, 2.3] : v === 1 ? [1.52, 0.88, 4] : v === 2 ? [2.72, 0.08, 2.24] : [1.96, 0.1, 1.96]
        const [rx, ry, rz] = v === 0 ? [0, 2.36, 0] : v === 1 ? [0, 2.36, 0] : v === 2 ? [0, 2.4, 0] : [0, 2.36, 0]
        mesh.setMatrixAt(idx, instanceMatrixFor(pl, rx, ry, rz, sx, sy, sz, rotY))
        // 个体识别：棚顶行业色 × lotNo 微扰 —— instanceColor 通道（不开 vertexColors，T14）。
        // 白天 material.color 置白由实例色接管；夜间实例色置白、material 深色保夜景统一。
        if (!night) {
          applyLotJitter(tempColor.set(INDUSTRIES[pl.lot.industry].color), pl.lot.id)
        } else {
          tempColor.set('#ffffff')
        }
        mesh.setColorAt(idx, tempColor)
      })
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    })
  }, [placements, count, night, envNight, delivered])

  return (
    <group>
      {/* booth */}
      <instancedMesh ref={boothRef} args={[undefined, undefined, count]}>
        <boxGeometry args={[2.2, 0.14, 2.2]} />
        <meshStandardMaterial color={night ? '#1b232c' : '#cdd8e2'} roughness={night ? 0.9 : 0.6} />
      </instancedMesh>
      {/* shadow */}
      <instancedMesh ref={shadowRef} args={[undefined, undefined, count]}>
        <planeGeometry args={[3.2, 3.2]} />
        {/* 柔边接触阴影：径向暗贴图（旧版无贴图=纯白方块，夜间 0.9 透明白板沿街堆叠成「白幕」，
            盲审 R3/R4 的 focus 白幕元凶——2026-10-27 透明网格清单探针定位） */}
        <meshBasicMaterial
          map={shadowTexture()}
          color="#0a0d12"
          transparent
          opacity={night ? 0.85 : 0.4}
          depthWrite={false}
        />
      </instancedMesh>
      {/* glow */}
      <instancedMesh ref={glowRef} args={[undefined, undefined, count]}>
        <planeGeometry args={[2.18, 1.72]} />
        <meshBasicMaterial vertexColors transparent opacity={night ? 0.1 : 0.16} side={THREE.DoubleSide} depthWrite={false} />
      </instancedMesh>
      {/* pole */}
      <instancedMesh ref={poleRef} args={[undefined, undefined, count]}>
        <boxGeometry args={[0.14, 1.86, 0.42]} />
        <meshStandardMaterial color={night ? '#1b232c' : '#cdd8e2'} />
      </instancedMesh>
      {/* sign */}
      <instancedMesh ref={signRef} args={[undefined, undefined, count]}>
        <planeGeometry args={[0.18, 1.46]} />
        <meshStandardMaterial vertexColors emissiveIntensity={0.55} side={THREE.DoubleSide} />
      </instancedMesh>
      {/* moneyBase */}
      <instancedMesh ref={moneyBaseRef} args={[undefined, undefined, count]}>
        <boxGeometry args={[0.42, 0.48, 0.08]} />
        <meshStandardMaterial color={night ? '#3d4650' : '#b6c3cf'} />
      </instancedMesh>
      {/* moneyCut */}
      <instancedMesh ref={moneyCutRef} args={[undefined, undefined, count]}>
        <boxGeometry args={[0.34, 0.12, 0.02]} />
        <meshStandardMaterial color={night ? '#8b949e' : '#94a4b3'} />
      </instancedMesh>
      {/* desk */}
      <instancedMesh ref={deskRef} args={[undefined, undefined, count]}>
        <boxGeometry args={[0.95, 0.07, 0.55]} />
        <meshStandardMaterial color={night ? '#3b4450' : '#c2cdd8'} roughness={0.8} />
      </instancedMesh>
      {/* carpet */}
      <instancedMesh ref={carpetRef} args={[undefined, undefined, count * 2]}>
        <boxGeometry args={[0.06, 0.2, 0.5]} />
        <meshStandardMaterial color={night ? '#2b323b' : '#b4c1cd'} />
      </instancedMesh>
      {/* flagPole */}
      <instancedMesh ref={flagPoleRef} args={[undefined, undefined, count]}>
        <cylinderGeometry args={[0.03, 0.03, 3.1, 6]} />
        <meshStandardMaterial color={night ? '#39424c' : '#aebfcc'} />
      </instancedMesh>
      {/* flag */}
      <instancedMesh ref={flagRef} args={[undefined, undefined, count]}>
        <planeGeometry args={[0.52, 1.5]} />
        <meshStandardMaterial vertexColors side={THREE.DoubleSide} roughness={0.85} />
      </instancedMesh>
      {/* screen：柜台立式业务屏（1 DC）。basic 自发光=夜间亮屏。染色×深底贴图 */}
      <instancedMesh ref={screenRef} args={[undefined, undefined, count]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      {/* roof 按行业分组 */}
      {industryList.map((ind) => {
        const v = roofVariant(ind)
        return (
          <instancedMesh
            key={ind}
            ref={roofRefs[ind]}
            args={[undefined, undefined, count]}
            castShadow
          >
            {roofGeometry(v)}
            <meshStandardMaterial
              // 个体识别：白天 color 置白、instanceColor 接管（行业色 × lotNo 微扰）；
              // ⚠ 不加 vertexColors（T14：无 color 顶点属性时 USE_COLOR 乘成纯黑）
              color={night ? '#1b232c' : '#ffffff'}
              roughness={night ? 0.7 : 0.72}
              emissive={INDUSTRIES[ind].color}
              emissiveIntensity={night ? 0.3 : 0.08}
            />
          </instancedMesh>
        )
      })}
    </group>
  )
}
