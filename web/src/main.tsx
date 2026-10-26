import { createRoot } from 'react-dom/client'
import App from './App'
import '../generated/design-tokens.output.css'
import './styles.css'
// 玻璃浮层垫实底（对比度修正）——必须在 styles.css 之后导入，
// 否则同优先级下层叠顺序不对，实底可能不生效。
import './styles/glass-underlay.css'

createRoot(document.getElementById('root')!).render(<App />)
