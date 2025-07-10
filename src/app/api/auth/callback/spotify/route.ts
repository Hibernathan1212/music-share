import { NextRequest, NextResponse } from "next/server";
import { api } from "../../../../../../convex/_generated/api"; 
import { getAuth } from "@clerk/nextjs/server"; 
import { ConvexHttpClient } from "convex/browser"; 
import { env } from "~/env"; 

const convex = new ConvexHttpClient(env.NEXT_PUBLIC_CONVEX_URL);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  
  const { userId: clerkUserId } = getAuth(request);
  
  if (!code || !clerkUserId) {
    return NextResponse.redirect(
      new URL("/settings?status=spotify_failed&error=missing_code_or_auth", request.url)
    );
  }
  
  try {
    await convex.action(api.queries.api_integrations.handleSpotifyCallback, {
      clerkUserId: clerkUserId, 
      code,
      redirectUri: env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI, 
    });
    
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