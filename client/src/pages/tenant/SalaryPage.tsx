import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, errorMessage } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";

interface SalaryTemplate {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  components: { id: string; name: string; type: string; calculation: string; value: string }[];
}

export default function SalaryPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["salary-templates"],
    queryFn: async () => {
      const res = await api.get("/salary/templates");
      return res.data.data as SalaryTemplate[];
    },
  });

  const create = useMutation({
    mutationFn: () =>
      api.post("/salary/templates", {
        name,
        components: [
          { name: "House Allowance", type: "EARNING", calculation: "PERCENTAGE", value: 10 },
          { name: "Transport Allowance", type: "EARNING", calculation: "FIXED", value: 5000 },
          { name: "Medical Allowance", type: "EARNING", calculation: "FIXED", value: 3000 },
        ],
      }),
    onSuccess: () => {
      setName("");
      qc.invalidateQueries({ queryKey: ["salary-templates"] });
      toast({ title: "Template created", variant: "success" });
    },
    onError: (err) => toast({ title: "Failed", description: errorMessage(err), variant: "destructive" }),
  });

  const update = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => api.put(`/salary/templates/${id}`, { name }),
    onSuccess: () => {
      setEditingId(null);
      qc.invalidateQueries({ queryKey: ["salary-templates"] });
      toast({ title: "Template updated", variant: "success" });
    },
    onError: (err) => toast({ title: "Failed", description: errorMessage(err), variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/salary/templates/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["salary-templates"] });
      toast({ title: "Template deleted", variant: "success" });
    },
    onError: (err) => toast({ title: "Failed", description: errorMessage(err), variant: "destructive" }),
  });

  return (
    <div>
      <PageHeader title="Salary Templates" description="Reusable salary structures with earnings and deductions" />
      <div className="mb-4 flex gap-2">
        <Input placeholder="New template name (e.g. Teacher Grade A)" className="max-w-sm" value={name} onChange={(e) => setName(e.target.value)} />
        <Button size="sm" onClick={() => create.mutate()} disabled={!name.trim()}>
          <Plus className="h-4 w-4" /> Create
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {isLoading ? (
          <Skeleton className="h-40" />
        ) : (
          (data ?? []).map((t) => (
            <Card key={t.id} className="p-5">
              <div className="flex items-center justify-between gap-2">
                {editingId === t.id ? (
                  <div className="flex items-center gap-1">
                    <Input className="h-8 w-44" value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus />
                    <Button size="sm" onClick={() => editName.trim() && update.mutate({ id: t.id, name: editName.trim() })} disabled={!editName.trim()}>
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <p className="font-semibold">{t.name}</p>
                )}
                <div className="flex items-center gap-1">
                  {t.isDefault && <span className="text-xs font-medium text-primary">Default</span>}
                  <button className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground" title="Rename" onClick={() => { setEditingId(t.id); setEditName(t.name); }}>
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600" title="Delete" onClick={() => remove.mutate(t.id)}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="mt-4 overflow-hidden rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Component</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {t.components.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>{c.name}</TableCell>
                        <TableCell className="capitalize">{c.type.toLowerCase()}</TableCell>
                        <TableCell>{c.calculation === "PERCENTAGE" ? `${c.value}%` : c.value}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
