import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Footer } from './components/Footer'
import { EnrollmentModal } from './components/EnrollmentModal'
import { Header } from './components/Header'
import { HomeHero } from './components/HomeHero'
import { InternalPage } from './components/InternalPage'
import { LegacyPage } from './components/LegacyPage'
import { pageTitles } from './navigation'

function ScrollManager() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [pathname])
  return null
}

export function App() {
  const { pathname } = useLocation()
  return <>
    <ScrollManager />
    <Header />
    {pathname === '/' && <HomeHero />}
    <main id="main-content">
      <Routes>
        {Object.keys(pageTitles).map(path => (
          <Route key={path} path={path} element={path === '/' ? <LegacyPage /> : <InternalPage />} />
        ))}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </main>
    <Footer />
    <EnrollmentModal />
  </>
}
