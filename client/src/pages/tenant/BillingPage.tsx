import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, errorMessage } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Subscription } from "@/lib/types";
import { CreditCard, RefreshCw, Trash2 } from "lucide-react";

interface BillingOverview extends Subscription {
  payments: { id: string; amount: string; status: string; createdAt: string }[];
  invoices: { id: string; invoiceNumber: string; totalAmount: string; status: string; issuedAt: string }[];
}

export default function BillingPage() {
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["billing"],
    queryFn: async () => {
      const res = await api.get("/billing");
      return res.data.data as BillingOverview;
    },
  });

  const renew = useMutation({
    mutationFn: () => api.post("/billing/record-payment", { amount: data?.amount }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["billing"] });
      toast({ title: "Payment recorded", description: "Your subscription has been renewed.", variant: "success" });
    },
    onError: (err) => toast({ title: "Failed", description: errorMessage(err), variant: "destructive" }),
  });

  const removeInvoice = useMutation({
    mutationFn: (id: string) => api.delete(`/billing/invoices/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["billing"] });
      toast({ title: "Invoice deleted", variant: "success" });
    },
    onError: (err) => toast({ title: "Failed", description: errorMessage(err), variant: "destructive" }),
  });

  const removePayment = useMutation({
    mutationFn: (id: string) => api.delete(`/billing/payments/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["billing"] });
      toast({ title: "Payment deleted", variant: "success" });
    },
    onError: (err) => toast({ title: "Failed", description: errorMessage(err), variant: "destructive" }),
  });

  if (isLoading || !data) {
    return <Skeleton className="h-64" />;
  }

  return (
    <div>
      <PageHeader title="Billing" description="Your subscription, invoices and payment history" />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Current plan</p>
              <p className="text-2xl font-semibold">{data.plan.name}</p>
            </div>
            <Badge variant={statusVariant(data.status)}>{data.status.toLowerCase()}</Badge>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <Info label="Amount" value={`${formatCurrency(data.amount, data.currency)} / ${data.billingPeriod.toLowerCase()}`} />
            <Info label="Renewal date" value={formatDate(data.renewalDate)} />
            <Info label="Currency" value={data.currency} />
          </div>
          <div className="mt-6 flex gap-2">
            <Button onClick={() => renew.mutate()} disabled={renew.isPending}>
              <RefreshCw className="h-4 w-4" /> {renew.isPending ? "Recording…" : "Record Payment & Renew"}
            </Button>
          </div>
          <div className="mt-6">
            <p className="mb-2 text-sm font-medium">Plan features</p>
            <div className="flex flex-wrap gap-2">
              {data.plan.features.filter((f) => f.enabled).map((f) => (
                <Badge key={f.key} variant="secondary">{f.label}</Badge>
              ))}
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <p className="font-medium">Recent payments</p>
          </div>
          <div className="mt-4 space-y-3">
            {data.payments.length === 0 && <p className="text-sm text-muted-foreground">No payments yet.</p>}
            {data.payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-muted-foreground">{formatDate(p.createdAt)}</span>
                <span className="font-medium">{formatCurrency(p.amount, data.currency)}</span>
                <Badge variant={statusVariant(p.status)}>{p.status.toLowerCase()}</Badge>
                {hasPermission("billing.manage") && (
                  <Button variant="ghost" size="sm" title="Delete" onClick={() => { if (window.confirm("Delete this payment?")) removePayment.mutate(p.id); }}>
                    <Trash2 className="h-3.5 w-3.5 text-red-500" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="mt-6 overflow-hidden">
        <div className="border-b px-6 py-4">
          <p className="font-medium">Invoices</p>
        </div>
        {data.invoices.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No invoices yet.</p>
        ) : (
          <div className="divide-y">
            {data.invoices.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between gap-3 px-6 py-3 text-sm">
                <span className="font-medium">{inv.invoiceNumber}</span>
                <span className="text-muted-foreground">{formatDate(inv.issuedAt)}</span>
                <span className="font-medium">{formatCurrency(inv.totalAmount, data.currency)}</span>
                <Badge variant={statusVariant(inv.status)}>{inv.status.toLowerCase()}</Badge>
                {hasPermission("billing.manage") && (
                  <Button variant="ghost" size="sm" title="Delete" onClick={() => { if (window.confirm("Delete this invoice?")) removeInvoice.mutate(inv.id); }}>
                    <Trash2 className="h-3.5 w-3.5 text-red-500" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-medium">{value}</p>
    </div>
  );
}
