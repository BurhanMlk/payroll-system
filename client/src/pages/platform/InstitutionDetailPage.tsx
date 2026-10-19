import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, errorMessage } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { formatDate } from "@/lib/utils";
import { ArrowLeft, Pencil, Trash2, KeyRound, Check, X, RefreshCcw, Ban, CheckCircle2 } from "lucide-react";

interface TenantUser {
  id: string;
  email: string;
  fullName: string;
  status: string;
  createdAt: string;
  lastLoginAt: string | null;
  roles: { role: { key: string; name: string } }[];
}

interface TenantDetail {
  id: string;
  name: string;
  slug: string;
  status: string;
  currency: string;
  country: string | null;
  city: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  website: string | null;
  createdAt: string;
  subscription: {
    id: string;
    status: string;
    billingPeriod: string;
    renewalDate: string;
    plan: { id: string; name: string };
    payments: SubscriptionPayment[];
    invoices: Invoice[];
  } | null;
  users: TenantUser[];
  _count: { users: number; employees: number; branches: number };
}

interface SubscriptionPayment {
  id: string;
  amount: string;
  currency: string;
  status: string;
  paidAt: string | null;
  createdAt: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  totalAmount: string;
  currency: string;
  status: string;
  issuedAt: string;
}

interface PlanOption {
  id: string;
  name: string;
  key: string;
}

