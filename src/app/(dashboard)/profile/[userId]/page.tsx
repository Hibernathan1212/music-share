"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Id } from "../../../../../convex/_generated/dataModel";
import { formatDistanceToNow } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { useUser } from "@clerk/nextjs";
import { Avatar, AvatarImage, AvatarFallback } from "~/components/ui/avatar";
import {
  Music,
  Link as LinkIcon,
  Loader2,
  ArrowLeft,
  UserRoundCheck,
  UserPlus,
  BookOpenText,
  Clock,
  Headphones,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import Link from "next/link"; // Ensure Link from next/link is imported

interface Song {
  _id: Id<"songs">;
  title: string;
  artist: string;
  album: string;
  coverImageUrl?: string | null;
}

interface RecentlyListenedEntry {
  _id: Id<"userListeningHistory">;
  song: Song | null;
  listenedAt: number;
}

interface SongDisplayProps {
  song: {
    title: string;
    artist: string;
    album: string;
    coverImageUrl?: string | null;
  };
  listenedAt: number;
}

interface User {
  _id: Id<"users">;
  username: string;
  displayName?: string | null;
  profilePictureUrl?: string | null;
  bio?: string | null;
}

interface FriendStatus {
  isFollowing: boolean;
}

const SongDisplay: React.FC<SongDisplayProps> = ({ song, listenedAt }) => {
  const timeAgo = formatDistanceToNow(new Date(listenedAt), {
    addSuffix: true,
  });
  return (
    <div className="flex transform items-center space-x-4 rounded-lg p-3 transition-all duration-200 hover:bg-accent hover:shadow-soft active:scale-[0.98]">
      {song.coverImageUrl ? (
        <img
          src={song.coverImageUrl}
          alt={song.album}
          className="h-16 w-16 flex-shrink-0 rounded-md object-cover shadow-soft"
        />
      ) : (
        <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground shadow-inset-soft">
          <Music className="h-8 w-8" />
        </div>
      )}
      <div className="flex-1 overflow-hidden">
        <p className="line-clamp-1 text-lg font-semibold text-foreground">
          {song.title}
        </p>
        <p className="line-clamp-1 text-sm text-muted-foreground">
          by {song.artist}
        </p>
        <p className="line-clamp-1 text-xs text-muted-foreground">
          Album: {song.album}
        </p>
      </div>
      <span className="flex-shrink-0 text-xs text-muted-foreground">
        <Clock className="mr-1 inline-block h-3 w-3" />
        {timeAgo}
      </span>
    </div>
  );
};

export default function PublicProfilePage() {
  const router = useRouter();
  const pathname = usePathname();
  const usernameFromUrl = pathname.split("/").pop();

  const { user: clerkUser, isLoaded: isClerkLoaded, isSignedIn } = useUser();
  const currentUserConvex = useQuery(
    api.queries.users.getMe,
    !isClerkLoaded || !isSignedIn ? "skip" : undefined,
  ) as User | null | undefined;

  const viewedUser = useQuery(
    api.queries.users.getUserByUsername,
    usernameFromUrl ? { username: usernameFromUrl } : "skip",
  ) as User | null | undefined;

  const recentlyListened = useQuery(
    api.queries.music.getUserRecentlyListened,
    viewedUser?._id ? { userId: viewedUser._id, limit: 10 } : "skip",
  ) as RecentlyListenedEntry[] | undefined;

  const followUser = useMutation(api.queries.friends.followUser);
  const unfollowUser = useMutation(api.queries.friends.unfollowUser);
  const friendStatus = useQuery(
    api.queries.friends.getFriendStatus,
    currentUserConvex && viewedUser ? { targetUserId: viewedUser._id } : "skip",
  ) as FriendStatus | undefined;

  const [isFollowActionLoading, setIsFollowActionLoading] = useState(false);

  const isFollowing = friendStatus?.isFollowing;

  // Redirect if viewing own profile
  useEffect(() => {
    if (
      isClerkLoaded &&
      isSignedIn &&
      currentUserConvex &&
      viewedUser &&
      currentUserConvex._id === viewedUser._id
    ) {
      router.replace("/profile/me");
    }
  }, [isClerkLoaded, isSignedIn, currentUserConvex, viewedUser, router]);

  const handleFollowToggle = async () => {
    if (!currentUserConvex || !viewedUser) return;

    setIsFollowActionLoading(true);
    try {
      if (isFollowing) {
        await unfollowUser({ followingId: viewedUser._id });
        toast.success(`Unfollowed @${viewedUser.username}.`);
      } else {
        await followUser({ followingId: viewedUser._id });
        toast.success(`Now following @${viewedUser.username}.`);
      }
    } catch (error: unknown) {
      console.error("Failed to toggle follow status:", error);
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred.";
      toast.error("Failed to update follow status.", {
        description: errorMessage,
      });
    } finally {
      setIsFollowActionLoading(false);
    }
  };

  // Render authentication required state
  if (!isClerkLoaded || !isSignedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
        <Card className="w-full max-w-md p-6 text-center shadow-lg-soft">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-primary">
              Authentication Required
            </CardTitle>
            <CardDescription className="text-base text-muted-foreground">
              Please sign in to view user profiles.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <Link href="/" className="inline-block">
              <Button className="w-full min-w-[150px] shadow-soft transition-all duration-200 hover:scale-[1.02]">
                Go to Sign In
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render invalid URL state
  if (!usernameFromUrl) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
        <Card className="w-full max-w-md p-6 text-center shadow-lg-soft">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-destructive">
              Invalid Profile URL
            </CardTitle>
            <CardDescription className="text-base text-muted-foreground">
              The username in the URL is missing or invalid.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <Link href="/home" className="inline-block">
              <Button className="w-full min-w-[150px] shadow-soft transition-all duration-200 hover:scale-[1.02]">
                Back to Home
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render loading state for user data
  if (
    viewedUser === undefined ||
    currentUserConvex === undefined ||
    friendStatus === undefined
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
        <div className="flex flex-col items-center gap-6">
          <Loader2 className="h-16 w-16 animate-spin text-primary" />
          <p className="text-xl font-medium text-muted-foreground">
            Loading user profile...
          </p>
          <div className="w-96 space-y-4">
            <Skeleton className="h-32 w-32 rounded-full" />
            <Skeleton className="h-8 w-64 rounded-md" />
            <Skeleton className="h-6 w-48 rounded-md" />
            <Skeleton className="h-10 w-40 rounded-full" />
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  // Render user not found state
  if (viewedUser === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
        <Card className="w-full max-w-md p-6 text-center shadow-lg-soft">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-destructive">
              User Not Found
            </CardTitle>
            <CardDescription className="text-base text-muted-foreground">
              The profile for @{usernameFromUrl} does not exist.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <Link href="/search" className="inline-block">
              <Button className="w-full min-w-[150px] shadow-soft transition-all duration-200 hover:scale-[1.02]">
                Search for Users
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-background p-4 text-foreground">
      <Card className="container mx-auto m-8 w-full max-w-2xl p-6 shadow-lg-soft sm:p-8">
        <CardHeader className="mb-6 flex flex-row items-center justify-between px-0 py-0 sm:mb-8">
          <CardTitle className="flex-grow text-center text-4xl font-extrabold text-primary sm:text-5xl">
            Profile
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-8 p-0">
          {/* User Info Section */}
          <section className="flex flex-col items-center gap-6 py-4">
            <Avatar className="h-36 w-36 overflow-hidden rounded-full border-4 border-primary shadow-lg-soft sm:h-40 sm:w-40">
              <AvatarImage
                src={viewedUser.profilePictureUrl ?? undefined}
                alt={viewedUser.displayName ?? viewedUser.username ?? "User Avatar"}
                className="h-full w-full object-cover"
              />
              <AvatarFallback className="flex h-full w-full items-center justify-center bg-primary text-6xl font-bold text-primary-foreground">
                {(viewedUser.displayName ?? viewedUser.username ?? "U")
                  .charAt(0)
                  .toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="text-center">
              <h3 className="text-4xl font-bold text-foreground">
                {viewedUser.displayName ?? viewedUser.username}
              </h3>
              <p className="text-xl text-muted-foreground">
                @{viewedUser.username}
              </p>
            </div>
            {currentUserConvex && currentUserConvex._id !== viewedUser._id && (
              <Button
                variant={isFollowing ? "outline" : "default"}
                onClick={handleFollowToggle}
                disabled={isFollowActionLoading || !currentUserConvex}
                className={`w-full max-w-[220px] rounded-full px-6 py-3 text-lg font-semibold shadow-soft transition-all duration-200 hover:scale-[1.01] ${isFollowing ? 'border-primary text-primary hover:bg-primary/5' : ''}`}
              >
                {isFollowActionLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Updating...
                  </>
                ) : isFollowing ? (
                  <>
                    <UserRoundCheck className="mr-2 h-5 w-5" /> Following
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-2 h-5 w-5" /> Follow
                  </>
                )}
              </Button>
            )}
          </section>

          {/* Bio Section */}
          {viewedUser.bio && (
            <section className="rounded-xl border border-border bg-card p-5 shadow-soft">
              <h2 className="mb-4 flex items-center gap-3 text-2xl font-bold text-primary">
                <BookOpenText className="h-6 w-6" /> Bio
              </h2>
              <p className="text-base text-muted-foreground">
                {viewedUser.bio}
              </p>
            </section>
          )}

          {/* Recently Listened Section */}
          {recentlyListened && recentlyListened.length > 0 ? (
            <section className="rounded-xl border border-border bg-card p-5 shadow-soft">
              <h2 className="mb-4 flex items-center gap-3 text-2xl font-bold text-primary">
                <Headphones className="h-6 w-6" /> Recently Listened
              </h2>
              <div className="space-y-4">
                {recentlyListened.map((entry: RecentlyListenedEntry) => (
                  <SongDisplay
                    key={String(entry._id)}
                    song={{
                      title: entry.song?.title ?? "Unknown Song",
                      artist: entry.song?.artist ?? "Unknown Artist",
                      album: entry.song?.album ?? "Unknown Album",
                      coverImageUrl: entry.song?.coverImageUrl,
                    }}
                    listenedAt={entry.listenedAt}
                  />
                ))}
              </div>
            </section>
          ) : (
            <div className="flex flex-col items-center justify-center gap-4 py-8 text-center text-muted-foreground">
              <Headphones className="h-16 w-16 text-muted-foreground" />
              <p className="text-lg font-medium">
                This user hasn&apos;t added a bio or listened to anything
                recently.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}