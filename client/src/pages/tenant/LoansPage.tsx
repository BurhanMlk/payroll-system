import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, errorMessage } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency } from "@/lib/utils";
import { Plus, CheckCircle2, XCircle, Trash2 } from "lucide-react";

interface Loan {
  id: string;
  loanNumber: string;
  loanAmount: string;
  remainingBalance: string;
  installmentAmount: string;
  installmentCount: number;
  status: string;
  employee: { employeeNumber: string; firstName: string; lastName: string };
}

export default function LoansPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const currency = user?.tenant?.currency ?? "USD";
  const qc = useQueryClient();
  const [form, setForm] = useState({ employeeNumber: "", amount: "", installments: "12" });

  const { data, isLoading } = useQuery({
    queryKey: ["loans"],
    queryFn: async () => {
      const res = await api.get("/finance/loans", { params: { limit: 100 } });
      return res.data.data as Loan[];
    },
  });

  const decide = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) => api.post(`/finance/loans/${id}/approve`, { approve }),
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({ queryKey: ["loans"] });
      toast({ title: vars.approve ? "Loan approved" : "Loan rejected", variant: "success" });
    },
    onError: (err) => toast({ title: "Failed", description: errorMessage(err), variant: "destructive" }),
  });

  const cancel = useMutation({
    mutationFn: (id: string) => api.post(`/finance/loans/${id}/cancel`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["loans"] });
      toast({ title: "Loan cancelled", variant: "success" });
    },
    onError: (err) => toast({ title: "Failed", description: errorMessage(err), variant: "destructive" }),
  });

  const createLoan = useMutation({
    mutationFn: async () => {
      const emp = await api.get("/employees", { params: { search: form.employeeNumber, limit: 1 } });
      const employee = emp.data.data[0];
      if (!employee) throw new Error("Employee not found");
      return api.post("/finance/loans", { employeeId: employee.id, loanAmount: Number(form.amount), installments: Number(form.installments) });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["loans"] });
      setForm({ employeeNumber: "", amount: "", installments: "12" });
      toast({ title: "Loan created", variant: "success" });
    },
    onError: (err) => toast({ title: "Failed", description: errorMessage(err), variant: "destructive" }),
  });

  return (
    <div>
      <PageHeader title="Loans" description="Employee loans with automatic payroll deductions" />

      <Card className="mb-6 p-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="space-y-1.5">
            <Label>Employee number</Label>
            <Input placeholder="EMP-001" value={form.employeeNumber} onChange={(e) => setForm({ ...form, employeeNumber: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Loan amount</Label>
            <Input type="number" placeholder="40000" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Installments</Label>
            <Input type="number" value={form.installments} onChange={(e) => setForm({ ...form, installments: e.target.value })} />
          </div>
          <div className="flex items-end">
            <Button size="sm" onClick={() => createLoan.mutate()} disabled={!form.employeeNumber || !form.amount}>
              <Plus className="h-4 w-4" /> Create Loan
            </Button>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Loan #</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Installment</TableHead>
                <TableHead>Remaining</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.loanNumber}</TableCell>
                  <TableCell>
                    {l.employee.firstName} {l.employee.lastName}
                    <span className="ml-1 text-xs text-muted-foreground">({l.employee.employeeNumber})</span>
                  </TableCell>
                  <TableCell>{formatCurrency(l.loanAmount, currency)}</TableCell>
                  <TableCell>{formatCurrency(l.installmentAmount, currency)} × {l.installmentCount}</TableCell>
                  <TableCell>{formatCurrency(l.remainingBalance, currency)}</TableCell>
                  <TableCell><Badge variant={statusVariant(l.status)}>{l.status.toLowerCase()}</Badge></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {l.status === "PENDING" && (
                        <>
                          <Button variant="outline" size="sm" onClick={() => decide.mutate({ id: l.id, approve: true })}>
                            <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => decide.mutate({ id: l.id, approve: false })}>
                            <XCircle className="h-3.5 w-3.5" /> Reject
                          </Button>
                        </>
                      )}
                      {l.status === "ACTIVE" && (
                        <Button variant="ghost" size="sm" onClick={() => cancel.mutate(l.id)} disabled={cancel.isPending}>
                          <Trash2 className="h-3.5 w-3.5 text-red-500" /> Cancel
                        </Button>
                      )}
                    </div>
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
