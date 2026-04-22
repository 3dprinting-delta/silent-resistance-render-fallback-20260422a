import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { createAccessRequest } from "@/lib/access-requests";
import { authOptions, isCorePortalUsername } from "@/lib/auth";
import { getRequestIp } from "@/lib/login-alerts";

const createRequestSchema = z.object({
  requesterName: z.string().trim().min(1).max(120),
  requesterEmail: z.string().trim().email().max(200),
  clientDeviceLabel: z.string().trim().min(1).max(120).optional(),
  requestPrompt: z.string().trim().min(1).max(1200),
});

function inferDeviceLabel(input: {
  clientDeviceLabel?: string;
  userAgent: string;
}) {
  const provided = input.clientDeviceLabel?.trim();
  if (provided) {
    return provided.slice(0, 120);
  }

  const userAgent = input.userAgent.toLowerCase();
  if (userAgent.includes("iphone")) {
    return "iPhone";
  }

  if (userAgent.includes("ipad")) {
    return "iPad";
  }

  if (userAgent.includes("android")) {
    return "Android device";
  }

  if (userAgent.includes("windows")) {
    return "Windows PC";
  }

  if (userAgent.includes("mac os x") || userAgent.includes("macintosh")) {
    return "Mac";
  }

  if (userAgent.includes("linux")) {
    return "Linux device";
  }

  return "Unknown device";
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = createRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }

  const requestHeaders = Object.fromEntries(request.headers.entries());
  const result = await createAccessRequest({
    requesterName: parsed.data.requesterName,
    requesterEmail: parsed.data.requesterEmail,
    deviceLabel: inferDeviceLabel({
      clientDeviceLabel: parsed.data.clientDeviceLabel,
      userAgent: request.headers.get("user-agent") || "",
    }),
    claimedIpAddress: getRequestIp({ headers: requestHeaders }) || "unknown",
    requestPrompt: parsed.data.requestPrompt,
  });
  return NextResponse.json({
    ok: true,
    warning: result.emailResult.ok ? undefined : "Request saved, but email delivery to 375351feng@gmail.com is not configured yet.",
  });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.username || !isCorePortalUsername(session.user.username)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
