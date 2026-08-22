import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from 'react-router-dom';

import { AuthProvider } from '@/hooks/useAuth';
import { ToastProvider } from '@/hooks/useToast';

import ProtectedRoute from '@/components/ProtectedRoute';
import AdminLayout from '@/layouts/AdminLayout';

import Login from '@/pages/Login';
import ResetPassword from '@/pages/ResetPassword';
import Dashboard from '@/pages/Dashboard';
import Students from '@/pages/Students';
import Courses from '@/pages/Courses';
import Enrollments from '@/pages/Enrollments';
import StudentProfile from '@/pages/StudentProfile';
import Attendance from '@/pages/Attendance';
import Fees from '@/pages/Fees';
import Exams from '@/pages/Exams';
import Certificates from '@/pages/Certificates';
import Reports from '@/pages/Reports';
import ComingSoon from '@/pages/ComingSoon';

/**
 * Root route handler for GitHub Pages SPA support.
 * When 404.html redirects back to /?redirect=/some-route,
 * this component navigates to that route instead of /dashboard.
 */
function RootRedirect() {
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect');
  if (redirect) {
    return <Navigate to={redirect} replace />;
  }
  return <Navigate to="/dashboard" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter basename="/SITH_Student_Management">
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Protected Routes */}
            <Route
              element={
                <ProtectedRoute>
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/students" element={<Students />} />
              <Route path="/students/:id" element={<StudentProfile />} />
              <Route path="/courses" element={<Courses />} />
              <Route path="/enrollments" element={<Enrollments />} />
              <Route path="/attendance" element={<Attendance />} />
              <Route path="/fees" element={<Fees />} />
              <Route path="/exams" element={<Exams />} />
              <Route path="/certificates" element={<Certificates />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/settings" element={<ComingSoon />} />
            </Route>

            {/* Default Route — honors ?redirect= from GitHub Pages 404 redirect */}
            <Route
              path="/"
              element={<RootRedirect />}
            />

            {/* Unknown Routes */}
            <Route
              path="*"
              element={<Navigate to="/login" replace />}
            />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}