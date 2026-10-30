import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  CalendarClock,
  Banknote,
  FileText,
  CreditCard,
  Settings,
  Menu,
  X,
  LogOut,
  School,
  ShieldCheck,
  Activity,
  Lock,
  CalendarCheck,
  Wallet,
  Search,
  GraduationCap,
  AlertCircle,
} from "lucide-react";
import { cn, initials } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import Logo from "@/components/Logo";

interface NavItem {
  label: string;
  to: string;
  icon: React.ReactNode;
}

interface NavSection {
  label?: string;
  items: NavItem[];
}

const tenantNav: NavSection[] = [
  { items: [{ label: "Overview", to: "/app", icon: <LayoutDashboard className="h-4 w-4" /> }] },
  {
    label: "People",
    items: [
      { label: "Employees", to: "/app/employees", icon: <Users className="h-4 w-4" /> },
      { label: "Employee Lookup", to: "/app/employee-lookup", icon: <Search className="h-4 w-4" /> },
      { label: "Branches", to: "/app/branches", icon: <School className="h-4 w-4" /> },
    ],
  },
  {
    label: "Attendance",
    items: [
      { label: "Daily Attendance", to: "/app/attendance", icon: <CalendarDays className="h-4 w-4" /> },
      { label: "Mark Attendance", to: "/app/attendance/mark", icon: <CalendarCheck className="h-4 w-4" /> },
      { label: "Shifts", to: "/app/shifts", icon: <CalendarClock className="h-4 w-4" /> },
      { label: "Holidays", to: "/app/holidays", icon: <CalendarDays className="h-4 w-4" /> },
    ],
  },
  {
    label: "Leave",
    items: [
      { label: "Leave Requests", to: "/app/leave", icon: <CalendarClock className="h-4 w-4" /> },
      { label: "Leave Types", to: "/app/leave/types", icon: <CalendarClock className="h-4 w-4" /> },
    ],
  },
  {
    label: "Payroll",
    items: [
      { label: "Payroll Runs", to: "/app/payroll", icon: <Banknote className="h-4 w-4" /> },
      { label: "Payslips", to: "/app/payslips", icon: <FileText className="h-4 w-4" /> },
      { label: "Salaries", to: "/app/salaries", icon: <Wallet className="h-4 w-4" /> },
    ],
  },
  {
    label: "Finance",
    items: [
      { label: "Loans", to: "/app/loans", icon: <CreditCard className="h-4 w-4" /> },
      { label: "Advances", to: "/app/advances", icon: <CreditCard className="h-4 w-4" /> },
    ],
  },
  { items: [{ label: "Reports", to: "/app/reports", icon: <FileText className="h-4 w-4" /> }] },
  {
    label: "Organization",
    items: [
      { label: "Billing", to: "/app/billing", icon: <CreditCard className="h-4 w-4" /> },
      { label: "Settings", to: "/app/settings", icon: <Settings className="h-4 w-4" /> },
    ],
  },
];

const studentNavSection: NavSection = {
  label: "Students",
  items: [
    { label: "Students", to: "/app/students", icon: <GraduationCap className="h-4 w-4" /> },
    { label: "Student Attendance", to: "/app/students/attendance", icon: <CalendarCheck className="h-4 w-4" /> },
    { label: "Student Fees", to: "/app/students/fees", icon: <CreditCard className="h-4 w-4" /> },
    { label: "Fees Due (Pending)", to: "/app/students/fees-due", icon: <AlertCircle className="h-4 w-4" /> },
  ],
};

