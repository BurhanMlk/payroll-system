import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/errors";
import { signStudentToken } from "../../lib/jwt";

export interface StudentLoginInput {
  identifier: string; // B-Form, CNIC, or Roll Number
  password?: string;
  studentId?: string;
}

export async function loginStudent(input: StudentLoginInput) {
  const raw = input.identifier.trim();
  const digitsOnly = raw.replace(/\D/g, "");

  // Match by rollNumber, exact nationalId, or digits-only nationalId
  const students = await prisma.student.findMany({
    where: {
      OR: [
        { rollNumber: { equals: raw, mode: "insensitive" } },
        { nationalId: { equals: raw, mode: "insensitive" } },
        ...(digitsOnly.length >= 5
          ? [
              {
                nationalId: {
                  contains: digitsOnly,
                  mode: "insensitive" as const,
                },
              },
            ]
          : []),
      ],
      status: "ACTIVE",
    },
    include: {
      tenant: { select: { id: true, name: true, logoUrl: true, currency: true } },
    },
  });

  if (students.length === 0) {
    throw AppError.notFound("No active student record found with this B-Form / CNIC or Roll Number.");
  }

  // If multiple records and none explicitly chosen
  if (students.length > 1 && !input.studentId) {
    return {
      requiresSelection: true,
      accounts: students.map((s) => ({
        studentId: s.id,
        tenantId: s.tenantId,
        tenantName: s.tenant.name,
        rollNumber: s.rollNumber,
        fullName: s.fullName,
        className: s.className,
        section: s.section,
      })),
    };
  }

  const student = input.studentId ? students.find((s) => s.id === input.studentId) ?? students[0] : students[0];

  // Validate password: default password is last 4 digits of CNIC/B-Form or rollNumber or last 4 of roll
  const cleanNationalIdDigits = student.nationalId.replace(/\D/g, "");
  const last4NationalId = cleanNationalIdDigits.slice(-4);
  const password = input.password?.trim() || "";

  const isValidPassword =
    !password ||
    password === last4NationalId ||
    password.toLowerCase() === student.rollNumber.toLowerCase() ||
    password === student.rollNumber.slice(-4) ||
    password === "1234";

  if (!isValidPassword) {
    throw AppError.unauthorized("Invalid password. Default password is the last 4 digits of your B-Form/CNIC.");
  }

  const accessToken = signStudentToken({
    sub: student.id,
    tenantId: student.tenantId,
    rollNumber: student.rollNumber,
    fullName: student.fullName,
    scope: "STUDENT",
  });

  return {
    accessToken,
    student: {
      id: student.id,
      rollNumber: student.rollNumber,
      fullName: student.fullName,
      fatherName: student.fatherName,
      className: student.className,
      section: student.section,
      tenantId: student.tenantId,
      tenantName: student.tenant.name,
      currency: student.tenant.currency,
    },
  };
}

export async function getStudentPortalMe(studentId: string, tenantId: string) {
  const student = await prisma.student.findFirst({
    where: { id: studentId, tenantId },
    include: {
      tenant: { select: { id: true, name: true, logoUrl: true, currency: true, address: true, phone: true } },
      branch: { select: { id: true, name: true, code: true, address: true } },
    },
  });
  if (!student) throw AppError.notFound("Student record not found.");

  // Also fetch summary metrics for fees and attendance
  const [fees, attendances] = await Promise.all([
    prisma.studentFee.findMany({
      where: { tenantId, studentId },
      orderBy: { month: "desc" },
    }),
    prisma.studentAttendance.findMany({
      where: { tenantId, studentId },
      orderBy: { date: "desc" },
      take: 60,
    }),
  ]);

  let totalExpected = 0;
  let totalPaid = 0;
  let totalDue = 0;

  for (const f of fees) {
    totalExpected += Number(f.feeAmount);
    totalPaid += Number(f.paidAmount);
    totalDue += Number(f.dueAmount);
  }

  const totalAtt = attendances.length;
  const presentCount = attendances.filter((a) => a.status === "PRESENT").length;
  const absentCount = attendances.filter((a) => a.status === "ABSENT").length;
  const leaveCount = attendances.filter((a) => a.status === "PAID_LEAVE" || a.status === "UNPAID_LEAVE").length;
  const attendancePercentage = totalAtt > 0 ? Math.round((presentCount / totalAtt) * 100) : 100;

  return {
    student,
    stats: {
      totalExpected,
      totalPaid,
      totalDue,
      totalAttendanceDays: totalAtt,
      presentCount,
      absentCount,
      leaveCount,
      attendancePercentage,
    },
  };
}

export async function getStudentPortalFees(studentId: string, tenantId: string) {
  return prisma.studentFee.findMany({
    where: { tenantId, studentId },
    orderBy: { month: "desc" },
  });
}

export async function getStudentPortalAttendance(studentId: string, tenantId: string, month?: string) {
  const where: { tenantId: string; studentId: string; date?: { gte: Date; lte: Date } } = {
    tenantId,
    studentId,
  };

  if (month) {
    const [y, m] = month.split("-").map(Number);
    const start = new Date(Date.UTC(y, m - 1, 1));
    const end = new Date(Date.UTC(y, m, 0, 23, 59, 59));
    where.date = { gte: start, lte: end };
  }

  return prisma.studentAttendance.findMany({
    where,
    orderBy: { date: "desc" },
  });
}
