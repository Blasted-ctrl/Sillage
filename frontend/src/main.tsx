import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './sillage.css'
import Discovery from './Discovery.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Discovery />
  </StrictMode>,
)
