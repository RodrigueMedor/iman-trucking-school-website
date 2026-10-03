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
import { SuperAdminRoute } from './components/admin/SuperAdminRoute'
import { AdminLayout } from './components/admin/AdminLayout'
import { AdminLogin } from './pages/AdminLogin'
import { AdminDashboard } from './pages/AdminDashboard'
import { AdminContent } from './pages/AdminContent'
import { AdminResetPassword } from './pages/AdminResetPassword'
import { CreateInstructor } from './pages/admin/CreateInstructor'
import { CDLScoreManagement } from './pages/admin/CDLScoreManagement'
import { CDLApplications } from './pages/admin/CDLApplications'
import { CDLEnrollments } from './pages/admin/CDLEnrollments'
import { CDLInstructorDashboard } from './pages/admin/CDLInstructorDashboard'
import { FinancingReferrals } from './pages/admin/FinancingReferrals'
import { PortalAuth } from './portal/PortalAuth'
import { RequireStudent } from './portal/RequireStudent'
import { PortalLayout } from './portal/PortalLayout'
import { Dashboard } from './portal/pages/Dashboard'
import { ApplicationWizard } from './portal/pages/ApplicationWizard'
import { ApplicationsList } from './portal/pages/ApplicationsList'
import { ApplicationDetail } from './portal/pages/ApplicationDetail'
import { Confirmation } from './portal/pages/Confirmation'
import { DocumentsPage } from './portal/pages/DocumentsPage'
import { SchedulePage } from './portal/pages/SchedulePage'
import { ProfilePage } from './portal/pages/ProfilePage'
import { AssessmentTest } from './portal/pages/AssessmentTest'

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
  // The portal has its own shell; the public header/footer show everywhere else.
  const publicChrome = !admin && !pathname.startsWith('/portal')
  return <>
    <ScrollManager />
    {publicChrome && <Header />}
    {publicChrome && pathname === '/' && <HomeHero />}
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
            <Route path="financing-referrals/" element={<FinancingReferrals />} />
            <Route path="cdl-enrollments/" element={<CDLEnrollments />} />
            <Route path="cdl-instructor/" element={<CDLInstructorDashboard />} />
          </Route>
        </Route>
        <Route element={<SuperAdminRoute />}>
          <Route path="/admin/create-instructor/" element={<CreateInstructor />} />
        </Route>
        <Route path="/portal/sign-in" element={<PortalAuth mode="sign-in" />} />
        <Route path="/portal/register" element={<PortalAuth mode="register" />} />
        <Route path="/portal/forgot-password" element={<PortalAuth mode="forgot" />} />
        <Route path="/portal/reset-password" element={<PortalAuth mode="reset" />} />
        <Route element={<RequireStudent />}>
          <Route path="/portal/" element={<PortalLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="apply/training" element={<ApplicationWizard key="TRAINING" type="TRAINING" />} />
            <Route path="apply/assessment" element={<ApplicationWizard key="ASSESSMENT" type="ASSESSMENT" />} />
            <Route path="applications/" element={<ApplicationsList />} />
            <Route path="applications/:id" element={<ApplicationDetail />} />
            <Route path="applications/:id/confirmation" element={<Confirmation />} />
            <Route path="documents/" element={<DocumentsPage />} />
            <Route path="schedule/" element={<SchedulePage />} />
            <Route path="profile/" element={<ProfilePage />} />
            <Route path="assessment/test/:applicationId" element={<AssessmentTest />} />
            <Route path="*" element={<Navigate to="/portal/" replace />} />
          </Route>
        </Route>
        {/* Retired URLs */}
        <Route path="/cdl-login/" element={<Navigate to="/portal/sign-in" replace />} />
        <Route path="/cdl-register/" element={<Navigate to="/portal/register" replace />} />
        <Route path="/class-application/" element={<Navigate to="/portal/apply/training" replace />} />
        <Route path="/cdl-readiness/" element={<Navigate to="/cdl-assessment/" replace />} />
        <Route path="/cdl-readiness-results/" element={<Navigate to="/portal/applications/" replace />} />
        <Route path="/dispatcher-registration/" element={<Navigate to="/" replace />} />
        <Route path="/admin/dispatcher-registrations/" element={<Navigate to="/admin/" replace />} />
        <Route path="/admin/dispatcher-classes/" element={<Navigate to="/admin/" replace />} />
        {Object.keys(pageTitles).map(path => (
          <Route key={path} path={path} element={path === '/' ? <HomePage /> : <InternalPage />} />
        ))}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </main>
    {publicChrome && <Footer />}
    {publicChrome && <EnrollmentModal />}
  </>
}
