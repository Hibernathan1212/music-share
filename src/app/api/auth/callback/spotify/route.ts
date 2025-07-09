// src/app/api/auth/callback/spotify/route.ts
import { NextRequest, NextResponse } from "next/server";
import { api } from "../../../../../../convex/_generated/api"; // Adjust path as needed
import { getAuth } from "@clerk/nextjs/server"; // For getting Clerk user ID on server
import { ConvexHttpClient } from "convex/browser"; // Use HTTP client for server-side
import { env } from "~/env"; // Import your t3 env

// Initialize Convex HTTP client for server-side operations
const convex = new ConvexHttpClient(env.NEXT_PUBLIC_CONVEX_URL);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  
  // Get Clerk user ID from the request
  const { userId: clerkUserId } = getAuth(request);
  
  if (!code || !clerkUserId) {
    return NextResponse.redirect(
      new URL("/settings?status=spotify_failed&error=missing_code_or_auth", request.url)
    );
  }
  
  try {
    // Call the Convex action to handle the OAuth flow
    await convex.action(api.queries.api_integrations.handleSpotifyCallback, {
      clerkUserId: clerkUserId, // Pass the Clerk user ID
      code,
      redirectUri: env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI, // Use env for redirect URI
    });
    
    // Redirect back to settings page with success status
    return NextResponse.redirect(
      new URL("/settings?status=spotify_connected", request.url)
    );
  } catch (error) {
    console.error("Spotify OAuth Error in API route:", error);
    
    return NextResponse.redirect(
      new URL(
        `/settings?status=spotify_failed&error=${encodeURIComponent((error as Error).message)}`,
        request.url
      )
    );
  }
}