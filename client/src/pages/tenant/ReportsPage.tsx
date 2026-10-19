import { useQuery } from "@tanstack/react-query";
import { api, getAccessToken } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Download } from "lucide-react";

interface ReportRow {
  [key: string]: unknown;
}

export default function ReportsPage() {
  const reports = [
    { key: "payroll", label: "Monthly Payroll", description: "Gross, deductions and net salary by employee" },
    { key: "attendance", label: "Attendance", description: "Daily attendance records" },
    { key: "leave", label: "Leave Summary", description: "Approved and pending leave requests" },
    { key: "loans", label: "Loan Report", description: "Outstanding loans and balances" },
    { key: "tax", label: "Tax Report", description: "Tax deductions per employee" },
    { key: "overtime", label: "Overtime Report", description: "Overtime hours by employee" },
  ];

  return (
    <div>
      <PageHeader title="Reports" description="Export payroll, attendance, leave and finance data" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reports.map((r) => (
          <ReportCard key={r.key} report={r} />
        ))}
      </div>
    </div>
  );
}

function ReportCard({ report }: { report: { key: string; label: string; description: string } }) {
  const { data, isLoading } = useQuery({
    queryKey: ["report", report.key],
    queryFn: async () => {
      const res = await api.get(`/reports/${report.key}`, { params: { limit: 5 } });
      return res.data.data as ReportRow[];
    },
  });

  const download = async (format: "csv" | "excel") => {
    const token = getAccessToken();
    const params = new URLSearchParams({ format });
    const res = await fetch(`/api/v1/reports/${report.key}?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${report.key}-report.${format === "csv" ? "csv" : "xlsx"}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
            <FileText className="h-4 w-4" />
          </div>
          <div>
            <p className="font-medium">{report.label}</p>
            <p className="text-xs text-muted-foreground">{report.description}</p>
          </div>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Button variant="outline" size="sm" onClick={() => download("csv")}>
          <Download className="h-3.5 w-3.5" /> CSV
        </Button>
        {report.key === "payroll" && (
          <Button variant="outline" size="sm" onClick={() => download("excel")}>
            <Download className="h-3.5 w-3.5" /> Excel
          </Button>
        )}
      </div>
      {!isLoading && data && (
        <p className="mt-3 text-xs text-muted-foreground">
          {data.length} record{data.length === 1 ? "" : "s"} in current period
        </p>
      )}
    </Card>
  );
}
