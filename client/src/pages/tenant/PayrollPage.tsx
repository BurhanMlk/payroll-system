import { useState, useEffect, FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, errorMessage } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { PayrollRun } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Play, CheckCircle2, Send, DollarSign, Trash2, Pencil, X } from "lucide-react";

export default function PayrollPage() {
  const { hasPermission, user } = useAuth();
  const currency = user?.tenant?.currency ?? "USD";
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<PayrollRun | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["payroll-runs"],
    queryFn: async () => {
      const res = await api.get("/payroll");
      return res.data.data as PayrollRun[];
    },
  });

  const action = useMutation({
    mutationFn: async ({ id, type }: { id: string; type: string }) => {
      await api.post(`/payroll/${id}/${type}`, type === "approve" ? { remarks: "Approved" } : {});
    },
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({ queryKey: ["payroll-runs"] });
      toast({ title: `Payroll ${vars.type.replace("-", " ")}`, variant: "success" });
    },
    onError: (err) => toast({ title: "Action failed", description: errorMessage(err), variant: "destructive" }),
  });

  const generate = useMutation({
    mutationFn: () => api.post("/payroll/generate", {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payroll-runs"] });
      toast({ title: "Payroll generated", description: "Review the draft before approval.", variant: "success" });
    },
    onError: (err) => toast({ title: "Generation failed", description: errorMessage(err), variant: "destructive" }),
  });

  const deleteRun = useMutation({
    mutationFn: (id: string) => api.delete(`/payroll/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payroll-runs"] });
      toast({ title: "Payroll run deleted", variant: "success" });
    },
    onError: (err) => toast({ title: "Delete failed", description: errorMessage(err), variant: "destructive" }),
  });

  const confirmDelete = (run: PayrollRun) => {
    if (window.confirm(`Delete payroll run "${run.name}"? This cannot be undone.`)) {
      deleteRun.mutate(run.id);
    }
  };

  return (
    <div>
      <PageHeader
        title="Payroll Runs"
        description="Generate, review, approve and pay payroll"
        actions={
          hasPermission("payroll.generate") && (
            <Button size="sm" onClick={() => generate.mutate()} disabled={generate.isPending}>
              <Play className="h-4 w-4" /> {generate.isPending ? "Generating…" : "Generate Payroll"}
            </Button>
          )
        }
      />

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
        ) : (data?.length ?? 0) === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <p className="font-medium">No payroll runs yet</p>
            <p className="text-sm">Generate your first payroll run to get started.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Employees</TableHead>
                <TableHead>Gross</TableHead>
                <TableHead>Net</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.map((run) => (
                <TableRow key={run.id}>
                  <TableCell>
                    <p className="font-medium">{run.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(run.periodStart)} → {formatDate(run.periodEnd)}
                    </p>
                  </TableCell>
                  <TableCell>{run.employeeCount}</TableCell>
                  <TableCell>{formatCurrency(run.totalGross, currency)}</TableCell>
                  <TableCell className="font-medium">{formatCurrency(run.totalNet, currency)}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(run.status)}>{run.status.toLowerCase()}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(run.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {(run.status === "DRAFT" || run.status === "CALCULATED") && hasPermission("payroll.review") && (
                        <IconAction title="Send for review" onClick={() => action.mutate({ id: run.id, type: "review" })}>
                          <Send className="h-3.5 w-3.5" />
                        </IconAction>
                      )}
                      {run.status === "PENDING_REVIEW" && hasPermission("payroll.approve") && (
                        <IconAction title="Approve" onClick={() => action.mutate({ id: run.id, type: "approve" })}>
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </IconAction>
                      )}
                      {(run.status === "APPROVED" || run.status === "PROCESSING") && hasPermission("payroll.mark_paid") && (
                        <Button size="sm" onClick={() => action.mutate({ id: run.id, type: "mark-paid" })}>
                          <DollarSign className="h-3.5 w-3.5" /> Mark Paid
                        </Button>
                      )}
                      {hasPermission("payroll.generate") && (
                        <IconAction title="Edit" onClick={() => setEditing(run)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </IconAction>
                      )}
                      {hasPermission("payroll.generate") && (
                        <IconAction title="Delete" onClick={() => confirmDelete(run)}>
                          <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        </IconAction>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <EditPayrollDialog run={editing} onClose={() => setEditing(null)} onSaved={() => qc.invalidateQueries({ queryKey: ["payroll-runs"] })} />
    </div>
  );
}

function EditPayrollDialog({ run, onClose, onSaved }: { run: PayrollRun | null; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [payDate, setPayDate] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (run) {
      setName(run.name);
      setPayDate(run.payDate ? new Date(run.payDate).toISOString().slice(0, 10) : "");
    }
  }, [run]);

  if (!run) return null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch(`/payroll/${run.id}`, { name, payDate: payDate || undefined });
      toast({ title: "Payroll updated", variant: "success" });
      onSaved();
      onClose();
    } catch (err) {
      toast({ title: "Update failed", description: errorMessage(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <form className="w-full max-w-md rounded-lg border bg-card p-6 shadow-lg" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Edit Payroll Run</h2>
            <p className="text-sm text-muted-foreground">Update the run name and pay date.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Run name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Pay date</Label>
            <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function IconAction({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Button variant="outline" size="sm" onClick={onClick} title={title}>
      {children}
    </Button>
  );
}
