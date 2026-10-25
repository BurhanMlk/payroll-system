import { PrismaClient, Prisma, AttendanceStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { env } from "../src/config/env";

const prisma = new PrismaClient();

const fakeReq = (tenantId?: string, userId?: string) =>
  ({
    tenant: tenantId ? { id: tenantId } : undefined,
    user: userId ? { id: userId } : undefined,
    ip: "127.0.0.1",
    headers: { "user-agent": "seed-script" },
  }) as never;

async function seedPermissionsAndRoles() {
  const { ALL_PERMISSIONS, DEFAULT_ROLES } = await import("../src/constants/permissions");

  // Keep the permission catalog up to date.
  for (const p of ALL_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: p.key },
      update: {
        module: p.module,
        action: p.action,
        description: p.description,
      },
      create: {
        key: p.key,
        module: p.module,
        action: p.action,
        description: p.description,
      },
    });
  }

  // Sync platform roles.
  for (const roleDef of DEFAULT_ROLES.filter((r) => r.scope === "PLATFORM")) {
    let role = await prisma.role.findFirst({
      where: { tenantId: null, key: roleDef.key },
    });

    if (!role) {
      role = await prisma.role.create({
        data: {
          tenantId: null,
          scope: "PLATFORM",
          key: roleDef.key,
          name: roleDef.name,
          description: roleDef.description,
          isSystem: true,
        },
      });
    } else {
      role = await prisma.role.update({
        where: { id: role.id },
        data: {
          name: roleDef.name,
          description: roleDef.description,
          isSystem: true,
        },
      });
    }

    const perms = await prisma.permission.findMany({
      where: { key: { in: roleDef.permissions } },
    });

    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });

    if (perms.length > 0) {
      await prisma.rolePermission.createMany({
        data: perms.map((p) => ({
          roleId: role.id,
          permissionId: p.id,
        })),
        skipDuplicates: true,
      });
    }
  }

  // Sync default tenant roles for every existing tenant.
  // This ensures newly-added permissions (e.g. biometric.read/manage)
  // are added to existing owner/HR/branch-manager roles too.
  const tenants = await prisma.tenant.findMany({ select: { id: true } });
  const tenantRoleDefs = DEFAULT_ROLES.filter((r) => r.scope === "TENANT");

  for (const tenant of tenants) {
    for (const roleDef of tenantRoleDefs) {
      let role = await prisma.role.findFirst({
        where: {
          tenantId: tenant.id,
          key: roleDef.key,
        },
      });

      if (!role) {
        role = await prisma.role.create({
          data: {
            tenantId: tenant.id,
            scope: "TENANT",
            key: roleDef.key,
            name: roleDef.name,
            description: roleDef.description,
            isSystem: true,
          },
        });
      } else {
        role = await prisma.role.update({
          where: { id: role.id },
          data: {
            name: roleDef.name,
            description: roleDef.description,
            isSystem: true,
          },
        });
      }

      const perms = await prisma.permission.findMany({
        where: { key: { in: roleDef.permissions } },
      });

      await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });

      if (perms.length > 0) {
        await prisma.rolePermission.createMany({
          data: perms.map((p) => ({
            roleId: role.id,
            permissionId: p.id,
          })),
          skipDuplicates: true,
        });
      }
    }
  }
}

