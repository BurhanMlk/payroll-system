import { useState, useEffect, FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, errorMessage } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Plus, CheckCircle2, X } from "lucide-react";

interface Advance {
  id: string;
  amount: string;
  remaining: string;
  issueDate: string;
  installments: number;
  installmentAmount: string;
  status: string;
  employee: { id: string; employeeNumber: string; firstName: string; lastName: string };
}

interface EmployeeOption {
  id: string;
  firstName: string;
  lastName: string;
  employeeNumber: string;
}

interface AdvanceForm {
  employeeId: string;
  amount: string;
  installments: string;
  issueDate: string;
}

const EMPTY: AdvanceForm = { employeeId: "", amount: "", installments: "1", issueDate: "" };

export default function AdvancesPage() {
  const { toast } = useToast();
  const { hasPermission, user } = useAuth();
  const currency = user?.tenant?.currency ?? "USD";
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["advances"],
    queryFn: async () => {
      const res = await api.get("/finance/advances", { params: { limit: 100 } });
      return res.data.data as Advance[];
    },
  });

  const approve = useMutation({
    mutationFn: (id: string) => api.post(`/finance/advances/${id}/approve`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["advances"] });
      toast({ title: "Advance approved", variant: "success" });
    },
    onError: (err) => toast({ title: "Failed", description: errorMessage(err), variant: "destructive" }),
  });

  return (
    <div>
      <PageHeader
        title="Salary Advances"
        description="Issue and approve employee salary advances"
        actions={
          hasPermission("advance.create") && (
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> Add Advance
            </Button>
          )
        }
      />

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : (data?.length ?? 0) === 0 ? (
          <div className="py-16 text-center text-muted-foreground">No advances yet.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Remaining</TableHead>
                <TableHead>Installment</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <p className="font-medium">{a.employee.firstName} {a.employee.lastName}</p>
                    <p className="text-xs text-muted-foreground">{a.employee.employeeNumber}</p>
                  </TableCell>
                  <TableCell>{formatCurrency(a.amount, currency)}</TableCell>
                  <TableCell>{formatCurrency(a.remaining, currency)}</TableCell>
                  <TableCell className="text-muted-foreground">{a.installments} × {formatCurrency(a.installmentAmount, currency)}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(a.issueDate)}</TableCell>
                  <TableCell><Badge variant={statusVariant(a.status)}>{a.status.toLowerCase()}</Badge></TableCell>
                  <TableCell className="text-right">
                    {a.status === "PENDING" && hasPermission("advance.approve") && (
                      <Button variant="outline" size="sm" onClick={() => approve.mutate(a.id)}>
                        <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <AdvanceDialog open={open} onClose={() => setOpen(false)} onSaved={() => qc.invalidateQueries({ queryKey: ["advances"] })} />
    </div>
  );
}

function AdvanceDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState<AdvanceForm>(EMPTY);
  const [saving, setSaving] = useState(false);

  const { data: employees } = useQuery({
    queryKey: ["employees"],
    enabled: open,
    queryFn: async () => {
      const res = await api.get("/employees", { params: { limit: 100 } });
      return res.data.data as EmployeeOption[];
    },
  });

  useEffect(() => {
    if (open) setForm(EMPTY);
  }, [open]);

  if (!open) return null;

  const set = (key: keyof AdvanceForm, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/finance/advances", {
        employeeId: form.employeeId,
        amount: Number(form.amount || 0),
        installments: Number(form.installments || 1),
        issueDate: form.issueDate || undefined,
      });
      toast({ title: "Advance added", variant: "success" });
      onSaved();
      onClose();
    } catch (err) {
      toast({ title: "Failed", description: errorMessage(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <form className="w-full max-w-md rounded-lg border bg-card p-6 shadow-lg" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Add Salary Advance</h2>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Employee *</Label>
            <Select
              value={form.employeeId}
              onChange={(e) => set("employeeId", e.target.value)}
              options={(employees ?? []).map((emp) => ({ label: `${emp.firstName} ${emp.lastName} (${emp.employeeNumber})`, value: emp.id }))}
              placeholder="Select employee"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Amount *</Label>
            <Input type="number" min={0} value={form.amount} onChange={(e) => set("amount", e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Installments</Label>
            <Input type="number" min={1} value={form.installments} onChange={(e) => set("installments", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Issue date</Label>
            <Input type="date" value={form.issueDate} onChange={(e) => set("issueDate", e.target.value)} />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Add Advance"}</Button>
        </div>
      </form>
    </div>
  );
}
