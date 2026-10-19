import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, errorMessage, getAccessToken } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge, statusVariant } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency } from "@/lib/utils";
import { Download, Pencil, Check, X, Users, FileText, Wallet, Banknote, Clock } from "lucide-react";

interface SalaryItem {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  nationalId: string | null;
  basicSalary: string;
  status: string;
}

interface Stats {
  totalEmployees: number;
  totalPayslips: number;
  paidPayslips: number;
  pendingPayslips: number;
  totalNetPaid: string | number;
}

export default function SalaryOverviewPage() {
  const { user } = useAuth();
  const currency = user?.tenant?.currency ?? "USD";
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSalary, setEditSalary] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["salaries-overview"],
    queryFn: async () => {
      const res = await api.get("/payroll/salaries");
      return { items: res.data.data.items as SalaryItem[], stats: res.data.data.stats as Stats };
    },
  });

  const updateSalary = useMutation({
    mutationFn: ({ id, basicSalary }: { id: string; basicSalary: number }) =>
      api.put(`/employees/${id}`, { basicSalary }),
    onSuccess: () => {
      setEditingId(null);
      qc.invalidateQueries({ queryKey: ["salaries-overview"] });
      toast({ title: "Salary updated", variant: "success" });
    },
    onError: (err) => toast({ title: "Failed", description: errorMessage(err), variant: "destructive" }),
  });

  const downloadCsv = async () => {
    const token = getAccessToken();
    const res = await fetch("/api/v1/payroll/salaries/csv", { headers: { Authorization: `Bearer ${token}` } });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "salaries.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const stats = data?.stats;

  return (
    <div>
      <PageHeader
        title="Salaries & Payslips"
        description="All employee salaries with payslip summary"
        actions={
          <Button size="sm" onClick={downloadCsv}>
            <Download className="h-4 w-4" /> Download CSV
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard icon={<Users className="h-5 w-5" />} label="Employees" value={String(stats?.totalEmployees ?? 0)} />
        <StatCard icon={<FileText className="h-5 w-5" />} label="Payslips Generated" value={String(stats?.totalPayslips ?? 0)} />
        <StatCard icon={<Wallet className="h-5 w-5" />} label="Paid Payslips" value={String(stats?.paidPayslips ?? 0)} />
        <StatCard icon={<Clock className="h-5 w-5" />} label="Pending Payments" value={String(stats?.pendingPayslips ?? 0)} />
        <StatCard
          icon={<Banknote className="h-5 w-5" />}
          label="Total Paid"
          value={formatCurrency(Number(stats?.totalNetPaid ?? 0), currency)}
        />
      </div>

      <Card className="mt-6 overflow-hidden">
        {isLoading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : (data?.items.length ?? 0) === 0 ? (
          <div className="py-16 text-center text-muted-foreground">No employees yet.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>CNIC</TableHead>
                <TableHead>Basic Salary</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.items.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>
                    <p className="font-medium">{e.firstName} {e.lastName}</p>
                    <p className="text-xs text-muted-foreground">{e.employeeNumber}</p>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{e.nationalId ?? "—"}</TableCell>
                  <TableCell>
                    {editingId === e.id ? (
                      <div className="flex items-center gap-1">
                        <Input className="h-8 w-32" type="number" min={0} value={editSalary} onChange={(ev) => setEditSalary(ev.target.value)} autoFocus />
                        <Button size="sm" onClick={() => editSalary.trim() && updateSalary.mutate({ id: e.id, basicSalary: Number(editSalary) })} disabled={!editSalary.trim()}>
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <span className="font-medium">{formatCurrency(e.basicSalary, currency)}</span>
                    )}
                  </TableCell>
                  <TableCell><Badge variant={statusVariant(e.status)}>{e.status.toLowerCase()}</Badge></TableCell>
                  <TableCell className="text-right">
                    <button
                      className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                      title="Edit salary"
                      onClick={() => { setEditingId(e.id); setEditSalary(String(e.basicSalary)); }}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
          {icon} {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
