import NextAuth, { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { consumeTemporaryCredential, findTemporaryCredential } from "@/lib/access-requests";
import { getRequestIp, recordFailedLoginAttempt } from "@/lib/login-alerts";

const credentialsSchema = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(128),
});

export const PORTAL_ACCOUNTS = [
  { username: "Glitch", password: "374606", id: "portal-glitch", name: "Glitch" },
  { username: "Proxy", password: "396109", id: "portal-proxy", name: "Proxy" },
  { username: "Kernel", password: "398444", id: "portal-kernel", name: "Kernel" },
  { username: "Null", password: "375351", id: "portal-null", name: "Null" },
] as const;

export function isCorePortalUsername(username: string | null | undefined) {
  if (!username) {
    return false;
  }

  return PORTAL_ACCOUNTS.some((entry) => entry.username === username);
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  providers: [
    CredentialsProvider({
      name: "Portal Access",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        const ipAddress = getRequestIp(req);
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) {
          await recordFailedLoginAttempt({
            ipAddress,
            attemptedUsername: credentials?.username,
            failureReason: "invalid-format",
          });
          return null;
        }

        const permanentAccount = PORTAL_ACCOUNTS.find(
          (entry) =>
            entry.username.toLowerCase() === parsed.data.username.toLowerCase() &&
            entry.password === parsed.data.password,
        );

        if (permanentAccount) {
          return {
            id: permanentAccount.id,
            name: permanentAccount.name,
            email: null,
            username: permanentAccount.username,
            accessMode: "permanent" as const,
            temporaryAccessExpiresAt: null,
            temporaryCredentialId: null,
          };
        }

        const temporaryCredential = await findTemporaryCredential(parsed.data.username);
        if (temporaryCredential && !temporaryCredential.consumedAt) {
          const passwordMatches = await bcrypt.compare(parsed.data.password, temporaryCredential.passwordHash);
          if (passwordMatches) {
            const consumed = await consumeTemporaryCredential({
              credentialId: temporaryCredential.id,
            });

            if (consumed) {
              return {
                id: `temporary-${temporaryCredential.id}`,
                name: temporaryCredential.request.requesterName,
                email: temporaryCredential.request.requesterEmail,
                username: temporaryCredential.username,
                accessMode: "temporary" as const,
                temporaryAccessExpiresAt: consumed.accessExpiresAt.getTime(),
                temporaryCredentialId: temporaryCredential.id,
              };
            }
          }
        }

        await recordFailedLoginAttempt({
          ipAddress,
          attemptedUsername: parsed.data.username,
          failureReason: "bad-credentials",
        });
        return null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.name = user.name;
        token.email = user.email;
        token.username = typeof user.username === "string" ? user.username : user.name || null;
        token.accessMode = user.accessMode || "permanent";
        token.temporaryAccessExpiresAt =
          typeof user.temporaryAccessExpiresAt === "number" ? user.temporaryAccessExpiresAt : null;
        token.temporaryCredentialId =
          typeof user.temporaryCredentialId === "string" ? user.temporaryCredentialId : null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      if (session.user) {
        session.user.name = typeof token.name === "string" ? token.name : session.user.name;
        session.user.email = typeof token.email === "string" ? token.email : null;
        session.user.username = typeof token.username === "string" ? token.username : undefined;
        session.user.accessMode = token.accessMode === "temporary" ? "temporary" : "permanent";
      }
      session.accessMode = token.accessMode === "temporary" ? "temporary" : "permanent";
      session.temporaryAccessExpiresAt =
        typeof token.temporaryAccessExpiresAt === "number" ? token.temporaryAccessExpiresAt : null;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
};

export const authHandler = NextAuth(authOptions);
