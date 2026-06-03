import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { ToastProvider } from './hooks/useToast';
import Navbar       from './components/Navbar';
import { Spinner }  from './components/UI';

import Login        from './pages/Login';
import Register     from './pages/Register';
import Dashboard    from './pages/Dashboard';
import Courses      from './pages/Courses';
import CourseDetail from './pages/CourseDetail';
import VideoPlayer  from './pages/VideoPlayer';
import Analytics    from './pages/Analytics';
import Profile      from './pages/Profile';
import PlanYourDay  from './pages/PlanYourDay';

/* ─── Protected layout ──────────────────────────────────────────────────── */
function ProtectedLayout({ children }) {
  const { token, loading } = useAuth();
  if (loading) return <Spinner pad={120} />;
  if (!token)  return <Navigate to="/login" replace />;
  return (
    <>
      <Navbar />
      <main>{children}</main>
    </>
  );
}

/* ─── App ───────────────────────────────────────────────────────────────── */
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            {/* Public */}
            <Route path="/login"    element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Protected */}
            <Route path="/" element={
              <ProtectedLayout><Dashboard /></ProtectedLayout>
            } />
            <Route path="/courses" element={
              <ProtectedLayout><Courses /></ProtectedLayout>
            } />
            <Route path="/courses/:id" element={
              <ProtectedLayout><CourseDetail /></ProtectedLayout>
            } />
            <Route path="/courses/:courseId/watch/:videoId" element={
              <ProtectedLayout><VideoPlayer /></ProtectedLayout>
            } />
            <Route path="/analytics" element={
              <ProtectedLayout><Analytics /></ProtectedLayout>
            } />
            <Route path="/plan" element={
              <ProtectedLayout><PlanYourDay /></ProtectedLayout>
            } />
            <Route path="/profile" element={
              <ProtectedLayout><Profile /></ProtectedLayout>
            } />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
