// src/components/FriendFeed.tsx
"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import { Skeleton } from "~/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Link, Music, PlusCircle, User } from "lucide-react";
import { formatDistanceToNow } from "date-fns"; // For time ago formatting
import { Button } from "./ui/button";

interface SongDisplayProps {
  song: {
    title: string;
    artist: string;
    album: string;
    coverImageUrl?: string | null;
  };
  listeningUser: {
    username: string;
    displayName?: string | null;
    profilePictureUrl?: string | null;
  };
  listenedAt: number; // Unix timestamp
}

const SongDisplay: React.FC<SongDisplayProps> = ({
  song,
  listeningUser,
  listenedAt,
}) => {
  const timeAgo = formatDistanceToNow(new Date(listenedAt), { addSuffix: true });

  return (
    <div className="flex items-center space-x-4 rounded-lg p-3 transition-colors hover:bg-accent hover:shadow-soft">
      {" "}
      {/* Added hover shadow */}
      <Avatar className="h-12 w-12 flex-shrink-0">
        <AvatarImage
          src={listeningUser.profilePictureUrl || undefined}
          alt={listeningUser.displayName || listeningUser.username}
        />
        <AvatarFallback>
          {(listeningUser.displayName || listeningUser.username)
            .charAt(0)
            .toUpperCase()}
        </AvatarFallback>
      </Avatar>
      {song.coverImageUrl ? (
        <img
          src={song.coverImageUrl}
          alt={`Album cover for ${song.title}`}
          className="h-16 w-16 flex-shrink-0 rounded-md object-cover shadow-soft" // Added shadow
        />
      ) : (
        <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground shadow-inset-soft">
          {" "}
          {/* Added shadow */}
          <Music className="h-8 w-8" />
        </div>
      )}
      <div className="flex-1 overflow-hidden">
        <p className="line-clamp-1 text-sm font-medium text-muted-foreground">
          <span className="font-semibold text-foreground">
            {listeningUser.displayName || listeningUser.username}
          </span>{" "}
          listened to:
        </p>
        <p className="line-clamp-1 text-lg font-bold text-foreground">
          {song.title}
        </p>
        <p className="line-clamp-1 text-sm text-muted-foreground">
          by {song.artist} • {song.album}
        </p>
      </div>
      <span className="flex-shrink-0 text-xs text-muted-foreground">
        {timeAgo}
      </span>
    </div>
  );
};

export function FriendFeed() {
  const { isLoaded, isSignedIn } = useUser();
  const convexUser = useQuery(
    api.queries.users.getMe, // Using the centralized getMe from convex/users.ts
    !isLoaded || !isSignedIn ? "skip" : undefined,
  );

  const friendFeed = useQuery(
    api.queries.music.getFriendFeed, // This now queries the new logic
    isLoaded && isSignedIn && convexUser
      ? { userId: convexUser._id, limit: 20 }
      : "skip",
  );

  if (!isLoaded || !isSignedIn || !convexUser || friendFeed === undefined) {
    // Show loading state until all data is ready
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (friendFeed.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-8 text-center">
        <User className="h-12 w-12 text-muted-foreground" />
        <p className="text-lg font-medium text-muted-foreground">
          No recent listens from your friends.
        </p>
        <p className="text-sm text-muted-foreground">
          Follow new people or tell your friends to start listening!
        </p>
        <Link href="/search">
          <Button className="shadow-soft transition-all hover:scale-[1.02]">
            <PlusCircle className="mr-2 h-4 w-4" /> Find Friends
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {friendFeed.map((entry) => (
        <SongDisplay
          key={String(entry._id)} // _id is now the user's _id from friendFeed structure
          song={{
            title: entry.song?.title ?? "Unknown Song",
            artist: entry.song?.artist ?? "Unknown Artist",
            album: entry.song?.album ?? "Unknown Album",
            coverImageUrl: entry.song?.coverImageUrl,
          }}
          listeningUser={{
            username: entry.listeningUser?.username ?? "Unknown",
            displayName: entry.listeningUser?.displayName,
            profilePictureUrl: entry.listeningUser?.profilePictureUrl,
          }}
          listenedAt={entry.listenedAt}
        />
      ))}
    </div>
  );
}