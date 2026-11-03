import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/manrope/latin-400.css'
import '@fontsource/manrope/latin-600.css'
import '@fontsource/manrope/latin-800.css'
import './sillage.css'
import Discovery from './Discovery.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Discovery />
  </StrictMode>,
)
