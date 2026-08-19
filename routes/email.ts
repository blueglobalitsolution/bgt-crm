import nodemailer from 'nodemailer';

export const OTP_TTL_MS = 60_000; // OTP valid for 60 seconds

/**
 * Send a 6-digit login OTP to the given address via SMTP.
 * Logs the OTP to the server console as a dev fallback if sending fails.
 * Returns true on success.
 */
export async function sendOtpEmail(to: string, otp: string): Promise<boolean> {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || `"BGT CRM" <${user || 'noreply@bgtcrm.com'}>`;

  if (!host || !user || !pass) {
    console.warn(`\n[SMTP NOT CONFIGURED] OTP for ${to}: ${otp}\n`);
    return false;
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: process.env.SMTP_SECURE === 'true' || port === 465,
      auth: { user, pass },
    });

    await transporter.sendMail({
      from,
      to,
      subject: 'BGT CRM Login OTP',
      text: `Your BGT CRM 6-digit OTP code is: ${otp}. It is valid for 60 seconds.`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eff0f0; border-radius: 8px; max-width: 500px;">
          <h2 style="color: #2563eb;">BGT CRM Login</h2>
          <p>Use the following 6-digit OTP code to complete your sign-in:</p>
          <div style="font-size: 28px; font-weight: bold; color: #2563eb; letter-spacing: 4px; padding: 15px 0; font-family: monospace;">${otp}</div>
          <p>This OTP is valid for <strong>60 seconds</strong> and expires afterward.</p>
          <p style="color: #666666; font-size: 12px; margin-top: 20px;">If you did not attempt to sign in, you can safely ignore this email.</p>
        </div>
      `,
    });
    console.log(`[SMTP] OTP email sent to ${to}`);
    return true;
  } catch (error) {
    console.error(`[SMTP ERROR] Failed to send OTP email to ${to}:`, error);
    return false;
  }
}

/** Mask an email for display, e.g. j***@gmail.com */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const maskedLocal = local.length <= 2 ? local[0] + '*' : local.slice(0, 1) + '***';
  return `${maskedLocal}@${domain}`;
}