async function seedPlans() {
  const plans = [
    {
      name: "Starter",
      key: "starter",
      monthlyPrice: 49,
      yearlyPrice: 490,
      employeeLimit: 50,
      branchLimit: 1,
      userLimit: 5,
      storageLimitMb: 1024,
      trialDays: 7,
      sortOrder: 1,
      features: [
        ["payroll.basic", "Core payroll", 1],
        ["attendance", "Attendance tracking", 1],
        ["reports.basic", "Basic reports", 1],
      ],
    },
    {
      name: "Professional",
      key: "professional",
      monthlyPrice: 99,
      yearlyPrice: 990,
      employeeLimit: 250,
      branchLimit: 5,
      userLimit: 20,
      storageLimitMb: 5120,
      trialDays: 7,
      sortOrder: 2,
      features: [
        ["payroll.basic", "Core payroll", 1],
        ["payroll.reports", "Advanced payroll", 1],
        ["attendance", "Attendance tracking", 1],
        ["leave_management", "Leave management", 1],
        ["loan_management", "Loan management", 1],
        ["reports.advanced", "Advanced reports & exports", 1],
      ],
    },
    {
      name: "Enterprise",
      key: "enterprise",
      monthlyPrice: 199,
      yearlyPrice: 1990,
      employeeLimit: 1000,
      branchLimit: 50,
      userLimit: 100,
      storageLimitMb: 51200,
      trialDays: 7,
      sortOrder: 3,
      features: [
        ["payroll.basic", "Core payroll", 1],
        ["payroll.reports", "Advanced payroll", 1],
        ["attendance", "Attendance tracking", 1],
        ["leave_management", "Leave management", 1],
        ["loan_management", "Loan management", 1],
        ["api_access", "API access", 1],
        ["priority_support", "Priority support", 1],
        ["reports.advanced", "Advanced reports & exports", 1],
      ],
    },
  ] as const;

  for (const plan of plans) {
    const created = await prisma.subscriptionPlan.upsert({
      where: { key: plan.key },
      update: {
        name: plan.name,
        monthlyPrice: new Prisma.Decimal(plan.monthlyPrice),
        yearlyPrice: new Prisma.Decimal(plan.yearlyPrice),
        employeeLimit: plan.employeeLimit,
        branchLimit: plan.branchLimit,
        userLimit: plan.userLimit,
        storageLimitMb: plan.storageLimitMb,
        trialDays: plan.trialDays,
        sortOrder: plan.sortOrder,
      },
      create: {
        name: plan.name,
        key: plan.key,
        monthlyPrice: new Prisma.Decimal(plan.monthlyPrice),
        yearlyPrice: new Prisma.Decimal(plan.yearlyPrice),
        currency: "USD",
        employeeLimit: plan.employeeLimit,
        branchLimit: plan.branchLimit,
        userLimit: plan.userLimit,
        storageLimitMb: plan.storageLimitMb,
        trialDays: plan.trialDays,
        sortOrder: plan.sortOrder,
      },
    });
    for (const [key, label] of plan.features) {
      await prisma.planFeature.upsert({
        where: { planId_key: { planId: created.id, key } },
        update: { label },
        create: { planId: created.id, key, label, enabled: true },
      });
    }
  }
}

async function seedCurrencies() {
  const currencies = [
    { code: "USD", name: "US Dollar", symbol: "$" },
    { code: "PKR", name: "Pakistani Rupee", symbol: "₨" },
    { code: "GBP", name: "British Pound", symbol: "£" },
    { code: "EUR", name: "Euro", symbol: "€" },
    { code: "INR", name: "Indian Rupee", symbol: "₹" },
    { code: "AED", name: "UAE Dirham", symbol: "د.إ" },
  ];
  for (const c of currencies) {
    await prisma.currency.upsert({ where: { code: c.code }, update: {}, create: c });
  }
}

async function seedSuperAdmin() {
  const existing = await prisma.user.findUnique({ where: { email: env.SUPER_ADMIN_EMAIL } });
  if (existing) return existing;

  const passwordHash = await bcrypt.hash(env.SUPER_ADMIN_PASSWORD, 12);
  const admin = await prisma.user.create({
    data: {
      tenantId: null,
      email: env.SUPER_ADMIN_EMAIL,
      fullName: "Platform Admin",
      passwordHash,
      status: "ACTIVE",
    },
  });
  const role = await prisma.role.findFirst({ where: { tenantId: null, key: "super_admin" } });
  if (role) await prisma.userRole.create({ data: { userId: admin.id, roleId: role.id } });
  return admin;
}

