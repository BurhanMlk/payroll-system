export interface PermissionDef {

  key: string;

  module: string;

  action: string;

  description?: string;

}



export const PERMISSIONS: PermissionDef[] = [

  // Employees

  { key: "employee.create", module: "employee", action: "create", description: "Create employees" },

  { key: "employee.read", module: "employee", action: "read", description: "View employees" },

  { key: "employee.update", module: "employee", action: "update", description: "Edit employees" },

  { key: "employee.delete", module: "employee", action: "delete", description: "Archive/delete employees" },

  { key: "document.manage", module: "employee", action: "manage", description: "Manage employee documents" },



  // Organization

  { key: "department.manage", module: "organization", action: "manage", description: "Manage departments" },

  { key: "designation.manage", module: "organization", action: "manage", description: "Manage designations" },

  { key: "branch.manage", module: "organization", action: "manage", description: "Manage branches" },



  // Attendance

{ key: "attendance.read", module: "attendance", action: "read", description: "View attendance" },

{ key: "attendance.manage", module: "attendance", action: "manage", description: "Manage attendance" },



{ key: "biometric.read", module: "attendance", action: "read", description: "View biometric devices, mappings and punch logs" },

{ key: "biometric.manage", module: "attendance", action: "manage", description: "Manage biometric devices, employee mappings and punch logs" },



{ key: "shift.manage", module: "attendance", action: "manage", description: "Manage shifts" },

{ key: "holiday.manage", module: "attendance", action: "manage", description: "Manage holidays" },



  // Leave

  { key: "leave.request", module: "leave", action: "request", description: "Request leave" },

  { key: "leave.read", module: "leave", action: "read", description: "View leave" },

  { key: "leave.approve", module: "leave", action: "approve", description: "Approve/reject leave" },

  { key: "leave.manage", module: "leave", action: "manage", description: "Manage leave types" },



  // Salary structure

  { key: "salary.manage", module: "salary", action: "manage", description: "Manage salary structures" },

  { key: "template.manage", module: "salary", action: "manage", description: "Manage salary templates" },

  { key: "overtime.manage", module: "attendance", action: "manage", description: "Manage overtime" },



  // Payroll

  { key: "payroll.generate", module: "payroll", action: "generate", description: "Generate payroll" },

  { key: "payroll.read", module: "payroll", action: "read", description: "View payroll" },

  { key: "payroll.review", module: "payroll", action: "review", description: "Review payroll" },

  { key: "payroll.approve", module: "payroll", action: "approve", description: "Approve payroll" },

  { key: "payroll.mark_paid", module: "payroll", action: "mark_paid", description: "Mark payroll paid" },

  { key: "payroll.unlock", module: "payroll", action: "unlock", description: "Unlock finalized payroll" },



  // Finance

  { key: "loan.create", module: "finance", action: "create", description: "Create loans" },

  { key: "loan.approve", module: "finance", action: "approve", description: "Approve loans" },

  { key: "loan.read", module: "finance", action: "read", description: "View loans" },

  { key: "advance.create", module: "finance", action: "create", description: "Create salary advances" },

  { key: "advance.approve", module: "finance", action: "approve", description: "Approve salary advances" },



  // Reports

  { key: "reports.view", module: "reports", action: "view", description: "View reports" },

  { key: "reports.export", module: "reports", action: "export", description: "Export reports" },



  // Settings

  { key: "settings.manage", module: "settings", action: "manage", description: "Manage settings" },

  { key: "user.manage", module: "settings", action: "manage", description: "Manage users" },

  { key: "role.manage", module: "settings", action: "manage", description: "Manage roles & permissions" },

  { key: "notification.manage", module: "settings", action: "manage", description: "Manage notification templates" },

  { key: "billing.manage", module: "billing", action: "manage", description: "Manage billing & subscription" },

];



export const PLATFORM_PERMISSIONS: PermissionDef[] = [

  { key: "platform.tenant.read", module: "platform", action: "read", description: "View institutions" },

  { key: "platform.tenant.manage", module: "platform", action: "manage", description: "Manage institutions" },

  { key: "platform.plan.manage", module: "platform", action: "manage", description: "Manage subscription plans" },

  { key: "platform.subscription.manage", module: "platform", action: "manage", description: "Manage subscriptions" },

  { key: "platform.revenue.view", module: "platform", action: "view", description: "View revenue analytics" },

  { key: "platform.audit.view", module: "platform", action: "view", description: "View audit logs" },

  { key: "platform.setting.manage", module: "platform", action: "manage", description: "Manage platform settings" },

  { key: "platform.impersonate", module: "platform", action: "impersonate", description: "Impersonate tenant admin" },

  { key: "platform.job.view", module: "platform", action: "view", description: "View background jobs" },

];



