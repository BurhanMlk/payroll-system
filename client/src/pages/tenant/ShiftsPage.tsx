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
import { EmployeeSearchInput } from "@/components/EmployeeSearchInput";
import { Plus, Pencil, Trash2, X } from "lucide-react";

interface Shift {
  id: string;
  name: string;
  type: string;
  startTime: string;
  endTime: string;
  graceMinutes: number;
  breakMinutes: number;
  isActive: boolean;
}

interface ShiftForm {
  name: string;
  type: string;
  startTime: string;
  endTime: string;
  graceMinutes: string;
  breakMinutes: string;
}

const EMPTY: ShiftForm = { name: "", type: "MORNING", startTime: "08:00", endTime: "16:00", graceMinutes: "15", breakMinutes: "60" };

export default function ShiftsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Shift | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["shifts"],
    queryFn: async () => (await api.get("/shifts")).data.data as Shift[],
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/shifts/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shifts"] });
      toast({ title: "Shift deleted", variant: "success" });
    },
    onError: (err) => toast({ title: "Delete failed", description: errorMessage(err), variant: "destructive" }),
  });

  return (
    <div>
      <PageHeader
        title="Shifts"
        description="Define working shifts for attendance"
        actions={
          <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="h-4 w-4" /> Add Shift
          </Button>
        }
      />

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : (data?.length ?? 0) === 0 ? (
          <div className="py-16 text-center text-muted-foreground">No shifts yet.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Grace (min)</TableHead>
                <TableHead>Break (min)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="capitalize">{s.type.toLowerCase()}</TableCell>
                  <TableCell className="text-muted-foreground">{s.startTime} – {s.endTime}</TableCell>
                  <TableCell>{s.graceMinutes}</TableCell>
                  <TableCell>{s.breakMinutes}</TableCell>
                  <TableCell>
                    <Badge variant={s.isActive ? "success" : "secondary"}>{s.isActive ? "Active" : "Inactive"}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="outline" size="sm" title="Edit" onClick={() => { setEditing(s); setOpen(true); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" title="Delete" onClick={() => { if (window.confirm("Delete this shift?")) remove.mutate(s.id); }}>
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

      <ShiftDialog open={open} editing={editing} onClose={() => setOpen(false)} onSaved={() => qc.invalidateQueries({ queryKey: ["shifts"] })} />
    </div>
  );
}

function ShiftDialog({ open, editing, onClose, onSaved }: { open: boolean; editing: Shift | null; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState<ShiftForm>(EMPTY);
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEmployeeNumber("");
    if (editing) {
      setForm({
        name: editing.name,
        type: editing.type,
        startTime: editing.startTime,
        endTime: editing.endTime,
        graceMinutes: String(editing.graceMinutes ?? ""),
        breakMinutes: String(editing.breakMinutes ?? ""),
      });
    } else {
      setForm(EMPTY);
    }
  }, [open, editing]);

  if (!open) return null;

  const set = (key: keyof ShiftForm, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        type: form.type,
        startTime: form.startTime,
        endTime: form.endTime,
        graceMinutes: Number(form.graceMinutes || 0),
        breakMinutes: Number(form.breakMinutes || 0),
      };
      if (editing) {
        await api.put(`/shifts/${editing.id}`, payload);
        toast({ title: "Shift updated", variant: "success" });
      } else {
        await api.post("/shifts", payload);
        toast({ title: "Shift added", variant: "success" });
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
          <h2 className="text-lg font-semibold">{editing ? "Edit Shift" : "Add Shift"}</h2>
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
            <Label>Type</Label>
            <Select
              value={form.type}
              onChange={(e) => set("type", e.target.value)}
              options={[
                { label: "Morning", value: "MORNING" },
                { label: "Evening", value: "EVENING" },
                { label: "Night", value: "NIGHT" },
                { label: "Custom", value: "CUSTOM" },
              ]}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Start time</Label>
            <Input value={form.startTime} onChange={(e) => set("startTime", e.target.value)} placeholder="08:00" />
          </div>
          <div className="space-y-1.5">
            <Label>End time</Label>
            <Input value={form.endTime} onChange={(e) => set("endTime", e.target.value)} placeholder="16:00" />
          </div>
          <div className="space-y-1.5">
            <Label>Grace (min)</Label>
            <Input type="number" min={0} value={form.graceMinutes} onChange={(e) => set("graceMinutes", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Break (min)</Label>
            <Input type="number" min={0} value={form.breakMinutes} onChange={(e) => set("breakMinutes", e.target.value)} />
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
