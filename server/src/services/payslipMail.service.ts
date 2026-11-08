import { prisma } from "../lib/prisma";
import { logger } from "../config/logger";
import { env } from "../config/env";
import { buildPayslipPdf } from "../utils/payslipPdf";
import { sendEmail } from "./email.service";
import { fmtMoney } from "../utils/money";
import { formatDate } from "../utils/dates";

export interface PayslipEmailSummary {
  sent: number;
  skipped: number;
  failed: number;
  failures: { employee: string; reason: string }[];
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => {
    const map: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return map[ch];
  });
}

function buildEmailHtml(params: {
  employeeName: string;
  institutionName: string;
  periodStart: Date;
  periodEnd: Date;
  gross: string;
  deductions: string;
  net: string;
  currency: string;
  portalUrl: string;
  employeeCnic?: string | null;
}): string {
  const period = `${formatDate(params.periodStart)} – ${formatDate(params.periodEnd)}`;
  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:24px;background:#f1f5f9;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px;">
      <tr><td>
        <h2 style="margin:0 0 4px;font-size:20px;">Your payslip is ready</h2>
        <p style="margin:0 0 20px;color:#64748b;font-size:14px;">
          ${escapeHtml(params.institutionName)} · ${escapeHtml(period)}
        </p>
        <p style="margin:0 0 16px;font-size:15px;">Hi ${escapeHtml(params.employeeName)},</p>
        <p style="margin:0 0 20px;font-size:14px;color:#334155;">
          Your salary for this period has been paid. The detailed payslip is attached to this email as a PDF.
        </p>
        <table role="presentation" width="100%" style="border-collapse:collapse;font-size:14px;">
          <tr>
            <td style="padding:10px 0;border-top:1px solid #e2e8f0;color:#64748b;">Gross salary</td>
            <td style="padding:10px 0;border-top:1px solid #e2e8f0;text-align:right;font-weight:600;">${escapeHtml(params.gross)}</td>
          </tr>
          <tr>
            <td style="padding:10px 0;border-top:1px solid #e2e8f0;color:#64748b;">Deductions</td>
            <td style="padding:10px 0;border-top:1px solid #e2e8f0;text-align:right;font-weight:600;color:#b91c1c;">-${escapeHtml(params.deductions)}</td>
          </tr>
          <tr>
            <td style="padding:12px 0;border-top:2px solid #0f172a;font-weight:600;">Net paid</td>
            <td style="padding:12px 0;border-top:2px solid #0f172a;text-align:right;font-weight:700;">${escapeHtml(params.net)}</td>
          </tr>
        </table>

        <!-- Employee Self-Service Portal Credentials & Instructions -->
        <div style="margin:24px 0 20px;padding:16px 20px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">
          <h3 style="margin:0 0 8px;font-size:15px;color:#1e293b;">Online Employee Portal</h3>
          <p style="margin:0 0 12px;font-size:13px;color:#475569;line-height:1.5;">
            You can also log in to your employee portal online anytime to view and download all your current and past payslips, check your attendance, and review salary details.
          </p>
          <div style="margin:0 0 14px;font-size:13px;color:#334155;background:#ffffff;padding:12px 14px;border-radius:6px;border:1px solid #cbd5e1;">
            <p style="margin:0 0 6px;"><strong>Portal Link:</strong> <a href="${escapeHtml(params.portalUrl)}" style="color:#4f46e5;text-decoration:underline;">${escapeHtml(params.portalUrl)}</a></p>
            <p style="margin:0 0 6px;"><strong>Username (CNIC):</strong> ${escapeHtml(params.employeeCnic || "Your registered CNIC")}</p>
            <p style="margin:0;"><strong>Password:</strong> Last 4 digits of your CNIC</p>
          </div>
          <a href="${escapeHtml(params.portalUrl)}" style="display:inline-block;padding:9px 18px;background:#4f46e5;color:#ffffff;text-decoration:none;border-radius:6px;font-size:13px;font-weight:600;">
            Log in to Employee Portal &rarr;
          </a>
        </div>

        <p style="margin:24px 0 0;font-size:12px;color:#94a3b8;">
          This is an automated message from ${escapeHtml(params.institutionName)}. Please contact your institution's payroll office for any questions.
        </p>
      </td></tr>
    </table>
  </body>
</html>`;
}

/**
 * Emails the payslip PDF of every employee in a payroll run.
 * Payslips that were already emailed are skipped unless `force` is set.
 * Never throws for a single failure: the summary reports sent/skipped/failed counts.
 */
export async function emailPayslipsForRun(
  tenantId: string,
  payrollRunId: string,
  options: { force?: boolean } = {},
): Promise<PayslipEmailSummary> {
  const summary: PayslipEmailSummary = { sent: 0, skipped: 0, failed: 0, failures: [] };

  const [tenant, payslips] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId } }),
    prisma.payslip.findMany({
      where: { tenantId, payrollRunId },
      include: {
        employee: true,
        payrollItem: { include: { earnings: true, deductions: true } },
        payrollRun: true,
      },
    }),
  ]);

  const institutionName = tenant?.name ?? "Your institution";

  for (const payslip of payslips) {
    const employee = payslip.employee;
    const label = `${employee.employeeNumber} (${employee.firstName} ${employee.lastName})`;

    if (!employee.email) {
      summary.skipped++;
      summary.failures.push({ employee: label, reason: "No email address on employee record" });
      continue;
    }
    if (payslip.emailedAt && !options.force) {
      summary.skipped++;
      continue;
    }

    try {
      const pdf = await buildPayslipPdf({
        payslip,
        employee,
        payrollItem: payslip.payrollItem,
        payrollRun: payslip.payrollRun,
        institution: {
          name: institutionName,
          address: tenant?.address,
          logoUrl: tenant?.logoUrl,
        },
      });

      const portalUrl = (env.APP_ORIGIN || "https://edupayroll.tech").replace(/\/+$/, "") + "/employee";

      const sent = await sendEmail(
        employee.email,
        `Payslip ${formatDate(payslip.periodStart)} – ${formatDate(payslip.periodEnd)} · ${institutionName}`,
        buildEmailHtml({
          employeeName: `${employee.firstName} ${employee.lastName}`,
          institutionName,
          periodStart: payslip.periodStart,
          periodEnd: payslip.periodEnd,
          gross: fmtMoney(payslip.grossSalary, tenant?.currency ?? "USD"),
          deductions: fmtMoney(payslip.totalDeductions, tenant?.currency ?? "USD"),
          net: fmtMoney(payslip.netSalary, tenant?.currency ?? "USD"),
          currency: tenant?.currency ?? "USD",
          portalUrl,
          employeeCnic: employee.nationalId,
        }),
        `Hi ${employee.firstName}, your payslip for ${formatDate(payslip.periodStart)} – ${formatDate(payslip.periodEnd)} is attached. Net paid: ${fmtMoney(payslip.netSalary, tenant?.currency ?? "USD")}. You can also view it on the employee portal at ${portalUrl}`,
        [
          {
            filename: `payslip-${employee.employeeNumber}-${formatDate(payslip.periodStart)}.pdf`,
            content: pdf,
            contentType: "application/pdf",
          },
        ],
      );

      if (!sent) {
        summary.skipped++;
        summary.failures.push({ employee: label, reason: "SMTP is not configured" });
        continue;
      }

      await prisma.payslip.update({ where: { id: payslip.id }, data: { emailedAt: new Date() } });
      summary.sent++;
    } catch (err) {
      summary.failed++;
      summary.failures.push({ employee: label, reason: err instanceof Error ? err.message : String(err) });
      logger.warn({ err, payslipId: payslip.id }, "Failed to email payslip");
    }
  }

  logger.info({ tenantId, payrollRunId, ...summary }, "Payslip emails processed");
  return summary;
}
