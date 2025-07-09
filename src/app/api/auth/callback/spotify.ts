// src/api/auth/callback/spotify.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { api } from "../../../../../convex/_generated/api"; // Correct relative path
import { getAuth } from "@clerk/nextjs/server"; // For getting Clerk user ID on server
import { ConvexClient } from "convex/browser"; // Server-side Convex client
import { env } from "~/env"; // Import your t3 env

// Initialize Convex client for server-side operations
// This should match your ConvexClientProvider's client config
const getConvexClient = () => new ConvexClient(env.NEXT_PUBLIC_CONVEX_URL);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { code } = req.query;
  const { userId: clerkUserId } = getAuth(req); // Get the Clerk user ID for the current session

  if (!code || typeof code !== "string" || !clerkUserId) {
    return res.status(400).send("Missing code or not authenticated with Clerk.");
  }

  try {
    const convex = getConvexClient();
    // Call the Convex action to handle the OAuth flow
    await convex.action(api.queries.api_integrations.handleSpotifyCallback, {
      clerkUserId: clerkUserId, // Pass the Clerk user ID
      code,
      redirectUri: env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI, // Use env for redirect URI
    });

    res.redirect("/settings?status=spotify_connected"); // Redirect back to settings page
  } catch (error) {
    console.error("Spotify OAuth Error in API route:", error);
    res.redirect(`/settings?status=spotify_failed&error=${encodeURIComponent((error as Error).message)}`);
  }
}