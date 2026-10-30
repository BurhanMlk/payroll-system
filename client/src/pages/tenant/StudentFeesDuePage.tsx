import { useState, FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, errorMessage } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/utils";
import type { StudentFee, PaginationMeta } from "@/lib/types";
import { useAuth } from "@/contexts/AuthContext";
import { ALL_CLASSES } from "./StudentsPage";
import {
  AlertCircle,
  Search,
  Download,
  CreditCard,
  Users,
  X,
  PhoneCall,
  Calendar,
} from "lucide-react";

export default function StudentFeesDuePage() {
  const currentMonthStr = new Date().toISOString().slice(0, 7);
  const [month, setMonth] = useState(currentMonthStr);
  const [search, setSearch] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [page, setPage] = useState(1);
  const [collectOpen, setCollectOpen] = useState(false);
  const [selectedFee, setSelectedFee] = useState<StudentFee | null>(null);

  const qc = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const currency = user?.tenant?.currency ?? "PKR";

  // Query only pending/partial records
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["student-fees-dues", month, search, selectedClass, page],
    queryFn: async () => {
      const res = await api.get("/students/fees", {
        params: {
          month,
          search: search || undefined,
          className: selectedClass || undefined,
          status: "PENDING", // PENDING or dues
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

  const handleExportCsv = async () => {
    try {
      const res = await api.get("/students/fees/export", {
        params: { month, status: "PENDING" },
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `fee_defaulters_${month}.csv`);
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

  const totalDues = data?.items.reduce((acc, curr) => acc + Number(curr.dueAmount), 0) ?? 0;

  return (
    <div>
      <PageHeader
        title="Fees Due & Defaulters"
        description="Track unpaid student fees, outstanding dues, and parent contact details"
        actions={
          <Button variant="outline" size="sm" onClick={handleExportCsv}>
            <Download className="h-4 w-4" /> Export Defaulters List
          </Button>
        }
      />

      {/* KPI Cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-4 bg-gradient-to-br from-red-50 to-white border-red-200 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-red-900">Total Defaulters</p>
            <Users className="h-5 w-5 text-red-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-red-700">{data?.meta?.total ?? 0}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Students with unpaid fees in {month}</p>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-amber-50 to-white border-amber-200 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-900">Total Outstanding Dues</p>
            <AlertCircle className="h-5 w-5 text-amber-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-amber-800">
            {formatCurrency(summary.totalPendingDues, currency)}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Pending collection for month</p>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-blue-50 to-white border-blue-200 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-900">Total Expected</p>
            <Calendar className="h-5 w-5 text-blue-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-blue-900">
            {formatCurrency(summary.totalExpectedFee, currency)}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Overall billing target</p>
        </Card>
      </div>

      {/* Filters */}
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
            placeholder="Search by student, roll, B-Form…"
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
          className="w-40 text-sm"
        >
          <option value="">All Classes</option>
          {ALL_CLASSES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
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
            <AlertCircle className="mb-3 h-10 w-10 text-emerald-500" />
            <p className="font-semibold text-slate-800">No pending dues found for {month}!</p>
            <p className="text-sm text-muted-foreground">All students in the selected criteria have paid their fees.</p>
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
                <TableHead>Total Fee</TableHead>
                <TableHead>Paid Amount</TableHead>
                <TableHead>Due Amount</TableHead>
                <TableHead>Guardian Contact</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.items.map((f) => (
                <TableRow key={f.id} className="hover:bg-red-50/20">
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
                  <TableCell>{formatCurrency(f.feeAmount, currency)}</TableCell>
                  <TableCell className="text-emerald-700 font-medium">{formatCurrency(f.paidAmount, currency)}</TableCell>
                  <TableCell className="text-red-600 font-bold">{formatCurrency(f.dueAmount, currency)}</TableCell>
                  <TableCell>
                    {f.student.phone ? (
                      <a
                        href={`tel:${f.student.phone}`}
                        className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline"
                      >
                        <PhoneCall className="h-3 w-3" /> {f.student.phone}
                      </a>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      className="bg-red-600 hover:bg-red-700 text-white text-xs gap-1"
                      onClick={() => {
                        setSelectedFee(f);
                        setCollectOpen(true);
                      }}
                    >
                      <CreditCard className="h-3.5 w-3.5" /> Collect Now
                    </Button>
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

      {/* Payment Modal */}
      {collectOpen && selectedFee && (
        <QuickPayModal
          fee={selectedFee}
          month={month}
          currency={currency}
          onClose={() => {
            setCollectOpen(false);
            setSelectedFee(null);
          }}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ["student-fees-dues"] });
            qc.invalidateQueries({ queryKey: ["student-fees"] });
            refetch();
          }}
        />
      )}
    </div>
  );
}

function QuickPayModal({
  fee,
  month,
  currency,
  onClose,
  onSuccess,
}: {
  fee: StudentFee;
  month: string;
  currency: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [paidAmount, setPaidAmount] = useState(String(fee.dueAmount));
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [receiptNumber, setReceiptNumber] = useState(`RCP-${Date.now().toString().slice(-6)}`);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/students/fees/pay", {
        studentId: fee.studentId,
        month,
        paidAmount: parseFloat(paidAmount) || 0,
        paymentMethod,
        receiptNumber: receiptNumber || undefined,
        notes: notes || undefined,
      });
      toast({ title: "Payment recorded successfully", variant: "success" });
      onSuccess();
      onClose();
    } catch (err) {
      toast({ title: "Failed to record payment", description: errorMessage(err), variant: "destructive" });
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

        <h2 className="text-lg font-bold text-slate-900 mb-1">Clear Student Due</h2>
        <p className="text-xs text-slate-500 mb-4">Record fee payment for month: {month}</p>

        <div className="rounded-xl border bg-slate-50 p-3 space-y-1 text-xs mb-4">
          <p className="font-semibold text-slate-900">{fee.student.fullName} ({fee.student.rollNumber})</p>
          <p className="text-slate-600">Class: {fee.student.className} {fee.student.section && `(${fee.student.section})`}</p>
          <p className="text-slate-600">B-Form / CNIC: {fee.student.nationalId}</p>
          <div className="flex justify-between pt-1 border-t text-xs">
            <span>Monthly Fee: {formatCurrency(fee.feeAmount, currency)}</span>
            <span className="font-bold text-red-600">Remaining Due: {formatCurrency(fee.dueAmount, currency)}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
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
            <Label className="text-xs">Remarks</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Paid in full"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={loading} className="bg-red-600 hover:bg-red-700 text-white">
              {loading ? "Recording…" : "Confirm Payment"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

