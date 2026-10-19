import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader, StatCard } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency } from "@/lib/utils";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from "recharts";
import { Users, UserCheck, CalendarClock, Banknote, FileCheck, BadgeCheck, CreditCard, ShieldCheck, BarChart3, ChartPie, Activity } from "lucide-react";

interface DashboardData {
  widgets: {
    totalEmployees: number;
    activeEmployees: number;
    onLeaveToday: number;
    presentToday: number;
    absentToday: number;
    lateToday: number;
    loansOutstanding: number;
    pendingLeaveApprovals: number;
    payrollProcessed: number;
    payrollPending: number;
    payrollPaid: number;
    payrollDraft: number;
    outstandingSalaries: number;
    monthlySalaryExpense: number;
    subscriptionDaysRemaining: number;
    subscriptionStatus: string | null;
    planName: string | null;
  };
  charts: {
    monthlyPayroll: { month: string; net: number; gross: number }[];
    attendanceByDay: { date: string; count: number }[];
    employeesByDepartment: { department: string; count: number }[];
    departmentExpense: { department: string; amount: number }[];
    payrollStatus: { status: string; count: number; sum: number }[];
  };
}

const COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#a855f7", "#ef4444", "#06b6d4"];

export default function DashboardPage() {
  const { user } = useAuth();
  const currency = user?.tenant?.currency ?? "USD";
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const res = await api.get("/dashboard");
      return res.data.data as DashboardData;
    },
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  const w = data.widgets;

  return (
    <div>
      <PageHeader
        title="Overview"
        description="Your institution at a glance"
        actions={
          <Badge variant="outline">
            {w.planName} · {w.subscriptionStatus?.toLowerCase()}
          </Badge>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Employees" value={w.totalEmployees} hint={`${w.activeEmployees} active`} icon={<Users className="h-5 w-5" />} gradient="from-indigo-500 to-blue-600" />
        <StatCard label="Present Today" value={w.presentToday} hint={`${w.absentToday} absent · ${w.lateToday} late`} icon={<UserCheck className="h-5 w-5" />} gradient="from-emerald-500 to-teal-600" />
        <StatCard label="On Leave Today" value={w.onLeaveToday} icon={<CalendarClock className="h-5 w-5" />} gradient="from-cyan-500 to-sky-600" />
        <StatCard label="Monthly Payroll" value={formatCurrency(w.monthlySalaryExpense, currency)} hint="salary expense this month" icon={<Banknote className="h-5 w-5" />} gradient="from-amber-500 to-orange-600" />
        <StatCard label="Payroll Processed" value={w.payrollProcessed} hint={`${w.payrollPending} pending review`} icon={<FileCheck className="h-5 w-5" />} gradient="from-violet-500 to-purple-600" />
        <StatCard label="Payroll Paid" value={w.payrollPaid} hint={`${w.payrollDraft} draft`} icon={<BadgeCheck className="h-5 w-5" />} gradient="from-green-500 to-emerald-600" />
        <StatCard label="Loans Outstanding" value={formatCurrency(w.loansOutstanding, currency)} icon={<CreditCard className="h-5 w-5" />} gradient="from-rose-500 to-red-600" />
        <StatCard label="Subscription" value={`${w.subscriptionDaysRemaining} days`} hint={w.subscriptionStatus?.toLowerCase()} icon={<ShieldCheck className="h-5 w-5" />} gradient="from-slate-500 to-slate-700" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-indigo-500" /> Monthly Payroll Trend
            </CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.charts.monthlyPayroll}>
                <defs>
                  <linearGradient id="netBar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#3b82f6" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="month" fontSize={12} axisLine={false} tickLine={false} />
                <YAxis fontSize={12} tickFormatter={(v) => `${currency} ${v / 1000}k`} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: number) => formatCurrency(v, currency)} cursor={{ fill: "#f1f5f9" }} />
                <Bar dataKey="net" name="Net Payroll" fill="url(#netBar)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ChartPie className="h-4 w-4 text-violet-500" /> Employees by Department
            </CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.charts.employeesByDepartment} dataKey="count" nameKey="department" innerRadius={55} outerRadius={90} paddingAngle={3} strokeWidth={2}>
                  {data.charts.employeesByDepartment.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-500" /> Attendance Trend (30 days)
            </CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.charts.attendanceByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="date" fontSize={11} axisLine={false} tickLine={false} />
                <YAxis fontSize={12} axisLine={false} tickLine={false} />
                <Tooltip />
                <Line type="monotone" dataKey="count" name="Records" stroke="#10b981" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-purple-500" /> Department Salary Cost
            </CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.charts.departmentExpense} layout="vertical">
                <defs>
                  <linearGradient id="deptBar" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#a855f7" />
                    <stop offset="100%" stopColor="#8b5cf6" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                <XAxis type="number" fontSize={12} tickFormatter={(v) => `${currency} ${v / 1000}k`} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="department" fontSize={12} width={100} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: number) => formatCurrency(v, currency)} cursor={{ fill: "#f1f5f9" }} />
                <Bar dataKey="amount" name="Salary" fill="url(#deptBar)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
