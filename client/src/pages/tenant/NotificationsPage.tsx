import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/utils";
import { Bell, CheckCheck } from "lucide-react";

interface Notification {
  id: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export default function NotificationsPage() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const res = await api.get("/notifications", { params: { limit: 50 } });
      return res.data.data as { items: Notification[]; unread: number };
    },
  });

  const markAll = useMutation({
    mutationFn: () => api.post("/notifications/read-all"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Stay updated on payroll, leave and subscription events"
        actions={
          <Button variant="outline" size="sm" onClick={() => markAll.mutate()}>
            <CheckCheck className="h-4 w-4" /> Mark all read
          </Button>
        }
      />

      <div className="space-y-2">
        {isLoading ? (
          <Skeleton className="h-40" />
        ) : (data?.items.length ?? 0) === 0 ? (
          <Card className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Bell className="mb-3 h-10 w-10 opacity-50" />
            <p className="font-medium">No notifications</p>
          </Card>
        ) : (
          data?.items.map((n) => (
            <Card key={n.id} className={`p-4 ${n.readAt ? "opacity-70" : "border-l-2 border-l-primary"}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{n.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{formatDate(n.createdAt)}</span>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
