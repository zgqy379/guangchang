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
        // 自动取景：按 splat 内容包围盒推导 Dollhouse 角视角（SPZ/PLY 尺度不可控，
        // 人工位姿会怼墙——2026-10-25 审查修复）
        camera.up.set(0, -1, 0)
        try {
          const operator = new SplatUtils.SplatOperator(splat, data)
          const { boxMin, boxMax } = SplatUtils.computeDenseBox(operator, 0.9)
          const c = [
            (boxMin[0] + boxMax[0]) / 2,
            (boxMin[1] + boxMax[1]) / 2,
            (boxMin[2] + boxMax[2]) / 2,
          ]
          const s = Math.max(
            boxMax[0] - boxMin[0],
            boxMax[1] - boxMin[1],
            boxMax[2] - boxMin[2]
          )
          const d = Math.max(2.5, s * 1.15)
          camera.position.set(c[0] + d * 0.72, c[1] - d * 0.5, c[2] + d * 0.72)
          camera.lookAt(new Vector3(c[0], c[1], c[2]))
          console.log('[office] dense box', { boxMin, boxMax, center: c, size: s })
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
