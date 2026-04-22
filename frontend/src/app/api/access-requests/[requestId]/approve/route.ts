import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isCorePortalUsername } from "@/lib/auth";
import { approveAccessRequest } from "@/lib/access-requests";

export async function POST(
  _request: Request,
  { params }: { params: { requestId: string } },
) {
  const session = await getServerSession(authOptions);
  const username = session?.user?.username;
  if (!username || !isCorePortalUsername(username)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const result = await approveAccessRequest({
      requestId: params.requestId,
      approvedBy: username,
    });

    return NextResponse.json({
      ok: true,
      username: result.username,
      password: result.password,
      warning: result.emailResult.ok ? undefined : "Credentials generated, but email delivery to 375351feng@gmail.com failed.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to approve request.";
    return NextResponse.json({ error: message }, { status: message === "Request not found." ? 404 : 400 });
  }
}
