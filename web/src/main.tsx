import { createRoot } from 'react-dom/client'
import App from './App'
import '../generated/design-tokens.output.css'
import './styles.css'

createRoot(document.getElementById('root')!).render(<App />)