async function seedDemoTenant(name: string, slug: string, planKey: string) {
  const existing = await prisma.tenant.findUnique({ where: { slug } });
  if (existing) return existing;

  const plan = await prisma.subscriptionPlan.findUnique({ where: { key: planKey } });
  if (!plan) throw new Error(`Plan ${planKey} not found`);

  const tenant = await prisma.tenant.create({
    data: {
      name,
      slug,
      institutionType: "COLLEGE",
      currency: "USD",
      timezone: "UTC",
      status: "TRIALING",
    },
  });

  // Seed tenant roles.
  const { seedTenantRoles } = await import("../src/modules/rbac/rbac.service");
  await seedTenantRoles(tenant.id);

  const ownerRole = await prisma.role.findUnique({ where: { tenantId_key: { tenantId: tenant.id, key: "owner" } } });
  const passwordHash = await bcrypt.hash("Password@123", 12);

  const adminUser = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: `admin@${slug}.com`,
      fullName: `${name} Admin`,
      passwordHash,
      status: "ACTIVE",
    },
  });
  if (ownerRole) await prisma.userRole.create({ data: { userId: adminUser.id, roleId: ownerRole.id } });

  // Branch, departments, designations.
  const branch = await prisma.branch.create({ data: { tenantId: tenant.id, name: "Main Campus", code: "MAIN" } });
  const deptCS = await prisma.department.create({ data: { tenantId: tenant.id, name: "Computer Science", code: "CS" } });
  const deptMath = await prisma.department.create({ data: { tenantId: tenant.id, name: "Mathematics", code: "MATH" } });
  const deptAdmin = await prisma.department.create({ data: { tenantId: tenant.id, name: "Administration", code: "ADMIN" } });
  const desigLect = await prisma.designation.create({ data: { tenantId: tenant.id, name: "Lecturer", grade: "A" } });
  const desigProf = await prisma.designation.create({ data: { tenantId: tenant.id, name: "Professor", grade: "B" } });
  const desigAcct = await prisma.designation.create({ data: { tenantId: tenant.id, name: "Accountant", grade: "C" } });

  // Leave types.
  const leaveTypes = [
    { name: "Casual Leave", code: "CASUAL", quota: 10, paid: true },
    { name: "Sick Leave", code: "SICK", quota: 10, paid: true },
    { name: "Annual Leave", code: "ANNUAL", quota: 20, paid: true },
  ];
  for (const lt of leaveTypes) {
    await prisma.leaveType.create({ data: { tenantId: tenant.id, name: lt.name, code: lt.code, annualQuota: lt.quota, isPaid: lt.paid, approvalRequired: true } });
  }

  // Payroll cycle with 30 working days to match the documented example.
  await prisma.payrollCycle.create({
    data: {
      tenantId: tenant.id,
      name: "Monthly Payroll",
      type: "MONTHLY",
      payDay: 1,
      autoGenerateDay: 28,
      workingDaysMethod: "FIXED_DAYS",
      workingDaysPerMonth: 30,
      approvalFlow: { levels: [{ name: "HR Review" }, { name: "Accounts Approval" }] },
    },
  });

  // Subscription (trial).
  const now = new Date();
  const trialEnd = new Date(now.getTime() + plan.trialDays * 24 * 60 * 60 * 1000);
  await prisma.subscription.create({
    data: {
      tenantId: tenant.id,
      planId: plan.id,
      status: "TRIALING",
      billingPeriod: "MONTHLY",
      startDate: now,
      trialEndDate: trialEnd,
      currentPeriodStart: now,
      currentPeriodEnd: trialEnd,
      renewalDate: trialEnd,
      amount: plan.monthlyPrice,
      currency: "USD",
      autoRenew: true,
      paymentProvider: "MANUAL",
    },
  });

  // Demo employees.
  const employees = [
    {
      employeeNumber: "EMP-001",
      firstName: "John",
      lastName: "Doe",
      departmentId: deptCS.id,
      designationId: desigLect.id,
      basicSalary: 60000,
      components: [
        { name: "House Allowance", type: "EARNING", calculation: "FIXED", value: 10000 },
        { name: "Transport Allowance", type: "EARNING", calculation: "FIXED", value: 5000 },
        { name: "Medical Allowance", type: "EARNING", calculation: "FIXED", value: 3000 },
        { name: "Overtime", type: "EARNING", calculation: "FIXED", value: 2500 },
      ],
      loan: { amount: 40000, installments: 10 },
    },
    {
      employeeNumber: "EMP-002",
      firstName: "Jane",
      lastName: "Smith",
      departmentId: deptMath.id,
      designationId: desigProf.id,
      basicSalary: 80000,
      components: [
        { name: "House Allowance", type: "EARNING", calculation: "PERCENTAGE", value: 10 },
        { name: "Medical Allowance", type: "EARNING", calculation: "FIXED", value: 5000 },
      ],
      loan: null,
    },
    {
      employeeNumber: "EMP-003",
      firstName: "Alice",
      lastName: "Brown",
      departmentId: deptAdmin.id,
      designationId: desigAcct.id,
      basicSalary: 45000,
      components: [
        { name: "Transport Allowance", type: "EARNING", calculation: "FIXED", value: 3000 },
      ],
      loan: null,
    },
  ];

  for (const e of employees) {
    const employee = await prisma.employee.create({
      data: {
        tenantId: tenant.id,
        employeeNumber: e.employeeNumber,
        firstName: e.firstName,
        lastName: e.lastName,
        branchId: branch.id,
        departmentId: e.departmentId,
        designationId: e.designationId,
        employmentType: "PERMANENT",
        status: "ACTIVE",
        joiningDate: new Date(now.getFullYear(), 0, 15),
        email: `${e.firstName.toLowerCase()}.${e.lastName.toLowerCase()}@${slug}.com`,
        bankName: "Demo Bank",
        accountTitle: `${e.firstName} ${e.lastName}`,
        accountNumber: `ACCT-${e.employeeNumber}`,
        basicSalary: new Prisma.Decimal(e.basicSalary),
        salaryType: "MONTHLY",
        paymentMethod: "BANK_TRANSFER",
      },
    });

    await prisma.employeeSalaryStructure.create({
      data: {
        tenantId: tenant.id,
        employeeId: employee.id,
        basicSalary: new Prisma.Decimal(e.basicSalary),
        components: e.components as unknown as Prisma.InputJsonValue,
        effectiveFrom: new Date(),
        isActive: true,
      },
    });

    if (e.loan) {
      await prisma.employeeLoan.create({
        data: {
          tenantId: tenant.id,
          loanNumber: `LN-${e.employeeNumber}`,
          employeeId: employee.id,
          loanAmount: new Prisma.Decimal(e.loan.amount),
          approvedAmount: new Prisma.Decimal(e.loan.amount),
          issueDate: new Date(now.getFullYear(), 0, 1),
          installmentCount: e.loan.installments,
          installmentAmount: new Prisma.Decimal(e.loan.amount / e.loan.installments),
          remainingBalance: new Prisma.Decimal(e.loan.amount),
          startMonth: new Date(now.getFullYear(), now.getMonth(), 1),
          status: "ACTIVE",
        },
      });
    }
  }

  return tenant;
}

