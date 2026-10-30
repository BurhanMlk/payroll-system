import { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import { AppLayout } from "./layouts/AppLayout";
import { Skeleton } from "./components/ui/skeleton";

import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";
import LandingPage from "./pages/LandingPage";
import EmployeePortalLoginPage from "./pages/employee/EmployeePortalLoginPage";
import EmployeePortalDashboard from "./pages/employee/EmployeePortalDashboard";
import StudentPortalLoginPage from "./pages/student/StudentPortalLoginPage";
import StudentPortalDashboard from "./pages/student/StudentPortalDashboard";
import DashboardPage from "./pages/tenant/DashboardPage";
import EmployeesPage from "./pages/tenant/EmployeesPage";
import StudentsPage from "./pages/tenant/StudentsPage";
import StudentAttendancePage from "./pages/tenant/StudentAttendancePage";
import StudentFeesPage from "./pages/tenant/StudentFeesPage";
import StudentFeesDuePage from "./pages/tenant/StudentFeesDuePage";
import EmployeeLookupPage from "./pages/tenant/EmployeeLookupPage";
import OrgListPage from "./pages/tenant/OrgListPage";
import AttendancePage from "./pages/tenant/AttendancePage";
import MarkAttendancePage from "./pages/tenant/MarkAttendancePage";
import ShiftsPage from "./pages/tenant/ShiftsPage";
import HolidaysPage from "./pages/tenant/HolidaysPage";
import LeavePage from "./pages/tenant/LeavePage";
import LeaveTypesPage from "./pages/tenant/LeaveTypesPage";
import PayrollPage from "./pages/tenant/PayrollPage";
import PayslipsPage from "./pages/tenant/PayslipsPage";
import SalaryPage from "./pages/tenant/SalaryPage";
import SalaryOverviewPage from "./pages/tenant/SalaryOverviewPage";
import LoansPage from "./pages/tenant/LoansPage";
import AdvancesPage from "./pages/tenant/AdvancesPage";
import BillingPage from "./pages/tenant/BillingPage";
import ReportsPage from "./pages/tenant/ReportsPage";
import NotificationsPage from "./pages/tenant/NotificationsPage";
import SettingsPage from "./pages/tenant/SettingsPage";
import PlatformDashboardPage from "./pages/platform/PlatformDashboardPage";
import InstitutionsPage from "./pages/platform/InstitutionsPage";
import InstitutionDetailPage from "./pages/platform/InstitutionDetailPage";
import SubscriptionsPage from "./pages/platform/SubscriptionsPage";
import PlansPage from "./pages/platform/PlansPage";
import RevenuePage from "./pages/platform/RevenuePage";
import AuditLogsPage from "./pages/platform/AuditLogsPage";
import JobsPage from "./pages/platform/JobsPage";
import PlatformSettingsPage from "./pages/platform/PlatformSettingsPage";
import LockedAccountsPage from "./pages/platform/LockedAccountsPage";

function FullPageLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Skeleton className="h-8 w-8 rounded-full" />
    </div>
  );
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <FullPageLoading />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequirePlatform({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (user?.scope !== "PLATFORM") return <Navigate to="/app" replace />;
  return <>{children}</>;
}

function RequireTenant({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (user?.scope === "PLATFORM") return <Navigate to="/platform" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/employee" element={<EmployeePortalLoginPage />} />
      <Route path="/employee/portal" element={<EmployeePortalDashboard />} />
      <Route path="/student" element={<StudentPortalLoginPage />} />
      <Route path="/student/portal" element={<StudentPortalDashboard />} />

      <Route
        path="/app"
        element={
          <RequireAuth>
            <RequireTenant>
              <AppLayout />
            </RequireTenant>
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="students" element={<StudentsPage />} />
        <Route path="students/attendance" element={<StudentAttendancePage />} />
        <Route path="students/fees" element={<StudentFeesPage />} />
        <Route path="students/fees-due" element={<StudentFeesDuePage />} />
        <Route path="employees" element={<EmployeesPage />} />
        <Route path="employee-lookup" element={<EmployeeLookupPage />} />
        <Route path="departments" element={<OrgListPage kind="departments" />} />
        <Route path="designations" element={<OrgListPage kind="designations" />} />
        <Route path="branches" element={<OrgListPage kind="branches" />} />
        <Route path="attendance" element={<AttendancePage />} />
        <Route path="attendance/mark" element={<MarkAttendancePage />} />
        <Route path="shifts" element={<ShiftsPage />} />
        <Route path="holidays" element={<HolidaysPage />} />
        <Route path="leave" element={<LeavePage />} />
        <Route path="leave/types" element={<LeaveTypesPage />} />
        <Route path="payroll" element={<PayrollPage />} />
        <Route path="payslips" element={<PayslipsPage />} />
        <Route path="salary" element={<SalaryPage />} />
        <Route path="salaries" element={<SalaryOverviewPage />} />
        <Route path="loans" element={<LoansPage />} />
        <Route path="advances" element={<AdvancesPage />} />
        <Route path="billing" element={<BillingPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      <Route
        path="/platform"
        element={
          <RequireAuth>
            <RequirePlatform>
              <AppLayout />
            </RequirePlatform>
          </RequireAuth>
        }
      >
        <Route index element={<PlatformDashboardPage />} />
        <Route path="institutions" element={<InstitutionsPage />} />
        <Route path="institutions/:id" element={<InstitutionDetailPage />} />
        <Route path="subscriptions" element={<SubscriptionsPage />} />
        <Route path="plans" element={<PlansPage />} />
        <Route path="revenue" element={<RevenuePage />} />
        <Route path="audit" element={<AuditLogsPage />} />
        <Route path="jobs" element={<JobsPage />} />
        <Route path="locked-accounts" element={<LockedAccountsPage />} />
        <Route path="settings" element={<PlatformSettingsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
