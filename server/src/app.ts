import express, { Express, Router } from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";
import path from "node:path";

import { env, corsOrigins } from "./config/env";

import { apiLimiter } from "./middlewares/rateLimiter";
import {
  errorHandler,
  notFoundHandler,
} from "./middlewares/errorHandler";
import { requireAuth } from "./middlewares/requireAuth";
import { resolveTenant } from "./middlewares/resolveTenant";

import authRoutes from "./routes/auth.routes";

import employeePortalRoutes from "./modules/employeePortal/employeePortal.routes";

import onboardingRoutes from "./modules/onboarding/onboarding.routes";
import { orgRouter } from "./modules/org/org.routes";
import employeesRoutes from "./modules/employees/employees.routes";
import attendanceRoutes from "./modules/attendance/attendance.routes";
import biometricRoutes from "./modules/biometric/biometric.routes";
import shiftsRoutes from "./modules/shifts/shifts.routes";
import holidaysRoutes from "./modules/holidays/holidays.routes";
import leaveRoutes from "./modules/leave/leave.routes";
import salaryRoutes from "./modules/salary/salary.routes";
import payrollRoutes from "./modules/payroll/payroll.routes";
import financeRoutes from "./modules/finance/finance.routes";
import reportsRoutes from "./modules/reports/reports.routes";
import notificationsRoutes from "./modules/notifications/notifications.routes";
import billingRoutes from "./modules/billing/billing.routes";
import usersRoutes from "./modules/users/users.routes";
import rbacRoutes from "./modules/rbac/rbac.routes";
import meRoutes from "./modules/me/me.routes";
import dashboardRoutes from "./modules/dashboard/dashboard.routes";
import platformRoutes from "./modules/platform/platform.routes";

export function createApp(): Express {
  const app = express();

  // --------------------------------------------------------------------------
  // BASIC SERVER CONFIG
  // --------------------------------------------------------------------------

  if (env.TRUST_PROXY === "true") {
    app.set("trust proxy", 1);
  }

  app.disable("x-powered-by");

  // --------------------------------------------------------------------------
  // SECURITY + COMMON MIDDLEWARE
  // --------------------------------------------------------------------------

  app.use(helmet());

  app.use(
    cors({
      origin: corsOrigins,
      credentials: true,
      methods: [
        "GET",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
        "OPTIONS",
      ],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "X-Request-Id",
      ],
    }),
  );

  app.use(compression());

  app.use(
    express.json({
      limit: "2mb",
    }),
  );

  app.use(
    express.urlencoded({
      extended: true,
    }),
  );

  app.use(cookieParser());

  // --------------------------------------------------------------------------
  // REQUEST ID
  // --------------------------------------------------------------------------

  app.use((req, res, next) => {
    req.requestId =
      (req.headers["x-request-id"] as string) ??
      randomUUID();

    res.setHeader(
      "X-Request-Id",
      req.requestId,
    );

    next();
  });

  // --------------------------------------------------------------------------
  // HEALTH CHECK
  // --------------------------------------------------------------------------

  app.get(
    "/api/v1/health",
    (_req, res) => {
      res.json({
        success: true,
        data: {
          status: "ok",
          service: "edupayroll-api",
          version: "1.0.0",
          time: new Date().toISOString(),
        },
      });
    },
  );

  // --------------------------------------------------------------------------
  // API RATE LIMITER
  //
  // Important:
  // This must come BEFORE the API routes.
  // --------------------------------------------------------------------------

  app.use(
    "/api/v1",
    apiLimiter,
  );

  // --------------------------------------------------------------------------
  // PUBLIC ROUTES
  // --------------------------------------------------------------------------

  app.use(
    "/api/v1/auth",
    authRoutes,
  );

  app.use(
    "/api/v1/onboarding",
    onboardingRoutes,
  );

  app.use(
    "/api/v1/employee-portal",
    employeePortalRoutes,
  );

  // --------------------------------------------------------------------------
  // TENANT-SCOPED ROUTES
  // --------------------------------------------------------------------------

  const tenantRouter = Router();

  // Every route below requires authentication
  // and a valid tenant context.
  tenantRouter.use(
    requireAuth,
    resolveTenant,
  );

  tenantRouter.use(
    "/dashboard",
    dashboardRoutes,
  );

  tenantRouter.use(
    "/employees",
    employeesRoutes,
  );

  tenantRouter.use(
    "/departments",
    orgRouter(
      "department",
      "department.manage",
    ),
  );

  tenantRouter.use(
    "/designations",
    orgRouter(
      "designation",
      "designation.manage",
    ),
  );

  tenantRouter.use(
    "/branches",
    orgRouter(
      "branch",
      "branch.manage",
    ),
  );

  tenantRouter.use(
    "/attendance",
    attendanceRoutes,
  );

  // --------------------------------------------------------------------------
  // BIOMETRIC ATTENDANCE
  // --------------------------------------------------------------------------

  tenantRouter.use(
    "/biometric",
    biometricRoutes,
  );

  tenantRouter.use(
    "/shifts",
    shiftsRoutes,
  );

  tenantRouter.use(
    "/holidays",
    holidaysRoutes,
  );

  tenantRouter.use(
    "/leaves",
    leaveRoutes,
  );

  tenantRouter.use(
    "/salary",
    salaryRoutes,
  );

  tenantRouter.use(
    "/payroll",
    payrollRoutes,
  );

  tenantRouter.use(
    "/finance",
    financeRoutes,
  );

  tenantRouter.use(
    "/reports",
    reportsRoutes,
  );

  tenantRouter.use(
    "/notifications",
    notificationsRoutes,
  );

  tenantRouter.use(
    "/billing",
    billingRoutes,
  );

  tenantRouter.use(
    "/users",
    usersRoutes,
  );

  tenantRouter.use(
    "/rbac",
    rbacRoutes,
  );

  tenantRouter.use(
    "/me",
    meRoutes,
  );

  app.use(
    "/api/v1",
    tenantRouter,
  );

  // --------------------------------------------------------------------------
  // PLATFORM / SUPER ADMIN ROUTES
  // --------------------------------------------------------------------------

  // requireAuth is handled inside platformRoutes.
  app.use(
    "/api/v1/platform",
    platformRoutes,
  );

  // --------------------------------------------------------------------------
  // STATIC FILE STORAGE
  // --------------------------------------------------------------------------

  if (env.STORAGE_DRIVER === "local") {
    app.use(
      "/storage",
      express.static(
        path.resolve(
          env.STORAGE_LOCAL_PATH,
        ),
      ),
    );
  }

  // --------------------------------------------------------------------------
  // 404 + GLOBAL ERROR HANDLER
  // --------------------------------------------------------------------------

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}