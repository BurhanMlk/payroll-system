import { useState, useEffect, FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, errorMessage } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { ALL_CLASSES, isClassWithSection, SECTIONS } from "./StudentsPage";
import {
  CalendarDays,
  Check,
  X,
  Upload,
  Download,
  FileSpreadsheet,
  Save,
  CheckCheck,
  AlertCircle,
  Clock,
} from "lucide-react";

interface AttendanceRecord {
  studentId: string;
  rollNumber: string;
  fullName: string;
  fatherName: string;
  className: string;
  section: string | null;
  status: "PRESENT" | "ABSENT" | "LATE" | "HALF_DAY" | "LEAVE";
  remarks: string;
  recorded: boolean;
}

export default function StudentAttendancePage() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedClass, setSelectedClass] = useState("Class 1");
  const [selectedSection, setSelectedSection] = useState("");
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [uploadOpen, setUploadOpen] = useState(false);

  const qc = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["student-attendance", date, selectedClass, selectedSection],
    queryFn: async () => {
      const res = await api.get("/students/attendance", {
        params: {
          date,
          className: selectedClass || undefined,
          section: selectedSection || undefined,
        },
      });
      return res.data.data as AttendanceRecord[];
    },
  });

  useEffect(() => {
    if (data) {
      setRecords(data);
    }
  }, [data]);

  const updateStatus = (studentId: string, status: AttendanceRecord["status"]) => {
    setRecords((prev) =>
      prev.map((r) => (r.studentId === studentId ? { ...r, status } : r)),
    );
  };

  const updateRemarks = (studentId: string, remarks: string) => {
    setRecords((prev) =>
      prev.map((r) => (r.studentId === studentId ? { ...r, remarks } : r)),
    );
  };

  const markAll = (status: AttendanceRecord["status"]) => {
    setRecords((prev) => prev.map((r) => ({ ...r, status })));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        date,
        records: records.map((r) => ({
          studentId: r.studentId,
          status: r.status,
          remarks: r.remarks || undefined,
        })),
      };
      return api.post("/students/attendance", payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["student-attendance"] });
      toast({ title: "Attendance saved successfully", variant: "success" });
    },
    onError: (err) => {
      toast({ title: "Failed to save attendance", description: errorMessage(err), variant: "destructive" });
    },
  });

  // Calculate live counts
  const total = records.length;
  const present = records.filter((r) => r.status === "PRESENT").length;
  const absent = records.filter((r) => r.status === "ABSENT").length;
  const leave = records.filter((r) => r.status === "LEAVE").length;
  const late = records.filter((r) => r.status === "LATE").length;

  return (
    <div>
      <PageHeader
        title="Student Attendance"
        description="Mark and review daily class attendance manually or via Excel upload"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setUploadOpen(true)}>
              <Upload className="h-4 w-4" /> Upload Excel Attendance
            </Button>
            <Button
              size="sm"
              disabled={saveMutation.isPending || records.length === 0}
              onClick={() => saveMutation.mutate()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
            >
              <Save className="h-4 w-4" />
              {saveMutation.isPending ? "Saving…" : "Save Attendance"}
            </Button>
          </div>
        }
      />

      {/* Control Bar */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Attendance Date</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-40 text-sm"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Class</Label>
            <Select
              value={selectedClass}
              onChange={(e) => {
                setSelectedClass(e.target.value);
                setSelectedSection("");
              }}
              className="w-40 text-sm"
            >
              <option value="">All Classes</option>
              {ALL_CLASSES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Select>
          </div>

          {selectedClass && isClassWithSection(selectedClass) && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Section</Label>
              <Select
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
                className="w-32 text-sm"
              >
                <option value="">All Sections</option>
                {SECTIONS.map((s) => (
                  <option key={s} value={s}>Section {s}</option>
                ))}
              </Select>
            </div>
          )}
        </div>

        {/* Quick action buttons */}
        {records.length > 0 && (
          <div className="flex items-center gap-2 pt-2 sm:pt-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => markAll("PRESENT")}
              className="text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50"
            >
              <CheckCheck className="h-3.5 w-3.5 mr-1" /> Mark All Present
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => markAll("ABSENT")}
              className="text-xs text-red-700 border-red-200 hover:bg-red-50"
            >
              <X className="h-3.5 w-3.5 mr-1" /> Mark All Absent
            </Button>
          </div>
        )}
      </div>

      {/* Summary KPI Cards */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-xl border bg-card p-3 shadow-sm">
          <p className="text-[11px] font-medium text-muted-foreground">Total Students</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">{total}</p>
        </div>
        <div className="rounded-xl border bg-emerald-50/50 border-emerald-100 p-3 shadow-sm">
          <p className="text-[11px] font-medium text-emerald-800">Present</p>
          <p className="mt-1 text-2xl font-bold text-emerald-700">{present}</p>
        </div>
        <div className="rounded-xl border bg-red-50/50 border-red-100 p-3 shadow-sm">
          <p className="text-[11px] font-medium text-red-800">Absent</p>
          <p className="mt-1 text-2xl font-bold text-red-700">{absent}</p>
        </div>
        <div className="rounded-xl border bg-amber-50/50 border-amber-100 p-3 shadow-sm">
          <p className="text-[11px] font-medium text-amber-800">Leave</p>
          <p className="mt-1 text-2xl font-bold text-amber-700">{leave}</p>
        </div>
        <div className="rounded-xl border bg-blue-50/50 border-blue-100 p-3 shadow-sm">
          <p className="text-[11px] font-medium text-blue-800">Late</p>
          <p className="mt-1 text-2xl font-bold text-blue-700">{late}</p>
        </div>
      </div>

      {/* Attendance Grid */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <CalendarDays className="mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="font-medium text-slate-800">No students enrolled in this class/section</p>
            <p className="text-sm text-muted-foreground">Please select a different class or enroll students first.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Roll No</TableHead>
                <TableHead>Student Name</TableHead>
                <TableHead>Father Name</TableHead>
                <TableHead>Class</TableHead>
                <TableHead className="w-72">Status</TableHead>
                <TableHead>Remarks</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((r) => (
                <TableRow key={r.studentId}>
                  <TableCell className="font-mono text-xs font-semibold text-slate-700">
                    {r.rollNumber}
                  </TableCell>
                  <TableCell className="font-semibold text-slate-900">
                    {r.fullName}
                  </TableCell>
                  <TableCell className="text-slate-600">{r.fatherName}</TableCell>
                  <TableCell>
                    {r.className} {r.section && `(${r.section})`}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => updateStatus(r.studentId, "PRESENT")}
                        className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                          r.status === "PRESENT"
                            ? "bg-emerald-600 text-white shadow-sm"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        P
                      </button>
                      <button
                        type="button"
                        onClick={() => updateStatus(r.studentId, "ABSENT")}
                        className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                          r.status === "ABSENT"
                            ? "bg-red-600 text-white shadow-sm"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        A
                      </button>
                      <button
                        type="button"
                        onClick={() => updateStatus(r.studentId, "LEAVE")}
                        className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                          r.status === "LEAVE"
                            ? "bg-amber-600 text-white shadow-sm"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        L
                      </button>
                      <button
                        type="button"
                        onClick={() => updateStatus(r.studentId, "LATE")}
                        className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                          r.status === "LATE"
                            ? "bg-blue-600 text-white shadow-sm"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        Late
                      </button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Input
                      placeholder="Optional remarks…"
                      value={r.remarks}
                      onChange={(e) => updateRemarks(r.studentId, e.target.value)}
                      className="h-8 text-xs max-w-xs"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Upload Modal */}
      <UploadAttendanceModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ["student-attendance"] });
          refetch();
        }}
      />
    </div>
  );
}

