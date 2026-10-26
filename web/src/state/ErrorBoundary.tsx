// 错误边界：把「一个场景崩了」与「整站白屏」分开
//
// 为什么需要：docs/lessons.md §4 T8（线上白屏）的同构风险。
// OfficeViewer 用的是非 R3F 的 aholo-viewer，它一旦抛错就会冒泡到 React 根节点，
// 把整个应用炸成白屏 —— 而 T8 已经真实发生过一次（Draco 解码器 CDN 失效）。
//
// 两级用法：
//   ① ErrorBoundary —— 包在应用最外层，任何未捕获错误都给可读的降级页 + 重试按钮
//   ② SceneErrorBoundary —— 包在单个 3D 场景外，某场景崩了只降级该区域，其余 UI 照常
import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  /** 自定义降级 UI；不传则用默认降级页 */
  fallback?: ReactNode
  /** 场景标识，用于日志与降级文案（例："招聘街区"、"3DGS 办公室"） */
  label?: string
  /** 默认降级页是否用「场景级」紧凑样式（无全屏遮罩） */
  compact?: boolean
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // 原始错误必须打印出来，否则线上出问题无从排查（T8 教训）
    console.error(
      `[ErrorBoundary${this.props.label ? ` · ${this.props.label}` : ''}] 捕获到未处理错误：`,
      error,
      info.componentStack
    )
  }

  private reset = () => {
    this.setState({ error: null })
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    if (this.props.fallback) return this.props.fallback
    return <FallbackPane error={error} label={this.props.label} compact={this.props.compact} onRetry={this.reset} />
  }
}

/** 场景级错误边界：降级时只占该场景的区域，不遮挡其他 UI */
export function SceneErrorBoundary(props: Props) {
  return <ErrorBoundary compact {...props} />
}

function FallbackPane({
  error,
  label,
  compact,
  onRetry,
}: {
  error: Error
  label?: string
  compact?: boolean
  onRetry: () => void
}) {
  const style: React.CSSProperties = compact
    ? {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        height: '100%',
        minHeight: 180,
        padding: '24px 16px',
        color: 'var(--ui-ink-secondary, #b7c2cc)',
        fontSize: 13,
        textAlign: 'center',
      }
    : {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        minHeight: '100vh',
        padding: '32px',
        color: 'var(--ui-ink-primary, #e6edf3)',
        fontSize: 15,
        textAlign: 'center',
        background: 'var(--ui-page-bg, #0d1117)',
      }

  return (
    <div style={style} role="alert">
      <div style={{ fontSize: compact ? 15 : 18, fontWeight: 700, color: 'var(--ui-ink-primary, #e6edf3)' }}>
        {label ? `${label}加载失败` : '页面出错了'}
      </div>
      <div style={{ maxWidth: 460, lineHeight: 1.6 }}>
        这一块没能加载出来，其余部分仍可使用。可以重试，或刷新页面。
      </div>
      <div
        style={{
          fontSize: 11,
          opacity: 0.6,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          maxWidth: 460,
          wordBreak: 'break-word',
        }}
      >
        {error.message}
      </div>
      <button
        onClick={onRetry}
        style={{
          marginTop: 4,
          padding: '10px 20px',
          minHeight: 44,
          borderRadius: 12,
          border: '1px solid var(--ui-glass-border, rgba(255,255,255,0.18))',
          background: 'var(--color-brand-red-deep, #c23a2b)',
          color: '#fff',
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        重试
      </button>
    </div>
  )
}
