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
import type { Student, PaginationMeta } from "@/lib/types";
import { useAuth } from "@/contexts/AuthContext";
import {
  Search,
  Plus,
  X,
  Pencil,
  Trash2,
  Upload,
  Download,
  GraduationCap,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

export const ALL_CLASSES = [
  "Playgroup",
  "Nursery",
  "Prep",
  "KG",
  "Class 1",
  "Class 2",
  "Class 3",
  "Class 4",
  "Class 5",
  "Class 6",
  "Class 7",
  "Class 8",
  "Class 9",
  "Class 10",
  "Class 11",
  "Class 12",
  "O-Levels",
  "A-Levels",
  "Associate Degree",
  "BS / Bachelor",
  "Master / MS",
  "MPhil",
  "PhD",
];

export function isClassWithSection(className: string): boolean {
  if (!className) return false;
  const l = className.toLowerCase();
  if (l.includes("playgroup") || l.includes("nursery") || l.includes("prep") || l.includes("kg")) return true;
  if (l.includes("class")) {
    const m = l.match(/class\s*(\d+)/);
    if (m && parseInt(m[1], 10) <= 12) return true;
  }
  if (l.includes("o-level") || l.includes("a-level")) return true;
  return false;
}

export const SECTIONS = ["A", "B", "C", "D"];

export default function StudentsPage() {
  const [search, setSearch] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSection, setSelectedSection] = useState("");
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);

  const qc = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const currency = user?.tenant?.currency ?? "PKR";

  const { data, isLoading } = useQuery({
    queryKey: ["students", search, selectedClass, selectedSection, page],
    queryFn: async () => {
      const res = await api.get("/students", {
        params: {
          search: search || undefined,
          className: selectedClass || undefined,
          section: selectedSection || undefined,
          page,
          limit: 20,
        },
      });
      return { items: res.data.data as Student[], meta: res.data.meta as PaginationMeta };
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/students/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["students"] });
      toast({ title: "Student deleted", variant: "success" });
    },
    onError: (err) => toast({ title: "Failed", description: errorMessage(err), variant: "destructive" }),
  });

  const handleDownloadTemplate = async () => {
    try {
      const res = await api.get("/students/template", { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "students_import_template.xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast({ title: "Failed to download template", description: errorMessage(err), variant: "destructive" });
    }
  };

  return (
    <div>
      <PageHeader
        title="Students"
        description="Manage student admissions, academic records, and classes"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
              <Download className="h-4 w-4" /> Download Template
            </Button>
            <Button variant="outline" size="sm" onClick={() => setBulkOpen(true)}>
              <Upload className="h-4 w-4" /> Bulk Import
            </Button>
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" /> Add Student
            </Button>
          </div>
        }
      />

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, roll, B-Form…"
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
            setSelectedSection("");
            setPage(1);
          }}
          className="w-40 text-sm"
        >
          <option value="">All Classes</option>
          {ALL_CLASSES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </Select>

        {selectedClass && isClassWithSection(selectedClass) && (
          <Select
            value={selectedSection}
            onChange={(e) => {
              setSelectedSection(e.target.value);
              setPage(1);
            }}
            className="w-32 text-sm"
          >
            <option value="">All Sections</option>
            {SECTIONS.map((s) => (
              <option key={s} value={s}>Section {s}</option>
            ))}
          </Select>
        )}
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : (data?.items.length ?? 0) === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <GraduationCap className="mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="font-medium text-slate-800">No students found</p>
            <p className="text-sm text-muted-foreground">Add students individually or import them in bulk via Excel.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Father Name</TableHead>
                <TableHead>B-Form / CNIC</TableHead>
                <TableHead>Class & Section</TableHead>
                <TableHead>Monthly Fee</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.items.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-700">
                        {s.fullName[0]}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{s.fullName}</p>
                        <p className="text-xs text-muted-foreground">{s.rollNumber}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{s.fatherName}</TableCell>
                  <TableCell className="font-mono text-xs">{s.nationalId}</TableCell>
                  <TableCell>
                    <span className="font-medium">{s.className}</span>
                    {s.section && <Badge variant="outline" className="ml-1.5 text-[11px]">Sec {s.section}</Badge>}
                  </TableCell>
                  <TableCell className="font-medium">{formatCurrency(s.monthlyFee, currency)}</TableCell>
                  <TableCell className="text-xs text-slate-600">{s.phone || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(s.status)}>{s.status.toLowerCase()}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        title="Edit"
                        onClick={() => {
                          setEditing(s);
                          setAddOpen(true);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Delete"
                        onClick={() => {
                          if (confirm(`Are you sure you want to delete ${s.fullName}?`)) {
                            deleteMutation.mutate(s.id);
                          }
                        }}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      </Button>
                    </div>
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
          <p>Page {data.meta.page} of {data.meta.totalPages} ({data.meta.total} students)</p>
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

      {/* Add / Edit Dialog */}
      <AddStudentDialog
        open={addOpen}
        editing={editing}
        onClose={() => {
          setAddOpen(false);
          setEditing(null);
        }}
        onSaved={() => qc.invalidateQueries({ queryKey: ["students"] })}
      />

      {/* Bulk Import Dialog */}
      <BulkImportStudentsDialog
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onSuccess={() => qc.invalidateQueries({ queryKey: ["students"] })}
      />
    </div>
  );
}

// ----------------------------------------------------------------------------
// ADD / EDIT STUDENT MODAL
// ----------------------------------------------------------------------------

function AddStudentDialog({
  open,
  editing,
  onClose,
  onSaved,
}: {
  open: boolean;
  editing: Student | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [fullName, setFullName] = useState("");
  const [fatherName, setFatherName] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [className, setClassName] = useState("Class 1");
  const [section, setSection] = useState("A");
  const [rollNumber, setRollNumber] = useState("");
  const [monthlyFee, setMonthlyFee] = useState("3000");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState("MALE");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const isEditing = !!editing;
  const showSection = isClassWithSection(className);

  const initFromEditing = () => {
    if (editing) {
      setFullName(editing.fullName);
      setFatherName(editing.fatherName);
      setNationalId(editing.nationalId);
      setClassName(editing.className);
      setSection(editing.section || "A");
      setRollNumber(editing.rollNumber);
      setMonthlyFee(String(editing.monthlyFee));
      setPhone(editing.phone || "");
      setGender(editing.gender || "MALE");
      setAddress(editing.address || "");
    } else {
      setFullName("");
      setFatherName("");
      setNationalId("");
      setClassName("Class 1");
      setSection("A");
      setRollNumber("");
      setMonthlyFee("3000");
      setPhone("");
      setGender("MALE");
      setAddress("");
    }
  };

  if (!open) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        fullName,
        fatherName,
        nationalId,
        className,
        section: showSection ? section : null,
        rollNumber: rollNumber || undefined,
        monthlyFee: parseFloat(monthlyFee) || 0,
        phone: phone || undefined,
        gender,
        address: address || undefined,
      };

      if (isEditing) {
        await api.put(`/students/${editing.id}`, payload);
        toast({ title: "Student updated", variant: "success" });
      } else {
        await api.post("/students", payload);
        toast({ title: "Student added successfully", variant: "success" });
      }
      onSaved();
      onClose();
    } catch (err) {
      toast({ title: "Failed to save student", description: errorMessage(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="relative w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl my-8">
        <button onClick={onClose} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600">
          <X className="h-5 w-5" />
        </button>

        <h2 className="text-lg font-bold text-slate-900 mb-1">
          {isEditing ? "Edit Student Record" : "Add New Student"}
        </h2>
        <p className="text-xs text-slate-500 mb-5">
          Enter student personal details, class enrollment, and monthly tuition fee.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Student Name *</Label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Full student name"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Father Name *</Label>
              <Input
                value={fatherName}
                onChange={(e) => setFatherName(e.target.value)}
                placeholder="Father / Guardian name"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">B-Form / CNIC Number *</Label>
              <Input
                value={nationalId}
                onChange={(e) => setNationalId(e.target.value)}
                placeholder="e.g. 35201-1234567-1"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Roll Number (Optional)</Label>
              <Input
                value={rollNumber}
                onChange={(e) => setRollNumber(e.target.value)}
                placeholder="Auto-generated if empty"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Class *</Label>
              <Select
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                required
              >
                {ALL_CLASSES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </div>

            {showSection ? (
              <div className="space-y-1.5">
                <Label className="text-xs">Section *</Label>
                <Select
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                  required
                >
                  {SECTIONS.map((s) => (
                    <option key={s} value={s}>Section {s}</option>
                  ))}
                </Select>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label className="text-xs">Gender</Label>
                <Select value={gender} onChange={(e) => setGender(e.target.value)}>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </Select>
              </div>
            )}

            {showSection && (
              <div className="space-y-1.5">
                <Label className="text-xs">Gender</Label>
                <Select value={gender} onChange={(e) => setGender(e.target.value)}>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">Monthly Tuition Fee *</Label>
              <Input
                type="number"
                min="0"
                value={monthlyFee}
                onChange={(e) => setMonthlyFee(e.target.value)}
                placeholder="3000"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Contact Phone / Mobile</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0300-1234567"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Home Address</Label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Residential address"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              {loading ? "Saving…" : isEditing ? "Save Changes" : "Add Student"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// BULK IMPORT STUDENTS MODAL
// ----------------------------------------------------------------------------

function BulkImportStudentsDialog({
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
  const [result, setResult] = useState<{ imported: number; failed: { row: number; name?: string; reason: string }[] } | null>(null);
  const { toast } = useToast();

  if (!open) return null;

  const handleUpload = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.post("/students/bulk-import", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const data = res.data.data;
      setResult(data);
      if (data.imported > 0) {
        toast({ title: "Import Successful", description: `Enrolled ${data.imported} students.`, variant: "success" });
        onSuccess();
      } else {
        toast({ title: "Import Completed with Issues", description: "No students were imported.", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Import failed", description: errorMessage(err), variant: "destructive" });
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
          <h2 className="text-lg font-bold text-slate-900">Bulk Import Students</h2>
        </div>

        <p className="mb-4 text-xs text-slate-500">
          Enroll multiple students at once by uploading an Excel (.xlsx, .xls) or CSV sheet.
        </p>

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
            {file && (
              <p className="text-[11px] text-slate-500">
                Selected: <span className="font-medium text-slate-700">{file.name}</span> ({(file.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          {result && (
            <div className="rounded-xl border p-3 space-y-2 text-xs">
              <div className="flex items-center gap-2 text-emerald-700 font-semibold">
                <CheckCircle2 className="h-4 w-4" />
                <span>Successfully imported {result.imported} students.</span>
              </div>
              {result.failed.length > 0 && (
                <div className="space-y-1 pt-1">
                  <p className="font-medium text-red-600 flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" /> {result.failed.length} record(s) failed or skipped:
                  </p>
                  <div className="max-h-32 overflow-y-auto space-y-1 pl-2 border-l-2 border-red-200">
                    {result.failed.map((f, i) => (
                      <p key={i} className="text-[11px] text-slate-600">
                        Row {f.row}: {f.name ? `[${f.name}] ` : ""}{f.reason}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="ghost" size="sm" onClick={reset}>
              {result?.imported ? "Close" : "Cancel"}
            </Button>
            <Button type="submit" size="sm" disabled={loading || !file} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5">
              <Upload className="h-3.5 w-3.5" />
              {loading ? "Importing…" : "Upload & Enroll"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