export const ALL_PERMISSIONS = [...PERMISSIONS, ...PLATFORM_PERMISSIONS];



export interface RoleDef {

  key: string;

  name: string;

  scope: "PLATFORM" | "TENANT";

  isSystem: boolean;

  description?: string;

  permissions: string[];

}



const tenantPermissionKeys = PERMISSIONS.map((p) => p.key);

const platformPermissionKeys = PLATFORM_PERMISSIONS.map((p) => p.key);



export const DEFAULT_ROLES: RoleDef[] = [

  // Platform

  {

    key: "super_admin",

    name: "Super Admin",

    scope: "PLATFORM",

    isSystem: true,

    description: "Full platform access",

    permissions: platformPermissionKeys,

  },

  {

    key: "platform_support",

    name: "Platform Support",

    scope: "PLATFORM",

    isSystem: true,

    description: "Limited platform support access",

    permissions: ["platform.tenant.read", "platform.audit.view", "platform.revenue.view", "platform.job.view"],

  },

  // Tenant

  {

    key: "owner",

    name: "Institution Owner",

    scope: "TENANT",

    isSystem: true,

    description: "Full access to the institution",

    permissions: tenantPermissionKeys,

  },

  {

    key: "principal",

    name: "Principal / Director",

    scope: "TENANT",

    isSystem: true,

    description: "Approves payroll and views reports",

    permissions: [

      "employee.read",

      "attendance.read",

      "leave.read",

      "leave.approve",

      "payroll.read",

      "payroll.review",

      "payroll.approve",

      "payroll.unlock",

      "loan.read",

      "loan.approve",

      "advance.approve",

      "reports.view",

      "reports.export",

    ],

  },

  {

    key: "hr_manager",

    name: "HR Manager",

    scope: "TENANT",

    isSystem: true,

    description: "Manages employees, attendance, leave and payroll review",

    permissions: [

      "employee.create",

      "employee.read",

      "employee.update",

      "employee.delete",

      "document.manage",

      "department.manage",

      "designation.manage",

      "branch.manage",

      "attendance.read",

      "attendance.manage",
    "biometric.read",
    "biometric.manage",

      "shift.manage",

      "holiday.manage",

      "leave.read",

      "leave.request",

      "leave.approve",

      "leave.manage",

      "salary.manage",

      "template.manage",

      "overtime.manage",

      "payroll.read",

      "payroll.review",

      "loan.create",

      "loan.approve",

      "loan.read",

      "advance.create",

      "advance.approve",

      "reports.view",

      "reports.export",

      "settings.manage",

      "user.manage",

    ],

  },

  {

    key: "accountant",

    name: "Accountant",

    scope: "TENANT",

    isSystem: true,

    description: "Processes payroll and finances",

    permissions: [

      "employee.read",

      "attendance.read",

      "leave.read",

      "salary.manage",

      "template.manage",

      "overtime.manage",

      "payroll.generate",

      "payroll.read",

      "payroll.review",

      "payroll.mark_paid",

      "loan.create",

      "loan.approve",

      "loan.read",

      "advance.create",

      "advance.approve",

      "reports.view",

      "reports.export",

    ],

  },

  {

    key: "branch_manager",

    name: "Branch Manager",

    scope: "TENANT",

    isSystem: true,

    description: "Manages employees and attendance in their branch",

    permissions: [

      "employee.read",

      "employee.update",

      "attendance.read",

      "attendance.manage",

      "biometric.read",

    "biometric.manage",

      "leave.read",

      "leave.approve",

      "reports.view",

    ],

  },

  {

    key: "department_manager",

    name: "Department Manager",

    scope: "TENANT",

    isSystem: true,

    description: "Approves leave and views department data",

    permissions: ["employee.read", "attendance.read", "leave.read", "leave.approve", "reports.view"],

  },

  {

    key: "employee",

    name: "Employee",

    scope: "TENANT",

    isSystem: true,

    description: "Employee self-service access",

    permissions: ["leave.request", "leave.read", "attendance.read"],

  },

];
