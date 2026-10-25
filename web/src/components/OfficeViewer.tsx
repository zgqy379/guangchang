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
        camera.up.set(0, -1, 0)
        camera.position.set(-2.5, -1.5, 0.5)
        camera.lookAt(new Vector3(0, 0, 0))
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
    </div>
  )
}
