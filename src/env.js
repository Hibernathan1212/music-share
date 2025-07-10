import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    ENCRYPTION_KEY: z.string().min(1), 
    SPOTIFY_CLIENT_SECRET: z.string().min(1),
    CLERK_WEBHOOK_SECRET: z.string(),
  },

  client: {
    NEXT_PUBLIC_CLERK_FRONTEND_API_URL: z.string().min(1), 
    NEXT_PUBLIC_SPOTIFY_REDIRECT_URI: z.string().url(),
    NEXT_PUBLIC_SPOTIFY_CLIENT_ID: z.string().min(1),
    NEXT_PUBLIC_CONVEX_URL: z.string().url(),
  },

  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_CLERK_FRONTEND_API_URL: process.env.NEXT_PUBLIC_CLERK_FRONTEND_API_URL,
    NEXT_PUBLIC_SPOTIFY_REDIRECT_URI: process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI,
    NEXT_PUBLIC_SPOTIFY_CLIENT_ID: process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID,
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
    SPOTIFY_CLIENT_SECRET: process.env.SPOTIFY_CLIENT_SECRET,
    NEXT_PUBLIC_CONVEX_URL: process.env.NEXT_PUBLIC_CONVEX_URL,
    CLERK_WEBHOOK_SECRET: process.env.CLERK_WEBHOOK_SECRET, 
  },
  emptyStringAsUndefined: true,
});