const platformNav: NavSection[] = [
  { items: [{ label: "Dashboard", to: "/platform", icon: <LayoutDashboard className="h-4 w-4" /> }] },
  { items: [{ label: "Institutions", to: "/platform/institutions", icon: <School className="h-4 w-4" /> }] },
  { items: [{ label: "Subscriptions", to: "/platform/subscriptions", icon: <CreditCard className="h-4 w-4" /> }] },
  { items: [{ label: "Plans", to: "/platform/plans", icon: <Banknote className="h-4 w-4" /> }] },
  { items: [{ label: "Revenue", to: "/platform/revenue", icon: <Activity className="h-4 w-4" /> }] },
  { items: [{ label: "Audit Logs", to: "/platform/audit", icon: <ShieldCheck className="h-4 w-4" /> }] },
  { items: [{ label: "Locked Accounts", to: "/platform/locked-accounts", icon: <Lock className="h-4 w-4" /> }] },
  { items: [{ label: "System Jobs", to: "/platform/jobs", icon: <Activity className="h-4 w-4" /> }] },
];

function SidebarContent({ nav, onNavigate }: { nav: NavSection[]; onNavigate?: () => void }) {
  return (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
      {nav.map((section, i) => (
        <div key={i}>
          {section.label && (
            <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400/80">
              {section.label}
            </p>
          )}
          <div className="space-y-0.5">
            {section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/app" || item.to === "/platform"}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all",
                    isActive
                      ? "bg-gradient-to-r from-indigo-500 to-blue-600 text-white shadow-md shadow-indigo-900/40"
                      : "text-slate-300 hover:bg-white/10 hover:text-white",
                  )
                }
              >
                {item.icon}
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function AppLayout() {
  const { user, logout, isPlatform } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const isEducational =
    !user?.tenant?.institutionType ||
    ["COLLEGE", "SCHOOL", "UNIVERSITY", "ACADEMY"].includes(user.tenant.institutionType.toUpperCase());

  const nav = isPlatform
    ? platformNav
    : [
        tenantNav[0], // Overview
        ...(isEducational ? [studentNavSection] : []),
        ...tenantNav.slice(1),
      ];

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 border-r border-slate-800 bg-gradient-to-b from-slate-900 via-slate-900 to-indigo-950 text-slate-200 lg:flex lg:flex-col">
        <SidebarHeader name={user?.tenant?.name ?? "EduPayroll"} />
        <SidebarContent nav={nav} />
        <SidebarFooter name={user?.fullName ?? ""} onLogout={handleLogout} />
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 flex h-full w-64 flex-col bg-gradient-to-b from-slate-900 via-slate-900 to-indigo-950 text-slate-200">
            <div className="flex items-center justify-between p-4">
              <SidebarHeader name={user?.tenant?.name ?? "EduPayroll"} />
              <button onClick={() => setOpen(false)} className="rounded-md p-1 text-slate-300 hover:bg-white/10 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <SidebarContent nav={nav} onNavigate={() => setOpen(false)} />
            <SidebarFooter name={user?.fullName ?? ""} onLogout={handleLogout} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b bg-background px-4 lg:px-6">
          <button onClick={() => setOpen(true)} className="rounded-md p-1 hover:bg-accent lg:hidden">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1" />
          {!isPlatform && user?.tenant && (
            <Badge variant="outline" className="hidden sm:inline-flex">
              {user.tenant.name}
            </Badge>
          )}
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {initials(user?.fullName ?? "?")}
          </div>
        </header>
        <main className="flex-1 overflow-x-hidden p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function SidebarHeader({ name }: { name: string }) {
  return (
    <div className="flex h-14 items-center gap-2 border-b border-slate-800 px-4">
      <Logo className="h-7 w-7" />
      <span className="truncate text-sm font-semibold text-white">{name || "EduPayroll"}</span>
    </div>
  );
}

function SidebarFooter({ name, onLogout }: { name: string; onLogout: () => void }) {
  return (
    <div className="border-t border-slate-800 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 text-xs font-semibold text-white">
            {initials(name || "?")}
          </div>
          <span className="truncate text-sm text-slate-200">{name}</span>
        </div>
        <button onClick={onLogout} className="rounded-md p-1.5 text-slate-300 hover:bg-white/10 hover:text-white" title="Sign out">
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
