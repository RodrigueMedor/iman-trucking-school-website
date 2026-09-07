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
import { CDLReadinessAssessment } from './pages/CDLReadinessAssessment'
import { CDLReadinessResults } from './pages/CDLReadinessResults'
import { CDLRegister } from './pages/CDLRegister'
import { CDLLogin } from './pages/CDLLogin'
import { ClassApplication } from './pages/ClassApplication'
import { CDLScoreManagement } from './pages/admin/CDLScoreManagement'
import { CDLApplications } from './pages/admin/CDLApplications'
import { CDLEnrollments } from './pages/admin/CDLEnrollments'
import { CDLInstructorDashboard } from './pages/admin/CDLInstructorDashboard'

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
            <Route path="cdl-scores/" element={<CDLScoreManagement />} />
            <Route path="cdl-applications/" element={<CDLApplications />} />
            <Route path="cdl-enrollments/" element={<CDLEnrollments />} />
            <Route path="cdl-instructor/" element={<CDLInstructorDashboard />} />
          </Route>
        </Route>
        <Route path="/cdl-register/" element={<CDLRegister />} />
        <Route path="/cdl-login/" element={<CDLLogin />} />
        <Route path="/cdl-readiness/" element={<CDLReadinessAssessment />} />
        <Route path="/cdl-readiness-results/" element={<CDLReadinessResults />} />
        <Route path="/class-application/" element={<ClassApplication />} />
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
