import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader, StatCard } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";
import { School, TrendingUp, CalendarRange, Wallet, Clock, XCircle, UserMinus, Users, Activity, Bell, BarChart3, ChartPie } from "lucide-react";

interface PlatformData {
  totals: {
    totalInstitutions: number;
    activeInstitutions: number;
    trialInstitutions: number;
    expiredInstitutions: number;
    suspendedInstitutions: number;
    mrr: number;
    yearlyRevenue: number;
    totalRevenue: number;
    newSubscriptions: number;
    failedPayments: number;
    churn: number;
    totalEmployees: number;
  };
  recentlyRegistered: { id: string; name: string; status: string; createdAt: string; plan: string | null }[];
  expiringSoon: { tenantName: string; renewalDate: string; daysLeft: number }[];
  planDistribution: { plan: string; count: number }[];
  monthlyRevenue: { month: string; amount: number }[];
  activeVsExpired: { name: string; value: number }[];
  activity: { id: string; action: string; module: string; tenant: string | null; createdAt: string }[];
}

const COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#a855f7"];

const HEALTH_COLORS: Record<string, string> = {
  Active: "#22c55e",
  Trial: "#f59e0b",
  Expired: "#ef4444",
  Suspended: "#64748b",
};

export default function PlatformDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["platform-dashboard"],
    queryFn: async () => {
      const res = await api.get("/platform/dashboard");
      return res.data.data as PlatformData;
    },
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  const t = data.totals;

  return (
    <div>
      <PageHeader title="Platform Dashboard" description="SaaS revenue and tenant health overview" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Institutions" value={t.totalInstitutions} hint={`${t.activeInstitutions} active · ${t.trialInstitutions} trial`} icon={<School className="h-5 w-5" />} gradient="from-indigo-500 to-blue-600" />
        <StatCard label="Monthly Recurring Revenue" value={formatCurrency(t.mrr)} icon={<TrendingUp className="h-5 w-5" />} gradient="from-emerald-500 to-teal-600" />
        <StatCard label="Yearly Revenue" value={formatCurrency(t.yearlyRevenue)} icon={<CalendarRange className="h-5 w-5" />} gradient="from-violet-500 to-purple-600" />
        <StatCard label="Total Revenue" value={formatCurrency(t.totalRevenue)} icon={<Wallet className="h-5 w-5" />} gradient="from-amber-500 to-orange-600" />
        <StatCard label="Expired" value={t.expiredInstitutions} hint={`${t.suspendedInstitutions} suspended`} icon={<Clock className="h-5 w-5" />} gradient="from-rose-500 to-red-600" />
        <StatCard label="Failed Payments" value={t.failedPayments} icon={<XCircle className="h-5 w-5" />} gradient="from-red-500 to-rose-600" />
        <StatCard label="Churn" value={t.churn} icon={<UserMinus className="h-5 w-5" />} gradient="from-slate-500 to-slate-700" />
        <StatCard label="Total Employees" value={t.totalEmployees} icon={<Users className="h-5 w-5" />} gradient="from-cyan-500 to-sky-600" />
      </div>

      <Card className="mt-6 overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-indigo-500" /> Institution Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
            {data.activeVsExpired.map((s) => {
              const total = data.activeVsExpired.reduce((sum, x) => sum + x.value, 0) || 1;
              return <div key={s.name} style={{ width: `${(s.value / total) * 100}%`, backgroundColor: HEALTH_COLORS[s.name] ?? "#94a3b8" }} />;
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
            {data.activeVsExpired.map((s) => (
              <div key={s.name} className="flex items-center gap-2 text-sm">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: HEALTH_COLORS[s.name] ?? "#94a3b8" }} />
                <span className="font-medium">{s.name}</span>
                <span className="text-muted-foreground">{s.value}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-indigo-500" /> Monthly Revenue
            </CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {data.monthlyRevenue.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No revenue recorded yet</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.monthlyRevenue}>
                  <defs>
                    <linearGradient id="revBar" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" />
                      <stop offset="100%" stopColor="#3b82f6" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="month" fontSize={11} axisLine={false} tickLine={false} />
                  <YAxis fontSize={11} tickFormatter={(v) => `$${v / 1000}k`} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} cursor={{ fill: "#f1f5f9" }} />
                  <Bar dataKey="amount" fill="url(#revBar)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ChartPie className="h-4 w-4 text-violet-500" /> Plan Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {data.planDistribution.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No plan data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data.planDistribution} dataKey="count" nameKey="plan" innerRadius={55} outerRadius={90} paddingAngle={3} strokeWidth={2}>
                    {data.planDistribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-amber-500" /> Subscription Expiry Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.expiringSoon.length === 0 ? (
              <p className="text-sm text-muted-foreground">No subscriptions expiring in the next 14 days.</p>
            ) : (
              <div className="space-y-2">
                {data.expiringSoon.map((s, i) => (
                  <div key={i} className="flex items-center justify-between rounded-md border p-3 text-sm">
                    <span className="font-medium">{s.tenantName}</span>
                    <span className="text-muted-foreground">{formatDate(s.renewalDate)}</span>
                    <Badge variant={s.daysLeft <= 3 ? "destructive" : "warning"}>{s.daysLeft} days</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-500" /> Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-80 overflow-y-auto">
            <div className="space-y-2">
              {data.activity.map((a) => (
                <div key={a.id} className="flex items-center justify-between text-sm">
                  <div>
                    <span className="font-mono text-xs text-muted-foreground">{a.module}.</span>
                    <span className="ml-1 font-medium">{a.action}</span>
                    {a.tenant && <span className="ml-2 text-xs text-muted-foreground">({a.tenant})</span>}
                  </div>
                  <span className="text-xs text-muted-foreground">{formatDate(a.createdAt)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
