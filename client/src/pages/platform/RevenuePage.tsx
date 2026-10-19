import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader, StatCard } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { TrendingUp, CalendarRange, Wallet, XCircle, BarChart3, PieChart as PieIcon } from "lucide-react";

interface PlatformData {
  totals: {
    mrr: number;
    yearlyRevenue: number;
    totalRevenue: number;
    failedPayments: number;
  };
  planDistribution: { plan: string; count: number }[];
  monthlyRevenue: { month: string; amount: number }[];
}

export default function RevenuePage() {
  const { data, isLoading } = useQuery({
    queryKey: ["platform-revenue"],
    queryFn: async () => {
      const res = await api.get("/platform/revenue");
      return res.data.data as PlatformData;
    },
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  const t = data.totals;

  return (
    <div>
      <PageHeader title="Revenue" description="SaaS revenue and earnings overview" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Monthly Recurring Revenue" value={formatCurrency(t.mrr)} icon={<TrendingUp className="h-5 w-5" />} gradient="from-emerald-500 to-teal-600" />
        <StatCard label="Yearly Revenue" value={formatCurrency(t.yearlyRevenue)} icon={<CalendarRange className="h-5 w-5" />} gradient="from-violet-500 to-purple-600" />
        <StatCard label="Total Revenue" value={formatCurrency(t.totalRevenue)} icon={<Wallet className="h-5 w-5" />} gradient="from-amber-500 to-orange-600" />
        <StatCard label="Failed Payments" value={t.failedPayments} icon={<XCircle className="h-5 w-5" />} gradient="from-red-500 to-rose-600" />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-indigo-500" /> Monthly Revenue
          </CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          {data.monthlyRevenue.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No revenue recorded yet</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.monthlyRevenue}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Bar dataKey="amount" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6 overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieIcon className="h-4 w-4 text-indigo-500" /> Revenue by Plan
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data.planDistribution.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">No subscriptions yet</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plan</TableHead>
                  <TableHead className="text-right">Subscriptions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.planDistribution.map((p) => (
                  <TableRow key={p.plan}>
                    <TableCell className="font-medium">{p.plan}</TableCell>
                    <TableCell className="text-right">{p.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
