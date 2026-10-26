import { useState, FormEvent, useEffect } from "react";
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
import type { Employee, PaginationMeta } from "@/lib/types";
import { useAuth } from "@/contexts/AuthContext";
import { formatCnic, formatPhoneNumber, isValidCnic, isValidPhoneNumber } from "@/lib/validation";
import { Search, Plus, Users, X, Pencil, Trash2 } from "lucide-react";

interface EmployeeResponse {
  items: Employee[];
  meta: PaginationMeta;
}

interface Country {
  name: string;
  code: string;
  currency: string;
  rate: number;
  cities: string[];
}

function toDateInput(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function EmployeesPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const qc = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const currency = user?.tenant?.currency ?? "USD";

  const { data, isLoading } = useQuery({
    queryKey: ["employees", search, page],
    queryFn: async () => {
      const res = await api.get("/employees", { params: { search: search || undefined, page, limit: 20 } });
      return { items: res.data.data as Employee[], meta: res.data.meta as PaginationMeta };
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/employees/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      toast({ title: "Employee deleted", variant: "success" });
    },
    onError: (err) => toast({ title: "Failed", description: errorMessage(err), variant: "destructive" }),
  });

  return (
    <div>
      <PageHeader
        title="Employees"
        description="Manage your institution's workforce"
        actions={
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Add Employee
          </Button>
        }
      />

      <div className="mb-4 flex items-center gap-2">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search employees…" className="pl-8" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : (data?.items.length ?? 0) === 0 ? (
          <EmptyState />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Designation</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Basic Salary</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.items.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {e.firstName[0]}
                        {e.lastName[0]}
                      </div>
                      <div>
                        <p className="font-medium">
                          {e.firstName} {e.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">{e.employeeNumber}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{e.department?.name ?? "—"}</TableCell>
                  <TableCell>{e.designation?.name ?? "—"}</TableCell>
                  <TableCell className="capitalize">{e.employmentType.toLowerCase().replace("_", " ")}</TableCell>
                  <TableCell>{formatCurrency(e.basicSalary, currency)}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(e.status)}>{e.status.toLowerCase()}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="outline" size="sm" title="Edit" onClick={() => { setEditing(e); setAddOpen(true); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" title="Delete" onClick={() => deleteMutation.mutate(e.id)} disabled={deleteMutation.isPending}>
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

      <Pagination meta={data?.meta} page={page} onPage={setPage} />

      <AddEmployeeDialog
        open={addOpen}
        editing={editing}
        onClose={() => { setAddOpen(false); setEditing(null); }}
        onCreated={() => qc.invalidateQueries({ queryKey: ["employees"] })}
      />
    </div>
  );
}

interface EmployeeForm {
  employeeNumber: string;
  currency: string;
  nationalId: string;
  firstName: string;
  lastName: string;
  fatherName: string;
  dateOfBirth: string;
  gender: string;
  email: string;
  phone: string;
  address: string;
  emergencyContact: string;
  departmentName: string;
  designationName: string;
  branchId: string;
  employmentType: string;
  basicSalary: string;
  salaryType: string;
  paymentMethod: string;
  joiningDate: string;
  bankName: string;
  accountTitle: string;
  accountNumber: string;
  status: string;
}

const EMPTY_FORM: EmployeeForm = {
  employeeNumber: "",
  currency: "",
  nationalId: "",
  firstName: "",
  lastName: "",
  fatherName: "",
  dateOfBirth: "",
  gender: "",
  email: "",
  phone: "",
  address: "",
  emergencyContact: "",
  departmentName: "",
  designationName: "",
  branchId: "",
  employmentType: "PERMANENT",
  basicSalary: "",
  salaryType: "MONTHLY",
  paymentMethod: "BANK_TRANSFER",
  joiningDate: "",
  bankName: "",
  accountTitle: "",
  accountNumber: "",
  status: "ACTIVE",
};

function AddEmployeeDialog({ open, editing, onClose, onCreated }: { open: boolean; editing: Employee | null; onClose: () => void; onCreated: () => void }) {
  const { toast } = useToast();
  const { user, refreshUser } = useAuth();
  const tenantCurrency = user?.tenant?.currency ?? "USD";
  const [form, setForm] = useState<EmployeeForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<"nationalId" | "phone" | "emergencyContact", string>>>({});
  const [submitting, setSubmitting] = useState(false);

  const { data: branches } = useQuery({
    queryKey: ["branches"],
    enabled: open,
    queryFn: async () => (await api.get("/branches", { params: { limit: 100 } })).data.data as { id: string; name: string }[],
  });

  const { data: countries } = useQuery({
    queryKey: ["countries"],
    enabled: open,
    queryFn: async () => (await api.get("/onboarding/countries")).data.data as Country[],
  });

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        ...EMPTY_FORM,
        currency: tenantCurrency,
        firstName: editing.firstName,
        lastName: editing.lastName,
        fatherName: editing.fatherName ?? "",
        employeeNumber: editing.employeeNumber,
        nationalId: editing.nationalId ?? "",
        dateOfBirth: toDateInput(editing.dateOfBirth),
        gender: editing.gender ?? "",
        email: editing.email ?? "",
        phone: editing.phone ?? "",
        address: editing.address ?? "",
        emergencyContact: editing.emergencyContact ?? "",
        departmentName: editing.department?.name ?? "",
        designationName: editing.designation?.name ?? "",
        branchId: editing.branch?.id ?? "",
        employmentType: editing.employmentType,
        status: editing.status,
        basicSalary: String(editing.basicSalary),
        salaryType: editing.salaryType ?? "MONTHLY",
        paymentMethod: editing.paymentMethod ?? "BANK_TRANSFER",
        joiningDate: toDateInput(editing.joiningDate),
        bankName: editing.bankName ?? "",
        accountTitle: editing.accountTitle ?? "",
        accountNumber: editing.accountNumber ?? "",
      });
    } else {
      setForm({ ...EMPTY_FORM, currency: tenantCurrency });
    }
    setErrors({});
  }, [open, editing, tenantCurrency]);

  if (!open) return null;

  const set = (key: keyof EmployeeForm, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();

    const validationErrors: Partial<Record<"nationalId" | "phone" | "emergencyContact", string>> = {};
    if (form.nationalId && !isValidCnic(form.nationalId)) {
      validationErrors.nationalId = "CNIC must be 13 digits (e.g. 12345-1234567-1)";
    }
    if (form.phone && !isValidPhoneNumber(form.phone)) {
      validationErrors.phone = "Phone must be 11 digits";
    }
    if (form.emergencyContact && !isValidPhoneNumber(form.emergencyContact)) {
      validationErrors.emergencyContact = "Emergency contact must be 11 digits";
    }
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      toast({ title: "Please fix the highlighted fields", variant: "destructive" });
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const payload = {
        employeeNumber: form.employeeNumber || undefined,
        currency: form.currency || undefined,
        firstName: form.firstName,
        lastName: form.lastName,
        fatherName: form.fatherName || undefined,
        nationalId: form.nationalId || undefined,
        dateOfBirth: form.dateOfBirth || undefined,
        gender: form.gender || undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
        address: form.address || undefined,
        emergencyContact: form.emergencyContact || undefined,
        departmentName: form.departmentName || undefined,
        designationName: form.designationName || undefined,
        branchId: form.branchId || undefined,
        employmentType: form.employmentType,
        status: form.status,
        basicSalary: Number(form.basicSalary || 0),
        salaryType: form.salaryType || undefined,
        paymentMethod: form.paymentMethod || undefined,
        joiningDate: form.joiningDate || undefined,
        bankName: form.bankName || undefined,
        accountTitle: form.accountTitle || undefined,
        accountNumber: form.accountNumber || undefined,
      };
      if (editing) {
        await api.put(`/employees/${editing.id}`, payload);
        toast({ title: "Employee updated", variant: "success" });
      } else {
        await api.post("/employees", payload);
        toast({ title: "Employee added", variant: "success" });
      }
      setForm(EMPTY_FORM);
      refreshUser();
      onCreated();
      onClose();
    } catch (err) {
      toast({ title: editing ? "Failed to update employee" : "Failed to add employee", description: errorMessage(err), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <form
        className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-lg border bg-card p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">{editing ? "Edit Employee" : "Add Employee"}</h2>
            <p className="text-sm text-muted-foreground">Fill in the employee's basic details.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label>First name *</Label>
            <Input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} placeholder="Muhammad" required />
          </div>
          <div className="space-y-1.5">
            <Label>Last name *</Label>
            <Input value={form.lastName} onChange={(e) => set("lastName", e.target.value)} placeholder="Burhan" required />
          </div>
          <div className="space-y-1.5">
            <Label>Employee ID</Label>
            <Input value={form.employeeNumber} onChange={(e) => set("employeeNumber", e.target.value)} placeholder="Auto-generated if empty" />
          </div>
          <div className="space-y-1.5">
            <Label>CNIC</Label>
            <Input value={form.nationalId} onChange={(e) => set("nationalId", formatCnic(e.target.value))} placeholder="12345-1234567-1" maxLength={15} />
            {errors.nationalId && <p className="text-xs text-destructive">{errors.nationalId}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Father name</Label>
            <Input value={form.fatherName} onChange={(e) => set("fatherName", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Date of birth</Label>
            <Input type="date" value={form.dateOfBirth} onChange={(e) => set("dateOfBirth", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Gender</Label>
            <Select
              value={form.gender}
              onChange={(e) => set("gender", e.target.value)}
              options={[
                { label: "Male", value: "MALE" },
                { label: "Female", value: "FEMALE" },
                { label: "Other", value: "OTHER" },
              ]}
              placeholder="Select gender"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="jane@institution.edu" />
          </div>
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input
              type="tel"
              inputMode="numeric"
              value={form.phone}
              maxLength={11}
              onChange={(e) => set("phone", formatPhoneNumber(e.target.value))}
            />
            {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Address</Label>
            <Input value={form.address} onChange={(e) => set("address", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Emergency contact</Label>
            <Input
              type="tel"
              inputMode="numeric"
              value={form.emergencyContact}
              maxLength={11}
              onChange={(e) => set("emergencyContact", formatPhoneNumber(e.target.value))}
            />
            {errors.emergencyContact && <p className="text-xs text-destructive">{errors.emergencyContact}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Country / Currency</Label>
            <Select
              value={form.currency}
              onChange={(e) => set("currency", e.target.value)}
              options={(countries ?? []).map((c) => ({ label: `${c.name} (${c.currency})`, value: c.currency }))}
              placeholder="Select country"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Basic salary</Label>
            <div className="flex items-center gap-2">
              <Input type="number" min={0} value={form.basicSalary} onChange={(e) => set("basicSalary", e.target.value)} placeholder="0" />
              <span className="text-sm font-semibold text-muted-foreground">{form.currency || tenantCurrency}</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Salary type</Label>
            <Select
              value={form.salaryType}
              onChange={(e) => set("salaryType", e.target.value)}
              options={[
                { label: "Monthly", value: "MONTHLY" },
                { label: "Weekly", value: "WEEKLY" },
                { label: "Daily", value: "DAILY" },
                { label: "Hourly", value: "HOURLY" },
              ]}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Payment method</Label>
            <Select
              value={form.paymentMethod}
              onChange={(e) => set("paymentMethod", e.target.value)}
              options={[
                { label: "Bank transfer", value: "BANK_TRANSFER" },
                { label: "Cash", value: "CASH" },
                { label: "Cheque", value: "CHEQUE" },
              ]}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Department</Label>
            <Input value={form.departmentName} onChange={(e) => set("departmentName", e.target.value)} placeholder="e.g. Science" />
          </div>
          <div className="space-y-1.5">
            <Label>Designation</Label>
            <Input value={form.designationName} onChange={(e) => set("designationName", e.target.value)} placeholder="e.g. Lecturer" />
          </div>
          <div className="space-y-1.5">
            <Label>Branch</Label>
            <Select
              value={form.branchId}
              onChange={(e) => set("branchId", e.target.value)}
              options={(branches ?? []).map((b) => ({ label: b.name, value: b.id }))}
              placeholder="Select branch"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Employment type</Label>
            <Select
              value={form.employmentType}
              onChange={(e) => set("employmentType", e.target.value)}
              options={[
                { label: "Permanent", value: "PERMANENT" },
                { label: "Contract", value: "CONTRACT" },
                { label: "Part time", value: "PART_TIME" },
                { label: "Visiting", value: "VISITING" },
                { label: "Temporary", value: "TEMPORARY" },
              ]}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select
              value={form.status}
              onChange={(e) => set("status", e.target.value)}
              options={[
                { label: "Active", value: "ACTIVE" },
                { label: "Inactive", value: "INACTIVE" },
                { label: "Resigned", value: "RESIGNED" },
                { label: "Terminated", value: "TERMINATED" },
                { label: "Retired", value: "RETIRED" },
                { label: "Suspended", value: "SUSPENDED" },
              ]}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Joining date</Label>
            <Input type="date" value={form.joiningDate} onChange={(e) => set("joiningDate", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Bank name</Label>
            <Input value={form.bankName} onChange={(e) => set("bankName", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Account title</Label>
            <Input value={form.accountTitle} onChange={(e) => set("accountTitle", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Account number</Label>
            <Input value={form.accountNumber} onChange={(e) => set("accountNumber", e.target.value)} />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? (editing ? "Saving…" : "Adding…") : editing ? "Save Changes" : "Add Employee"}
          </Button>
        </div>
      </form>
    </div>
  );
}

export function Pagination({ meta, page, onPage }: { meta?: PaginationMeta; page: number; onPage: (p: number) => void }) {
  if (!meta || meta.totalPages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
      <span>
        {meta.total} record{meta.total === 1 ? "" : "s"}
      </span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </Button>
        <Button variant="outline" size="sm" disabled={page >= meta.totalPages} onClick={() => onPage(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Users className="mb-3 h-10 w-10 text-muted-foreground/50" />
      <p className="font-medium">No employees found</p>
      <p className="text-sm text-muted-foreground">Add your first employee to get started.</p>
    </div>
  );
}
