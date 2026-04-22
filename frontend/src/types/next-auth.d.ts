import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    spotifyConnected?: boolean;
    spotifyError?: string;
    accessMode?: "permanent" | "temporary";
    temporaryAccessExpiresAt?: number | null;
    user?: {
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      username?: string | null;
      accessMode?: "permanent" | "temporary";
    };
  }

  interface User {
    username?: string | null;
    accessMode?: "permanent" | "temporary";
    temporaryAccessExpiresAt?: number | null;
    temporaryCredentialId?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    username?: string | null;
    accessMode?: "permanent" | "temporary";
    temporaryAccessExpiresAt?: number | null;
    temporaryCredentialId?: string | null;
    spotifyConnected?: boolean;
    spotifyAccessToken?: string;
    spotifyRefreshToken?: string;
    spotifyExpiresAt?: number;
    spotifyError?: string;
  }
}
