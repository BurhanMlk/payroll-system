import { NextFunction, Request, Response } from "express";
import { registerInstitution } from "./onboarding.service";
import { prisma } from "../../lib/prisma";
import { created, ok } from "../../lib/response";
import { COUNTRIES } from "./countries.data";

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await registerInstitution(req.body, req);
    created(res, {
      tenant: { id: result.tenant.id, name: result.tenant.name, slug: result.tenant.slug },
      user: { id: result.user.id, email: result.user.email, fullName: result.user.fullName },
      subscription: { status: result.subscription.status, renewalDate: result.subscription.renewalDate },
    });
  } catch (err) {
    next(err);
  }
}

export async function listPlansPublic(_req: Request, res: Response, next: NextFunction) {
  try {
    const plans = await prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      include: { features: true },
      orderBy: { sortOrder: "asc" },
    });
    ok(res, plans);
  } catch (err) {
    next(err);
  }
}

export async function listPublicStats(_req: Request, res: Response, next: NextFunction) {
  try {
    const [institutions, employees] = await Promise.all([
      prisma.tenant.count(),
      prisma.employee.count(),
    ]);
    ok(res, { institutions, employees });
  } catch (err) {
    next(err);
  }
}

export async function listCountries(_req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, COUNTRIES);
  } catch (err) {
    next(err);
  }
}

const DEFAULT_LANDING_CONTENT = {
  heroHeading: "Payroll for educational institutions,",
  heroAccent: "made simple.",
  heroSubtitle: "Manage salaries, attendance, leave, loans and payslips for your entire staff all in one professional, easy-to-use platform.",
  institutionsLabel: "Institutions onboarded",
  employeesLabel: "Employees paid monthly",
  uptimeValue: "99.9%",
  uptimeLabel: "Platform uptime",
  supportValue: "24/7",
  supportLabel: "Dedicated support",
};

export async function getLandingContent(_req: Request, res: Response, next: NextFunction) {
  try {
    const setting = await prisma.globalSetting.findUnique({ where: { key: "landing" } });
    const saved = (setting?.value ?? {}) as Partial<typeof DEFAULT_LANDING_CONTENT>;
    ok(res, { ...DEFAULT_LANDING_CONTENT, ...saved });
  } catch (err) {
    next(err);
  }
}
