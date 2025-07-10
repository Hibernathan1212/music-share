// src/app/settings/page.tsx
"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import { env } from "~/env";
import { Button } from "~/components/ui/button";
import Link from "next/link";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Loader2,
  ArrowLeft,
  Headphones,
  ExternalLink,
  CheckCircle,
  User,
  Settings,
} from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export default function SettingsPage() {
  const { user: clerkUser, isLoaded: isClerkLoaded, isSignedIn } = useUser();
  const convexUser = useQuery(
    api.queries.users.getMe,
    !isClerkLoaded || !isSignedIn ? "skip" : undefined,
  );

  const spotifyAccount = useQuery(
    api.queries.api_integrations.getPlatformAccount, // Assuming this is in api_integrations.ts
    isClerkLoaded && isSignedIn && convexUser ? { userId: convexUser._id, platform: "spotify" } : "skip",
  );

  const [isConnecting, setIsConnecting] = useState(false);

  const connectSpotify = async () => {
    setIsConnecting(true);
    try {
      const clientId = env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID;
      const redirectUri = encodeURIComponent(
        env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI,
      );
      const scopes = encodeURIComponent(
        "user-read-currently-playing user-read-recently-played user-read-playback-state", // Added user-read-playback-state for more control/info
      );
      // Generate a state parameter to prevent CSRF attacks
      const state = generateRandomString(16);
      localStorage.setItem("spotify_auth_state", state); // Store state in localStorage

      const spotifyAuthUrl = `https://accounts.spotify.com/authorize?response_type=code&client_id=${clientId}&scope=${scopes}&redirect_uri=${redirectUri}&state=${state}`;

      window.location.href = spotifyAuthUrl;
    } catch (error) {
      console.error("Error initiating Spotify connection:", error);
      toast.error("Failed to initiate Spotify connection.", {
        description: "Please try again later.",
      });
      setIsConnecting(false);
    }
  };

  const generateRandomString = (length: number) => {
    let result = "";
    const characters =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
  };

  if (!isClerkLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
        <Skeleton className="h-96 w-full max-w-md rounded-lg shadow-lg-soft" />
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
        <Card className="w-full max-w-md p-6 text-center shadow-lg-soft">
          <CardHeader>
            <CardTitle className="text-xl">Authentication Required</CardTitle>
            <CardDescription>Please sign in to access settings.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/">
              <Button className="shadow-soft hover:scale-[1.02]">
                Go to Sign In
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!convexUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-lg text-muted-foreground">Loading your profile...</p>
          {/* <Skeleton className="h-20 w-48 rounded-md shadow-soft" /> */}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-background p-4 text-foreground">
      <Card className="container mx-auto mt-8 w-full max-w-md p-6 shadow-lg-soft">
        <CardHeader className="flex flex-row items-center justify-between p-0 pb-6">
          <Link href="/home">
            <Button
              variant="ghost"
              className="group text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />{" "}
              Back to Home
            </Button>
          </Link>
          <CardTitle className="text-3xl font-bold text-primary">
            Settings
          </CardTitle>
          <div className="w-[88px]" /> {/* Spacer to align title */}
        </CardHeader>

        <CardContent className="space-y-8 p-0 pt-6">
          <section>
            <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold text-foreground">
              <Headphones className="h-5 w-5 text-primary" /> Connected Accounts
            </h2>

            <div className="rounded-lg border border-border p-4 shadow-soft">
              <h3 className="mb-2 text-lg font-medium">Spotify</h3>
              {spotifyAccount ? (
                <div className="flex items-center justify-between">
                  <p className="flex items-center gap-2 text-sm text-primary">
                    <CheckCircle className="h-4 w-4" /> Spotify Connected!
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    asChild
                  >
                    <a
                      href="https://spotify.com"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View on Spotify <ExternalLink className="ml-1 h-3 w-3" />
                    </a>
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={connectSpotify}
                  disabled={isConnecting}
                  className="shadow-soft hover:scale-[1.02]"
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />{" "}
                      Connecting...
                    </>
                  ) : (
                    "Connect Spotify"
                  )}
                </Button>
              )}
            </div>
          </section>

          {/* Moved Profile settings to its own page: /profile/me */}
          <section>
            <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold text-foreground">
              <User className="h-5 w-5 text-primary" /> Profile Settings
            </h2>
            <div className="rounded-lg border border-border p-4 shadow-soft">
              <p className="text-muted-foreground mb-4">
                Manage your display name, profile picture, and bio.
              </p>
              <Link href="/profile/me">
                <Button variant="outline" className="w-full shadow-soft hover:scale-[1.01]">
                  Go to Profile Settings
                </Button>
              </Link>
            </div>
          </section>

          {/* Add more general settings like privacy, notifications here */}
          <section>
            <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold text-foreground">
              <Settings className="h-5 w-5 text-primary" /> General
            </h2>
            <div className="rounded-lg border border-border p-4 shadow-soft">
              <p className="text-muted-foreground">
                Notifications, Privacy, and Account Deletion options.
                <br /> (Coming Soon)
              </p>
            </div>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}