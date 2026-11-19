import { ReactNode, Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import { AppLayout } from "./layouts/AppLayout";

// Lazy-loaded pages for ultra-fast instant startup and smooth on-demand loading
const LoginPage = lazy(() => import("./pages/auth/LoginPage"));
const RegisterPage = lazy(() => import("./pages/auth/RegisterPage"));
const LandingPage = lazy(() => import("./pages/LandingPage"));
const EmployeePortalLoginPage = lazy(() => import("./pages/employee/EmployeePortalLoginPage"));
const EmployeePortalDashboard = lazy(() => import("./pages/employee/EmployeePortalDashboard"));
const StudentPortalLoginPage = lazy(() => import("./pages/student/StudentPortalLoginPage"));
const StudentPortalDashboard = lazy(() => import("./pages/student/StudentPortalDashboard"));
const DashboardPage = lazy(() => import("./pages/tenant/DashboardPage"));
const EmployeesPage = lazy(() => import("./pages/tenant/EmployeesPage"));
const StudentsPage = lazy(() => import("./pages/tenant/StudentsPage"));
const StudentAttendancePage = lazy(() => import("./pages/tenant/StudentAttendancePage"));
const StudentFeesPage = lazy(() => import("./pages/tenant/StudentFeesPage"));
const StudentFeesDuePage = lazy(() => import("./pages/tenant/StudentFeesDuePage"));
const EmployeeLookupPage = lazy(() => import("./pages/tenant/EmployeeLookupPage"));
const OrgListPage = lazy(() => import("./pages/tenant/OrgListPage"));
const AttendancePage = lazy(() => import("./pages/tenant/AttendancePage"));
const MarkAttendancePage = lazy(() => import("./pages/tenant/MarkAttendancePage"));
const ShiftsPage = lazy(() => import("./pages/tenant/ShiftsPage"));
const HolidaysPage = lazy(() => import("./pages/tenant/HolidaysPage"));
const LeavePage = lazy(() => import("./pages/tenant/LeavePage"));
const LeaveTypesPage = lazy(() => import("./pages/tenant/LeaveTypesPage"));
const PayrollPage = lazy(() => import("./pages/tenant/PayrollPage"));
const PayslipsPage = lazy(() => import("./pages/tenant/PayslipsPage"));
const SalaryPage = lazy(() => import("./pages/tenant/SalaryPage"));
const SalaryOverviewPage = lazy(() => import("./pages/tenant/SalaryOverviewPage"));
const LoansPage = lazy(() => import("./pages/tenant/LoansPage"));
const AdvancesPage = lazy(() => import("./pages/tenant/AdvancesPage"));
const BillingPage = lazy(() => import("./pages/tenant/BillingPage"));
const ReportsPage = lazy(() => import("./pages/tenant/ReportsPage"));
const NotificationsPage = lazy(() => import("./pages/tenant/NotificationsPage"));
const SettingsPage = lazy(() => import("./pages/tenant/SettingsPage"));
const PlatformDashboardPage = lazy(() => import("./pages/platform/PlatformDashboardPage"));
const InstitutionsPage = lazy(() => import("./pages/platform/InstitutionsPage"));
const InstitutionDetailPage = lazy(() => import("./pages/platform/InstitutionDetailPage"));
const SubscriptionsPage = lazy(() => import("./pages/platform/SubscriptionsPage"));
const PlansPage = lazy(() => import("./pages/platform/PlansPage"));
const RevenuePage = lazy(() => import("./pages/platform/RevenuePage"));
const AuditLogsPage = lazy(() => import("./pages/platform/AuditLogsPage"));
const JobsPage = lazy(() => import("./pages/platform/JobsPage"));
const PlatformSettingsPage = lazy(() => import("./pages/platform/PlatformSettingsPage"));
const LockedAccountsPage = lazy(() => import("./pages/platform/LockedAccountsPage"));

function PageLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
    </div>
  );
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoading />;
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
    <Suspense fallback={<PageLoading />}>
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
    </Suspense>
  );
}
