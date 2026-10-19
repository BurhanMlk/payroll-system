import { useState, useEffect, FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, errorMessage } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { Plus, Pencil, Trash2, X } from "lucide-react";

interface LeaveType {
  id: string;
  name: string;
  code: string;
  annualQuota: number;
  isPaid: boolean;
  approvalRequired: boolean;
  isActive: boolean;
}

interface LeaveTypeForm {
  name: string;
  code: string;
  annualQuota: string;
  isPaid: string;
  approvalRequired: string;
}

const EMPTY: LeaveTypeForm = { name: "", code: "", annualQuota: "0", isPaid: "true", approvalRequired: "true" };

export default function LeaveTypesPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LeaveType | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["leave-types"],
    queryFn: async () => (await api.get("/leaves/types")).data.data as LeaveType[],
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/leaves/types/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leave-types"] });
      toast({ title: "Leave type deleted", variant: "success" });
    },
    onError: (err) => toast({ title: "Delete failed", description: errorMessage(err), variant: "destructive" }),
  });

  return (
    <div>
      <PageHeader
        title="Leave Types"
        description="Define the types of leave employees can request"
        actions={
          <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="h-4 w-4" /> Add Leave Type
          </Button>
        }
      />

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : (data?.length ?? 0) === 0 ? (
          <div className="py-16 text-center text-muted-foreground">No leave types yet.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Annual Quota</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Approval</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell className="text-muted-foreground">{t.code}</TableCell>
                  <TableCell>{t.annualQuota}</TableCell>
                  <TableCell>{t.isPaid ? "Yes" : "No"}</TableCell>
                  <TableCell>{t.approvalRequired ? "Required" : "Auto"}</TableCell>
                  <TableCell>
                    <Badge variant={t.isActive ? "success" : "secondary"}>{t.isActive ? "Active" : "Inactive"}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="outline" size="sm" title="Edit" onClick={() => { setEditing(t); setOpen(true); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" title="Delete" onClick={() => { if (window.confirm("Delete this leave type?")) remove.mutate(t.id); }}>
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <LeaveTypeDialog open={open} editing={editing} onClose={() => setOpen(false)} onSaved={() => qc.invalidateQueries({ queryKey: ["leave-types"] })} />
    </div>
  );
}

function LeaveTypeDialog({ open, editing, onClose, onSaved }: { open: boolean; editing: LeaveType | null; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState<LeaveTypeForm>(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        name: editing.name,
        code: editing.code,
        annualQuota: String(editing.annualQuota ?? ""),
        isPaid: String(Boolean(editing.isPaid)),
        approvalRequired: String(Boolean(editing.approvalRequired)),
      });
    } else {
      setForm(EMPTY);
    }
  }, [open, editing]);

  if (!open) return null;

  const set = (key: keyof LeaveTypeForm, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        code: form.code,
        annualQuota: Number(form.annualQuota || 0),
        isPaid: form.isPaid === "true",
        approvalRequired: form.approvalRequired === "true",
      };
      if (editing) {
        await api.put(`/leaves/types/${editing.id}`, payload);
        toast({ title: "Leave type updated", variant: "success" });
      } else {
        await api.post("/leaves/types", payload);
        toast({ title: "Leave type added", variant: "success" });
      }
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
          <h2 className="text-lg font-semibold">{editing ? "Edit Leave Type" : "Add Leave Type"}</h2>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Name *</Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Code *</Label>
            <Input value={form.code} onChange={(e) => set("code", e.target.value.toUpperCase())} placeholder="e.g. ANNUAL" required />
          </div>
          <div className="space-y-1.5">
            <Label>Annual quota (days)</Label>
            <Input type="number" min={0} value={form.annualQuota} onChange={(e) => set("annualQuota", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Paid leave</Label>
            <Select
              value={form.isPaid}
              onChange={(e) => set("isPaid", e.target.value)}
              options={[
                { label: "Yes", value: "true" },
                { label: "No", value: "false" },
              ]}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Approval required</Label>
            <Select
              value={form.approvalRequired}
              onChange={(e) => set("approvalRequired", e.target.value)}
              options={[
                { label: "Yes", value: "true" },
                { label: "No (auto approve)", value: "false" },
              ]}
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </div>
      </form>
    </div>
  );
}
