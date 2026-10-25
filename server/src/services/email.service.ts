import nodemailer, { Transporter } from "nodemailer";
import { env } from "../config/env";
import { logger } from "../config/logger";

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!env.SMTP_HOST || !env.SMTP_USER) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    });
  }
  return transporter;
}

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

/** Sends an email. Returns false when SMTP is not configured (the message is then skipped). */
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text?: string,
  attachments?: EmailAttachment[],
): Promise<boolean> {
  const t = getTransporter();
  if (!t) {
    logger.info({ to, subject, attachments: attachments?.length ?? 0 }, "Email skipped (SMTP not configured)");
    return false;
  }
  await t.sendMail({ from: env.SMTP_FROM, to, subject, html, text, attachments });
  return true;
}