async function seedDemoPayroll(tenantSlug: string) {
  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant) return;

  const periodStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const periodEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59);

  const existing = await prisma.payrollRun.findFirst({ where: { tenantId: tenant.id, periodStart, periodEnd } });
  if (existing) return;

  // Seed attendance for EMP-001: 2 absent weekdays.
  const john = await prisma.employee.findFirst({ where: { tenantId: tenant.id, employeeNumber: "EMP-001" } });
  if (john) {
    let absentDaysMarked = 0;
    for (let day = 1; day <= 28; day++) {
      const d = new Date(periodStart.getFullYear(), periodStart.getMonth(), day);
      const dow = d.getDay();
      if (dow === 0 || dow === 6) continue;
      let status: AttendanceStatus = AttendanceStatus.PRESENT;
      if (absentDaysMarked < 2) {
        status = AttendanceStatus.ABSENT;
        absentDaysMarked += 1;
      }
      await prisma.attendance.upsert({
        where: {
          tenantId_employeeId_date: {
            tenantId: tenant.id,
            employeeId: john.id,
            date: d,
          },
        },
        update: {
          status,
          source: "MANUAL",
        },
        create: {
          tenantId: tenant.id,
          employeeId: john.id,
          date: d,
          status,
          source: "MANUAL",
        },
      });
    }
  }

  const { generatePayroll } = await import("../src/modules/payroll/payroll.service");
  await generatePayroll(tenant.id, { periodStart, periodEnd }, fakeReq(tenant.id));
}

async function main() {
  await seedPermissionsAndRoles();
  await seedPlans();
  await seedCurrencies();
  await seedSuperAdmin();

  const demoSeeded = env.SEED_DEMO_DATA !== "false";
  if (demoSeeded) {
    const tenantA = await seedDemoTenant("ABC College", "abc-college", "professional");
    const tenantB = await seedDemoTenant("XYZ School", "xyz-school", "starter");
    await seedDemoPayroll("abc-college");
    await seedDemoPayroll("xyz-school");
    console.log(`Seeded demo tenants: ${tenantA.name}, ${tenantB.name}`);
  }

  console.log("Seed completed.");
  console.log(`Super Admin login: ${env.SUPER_ADMIN_EMAIL} / ${env.SUPER_ADMIN_PASSWORD}`);
  if (demoSeeded) console.log("Demo tenant login: admin@abc-college.com / Password@123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
