import nodemailer from "nodemailer";

type PortalEmailInput = {
  to: string | string[];
  subject: string;
  text: string;
};

function normalizeRecipients(value: string | string[]) {
  const raw = Array.isArray(value) ? value : value.split(",");
  return raw.map((entry) => entry.trim()).filter(Boolean);
}

function readEnv(name: string) {
  const value = process.env[name];
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.replace(/^\uFEFF/, "").trim();
  return trimmed || null;
}

function getBrevoConfig() {
  const apiKey = readEnv("BREVO_API_KEY");
  const senderEmail =
    readEnv("BREVO_SENDER_EMAIL") ||
    readEnv("ALERT_EMAIL_FROM") ||
    readEnv("ALERT_EMAIL_TO");
  const senderName = readEnv("BREVO_SENDER_NAME") || "Ghost Protocol";

  if (!apiKey || !senderEmail) {
    return null;
  }

  return {
    apiKey,
    senderEmail,
    senderName,
  };
}

function getSmtpConfig() {
  const host = readEnv("ALERT_SMTP_HOST");
  const portRaw = readEnv("ALERT_SMTP_PORT");
  const port = portRaw ? Number(portRaw) : undefined;
  const secure = readEnv("ALERT_SMTP_SECURE") === "true";
  const user = readEnv("ALERT_SMTP_USER");
  const pass = readEnv("ALERT_SMTP_PASS");

  if (!host || !port || !user || !pass) {
    return null;
  }

  return {
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  };
}

export async function sendPortalEmail(input: PortalEmailInput) {
  const recipients = normalizeRecipients(input.to);
  if (!recipients.length) {
    return { ok: false, error: "No recipient configured." };
  }

  const smtpConfig = getSmtpConfig();
  if (smtpConfig) {
    try {
      const transporter = nodemailer.createTransport(smtpConfig);
      await transporter.sendMail({
        from:
          readEnv("BREVO_SENDER_EMAIL") ||
          readEnv("ALERT_EMAIL_FROM") ||
          smtpConfig.auth.user,
        to: recipients.join(", "),
        subject: input.subject,
        text: input.text,
      });

      return { ok: true };
    } catch (error) {
      const smtpError = error instanceof Error ? error.message : "SMTP delivery failed.";
      const brevoConfig = getBrevoConfig();
      if (!brevoConfig) {
        return {
          ok: false,
          error: smtpError,
        };
      }
    }
  }

  const brevoConfig = getBrevoConfig();
  if (brevoConfig) {
    try {
      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "api-key": brevoConfig.apiKey,
          "Content-Type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          sender: {
            name: brevoConfig.senderName,
            email: brevoConfig.senderEmail,
          },
          to: recipients.map((email) => ({ email })),
          subject: input.subject,
          textContent: input.text,
        }),
      });

      if (!response.ok) {
        return {
          ok: false,
          error: await response.text(),
        };
      }

      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Brevo delivery failed.",
      };
    }
  }

  return { ok: false, error: "Email delivery is not configured." };
}
