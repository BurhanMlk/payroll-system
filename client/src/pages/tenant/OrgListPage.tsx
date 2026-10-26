import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, errorMessage } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { isValidCnic, isValidMobile } from "@/lib/validation";
import { Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { Pagination } from "./EmployeesPage";

interface OrgKindConfig {
  title: string;
  singular: string;
  path: string;
  permission: string;
}

const CONFIG: Record<string, OrgKindConfig> = {
  departments: { title: "Departments", singular: "Department", path: "/departments", permission: "department.manage" },
  designations: { title: "Designations", singular: "Designation", path: "/designations", permission: "designation.manage" },
  branches: { title: "Branches", singular: "Branch", path: "/branches", permission: "branch.manage" },
};

export default function OrgListPage({ kind }: { kind: "departments" | "designations" | "branches" }) {
  const config = CONFIG[kind];
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [branchForm, setBranchForm] = useState({ name: "", headName: "", headCnic: "", phone: "", address: "" });
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: [kind, search, page],
    queryFn: async () => {
      const res = await api.get(config.path, { params: { search: search || undefined, page, limit: 20 } });
      return { items: res.data.data as { id: string; name: string; code?: string; manager?: { fullName: string }; headName?: string; headCnic?: string; phone?: string; address?: string }[], meta: res.data.meta };
    },
  });

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, string>) => api.post(config.path, payload),
    onSuccess: () => {
      setNewName("");
      setBranchForm({ name: "", headName: "", headCnic: "", phone: "", address: "" });
      qc.invalidateQueries({ queryKey: [kind] });
      toast({ title: `${config.singular} created`, variant: "success" });
    },
    onError: (err) => toast({ title: "Failed", description: errorMessage(err), variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`${config.path}/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [kind] });
      toast({ title: `${config.singular} deleted`, variant: "success" });
    },
    onError: (err) => toast({ title: "Failed", description: errorMessage(err), variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => api.put(`${config.path}/${id}`, { name }),
    onSuccess: () => {
      setEditingId(null);
      qc.invalidateQueries({ queryKey: [kind] });
      toast({ title: `${config.singular} updated`, variant: "success" });
    },
    onError: (err) => toast({ title: "Failed", description: errorMessage(err), variant: "destructive" }),
  });

  const startEdit = (item: { id: string; name: string }) => {
    setEditingId(item.id);
    setEditName(item.name);
  };

  const saveEdit = (id: string) => {
    if (!editName.trim()) return;
    updateMutation.mutate({ id, name: editName.trim() });
  };

  const addBranch = () => {
    if (!branchForm.name.trim()) return;
    if (branchForm.headCnic && !isValidCnic(branchForm.headCnic)) {
      toast({ title: "Invalid CNIC", description: "CNIC must be 13 digits (e.g. 12345-1234567-1).", variant: "destructive" });
      return;
    }
    if (branchForm.phone && !isValidMobile(branchForm.phone)) {
      toast({ title: "Invalid mobile", description: "Enter a valid mobile number (10-15 digits).", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      name: branchForm.name.trim(),
      headName: branchForm.headName,
      headCnic: branchForm.headCnic,
      phone: branchForm.phone,
      address: branchForm.address,
    });
  };

  return (
    <div>
      <PageHeader title={config.title} description={`Manage ${config.title.toLowerCase()} for your institution`} />

      {kind === "branches" ? (
        <Card className="mb-4 p-4">
          <p className="mb-3 text-sm font-medium">Add Branch</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Input placeholder="Branch name *" value={branchForm.name} onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })} />
            <Input placeholder="Head of Branch" value={branchForm.headName} onChange={(e) => setBranchForm({ ...branchForm, headName: e.target.value })} />
            <Input placeholder="CNIC" value={branchForm.headCnic} onChange={(e) => setBranchForm({ ...branchForm, headCnic: e.target.value })} />
            <Input placeholder="Branch mobile" value={branchForm.phone} onChange={(e) => setBranchForm({ ...branchForm, phone: e.target.value })} />
            <Input placeholder="Location" value={branchForm.address} onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })} />
          </div>
          <div className="mt-3 flex gap-2">
            <Input placeholder="Search branches…" className="max-w-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
            <Button size="sm" onClick={addBranch} disabled={!branchForm.name.trim()}>
              <Plus className="h-4 w-4" /> Add Branch
            </Button>
          </div>
        </Card>
      ) : (
        <div className="mb-4 flex flex-col gap-2 sm:flex-row">
          <Input placeholder={`Search ${config.title.toLowerCase()}…`} className="max-w-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="flex gap-2">
            <Input placeholder={`New ${config.singular.toLowerCase()} name`} value={newName} onChange={(e) => setNewName(e.target.value)} />
            <Button size="sm" onClick={() => newName.trim() && createMutation.mutate({ name: newName.trim() })} disabled={!newName.trim()}>
              <Plus className="h-4 w-4" /> Add
            </Button>
          </div>
        </div>
      )}

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                {kind === "branches" ? <TableHead>Head / Contact</TableHead> : kind !== "designations" ? <TableHead>Code</TableHead> : null}
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">
                    {editingId === item.id ? (
                      <div className="flex items-center gap-2">
                        <Input className="h-8 w-48" value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus />
                        <Button size="sm" onClick={() => saveEdit(item.id)} disabled={!editName.trim()}>
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      item.name
                    )}
                  </TableCell>
                  {kind === "branches" ? (
                    <TableCell className="text-muted-foreground">
                      {item.headName ? <p>{item.headName}</p> : <p>—</p>}
                      <p className="text-xs">{item.headCnic ?? ""}{item.phone ? ` · ${item.phone}` : ""}{item.address ? ` · ${item.address}` : ""}</p>
                    </TableCell>
                  ) : kind !== "designations" ? (
                    <TableCell className="text-muted-foreground">{item.code ?? "—"}</TableCell>
                  ) : null}
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <button className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground" title="Edit" onClick={() => startEdit(item)}>
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600" title="Delete" onClick={() => deleteMutation.mutate(item.id)}>
                        <Trash2 className="h-4 w-4" />
                      </button>
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
