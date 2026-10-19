import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { startOfDay, endOfDay, startOfMonth, endOfMonth, dayjs } from "../../utils/dates";

export async function getDashboard(tenantId: string) {
  const today = new Date();
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);

  const [
    totalEmployees,
    activeEmployees,
    onLeaveToday,
    presentToday,
    absentToday,
    lateToday,
    loansOutstanding,
    pendingLeaveApprovals,
    payrollSummary,
    departmentExpense,
    departmentDistribution,
    monthlyPayrollTrend,
    attendanceTrend,
    subscription,
  ] = await Promise.all([
    prisma.employee.count({ where: { tenantId } }),
    prisma.employee.count({ where: { tenantId, status: "ACTIVE" } }),
    prisma.leaveRequest.count({
      where: {
        tenantId,
        status: "APPROVED",
        startDate: { lte: endOfDay(today) },
        endDate: { gte: startOfDay(today) },
      },
    }),
    prisma.attendance.count({
      where: { tenantId, date: { gte: startOfDay(today), lte: endOfDay(today) }, status: { in: ["PRESENT", "LATE", "WORK_FROM_HOME"] } },
    }),
    prisma.attendance.count({
      where: { tenantId, date: { gte: startOfDay(today), lte: endOfDay(today) }, status: "ABSENT" },
    }),
    prisma.attendance.count({
      where: { tenantId, date: { gte: startOfDay(today), lte: endOfDay(today) }, status: "LATE" },
    }),
    prisma.employeeLoan.aggregate({
      where: { tenantId, status: "ACTIVE" },
      _sum: { remainingBalance: true },
    }),
    prisma.leaveRequest.count({ where: { tenantId, status: "PENDING" } }),
    prisma.payrollRun.groupBy({
      by: ["status"],
      where: { tenantId },
      _sum: { totalNet: true },
      _count: { _all: true },
    }),
    prisma.payrollItem.groupBy({
      by: ["employeeId"],
      where: { tenantId, payrollRun: { periodStart: { gte: monthStart, lte: monthEnd } } },
      _sum: { grossSalary: true },
    }),
    prisma.employee.groupBy({
      by: ["departmentId"],
      where: { tenantId, status: "ACTIVE" },
      _count: { _all: true },
    }),
    prisma.payrollRun.findMany({
      where: { tenantId, createdAt: { gte: dayjs().subtract(12, "month").toDate() } },
      orderBy: { periodStart: "asc" },
      select: { periodStart: true, totalNet: true, totalGross: true, status: true },
    }),
    prisma.attendance.groupBy({
      by: ["date"],
      where: { tenantId, date: { gte: dayjs().subtract(30, "day").toDate() } },
      _count: { _all: true },
    }),
    prisma.subscription.findUnique({ where: { tenantId }, include: { plan: true } }),
  ]);

  const payrollByStatus: Record<string, { count: number; sum: number }> = {};
  for (const p of payrollSummary) {
    payrollByStatus[p.status] = { count: p._count._all, sum: p._sum.totalNet?.toNumber() ?? 0 };
  }

  // Department names + expense mapping.
  const departments = await prisma.department.findMany({ where: { tenantId }, select: { id: true, name: true } });
  const deptName = new Map(departments.map((d) => [d.id, d.name]));
  const departmentExpenseData = departmentExpense
    .filter((d) => d.employeeId)
    .map((d) => ({ department: deptName.get(d.employeeId ?? "") ?? "Unknown", amount: d._sum.grossSalary?.toNumber() ?? 0 }));
  const employeesByDepartment = departmentDistribution.map((d) => ({
    department: deptName.get(d.departmentId ?? "") ?? "Unassigned",
    count: d._count._all,
  }));

  const monthlyPayroll = monthlyPayrollTrend.map((r) => ({
    month: dayjs(r.periodStart).format("MMM YYYY"),
    net: r.totalNet.toNumber(),
    gross: r.totalGross.toNumber(),
  }));

  const attendanceByDay = attendanceTrend.map((a) => ({ date: dayjs(a.date).format("MMM D"), count: a._count._all }));

  return {
    widgets: {
      totalEmployees,
      activeEmployees,
      onLeaveToday,
      presentToday,
      absentToday,
      lateToday,
      loansOutstanding: loansOutstanding._sum.remainingBalance?.toNumber() ?? 0,
      pendingLeaveApprovals,
      payrollProcessed: payrollByStatus["APPROVED"]?.count ?? 0,
      payrollPending: payrollByStatus["PENDING_REVIEW"]?.count ?? 0,
      payrollPaid: payrollByStatus["PAID"]?.count ?? 0,
      payrollDraft: payrollByStatus["CALCULATED"]?.count ?? 0,
      outstandingSalaries: (payrollByStatus["APPROVED"]?.sum ?? 0) + (payrollByStatus["PENDING_REVIEW"]?.sum ?? 0),
      monthlySalaryExpense: departmentExpense.reduce((s, d) => s + (d._sum.grossSalary?.toNumber() ?? 0), 0),
      subscriptionDaysRemaining: subscription ? Math.max(0, dayjs(subscription.renewalDate).diff(dayjs(), "day")) : 0,
      subscriptionStatus: subscription?.status ?? null,
      planName: subscription?.plan.name ?? null,
    },
    charts: {
      monthlyPayroll,
      attendanceByDay,
      employeesByDepartment,
      departmentExpense: departmentExpenseData,
      payrollStatus: Object.entries(payrollByStatus).map(([status, v]) => ({ status, count: v.count, sum: v.sum })),
    },
  };
}
