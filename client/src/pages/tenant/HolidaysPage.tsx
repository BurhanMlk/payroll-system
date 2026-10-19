import { useState, useEffect, FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, errorMessage } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { EmployeeSearchInput } from "@/components/EmployeeSearchInput";
import { formatDate } from "@/lib/utils";
import { Plus, Pencil, Trash2, X } from "lucide-react";

interface Holiday {
  id: string;
  name: string;
  date: string;
  isRecurring: boolean;
  branch?: { id: string; name: string } | null;
}

interface HolidayForm {
  name: string;
  date: string;
  branchId: string;
  isRecurring: string;
}

const EMPTY: HolidayForm = { name: "", date: "", branchId: "", isRecurring: "false" };

export default function HolidaysPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Holiday | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["holidays"],
    queryFn: async () => (await api.get("/holidays")).data.data as Holiday[],
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/holidays/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["holidays"] });
      toast({ title: "Holiday deleted", variant: "success" });
    },
    onError: (err) => toast({ title: "Delete failed", description: errorMessage(err), variant: "destructive" }),
  });

  return (
    <div>
      <PageHeader
        title="Holidays"
        description="Manage institution holidays"
        actions={
          <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="h-4 w-4" /> Add Holiday
          </Button>
        }
      />

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : (data?.length ?? 0) === 0 ? (
          <div className="py-16 text-center text-muted-foreground">No holidays yet.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Recurring</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.map((h) => (
                <TableRow key={h.id}>
                  <TableCell className="font-medium">{h.name}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(h.date)}</TableCell>
                  <TableCell>{h.branch?.name ?? "All branches"}</TableCell>
                  <TableCell>{h.isRecurring ? "Yes" : "No"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="outline" size="sm" title="Edit" onClick={() => { setEditing(h); setOpen(true); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" title="Delete" onClick={() => { if (window.confirm("Delete this holiday?")) remove.mutate(h.id); }}>
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

      <HolidayDialog open={open} editing={editing} onClose={() => setOpen(false)} onSaved={() => qc.invalidateQueries({ queryKey: ["holidays"] })} />
    </div>
  );
}

function toDateInput(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function HolidayDialog({ open, editing, onClose, onSaved }: { open: boolean; editing: Holiday | null; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState<HolidayForm>(EMPTY);
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: branches } = useQuery({
    queryKey: ["branches"],
    enabled: open,
    queryFn: async () => (await api.get("/branches", { params: { limit: 100 } })).data.data as { id: string; name: string }[],
  });

  useEffect(() => {
    if (!open) return;
    setEmployeeNumber("");
    if (editing) {
      setForm({
        name: editing.name,
        date: toDateInput(editing.date),
        branchId: editing.branch?.id ?? "",
        isRecurring: String(Boolean(editing.isRecurring)),
      });
    } else {
      setForm(EMPTY);
    }
  }, [open, editing]);

  if (!open) return null;

  const set = (key: keyof HolidayForm, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        date: form.date,
        branchId: form.branchId || undefined,
        isRecurring: form.isRecurring === "true",
      };
      if (editing) {
        await api.put(`/holidays/${editing.id}`, payload);
        toast({ title: "Holiday updated", variant: "success" });
      } else {
        await api.post("/holidays", payload);
        toast({ title: "Holiday added", variant: "success" });
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
          <h2 className="text-lg font-semibold">{editing ? "Edit Holiday" : "Add Holiday"}</h2>
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
            <Label>Date *</Label>
            <Input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Branch</Label>
            <Select
              value={form.branchId}
              onChange={(e) => set("branchId", e.target.value)}
              options={(branches ?? []).map((b) => ({ label: b.name, value: b.id }))}
              placeholder="All branches"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Recurring yearly</Label>
            <Select
              value={form.isRecurring}
              onChange={(e) => set("isRecurring", e.target.value)}
              options={[
                { label: "No", value: "false" },
                { label: "Yes", value: "true" },
              ]}
            />
          </div>
          <div className="sm:col-span-2">
            <EmployeeSearchInput value={employeeNumber} onChange={setEmployeeNumber} />
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
