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
    // viewer 实例要在 cleanup 里 destroy：aholo-viewer 的 Viewer.destroy() 会
    // "release the resource of engine and remove bounded canvas"（见其 index.d.ts）。
    // 不销毁 → 反复切场景/换下拉项会泄漏 WebGL 上下文（浏览器上限约 8–16 个）。
    let viewerInstance: ReturnType<typeof createViewer> | null = null

    ;(async () => {
      try {
        const viewer = createViewer('office-viewer', el, {})
        viewerInstance = viewer
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
          // 点距采样（决策：取景半径不再由最远离群点决定——一颗飘点曾把相机推到
          // 极远，房间缩成一条竖板；改用 98 分位点距，相机在 98% 点云之外）
          const dists: number[] = []
          operator.foreachSplatCenter((_i, x, y, z) => {
            const p = [x, y, z]
            for (let k = 0; k < 3; k++) {
              fMin[k] = Math.min(fMin[k], p[k])
              fMax[k] = Math.max(fMax[k], p[k])
            }
            dists.push(Math.hypot(x - c[0], y - c[1], z - c[2]))
          })
          // dense 中心到全量包围盒最远角的距离：仅用于诊断日志
          let radius = 0
          for (const mx of [fMin[0], fMax[0]])
            for (const my of [fMin[1], fMax[1]])
              for (const mz of [fMin[2], fMax[2]])
                radius = Math.max(radius, Math.hypot(mx - c[0], my - c[1], mz - c[2]))
          dists.sort((a, b) => a - b)
          const p98 = dists[Math.min(dists.length - 1, Math.floor(dists.length * 0.98))] ?? 6
          // 取景（决策纸⑥v5）：d = p98×1.15（98% 点云之外，离群点不再绑架机位），
          // 方向由 ?officeCam=仰角,方位角 覆盖（截图确定性测试缝，同 ?hour= 惯例）。
          // 默认 elev 0.10 / azim 0：六机位接触表（docs/figures/office-cam-sweep/）选出的
          // 最不坏正面像——该 SPZ 生成物本身是纵向柱状低质扫描，机位只能选呈现方式，
          // 资产重生成是独立任务（需 Aholo 生成配额）。
          const d = Math.max(6, p98 * 1.15)
          const oc = new URLSearchParams(window.location.search).get('officeCam')
          let elev = 0.1
          let azim = 0
          if (oc) {
            const [e, a] = oc.split(',').map(Number)
            if (Number.isFinite(e)) elev = e
            if (Number.isFinite(a)) azim = a
          }
          // 球坐标方向（OpenCV -Y 朝上：仰角抬高 = y 减小）
          const dirX = Math.sin(azim) * Math.cos(elev)
          const dirZ = Math.cos(azim) * Math.cos(elev)
          const dirY = -Math.sin(elev)
          camera.position.set(c[0] + dirX * d, c[1] + dirY * d, c[2] + dirZ * d)
          camera.lookAt(new Vector3(c[0], c[1], c[2]))
          console.log(
            `[office] dense=[${boxMin.map((v) => v.toFixed(2))}]..[${boxMax
              .map((v) => v.toFixed(2))
              .join(',')}] full=[${fMin.map((v) => v.toFixed(2))}]..[${fMax
                .map((v) => v.toFixed(2))
                .join(',')}] radius=${radius.toFixed(2)} p98=${p98.toFixed(2)} dist=${d.toFixed(2)} elev=${elev.toFixed(2)} azim=${azim.toFixed(2)}`
          )
        } catch {
          // 兜底：人工位姿
          camera.position.set(-3.4, -1.4, 2.2)
          camera.lookAt(new Vector3(-0.5, -0.2, -0.8))
        }
        viewer.getScene().add(splat)
        viewer.setCamera(camera)
        // 诊断钩子（先例：StreetScene 的 __st/__cam）：取景调试用
        ;(window as unknown as Record<string, unknown>).__officeCam = camera
        ;(window as unknown as Record<string, unknown>).__officeViewer = viewer
        ;(window as unknown as Record<string, unknown>).__officeSplat = splat
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
      // 释放引擎资源与 canvas（否则反复切场景会累积 WebGL 上下文）
      try {
        viewerInstance?.destroy()
      } catch (e) {
        console.warn('[office] viewer.destroy() 失败：', e)
      }
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
