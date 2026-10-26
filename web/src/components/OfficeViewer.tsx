// 办公室漫游：Aholo Viewer 渲染 World 生成的 3DGS 空间（SPZ 格式，4MB 移动端预算内）
// 官方 MIT 开源渲染器（aholojs.dev），W2 三档管线的展示层
import { useEffect, useRef, useState } from 'react'
import {
  createViewer,
  setViewerConfig,
  PerspectiveCamera,
  BackgroundMode,
  Vector3,
  Color,
  SplatLoader,
  SplatUtils,
} from '@manycore/aholo-viewer'

export function OfficeViewer({ url }: { url: string }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState('加载中…')

  useEffect(() => {
    const el = hostRef.current
    if (!el) return
    let stopped = false

    ;(async () => {
      try {
        const viewer = createViewer('office-viewer', el, {})
        const camera = new PerspectiveCamera(
          60,
          Math.max(0.1, el.clientWidth / Math.max(1, el.clientHeight)),
          0.1,
          2000
        )
        const resp = await fetch(url)
        if (!resp.ok) throw new Error(`fetch ${resp.status}`)
        const buffer = await resp.arrayBuffer()
        const fileType = url.toLowerCase().endsWith('.ply')
          ? SplatLoader.SplatFileType.PLY
          : SplatLoader.SplatFileType.SPZ
        const data = await SplatLoader.parseSplatData(
          fileType,
          new Uint8Array(buffer),
          SplatLoader.SplatPackType.Compressed
        )
        const splat = await SplatUtils.createSplat(data)
        if (stopped) return

        // 3DGS 为 OpenCV 坐标系（-Y 朝上）
        // 自动取景：dense box 决定"看什么"，全量点云包围盒决定"站多远"。
        // 只按 dense box 定距离会把相机留在飘在外围的点云里（画面糊成一片噪点）。
        camera.up.set(0, -1, 0)
        try {
          const operator = new SplatUtils.SplatOperator(splat, data)
          const { boxMin, boxMax } = SplatUtils.computeDenseBox(operator, 0.9)
          const c: [number, number, number] = [
            (boxMin[0] + boxMax[0]) / 2,
            (boxMin[1] + boxMax[1]) / 2,
            (boxMin[2] + boxMax[2]) / 2,
          ]

          let fMin = [Infinity, Infinity, Infinity]
          let fMax = [-Infinity, -Infinity, -Infinity]
          operator.foreachSplatCenter((_i, x, y, z) => {
            const p = [x, y, z]
            for (let k = 0; k < 3; k++) {
              fMin[k] = Math.min(fMin[k], p[k])
              fMax[k] = Math.max(fMax[k], p[k])
            }
          })
          // dense 中心到全量包围盒最远角的距离：用于判断"飘点外壳"有多厚
          let radius = 0
          for (const mx of [fMin[0], fMax[0]])
            for (const my of [fMin[1], fMax[1]])
              for (const mz of [fMin[2], fMax[2]])
                radius = Math.max(radius, Math.hypot(mx - c[0], my - c[1], mz - c[2]))
          // 取景取"全量外壳之外"：按 dense box 站近会被飘点糊满屏（实测两种都试过），
          // 站在外壳外至少能看全整个空间模型，细节靠滚轮缩放
          const d = Math.max(6, radius * 1.6)
          const inv = 1 / Math.hypot(0.78, 0.42, 0.78)
          camera.position.set(
            c[0] + 0.78 * inv * d,
            c[1] - 0.42 * inv * d,
            c[2] + 0.78 * inv * d
          )
          camera.lookAt(new Vector3(c[0], c[1], c[2]))
          console.log(
            `[office] dense=[${boxMin.map((v) => v.toFixed(2))}]..[${boxMax
              .map((v) => v.toFixed(2))
              .join(',')}] full=[${fMin.map((v) => v.toFixed(2))}]..[${fMax
              .map((v) => v.toFixed(2))
              .join(',')}] radius=${radius.toFixed(2)} dist=${d.toFixed(2)}`
          )
        } catch {
          // 兜底：人工位姿
          camera.position.set(-3.4, -1.4, 2.2)
          camera.lookAt(new Vector3(-0.5, -0.2, -0.8))
        }
        viewer.getScene().add(splat)
        viewer.setCamera(camera)
        setViewerConfig(viewer, {
          pipeline: {
            Background: {
              background: {
                active: BackgroundMode.BasicBackground,
                basic: { color: new Color(0.09, 0.11, 0.13) },
              },
              ground: { enabled: false },
            },
            Splatting: { enabled: true },
            TAA: { enabled: false },
          },
        })

        const render = () => {
          if (!stopped) viewer.render()
        }
        viewer.requestRenderHandler = () => requestAnimationFrame(render)
        requestAnimationFrame(render)
        setStatus(`就绪（${(buffer.byteLength / 1e6).toFixed(1)}MB · ${fileType === SplatLoader.SplatFileType.PLY ? 'PLY' : 'SPZ'} · Aholo Viewer）`)
      } catch (e) {
        setStatus('加载失败: ' + (e instanceof Error ? e.message : String(e)))
      }
    })()

    return () => {
      stopped = true
    }
  }, [url])

  return (
    <div className="office-viewer">
      <div ref={hostRef} className="office-host" />
      <div className="office-status">{status}</div>
      <div className="office-hint">左键拖拽旋转 · 滚轮缩放 · 右键平移</div>
    </div>
  )
}
