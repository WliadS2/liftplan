import { HomePage } from '../pages/HomePage'
import { lazy, Suspense } from 'react'

const MechanicalPreview = import.meta.env.DEV
  ? lazy(() => import('../dev/MechanicalPreview'))
  : undefined

export function App() {
  if (MechanicalPreview && window.location.pathname === '/dev/mechanical') {
    return <Suspense fallback={<p>Entwicklungsansicht wird geladen.</p>}><MechanicalPreview /></Suspense>
  }
  return <HomePage />
}
