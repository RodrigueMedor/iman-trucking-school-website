import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Footer } from './components/Footer'
import { EnrollmentModal } from './components/EnrollmentModal'
import { Header } from './components/Header'
import { HomeHero } from './components/HomeHero'
import { HomePage } from './components/HomePage'
import { InternalPage } from './components/InternalPage'
import { pageTitles } from './navigation'
import { ProtectedRoute } from './components/admin/ProtectedRoute'
import { AdminLayout } from './components/admin/AdminLayout'
import { AdminLogin } from './pages/AdminLogin'
import { AdminDashboard } from './pages/AdminDashboard'
import { AdminContent } from './pages/AdminContent'
import { AdminResetPassword } from './pages/AdminResetPassword'

function ScrollManager() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [pathname])
  return null
}

export function App() {
  const { pathname } = useLocation()
  const admin = pathname.startsWith('/admin/')
  return <>
    <ScrollManager />
    {!admin && <Header />}
    {!admin && pathname === '/' && <HomeHero />}
    <main id="main-content">
      <Routes>
        <Route path="/admin/login/" element={<AdminLogin />} />
        <Route path="/admin/reset-password/" element={<AdminResetPassword />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/admin/" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="content/" element={<AdminContent />} />
          </Route>
        </Route>
        {Object.keys(pageTitles).map(path => (
          <Route key={path} path={path} element={path === '/' ? <HomePage /> : <InternalPage />} />
        ))}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </main>
    {!admin && <Footer />}
    {!admin && <EnrollmentModal />}
  </>
}
