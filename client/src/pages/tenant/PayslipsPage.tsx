import { useQuery } from "@tanstack/react-query";
import { api, getAccessToken } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Download, FileText } from "lucide-react";

interface Payslip {
  id: string;
  grossSalary: string;
  totalDeductions: string;
  netSalary: string;
  paymentStatus: string;
  paymentDate: string | null;
  periodStart: string;
  employee: { id: string; employeeNumber: string; firstName: string; lastName: string; department?: { name: string } | null };
}

export default function PayslipsPage() {
  const { user } = useAuth();
  const currency = user?.tenant?.currency ?? "USD";
  const { data, isLoading } = useQuery({
    queryKey: ["payslips"],
    queryFn: async () => {
      const res = await api.get("/payroll/payslips/list", { params: { limit: 100 } });
      return res.data.data as Payslip[];
    },
  });

  const downloadPdf = async (id: string, employeeNumber: string) => {
    const token = getAccessToken();
    const res = await fetch(`/api/v1/payroll/payslips/${id}/pdf`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payslip-${employeeNumber}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <PageHeader title="Payslips" description="View and download employee payslips" />
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : (data?.length ?? 0) === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <FileText className="mx-auto mb-3 h-10 w-10 opacity-50" />
            <p className="font-medium">No payslips yet</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Gross</TableHead>
                <TableHead>Deductions</TableHead>
                <TableHead>Net</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Download</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <p className="font-medium">{p.employee.firstName} {p.employee.lastName}</p>
                    <p className="text-xs text-muted-foreground">{p.employee.employeeNumber}</p>
                  </TableCell>
                  <TableCell>{p.employee.department?.name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(p.periodStart)}</TableCell>
                  <TableCell>{formatCurrency(p.grossSalary, currency)}</TableCell>
                  <TableCell className="text-red-600">-{formatCurrency(p.totalDeductions, currency)}</TableCell>
                  <TableCell className="font-medium">{formatCurrency(p.netSalary, currency)}</TableCell>
                  <TableCell><Badge variant={statusVariant(p.paymentStatus)}>{p.paymentStatus.toLowerCase()}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => downloadPdf(p.id, p.employee.employeeNumber)}>
                      <Download className="h-4 w-4" /> PDF
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
