// 摊位个体识别标记（2026-10-27 美术攻关 · 对应盲审差距 2「摊位同构」）
//
// 64 个摊位此前高度同构，远看分不出是哪家。本文件用**两个 InstancedMesh**
// 解决，且**总共只增加 2 个 draw call**：
//
//   ① LotNumberDecals —— 地面编号牌（01–64）
//      做法：一张 8×8 的编号图集（atlas），每个实例用实例属性 aCell 指定
//      自己占用哪一格，材质用 onBeforeCompile 把 UV 重映射到那一格。
//      → 64 个编号牌 = 1 个 draw call。这是鸟瞰距离**唯一还能读出来**的个体线索。
//
//   ② LotBeacons —— 摊位前的行业色信标鳍
//      高度按稀有度分级（S/A/B 三档），颜色取行业色。
//      → 中景看得到"彩色竖鳍"，鸟瞰看得到"彩色短刻度"，与编号牌组成识别牌。
//
// 为什么不用「每摊位多画几个 mesh」：draw call 是移动端生死线，
// 本项目实测已到 2000+，任何"每个摊位多两个 mesh"的做法都是不可接受的。
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { INDUSTRIES, placeLots } from '../../data/street-companies'
import { totalPackage } from '../../engine/params'
import {
  GameXpRarityASalary,
  GameXpRaritySSalary,
  TwinBeaconHeightA,
  TwinBeaconHeightB,
  TwinBeaconHeightS,
} from '../../../generated/design-tokens.output.mjs'

const ATLAS_COLS = 8
const ATLAS_ROWS = 8

// 摊位在世界坐标里的朝向换算（与 ParamSteles 同源：Ry(rot)·(lx,lz)）
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

/** 编号图集：8×8 格，每格一块深色编号牌 + 白色数字（数字随实例色变行业色） */
let NUMBER_ATLAS: THREE.CanvasTexture | null = null
function numberAtlasTexture() {
  if (NUMBER_ATLAS) return NUMBER_ATLAS
  const CELL = 64
  const size = CELL * ATLAS_COLS
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const ctx = c.getContext('2d')!
  ctx.clearRect(0, 0, size, size)
  for (let i = 0; i < ATLAS_COLS * ATLAS_ROWS; i++) {
    const col = i % ATLAS_COLS
    const row = Math.floor(i / ATLAS_COLS)
    const x = col * CELL
    const y = row * CELL
    // 编号牌底（深色 → 任何行业色数字压在上面都够对比）
    ctx.fillStyle = 'rgba(9,12,20,0.88)'
    ctx.beginPath()
    ctx.roundRect(x + 5, y + 5, CELL - 10, CELL - 10, 11)
    ctx.fill()
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 2.5
    ctx.stroke()
    // 数字（白 → 会被 instanceColor 染成行业色）
    ctx.fillStyle = '#ffffff'
    ctx.font = '800 36px "Segoe UI", Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(i + 1).padStart(2, '0'), x + CELL / 2, y + CELL / 2 + 2)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  NUMBER_ATLAS = t
  return t
}

/** 地面编号牌：64 块 = 1 个 draw call */
export function LotNumberDecals() {
  const ref = useRef<THREE.InstancedMesh>(null)
  const placed = useMemo(() => placeLots(), [])
  const cells = useMemo(() => {
    const arr = new Float32Array(placed.length * 2)
    placed.forEach((_p, i) => {
      const col = i % ATLAS_COLS
      const row = Math.floor(i / ATLAS_COLS)
      arr[i * 2] = col / ATLAS_COLS
      // canvas flipY=true → 顶行对应 v 的上界
      arr[i * 2 + 1] = 1 - (row + 1) / ATLAS_ROWS
    })
    return arr
  }, [placed])

  const material = useMemo(() => {
    const m = new THREE.MeshBasicMaterial({
      map: numberAtlasTexture(),
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    })
    m.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          '#include <common>\nattribute vec2 aCell;\nvarying vec2 vCell;'
        )
        .replace('#include <uv_vertex>', '#include <uv_vertex>\n\tvCell = aCell;')
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vCell;')
        .replace(
          '#include <map_fragment>',
          `#ifdef USE_MAP
          vec4 gcCell = texture2D( map, vMapUv * ${(1 / ATLAS_COLS).toFixed(6)} + vCell );
          diffuseColor *= gcCell;
        #endif`
        )
    }
    m.customProgramCacheKey = () => 'gc-lot-number-atlas'
    m.needsUpdate = true
    return m
  }, [])

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const o = new THREE.Object3D()
    const col = new THREE.Color()
    const q = new THREE.Quaternion()
    const qYaw = new THREE.Quaternion()
    const qFlat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0))
    placed.forEach((p, i) => {
      const [wx, wz] = localToWorld(p.position, p.rotationY, 0, 2.3)
      o.position.set(wx, 0.032, wz)
      qYaw.setFromEuler(new THREE.Euler(0, p.rotationY, 0))
      q.copy(qYaw).multiply(qFlat)
      o.quaternion.copy(q)
      o.scale.setScalar(1)
      o.updateMatrix()
      mesh.setMatrixAt(i, o.matrix)
      mesh.setColorAt(i, col.set(INDUSTRIES[p.lot.industry].color))
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    ;(mesh.material as THREE.MeshBasicMaterial).needsUpdate = true
  }, [placed])

  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, placed.length]}
      material={material}
      frustumCulled={false}
    >
      <planeGeometry args={[1.15, 1.15]}>
        <instancedBufferAttribute attach="attributes-aCell" args={[cells, 2]} />
      </planeGeometry>
    </instancedMesh>
  )
}

/** 摊位信标鳍：高度按稀有度 S/A/B 分级，颜色取行业色 —— 64 个 = 1 个 draw call */
export function LotBeacons() {
  const ref = useRef<THREE.InstancedMesh>(null)
  const placed = useMemo(() => placeLots(), [])
  const data = useMemo(
    () =>
      placed.map((p) => {
        const total = totalPackage(p.lot.params)
        const h =
          total >= GameXpRaritySSalary
            ? TwinBeaconHeightS
            : total >= GameXpRarityASalary
              ? TwinBeaconHeightA
              : TwinBeaconHeightB
        return { p, h }
      }),
    []
  )

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const o = new THREE.Object3D()
    const col = new THREE.Color()
    data.forEach(({ p, h }, i) => {
      // 紧挨编号牌右侧（local +X），高度低于 HR 视线 → 不挡人
      const [wx, wz] = localToWorld(p.position, p.rotationY, 0.74, 2.3)
      o.position.set(wx, h / 2, wz)
      o.rotation.set(0, p.rotationY, 0)
      o.scale.set(1, h, 1)
      o.updateMatrix()
      mesh.setMatrixAt(i, o.matrix)
      mesh.setColorAt(i, col.set(INDUSTRIES[p.lot.industry].color))
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    ;(mesh.material as THREE.MeshBasicMaterial).needsUpdate = true
  }, [data])

  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, data.length]}
      frustumCulled={false}
    >
      <boxGeometry args={[0.16, 1, 0.05]} />
      {/* 信标用无光照材质：instanceColor 只作用于 diffuse，
          若用标准材质则自发光会统一变白，行业色就丢了 —— 这里直接让它"常亮" */}
      <meshBasicMaterial color="#ffffff" toneMapped={false} transparent opacity={0.9} />
    </instancedMesh>
  )
}
