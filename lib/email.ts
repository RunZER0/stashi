// Email dispatch abstraction for Stashi Auth via Brevo.
// In production, configure Brevo via BREVO_API_KEY and EMAIL_FROM.
// In development or when unconfigured, logs single-purpose security links safely.

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export function parseSender(from: string): { name?: string; email: string } {
  const match = from.match(/^(?:(.*?)<)?([^<>]+)>?$/);
  if (match) {
    const name = match[1]?.trim()?.replace(/^["']|["']$/g, "");
    const email = match[2]?.trim();
    if (email) {
      return name ? { name, email } : { email };
    }
  }
  return { email: from };
}

export async function sendEmail({ to, subject, html, text }: EmailOptions): Promise<void> {
  const isProd = process.env.NODE_ENV === "production";
  const emailFrom = process.env.EMAIL_FROM || "Stashi Auth <auth@mystashi.online>";
  const brevoApiKey = process.env.BREVO_API_KEY;

  // Log in non-production or for local inspection
  if (!isProd || process.env.DEBUG_AUTH_EMAILS === "true") {
    console.log(`[Email Dispatch] To: ${to} | Subject: ${subject}`);
    if (text) console.log(`[Email Content]\n${text}`);
  }

  // Brevo transactional email dispatch
  if (brevoApiKey) {
    try {
      const sender = parseSender(emailFrom);
      const res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "api-key": brevoApiKey,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          sender,
          to: [{ email: to }],
          subject,
          htmlContent: html,
          textContent: text || html.replace(/<[^>]*>/g, ""),
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        console.error("[Email Dispatch] Brevo API error:", res.status, err);
      }
    } catch (err) {
      console.error("[Email Dispatch] Failed to send via Brevo:", err);
    }
  }
}

export function renderVerificationEmail(url: string): { subject: string; html: string; text: string } {
  return {
    subject: "Verify your Stashi email address",
    text: `Welcome to Stashi.\n\nPlease verify your email address by visiting this link:\n${url}\n\nThis link will expire in 24 hours.`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 20px; color: #111;">
        <h2 style="font-size: 22px; font-weight: 600; margin-bottom: 16px;">Verify your email address</h2>
        <p style="font-size: 15px; line-height: 24px; color: #444; margin-bottom: 24px;">
          Welcome to Stashi. Click the button below to verify your email address and activate your account.
        </p>
        <div style="margin-bottom: 32px;">
          <a href="${url}" style="background-color: #0b0f19; color: #fff; padding: 12px 24px; font-size: 14px; font-weight: 500; text-decoration: none; border-radius: 6px; display: inline-block;">
            Verify Email
          </a>
        </div>
        <p style="font-size: 13px; line-height: 20px; color: #888;">
          If you didn't create a Stashi account, you can safely ignore this email.<br/>
          Direct link: <a href="${url}" style="color: #2563eb;">${url}</a>
        </p>
      </div>
    `,
  };
}

export function renderPasswordResetEmail(url: string): { subject: string; html: string; text: string } {
  return {
    subject: "Reset your Stashi password",
    text: `You requested a password reset for your Stashi account.\n\nReset your password here:\n${url}\n\nThis link will expire in 15 minutes. If you did not request this, please ignore this email.`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 20px; color: #111;">
        <h2 style="font-size: 22px; font-weight: 600; margin-bottom: 16px;">Reset your password</h2>
        <p style="font-size: 15px; line-height: 24px; color: #444; margin-bottom: 24px;">
          We received a request to reset your password for your Stashi account. Click the button below to choose a new password.
        </p>
        <div style="margin-bottom: 32px;">
          <a href="${url}" style="background-color: #0b0f19; color: #fff; padding: 12px 24px; font-size: 14px; font-weight: 500; text-decoration: none; border-radius: 6px; display: inline-block;">
            Reset Password
          </a>
        </div>
        <p style="font-size: 13px; line-height: 20px; color: #888;">
          This link is single-use and will expire in 15 minutes.<br/>
          If you didn't request a password reset, your account is still secure and no changes were made.<br/>
          Direct link: <a href="${url}" style="color: #2563eb;">${url}</a>
        </p>
      </div>
    `,
  };
}
