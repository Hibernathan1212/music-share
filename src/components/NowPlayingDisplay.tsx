"use client";

import { useEffect, useState, useCallback } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { Clock, Music, Headphones, AlertCircle, RefreshCcw, Pause, Play, ExternalLink } from "lucide-react";
import ClipLoader from "react-spinners/ClipLoader";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";

interface CurrentPlaying {
  title: string;
  artistName: string;
  albumCover?: string;
  isPlaying: boolean;
  progress_ms?: number;
  duration_ms?: number;
}

export function NowPlayingDisplay() {
  const { isLoaded: isClerkLoaded, isSignedIn } = useUser();
  const convexUser = useQuery(api.queries.users.getMe, !isClerkLoaded || !isSignedIn ? "skip" : undefined);

  const fetchCurrentPlaying = useAction(
    api.queries.api_integrations.fetchSpotifyCurrentlyPlaying,
  );

  const [currentPlaying, setCurrentPlaying] = useState<CurrentPlaying | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  const isReady = isClerkLoaded && isSignedIn && !!convexUser;
  const stableUserId = convexUser?._id;

  const refreshNowPlaying = useCallback(async () => {
    if (!isClerkLoaded || !isSignedIn || !stableUserId) {
      setError("Please sign in and ensure your profile is loaded.");
      setIsLoading(false);
      return;
    }

    setIsPolling(true);
    setError(null);
    try {
      const data = await fetchCurrentPlaying({ userId: stableUserId });
      setCurrentPlaying(data);
      if (!data) {
        toast.info("No music currently playing on Spotify.", {
          description: "Start listening to see your status here.",
        });
      }
    } catch (err) {
      console.error("Failed to fetch current playing:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch currently playing music.";
      setError(errorMessage);
      setCurrentPlaying(null);
      toast.error("Failed to fetch Spotify status", {
        description: errorMessage.includes("Spotify account not linked")
          ? "Please connect your Spotify account in settings."
          : "An unexpected error occurred.",
      });
    } finally {
      setIsPolling(false);
      setIsLoading(false);
    }
  }, [isClerkLoaded, isSignedIn, stableUserId, fetchCurrentPlaying]);

  useEffect(() => {
    if (!isReady) return;

    void refreshNowPlaying();
    const intervalId = setInterval(() => {
      void refreshNowPlaying();
    }, 10000);

    return () => clearInterval(intervalId);
  }, [isReady, refreshNowPlaying]);

  if (isLoading) {
    return <Skeleton className="h-48 w-full rounded-md" />;
  }

  if (error?.includes("Spotify account not linked")) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-md border border-destructive/30 bg-destructive/10 p-6 text-center">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <p className="text-lg font-medium text-destructive">Spotify not connected.</p>
        <p className="text-sm text-muted-foreground">
          To see what you&apos;re listening to, please link your Spotify account.
        </p>
        <Link href="/settings">
          <Button>Connect Spotify</Button>
        </Link>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-md border border-red-500/30 bg-red-500/10 p-6 text-center">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <p className="text-lg font-medium text-destructive">Error Loading Status</p>
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button onClick={() => void refreshNowPlaying()} variant="outline">
          <RefreshCcw className="mr-2 h-4 w-4" /> Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <p className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary/80" /> Last updated:{" "}
          {isPolling ? (
            <ClipLoader size={12} color="hsl(var(--primary))" />
          ) : (
            new Date().toLocaleTimeString()
          )}
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void refreshNowPlaying()}
          disabled={isPolling}
          className="rounded px-2 py-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <RefreshCcw
            className={`mr-1 h-3 w-3 ${isPolling ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>
      {currentPlaying ? (
        <div className="flex items-center gap-4">
          {currentPlaying.albumCover ? (
            <Image
              src={currentPlaying.albumCover}
              alt={`album cover`}
              width={96}
              height={96}
              className="rounded-md object-cover shadow-soft"
            />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-md bg-secondary text-muted-foreground shadow-inset-soft">
              <Music className="h-12 w-12" />
            </div>
          )}
          <div className="flex-1 overflow-hidden">
            <h4 className="line-clamp-1 text-xl font-semibold text-primary">
              {currentPlaying.title}
            </h4>
            <p className="line-clamp-1 text-md text-muted-foreground">
              by {currentPlaying.artistName}
            </p>
            {/* <p className="line-clamp-1 text-sm text-muted-foreground">
              on {currentPlaying.albumName}
            </p> */}
            <p className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
              {currentPlaying.isPlaying ? (
                <Play className="h-4 w-4 text-primary" />
              ) : (
                <Pause className="h-4 w-4 text-muted-foreground" />
              )}
              {typeof currentPlaying.progress_ms === "number" &&
              typeof currentPlaying.duration_ms === "number" ? (
                <>
                  {Math.floor(currentPlaying.progress_ms / 1000 / 60)}:
                  {(
                    "0" + Math.floor((currentPlaying.progress_ms / 1000) % 60)
                  ).slice(-2)}{" "}
                  /{" "}
                  {Math.floor(currentPlaying.duration_ms / 1000 / 60)}:
                  {(
                    "0" + Math.floor((currentPlaying.duration_ms / 1000) % 60)
                  ).slice(-2)}
                </>
              ) : currentPlaying.isPlaying ? (
                "Playing now"
              ) : (
                "Paused"
              )}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-4 py-8 text-center">
          <Headphones className="h-12 w-12 text-muted-foreground" />
          <p className="text-lg text-muted-foreground">
            Nothing currently playing.
          </p>
          <p className="text-sm text-muted-foreground">
            Start listening on Spotify to see your status here.
          </p>
          {isSignedIn && !convexUser ? (
            <p className="text-sm text-muted-foreground">
              Loading user profile...
            </p>
          ) : (<></>)}
          
          {convexUser?.spotifyUserId ? (
            <Link href="/settings">
              <Button className="shadow-soft transition-all hover:scale-[1.02]">
                Connect Spotify
              </Button>
            </Link>
          ) : (
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
                  Listen on Spotify <ExternalLink className="ml-1 h-3 w-3" />
                </a>
              </Button>
          )}
            
        </div>
      )}
    </div>
  );
}