export default function InstitutionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const { data: tenant, isLoading } = useQuery({
    queryKey: ["platform-tenant", id],
    queryFn: async () => {
      const res = await api.get(`/platform/tenants/${id}`);
      return res.data.data as TenantDetail;
    },
    enabled: !!id,
  });

  const del = useMutation({
    mutationFn: (userId: string) => api.delete(`/platform/users/${userId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-tenant", id] });
      toast({ title: "User deleted", variant: "success" });
    },
    onError: (err) => toast({ title: "Failed", description: errorMessage(err), variant: "destructive" }),
  });

  const upd = useMutation({
    mutationFn: ({ userId, fullName, email }: { userId: string; fullName: string; email: string }) =>
      api.put(`/platform/users/${userId}`, { fullName, email }),
    onSuccess: () => {
      setEditingId(null);
      qc.invalidateQueries({ queryKey: ["platform-tenant", id] });
      toast({ title: "User updated", variant: "success" });
    },
    onError: (err) => toast({ title: "Failed", description: errorMessage(err), variant: "destructive" }),
  });

  const reset = useMutation({
    mutationFn: ({ userId, password }: { userId: string; password: string }) =>
      api.post(`/platform/users/${userId}/reset-password`, { password }),
    onSuccess: () => {
      setResettingId(null);
      setNewPassword("");
      toast({ title: "Password reset", variant: "success" });
    },
    onError: (err) => toast({ title: "Failed", description: errorMessage(err), variant: "destructive" }),
  });

  // ---- Institute details editing ----
  const [editDetails, setEditDetails] = useState(false);
  const [tenantName, setTenantName] = useState("");
  const [tenantEmail, setTenantEmail] = useState("");
  const [tenantPhone, setTenantPhone] = useState("");
  const [tenantAddress, setTenantAddress] = useState("");
  const [tenantWebsite, setTenantWebsite] = useState("");

  const { data: plans } = useQuery({
    queryKey: ["platform-plans"],
    queryFn: async () => {
      const res = await api.get("/platform/plans");
      return res.data.data as PlanOption[];
    },
  });

  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [extendDays, setExtendDays] = useState("30");

  useEffect(() => {
    if (tenant) {
      setTenantName(tenant.name);
      setTenantEmail(tenant.email ?? "");
      setTenantPhone(tenant.phone ?? "");
      setTenantAddress(tenant.address ?? "");
      setTenantWebsite(tenant.website ?? "");
      setSelectedPlanId(tenant.subscription?.plan.id ?? "");
    }
  }, [tenant]);

  const saveTenant = useMutation({
    mutationFn: (payload: { name: string; email: string; phone: string; address: string; website: string }) =>
      api.put(`/platform/tenants/${id}`, payload),
    onSuccess: () => {
      setEditDetails(false);
      qc.invalidateQueries({ queryKey: ["platform-tenant", id] });
      qc.invalidateQueries({ queryKey: ["platform-tenants"] });
      toast({ title: "Institution updated", variant: "success" });
    },
    onError: (err) => toast({ title: "Failed", description: errorMessage(err), variant: "destructive" }),
  });

  const changePlan = useMutation({
    mutationFn: (planId: string) =>
      api.post(`/platform/subscriptions/${tenant?.subscription?.id}/change-plan`, { planId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-tenant", id] });
      toast({ title: "Plan changed", variant: "success" });
    },
    onError: (err) => toast({ title: "Failed", description: errorMessage(err), variant: "destructive" }),
  });

  const subAction = useMutation({
    mutationFn: ({ action, days }: { action: string; days?: string }) =>
      api.post(`/platform/subscriptions/${tenant?.subscription?.id}/${action}`, days ? { days: Number(days) } : {}),
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({ queryKey: ["platform-tenant", id] });
      toast({ title: `Subscription ${vars.action}`, variant: "success" });
    },
    onError: (err) => toast({ title: "Failed", description: errorMessage(err), variant: "destructive" }),
  });

  const tenantAction = useMutation({
    mutationFn: (action: string) =>
      api.post(`/platform/tenants/${id}/${action}`, action === "suspend" ? { reason: "Manual" } : {}),
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({ queryKey: ["platform-tenant", id] });
      toast({ title: vars === "suspend" ? "Institution suspended" : "Institution reactivated", variant: "success" });
    },
    onError: (err) => toast({ title: "Failed", description: errorMessage(err), variant: "destructive" }),
  });

  const startEdit = (u: TenantUser) => {
    setEditingId(u.id);
    setEditName(u.fullName);
    setEditEmail(u.email);
  };

  const saveEdit = (userId: string) => {
    if (!editName.trim() || !editEmail.trim()) return;
    upd.mutate({ userId, fullName: editName.trim(), email: editEmail.trim() });
  };

  const confirmDelete = (u: TenantUser) => {
    if (window.confirm(`Delete user "${u.email}"? This cannot be undone.`)) {
      del.mutate(u.id);
    }
  };

  if (isLoading || !tenant) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={tenant.name}
        description={`${tenant.slug} · Registered ${formatDate(tenant.createdAt)}`}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/platform/institutions">
              <ArrowLeft className="h-4 w-4" /> Back
            </Link>
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</p>
          <Badge variant={statusVariant(tenant.status)} className="mt-2">{tenant.status.toLowerCase()}</Badge>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Plan</p>
          <p className="mt-2 font-semibold">{tenant.subscription?.plan.name ?? "—"}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Location</p>
          <p className="mt-2 font-semibold">
            {[tenant.city, tenant.country].filter(Boolean).join(", ") || "—"}
          </p>
          <p className="text-xs text-muted-foreground">Currency: {tenant.currency}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Usage</p>
          <p className="mt-2 text-sm">
            {tenant._count.employees} employees · {tenant._count.branches} branches · {tenant._count.users} users
          </p>
        </Card>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold">Institution details</h2>
            {!editDetails && (
              <Button size="sm" variant="outline" onClick={() => setEditDetails(true)}>
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
            )}
          </div>
          {editDetails ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input value={tenantName} onChange={(e) => setTenantName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input value={tenantEmail} onChange={(e) => setTenantEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={tenantPhone} onChange={(e) => setTenantPhone(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Address</Label>
                <Input value={tenantAddress} onChange={(e) => setTenantAddress(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Website</Label>
                <Input value={tenantWebsite} onChange={(e) => setTenantWebsite(e.target.value)} />
              </div>
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setEditDetails(false)}>Cancel</Button>
                <Button size="sm" onClick={() => saveTenant.mutate({ name: tenantName, email: tenantEmail, phone: tenantPhone, address: tenantAddress, website: tenantWebsite })} disabled={!tenantName.trim()}>
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Name</dt><dd className="font-medium">{tenant.name}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Email</dt><dd className="font-medium">{tenant.email ?? "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Phone</dt><dd className="font-medium">{tenant.phone ?? "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Address</dt><dd className="font-medium">{tenant.address ?? "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Website</dt><dd className="font-medium">{tenant.website ?? "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Slug</dt><dd className="font-medium">{tenant.slug}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Currency</dt><dd className="font-medium">{tenant.currency}</dd></div>
            </dl>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="mb-4 text-base font-semibold">Plan & subscription</h2>
          {tenant.subscription ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">{tenant.subscription.plan.name}</p>
                  <Badge variant={statusVariant(tenant.subscription.status)} className="mt-1">{tenant.subscription.status.toLowerCase()}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">Renews {formatDate(tenant.subscription.renewalDate)}</p>
              </div>

              <div className="space-y-1.5">
                <Label>Change plan</Label>
                <div className="flex gap-2">
                  <select
                    className="h-9 flex-1 rounded-md border border-input bg-transparent px-3 text-sm"
                    value={selectedPlanId}
                    onChange={(e) => setSelectedPlanId(e.target.value)}
                  >
                    {(plans ?? []).map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <Button size="sm" variant="outline" disabled={!selectedPlanId || selectedPlanId === tenant.subscription.plan.id} onClick={() => changePlan.mutate(selectedPlanId)}>
                    Apply
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Extend / trial / free (days)</Label>
                <div className="flex gap-2">
                  <Input value={extendDays} onChange={(e) => setExtendDays(e.target.value)} placeholder="Days" />
                  <Button size="sm" variant="outline" onClick={() => subAction.mutate({ action: "extend", days: extendDays })}>Extend</Button>
                  <Button size="sm" variant="outline" onClick={() => subAction.mutate({ action: "trial", days: extendDays })}>Trial</Button>
                  <Button size="sm" variant="outline" onClick={() => subAction.mutate({ action: "free", days: extendDays })}>Free</Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => subAction.mutate({ action: "activate" })}>
                  <CheckCircle2 className="h-3.5 w-3.5" /> Activate
                </Button>
                <Button size="sm" variant="outline" onClick={() => subAction.mutate({ action: "renew" })}>
                  <RefreshCcw className="h-3.5 w-3.5" /> Renew
                </Button>
                <Button size="sm" variant="outline" onClick={() => subAction.mutate({ action: "cancel" })}>
                  <Ban className="h-3.5 w-3.5" /> Cancel
                </Button>
                {tenant.status === "SUSPENDED" ? (
                  <Button size="sm" variant="outline" onClick={() => tenantAction.mutate("reactivate")}>
                    <CheckCircle2 className="h-3.5 w-3.5" /> Reactivate
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => tenantAction.mutate("suspend")}>
                    <Ban className="h-3.5 w-3.5" /> Suspend
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">This institution has no subscription yet.</p>
          )}
        </Card>
      </div>

      <Card className="mb-6 overflow-hidden">
        <div className="border-b p-4">
          <h2 className="text-base font-semibold">Payments & invoices</h2>
          <p className="text-sm text-muted-foreground">Billing history for this institution.</p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(tenant.subscription?.payments ?? []).map((p) => (
              <TableRow key={p.id}>
                <TableCell>Payment</TableCell>
                <TableCell className="text-muted-foreground">—</TableCell>
                <TableCell>{p.amount} {p.currency}</TableCell>
                <TableCell><Badge variant={statusVariant(p.status)}>{p.status.toLowerCase()}</Badge></TableCell>
                <TableCell className="text-muted-foreground">{p.paidAt ? formatDate(p.paidAt) : formatDate(p.createdAt)}</TableCell>
              </TableRow>
            ))}
            {(tenant.subscription?.invoices ?? []).map((inv) => (
              <TableRow key={inv.id}>
                <TableCell>Invoice</TableCell>
                <TableCell className="text-muted-foreground">{inv.invoiceNumber}</TableCell>
                <TableCell>{inv.totalAmount} {inv.currency}</TableCell>
                <TableCell><Badge variant={statusVariant(inv.status)}>{inv.status.toLowerCase()}</Badge></TableCell>
                <TableCell className="text-muted-foreground">{formatDate(inv.issuedAt)}</TableCell>
              </TableRow>
            ))}
            {!tenant.subscription?.payments.length && !tenant.subscription?.invoices.length && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  No payments or invoices yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b p-4">
          <h2 className="text-base font-semibold">Users ({tenant.users.length})</h2>
          <p className="text-sm text-muted-foreground">Manage this institution's login accounts.</p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tenant.users.map((u) => (
              <TableRow key={u.id}>
                <TableCell>
                  {editingId === u.id ? (
                    <Input className="h-8 w-40" value={editName} onChange={(e) => setEditName(e.target.value)} />
                  ) : (
                    <span className="font-medium">{u.fullName}</span>
                  )}
                </TableCell>
                <TableCell>
                  {editingId === u.id ? (
                    <Input className="h-8 w-52" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
                  ) : (
                    <span className="text-muted-foreground">{u.email}</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {u.roles.map((r) => (
                      <Badge key={r.role.key} variant="secondary">{r.role.name}</Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant(u.status)}>{u.status.toLowerCase()}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {editingId === u.id ? (
                      <>
                        <Button size="sm" onClick={() => saveEdit(u.id)} disabled={!editName.trim() || !editEmail.trim()}>
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" variant="outline" title="Edit" onClick={() => startEdit(u)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="outline" title="Reset password" onClick={() => { setResettingId(u.id); setNewPassword(""); }}>
                          <KeyRound className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" title="Delete" onClick={() => confirmDelete(u)}>
                          <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {tenant.users.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  No users found for this institution.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {resettingId && (
        <Card className="mt-4 p-4">
          <h3 className="text-sm font-semibold">Reset password</h3>
          <div className="mt-2 flex items-center gap-2">
            <Input
              type="password"
              placeholder="New password (min 8 chars)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <Button onClick={() => reset.mutate({ userId: resettingId, password: newPassword })} disabled={newPassword.length < 8}>
              Save
            </Button>
            <Button variant="ghost" onClick={() => { setResettingId(null); setNewPassword(""); }}>
              Cancel
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