// ----------------------------------------------------------------------------
// EXCEL ATTENDANCE UPLOAD MODAL
// ----------------------------------------------------------------------------

function UploadAttendanceModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ imported: number; failed: { row: number; reason: string }[] } | null>(null);
  const { toast } = useToast();

  if (!open) return null;

  const handleDownloadTemplate = async () => {
    try {
      const res = await api.get("/students/attendance/template", { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "student_attendance_template.xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast({ title: "Failed to download template", description: errorMessage(err), variant: "destructive" });
    }
  };

  const handleUpload = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.post("/students/attendance/import", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const data = res.data.data;
      setResult(data);
      if (data.imported > 0) {
        toast({ title: "Attendance Uploaded", description: `Updated ${data.imported} attendance records.`, variant: "success" });
        onSuccess();
      } else {
        toast({ title: "Upload Failed", description: "No records were updated.", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Upload error", description: errorMessage(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <button onClick={reset} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600">
          <X className="h-5 w-5" />
        </button>

        <div className="mb-4 flex items-center gap-2">
          <FileSpreadsheet className="h-6 w-6 text-indigo-600" />
          <h2 className="text-lg font-bold text-slate-900">Upload Attendance via Excel / CSV</h2>
        </div>

        <p className="mb-4 text-xs text-slate-500">
          Upload bulk attendance records. Use Roll Number, Date, Status (PRESENT, ABSENT, LATE, LEAVE).
        </p>

        <div className="mb-4 flex justify-between items-center rounded-xl border border-dashed border-indigo-200 bg-indigo-50/50 p-3">
          <div>
            <p className="text-xs font-semibold text-indigo-900">Download Excel Template</p>
            <p className="text-[11px] text-indigo-700">Includes Roll Number, Date, and Status columns</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={handleDownloadTemplate} className="gap-1.5 text-xs">
            <Download className="h-3.5 w-3.5" /> Download Template
          </Button>
        </div>

        <form onSubmit={handleUpload} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Select Excel / CSV File</Label>
            <Input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="text-xs"
              required
            />
          </div>

          {result && (
            <div className="rounded-xl border p-3 space-y-2 text-xs">
              <p className="text-emerald-700 font-semibold">
                Imported / Updated {result.imported} student records.
              </p>
              {result.failed.length > 0 && (
                <div className="space-y-1 max-h-28 overflow-y-auto pl-2 border-l-2 border-red-300">
                  {result.failed.map((f, i) => (
                    <p key={i} className="text-[11px] text-red-600">Row {f.row}: {f.reason}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="ghost" size="sm" onClick={reset}>
              {result?.imported ? "Close" : "Cancel"}
            </Button>
            <Button type="submit" size="sm" disabled={loading || !file} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              {loading ? "Uploading…" : "Upload Attendance"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

