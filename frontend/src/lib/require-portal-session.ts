import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

function normalizeProtectedPath(path: string) {
  if (!path.startsWith("/") || path.startsWith("//")) {
    return "/";
  }

  return path;
}

export async function requirePortalSession(path: string) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    const nextPath = encodeURIComponent(normalizeProtectedPath(path));
    redirect(`/login?next=${nextPath}`);
  }

  if (
    session.accessMode === "temporary" &&
    typeof session.temporaryAccessExpiresAt === "number" &&
    session.temporaryAccessExpiresAt <= Date.now()
  ) {
    const nextPath = encodeURIComponent(normalizeProtectedPath(path));
    redirect(`/login?next=${nextPath}`);
  }

  return session;
}
