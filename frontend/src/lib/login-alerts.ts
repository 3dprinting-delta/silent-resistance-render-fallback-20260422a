import { prisma } from "@/lib/prisma";
import { sendPortalEmail } from "@/lib/portal-mail";

function normalizeAttemptedUsername(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 64) : null;
}

export function getRequestIp(
  req?: {
    headers?: Record<string, string | string[] | undefined>;
  } | null,
) {
  if (!req?.headers) {
    return null;
  }

  const forwardedFor = req.headers["x-forwarded-for"];
  const realIp = req.headers["x-real-ip"];
  const candidate = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : typeof forwardedFor === "string"
      ? forwardedFor
      : Array.isArray(realIp)
        ? realIp[0]
        : typeof realIp === "string"
          ? realIp
          : null;

  if (!candidate) {
    return null;
  }

  const ip = candidate.split(",")[0]?.trim();
  return ip ? ip.slice(0, 64) : null;
}

async function sendFailedLoginAlert(input: {
  ipAddress: string;
  attemptedUsername: string | null;
  failureReason: "invalid-format" | "bad-credentials";
}) {
  const result = await sendPortalEmail({
    to: "375351feng@gmail.com",
    subject: "Ghost Protocol alert: failed login attempt detected",
    text: [
      "A failed login attempt was detected on the Kappa-4 portal.",
      `IP address: ${input.ipAddress}`,
      `Attempted username: ${input.attemptedUsername || "unknown"}`,
      `Failure reason: ${input.failureReason}`,
      `Detected at: ${new Date().toISOString()}`,
    ].join("\n"),
  });

  return result.ok;
}

export async function recordFailedLoginAttempt(input: {
  ipAddress: string | null;
  attemptedUsername: unknown;
  failureReason: "invalid-format" | "bad-credentials";
}) {
  if (!process.env.DATABASE_URL) {
    return;
  }

  const attemptedUsername = normalizeAttemptedUsername(input.attemptedUsername);
  const ipAddress = input.ipAddress || "unknown";

  const createdAttempt = await prisma.failedLoginAttempt.create({
    data: {
      ipAddress,
      attemptedUsername,
    },
  });

  try {
    const sent = await sendFailedLoginAlert({
      ipAddress,
      attemptedUsername,
      failureReason: input.failureReason,
    });

    if (sent) {
      await prisma.failedLoginAttempt.update({
        where: { id: createdAttempt.id },
        data: { alertSentAt: new Date() },
      });
    }
  } catch (error) {
    console.error("Failed to send login alert email.", error);
  }
}
