import { useState, FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, errorMessage } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/utils";
import type { StudentFee, PaginationMeta } from "@/lib/types";
import { useAuth } from "@/contexts/AuthContext";
import { ALL_CLASSES } from "./StudentsPage";
import {
  CreditCard,
  Search,
  Download,
  Plus,
  X,
  FileCheck2,
  Calendar,
  AlertCircle,
  Receipt,
  Users,
  DollarSign,
  TrendingUp,
} from "lucide-react";

export default function StudentFeesPage() {
  const currentMonthStr = new Date().toISOString().slice(0, 7); // "YYYY-MM"
  const [month, setMonth] = useState(currentMonthStr);
  const [search, setSearch] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [page, setPage] = useState(1);
  const [collectOpen, setCollectOpen] = useState(false);
  const [selectedFee, setSelectedFee] = useState<StudentFee | null>(null);

  const qc = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const currency = user?.tenant?.currency ?? "PKR";

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["student-fees", month, search, selectedClass, selectedStatus, page],
    queryFn: async () => {
      const res = await api.get("/students/fees", {
        params: {
          month,
          search: search || undefined,
          className: selectedClass || undefined,
          status: selectedStatus || undefined,
          page,
          limit: 20,
        },
      });
      return {
        items: res.data.data as StudentFee[],
        summary: res.data.summary as {
          totalStudents: number;
          totalExpectedFee: number;
          totalCollectedFee: number;
          totalPendingDues: number;
        },
        meta: res.data.meta as PaginationMeta,
      };
    },
  });

  const generateMutation = useMutation({
    mutationFn: () => api.post("/students/fees/generate", { month }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["student-fees"] });
      toast({
        title: "Fee slips generated",
        description: `Generated fees for ${res.data.data.generated} students.`,
        variant: "success",
      });
    },
    onError: (err) => {
      toast({ title: "Failed to generate fees", description: errorMessage(err), variant: "destructive" });
    },
  });

  const handleExportCsv = async () => {
    try {
      const res = await api.get("/students/fees/export", {
        params: { month, status: selectedStatus || undefined },
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `student_fees_${month}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast({ title: "Export failed", description: errorMessage(err), variant: "destructive" });
    }
  };

  const summary = data?.summary ?? {
    totalStudents: 0,
    totalExpectedFee: 0,
    totalCollectedFee: 0,
    totalPendingDues: 0,
  };

  return (
    <div>
      <PageHeader
        title="Student Fees Management"
        description="Manage fee generation, collect tuition fees, and track dues"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCsv}>
              <Download className="h-4 w-4" /> Export CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={generateMutation.isPending}
              onClick={() => generateMutation.mutate()}
            >
              <FileCheck2 className="h-4 w-4" />
              {generateMutation.isPending ? "Generating…" : "Generate Monthly Fees"}
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setSelectedFee(null);
                setCollectOpen(true);
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <CreditCard className="h-4 w-4" /> Collect Fee
            </Button>
          </div>
        }
      />

      {/* KPI Cards (Cards requested by user) */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4 bg-gradient-to-br from-indigo-50/50 to-white border-indigo-100 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-indigo-900">Total Enrolled</p>
            <Users className="h-5 w-5 text-indigo-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-indigo-950">{summary.totalStudents}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Active students in institution</p>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-blue-50/50 to-white border-blue-100 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-900">Total Expected</p>
            <DollarSign className="h-5 w-5 text-blue-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-blue-950">{formatCurrency(summary.totalExpectedFee, currency)}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Total fees for {month}</p>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-emerald-50/50 to-white border-emerald-100 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-900">Total Collected</p>
            <TrendingUp className="h-5 w-5 text-emerald-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-800">{formatCurrency(summary.totalCollectedFee, currency)}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Received payments</p>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-red-50/50 to-white border-red-100 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-red-900">Pending Dues</p>
            <AlertCircle className="h-5 w-5 text-red-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-red-700">{formatCurrency(summary.totalPendingDues, currency)}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Outstanding fee amount</p>
        </Card>
      </div>

      {/* Filter Row */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Label className="text-xs font-semibold text-muted-foreground">Month:</Label>
          <Input
            type="month"
            value={month}
            onChange={(e) => {
              setMonth(e.target.value);
              setPage(1);
            }}
            className="w-40 text-sm"
          />
        </div>

        <div className="relative w-full max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search student, roll, B-Form…"
            className="pl-8 text-sm"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <Select
          value={selectedClass}
          onChange={(e) => {
            setSelectedClass(e.target.value);
            setPage(1);
          }}
          className="w-36 text-sm"
        >
          <option value="">All Classes</option>
          {ALL_CLASSES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </Select>

        <Select
          value={selectedStatus}
          onChange={(e) => {
            setSelectedStatus(e.target.value);
            setPage(1);
          }}
          className="w-36 text-sm"
        >
          <option value="">All Statuses</option>
          <option value="PAID">Paid</option>
          <option value="PENDING">Pending (Due)</option>
          <option value="PARTIAL">Partial</option>
        </Select>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : (data?.items.length ?? 0) === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Receipt className="mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="font-medium text-slate-800">No fee records found for {month}</p>
            <p className="text-sm text-muted-foreground">
              Click &quot;Generate Monthly Fees&quot; above to create fee slips for all active students.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Roll No</TableHead>
                <TableHead>Student Name</TableHead>
                <TableHead>Father Name</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>B-Form / CNIC</TableHead>
                <TableHead>Fee Amount</TableHead>
                <TableHead>Paid Amount</TableHead>
                <TableHead>Due Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Receipt #</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.items.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-mono text-xs font-semibold text-slate-700">
                    {f.student.rollNumber}
                  </TableCell>
                  <TableCell className="font-semibold text-slate-900">
                    {f.student.fullName}
                  </TableCell>
                  <TableCell className="text-slate-600">{f.student.fatherName}</TableCell>
                  <TableCell>
                    {f.student.className} {f.student.section && `(${f.student.section})`}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{f.student.nationalId}</TableCell>
                  <TableCell className="font-medium">{formatCurrency(f.feeAmount, currency)}</TableCell>
                  <TableCell className="text-emerald-700 font-semibold">{formatCurrency(f.paidAmount, currency)}</TableCell>
                  <TableCell className="text-red-600 font-semibold">{formatCurrency(f.dueAmount, currency)}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        f.status === "PAID"
                          ? "success"
                          : f.status === "PARTIAL"
                          ? "warning"
                          : "destructive"
                      }
                    >
                      {f.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs font-mono">{f.receiptNumber || "—"}</TableCell>
                  <TableCell className="text-right">
                    {f.status !== "PAID" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs text-indigo-600 hover:bg-indigo-50"
                        onClick={() => {
                          setSelectedFee(f);
                          setCollectOpen(true);
                        }}
                      >
                        Collect
                      </Button>
                    ) : (
                      <span className="text-xs text-emerald-600 font-medium">Completed</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Pagination */}
      {data?.meta && data.meta.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <p>Page {data.meta.page} of {data.meta.totalPages} ({data.meta.total} records)</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={page >= data.meta.totalPages} onClick={() => setPage(page + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Collect Fee Modal */}
      <CollectFeeModal
        open={collectOpen}
        fee={selectedFee}
        month={month}
        currency={currency}
        onClose={() => {
          setCollectOpen(false);
          setSelectedFee(null);
        }}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ["student-fees"] });
          refetch();
        }}
      />
    </div>
  );
}

// ----------------------------------------------------------------------------
// COLLECT FEE MODAL
// ----------------------------------------------------------------------------

function CollectFeeModal({
  open,
  fee,
  month,
  currency,
  onClose,
  onSuccess,
}: {
  open: boolean;
  fee: StudentFee | null;
  month: string;
  currency: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [studentId, setStudentId] = useState(fee?.studentId || "");
  const [paidAmount, setPaidAmount] = useState(fee ? String(fee.dueAmount) : "");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [receiptNumber, setReceiptNumber] = useState(`RCP-${Date.now().toString().slice(-6)}`);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // If opening for a new student without fee record
  const { data: students } = useQuery({
    queryKey: ["all-students-dropdown"],
    enabled: !fee && open,
    queryFn: async () => {
      const res = await api.get("/students", { params: { limit: 100 } });
      return res.data.data as { id: string; fullName: string; rollNumber: string; nationalId: string; monthlyFee: number }[];
    },
  });

  if (!open) return null;

  const currentStudent = fee?.student || students?.find((s) => s.id === studentId);
  const targetStudentId = fee ? fee.studentId : studentId;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!targetStudentId) {
      toast({ title: "Please select a student", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      await api.post("/students/fees/pay", {
        studentId: targetStudentId,
        month,
        paidAmount: parseFloat(paidAmount) || 0,
        paymentMethod,
        receiptNumber: receiptNumber || undefined,
        notes: notes || undefined,
      });
      toast({ title: "Fee collected successfully!", variant: "success" });
      onSuccess();
      onClose();
    } catch (err) {
      toast({ title: "Payment failed", description: errorMessage(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <button onClick={onClose} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600">
          <X className="h-5 w-5" />
        </button>

        <h2 className="text-lg font-bold text-slate-900 mb-1">Collect Student Fee</h2>
        <p className="text-xs text-slate-500 mb-4">Record tuition fee payment for month: {month}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!fee ? (
            <div className="space-y-1.5">
              <Label className="text-xs">Select Student *</Label>
              <Select
                value={studentId}
                onChange={(e) => {
                  const id = e.target.value;
                  setStudentId(id);
                  const found = students?.find((s) => s.id === id);
                  if (found) setPaidAmount(String(found.monthlyFee));
                }}
                required
              >
                <option value="">-- Choose Student --</option>
                {students?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.fullName} ({s.rollNumber}) · B-Form: {s.nationalId}
                  </option>
                ))}
              </Select>
            </div>
          ) : (
            <div className="rounded-xl border bg-slate-50 p-3 space-y-1 text-xs">
              <p className="font-semibold text-slate-900">{fee.student.fullName} ({fee.student.rollNumber})</p>
              <p className="text-slate-600">Class: {fee.student.className} {fee.student.section && `(${fee.student.section})`}</p>
              <p className="text-slate-600">B-Form / CNIC: {fee.student.nationalId}</p>
              <div className="flex justify-between pt-1 border-t text-xs">
                <span>Fee: {formatCurrency(fee.feeAmount, currency)}</span>
                <span className="font-bold text-red-600">Due: {formatCurrency(fee.dueAmount, currency)}</span>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Amount Received *</Label>
            <Input
              type="number"
              min="1"
              value={paidAmount}
              onChange={(e) => setPaidAmount(e.target.value)}
              placeholder="e.g. 3000"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Payment Method</Label>
              <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                <option value="CASH">Cash</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="ONLINE">Online / Easypaisa</option>
                <option value="CHEQUE">Cheque</option>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Receipt Number</Label>
              <Input
                value={receiptNumber}
                onChange={(e) => setReceiptNumber(e.target.value)}
                placeholder="RCP-12345"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Notes / Remarks</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Paid in full by father"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              {loading ? "Recording…" : "Confirm Payment"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

