// 资产级容错：单个 GLB 加载失败只降级该资产，绝不拖垮整个 3D 场景。
//
// 背景（2026-11-05 真机体验事故）：vivo 手机 5G 网络下点摊位触发 HR GLB
// （hr-f03-idle.glb / hr-m03-idle.glb）fetch 失败，异常冒泡到 SceneErrorBoundary，
// 整个「招聘街区」崩成失败页，已逛的状态全丢 —— 这是移动端体验最恶劣的一条。
//
// 策略（三层）：
//   ① fetch 预检 + 重试：成功才渲染 useGLTF 子树，避免 rejected promise 进 drei 全局缓存
//      （一旦进缓存，重挂载也会直接复用失败结果，必须先绕开）
//   ② 局部 ErrorBoundary：解析/渲染阶段再抛错也只降级本资产
//   ③ 失败渲染传入的占位体（不透明 3D 形体），街区照常可逛
import { Component, type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { useGLTF } from '@react-three/drei'

/**
 * 状态化 GLB 加载（不走 Suspense）：
 * useGLTF 的 promise rejection 不可靠地被 ErrorBoundary 拦截（React 对
 * Suspense reject 的边界行为在不同版本/并发路径下不一致，2026-11-05 真机
 * 排查中实测错误穿透到外层边界），所以关键资产改用 GLTFLoader 手动加载，
 * 失败只翻状态、绝不抛出。
 */
export function useGLTFState(
  url: string,
  dracoPath?: string,
  retries = 2
): {
  status: 'loading' | 'ready' | 'failed'
  scene: THREE.Group | null
  animations: THREE.AnimationClip[]
} {
  const [state, setState] = useState<{
    status: 'loading' | 'ready' | 'failed'
    scene: THREE.Group | null
    animations: THREE.AnimationClip[]
  }>({ status: 'loading', scene: null, animations: [] })
  const retriesRef = useRef(retries)
  retriesRef.current = retries

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading', scene: null, animations: [] })
    const loader = new GLTFLoader()
    if (dracoPath) {
      const draco = new DRACOLoader()
      draco.setDecoderPath(dracoPath)
      loader.setDRACOLoader(draco)
    }
    let attempt = 0
    const tryLoad = () => {
      loader.load(
        url,
        (gltf) => {
          if (!cancelled) setState({ status: 'ready', scene: gltf.scene as THREE.Group, animations: gltf.animations ?? [] })
        },
        undefined,
        () => {
          if (cancelled) return
          attempt++
          if (attempt <= retriesRef.current) window.setTimeout(tryLoad, 500 * attempt)
          else setState({ status: 'failed', scene: null, animations: [] })
        }
      )
    }
    tryLoad()
    return () => {
      cancelled = true
    }
  }, [url, dracoPath])

  return state
}

// ── 局部边界：捕获子树渲染错误，降级到占位体 ──
class AssetBoundary extends Component<
  { fallback: ReactNode; onError: () => void; children: ReactNode },
  { error: boolean }
> {
  state = { error: false }
  static getDerivedStateFromError() {
    return { error: true }
  }
  componentDidCatch(error: unknown) {
    console.warn('[SafeGLTF] 资产渲染失败，降级占位体：', error)
    this.props.onError()
  }
  render() {
    return this.state.error ? this.props.fallback : this.props.children
  }
}

export function SafeGLTF({
  urls,
  fallback,
  children,
  retries = 2,
}: {
  /** 该资产依赖的全部 GLB/资源 URL（预检全部通过才渲染子树） */
  urls: string | string[]
  /** 加载失败时渲染的 3D 占位体（R3F 元素，不是 DOM） */
  fallback: ReactNode
  children: ReactNode
  /** 每个 URL 的额外重试次数（不含首次） */
  retries?: number
}) {
  const list = useMemo(() => (Array.isArray(urls) ? urls : [urls]), [urls])
  const key = list.join('|')
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [attempt, setAttempt] = useState(0)
  const [giveUp, setGiveUp] = useState(false)

  // 子树抛错（GLTF 解析/渲染阶段）时：清 drei 全局缓存里被拒的 promise 再有限重试。
  // 不清缓存的话重挂载会立刻复用 rejected promise → 死循环，最终拖垮外层边界
  // （2026-11-05 真机排查：avatar-idle.glb Failed to fetch 沿此路径炸掉整个街区）。
  const handleSubtreeError = () => {
    for (const u of list) {
      try {
        useGLTF.clear(u)
      } catch {
        /* API 不可用时忽略 */
      }
    }
    if (attempt >= retries) {
      setGiveUp(true)
      return
    }
    setAttempt((a) => a + 1)
  }

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    ;(async () => {
      for (const url of list) {
        let ok = false
        for (let i = 0; i <= retries; i++) {
          try {
            // cache: 'no-store' —— 必须绕开 HTTP 缓存，否则 CDP/弱网下 fetch 从缓存拿到 200、
            // 而 GLTFLoader 实走网络失败，预检形同虚设（2026-11-05 真机排查）
            const res = await fetch(url, { cache: 'no-store' })
            if (res.ok) {
              ok = true
              break
            }
          } catch {
            /* 网络抖动，进入退避重试 */
          }
          await new Promise((r) => setTimeout(r, 500 * (i + 1)))
        }
        if (!ok) {
          if (!cancelled) setStatus('failed')
          return
        }
      }
      if (!cancelled) setStatus('ready')
    })()
    return () => {
      cancelled = true
    }
    // key 覆盖 list 内容变化；attempt 触发重新预检
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt, retries])

  if (status === 'failed' || giveUp) return <>{fallback}</>
  if (status === 'loading') return null
  return (
    <AssetBoundary key={attempt} fallback={fallback} onError={handleSubtreeError}>
      {children}
    </AssetBoundary>
  )
}

/**
 * 通用「人形占位体」：胶囊身体 + 球头，给 HR/Avatar 加载失败时兜底。
 * 不加载任何 GLB，纯几何，零网络依赖；配色由调用方传入以区分个体。
 */
export function GhostFigure({
  color = '#3d4c63',
  height = 1.6,
  position = [0, 0, 0] as [number, number, number],
}: {
  color?: string
  height?: number
  position?: [number, number, number]
}) {
  const bodyH = height * 0.62
  const headR = height * 0.12
  return (
    <group position={position}>
      <mesh position={[0, bodyH / 2, 0]}>
        <capsuleGeometry args={[height * 0.17, bodyH * 0.72, 4, 12]} />
        <meshStandardMaterial color={color} roughness={0.85} />
      </mesh>
      <mesh position={[0, bodyH + headR * 1.05, 0]}>
        <sphereGeometry args={[headR, 12, 10]} />
        <meshStandardMaterial color="#c9b7a4" roughness={0.8} />
      </mesh>
    </group>
  )
}
