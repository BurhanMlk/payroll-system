import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, errorMessage } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { formatDate } from "@/lib/utils";
import { Pagination } from "@/pages/tenant/EmployeesPage";
import { Search, Ban, CheckCircle2, Trash2, Pencil, Check, X, Eye } from "lucide-react";

interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: string;
  currency: string;
  createdAt: string;
  subscription: { plan: { name: string } } | null;
  _count: { users: number; employees: number };
}

export default function InstitutionsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["platform-tenants", search, page],
    queryFn: async () => {
      const res = await api.get("/platform/tenants", { params: { search: search || undefined, page, limit: 20 } });
      return { items: res.data.data as Tenant[], meta: res.data.meta };
    },
  });

  const act = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) => api.post(`/platform/tenants/${id}/${action}`, action === "suspend" ? { reason: "Manual" } : {}),
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({ queryKey: ["platform-tenants"] });
      toast({ title: `Tenant ${vars.action}`, variant: "success" });
    },
    onError: (err) => toast({ title: "Failed", description: errorMessage(err), variant: "destructive" }),
  });

  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/platform/tenants/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-tenants"] });
      toast({ title: "Tenant deleted", variant: "success" });
    },
    onError: (err) => toast({ title: "Failed", description: errorMessage(err), variant: "destructive" }),
  });

  const upd = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => api.put(`/platform/tenants/${id}`, { name }),
    onSuccess: () => {
      setEditingId(null);
      qc.invalidateQueries({ queryKey: ["platform-tenants"] });
      toast({ title: "Institution updated", variant: "success" });
    },
    onError: (err) => toast({ title: "Failed", description: errorMessage(err), variant: "destructive" }),
  });

  const startEdit = (t: Tenant) => {
    setEditingId(t.id);
    setEditName(t.name);
  };

  const saveEdit = (id: string) => {
    if (!editName.trim()) return;
    upd.mutate({ id, name: editName.trim() });
  };

  return (
    <div>
      <PageHeader title="Institutions" description="All registered institutions on the platform" />

      <div className="mb-4 flex max-w-sm items-center gap-2">
        <Search className="ml-2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search institutions…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Institution</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Employees</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Registered</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.items.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    {editingId === t.id ? (
                      <div className="flex items-center gap-2">
                        <Input className="h-8 w-48" value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus />
                        <Button size="sm" onClick={() => saveEdit(t.id)} disabled={!editName.trim()}>
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <p className="font-medium">{t.name}</p>
                        <p className="text-xs text-muted-foreground">{t.slug}</p>
                      </>
                    )}
                  </TableCell>
                  <TableCell>{t.subscription?.plan.name ?? "—"}</TableCell>
                  <TableCell>{t._count.employees}</TableCell>
                  <TableCell><Badge variant={statusVariant(t.status)}>{t.status.toLowerCase()}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(t.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button asChild variant="outline" size="sm" title="View details">
                        <Link to={`/platform/institutions/${t.id}`}>
                          <Eye className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                      <Button variant="outline" size="sm" title="Edit" onClick={() => startEdit(t)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {t.status !== "SUSPENDED" && (
                        <Button variant="outline" size="sm" title="Suspend" onClick={() => act.mutate({ id: t.id, action: "suspend" })}>
                          <Ban className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {t.status === "SUSPENDED" && (
                        <Button variant="outline" size="sm" title="Reactivate" onClick={() => act.mutate({ id: t.id, action: "reactivate" })}>
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" title="Delete" onClick={() => del.mutate(t.id)}>
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
      <Pagination meta={data?.meta} page={page} onPage={setPage} />
    </div>
  );
}
