import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, errorMessage } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/toast";
import { Settings, Pencil, Trash2, Check, X } from "lucide-react";

interface Role {
  id: string;
  key: string;
  name: string;
  isSystem: boolean;
  _count: { userRoles: number };
}

export default function SettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const { data: roles } = useQuery({
    queryKey: ["roles"],
    queryFn: async () => {
      const res = await api.get("/rbac/roles");
      return res.data.data as Role[];
    },
  });

  const update = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => api.put(`/rbac/roles/${id}`, { name }),
    onSuccess: () => {
      setEditingId(null);
      qc.invalidateQueries({ queryKey: ["roles"] });
      toast({ title: "Role updated", variant: "success" });
    },
    onError: (err) => toast({ title: "Failed", description: errorMessage(err), variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/rbac/roles/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["roles"] });
      toast({ title: "Role deleted", variant: "success" });
    },
    onError: (err) => toast({ title: "Failed", description: errorMessage(err), variant: "destructive" }),
  });

  return (
    <div>
      <PageHeader title="Settings" description="Organization, users and roles" />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-4 w-4" /> Organization
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Info label="Institution" value={user?.tenant?.name ?? "—"} />
            <Info label="Slug" value={user?.tenant?.slug ?? "—"} />
            <Info label="Status" value={user?.tenant?.status ?? "—"} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Roles & Permissions</CardTitle>
          </CardHeader>
          <CardContent className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(roles ?? []).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      {editingId === r.id ? (
                        <div className="flex items-center gap-1">
                          <Input className="h-8 w-36" value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus />
                          <Button size="sm" onClick={() => editName.trim() && update.mutate({ id: r.id, name: editName.trim() })} disabled={!editName.trim()}>
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        r.name
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{r.key}</TableCell>
                    <TableCell>{r._count.userRoles}</TableCell>
                    <TableCell>
                      <Badge variant={r.isSystem ? "secondary" : "outline"}>{r.isSystem ? "System" : "Custom"}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <button className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground" title="Rename" onClick={() => { setEditingId(r.id); setEditName(r.name); }}>
                          <Pencil className="h-4 w-4" />
                        </button>
                        {!r.isSystem && (
                          <button className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600" title="Delete" onClick={() => remove.mutate(r.id)}>
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b pb-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
