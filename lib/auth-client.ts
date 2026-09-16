import { createAuthClient } from "better-auth/react";
import { oauthProviderClient } from "@better-auth/oauth-provider/client";

export const authClient = createAuthClient({
  baseURL:
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_AUTH_URL || process.env.BETTER_AUTH_URL || "https://auth.mystashi.online",
  plugins: [oauthProviderClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
