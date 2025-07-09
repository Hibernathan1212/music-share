// src/app/profile/[userId]/page.tsx
"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api"; // Adjust path for api.users, api.music, api.friends
// ... (other imports)
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
// import { Id } from "../../../../convex/_generated/dataModel"; // Import Id type
import { formatDistanceToNow } from "date-fns"; // Make sure to import this
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { useUser } from "@clerk/nextjs";
import { Avatar, AvatarImage, AvatarFallback } from "@radix-ui/react-avatar";
import { Music, Link, Loader2, ArrowLeft, UserRoundCheck, UserPlus, BookOpenText, Clock, Headphones } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";

interface SongDisplayProps {
  song: {
    title: string;
    artist: string;
    album: string;
    coverImageUrl?: string | null;
  };
  listenedAt: number;
}

const SongDisplay: React.FC<SongDisplayProps> = ({ song, listenedAt }) => {
  const timeAgo = formatDistanceToNow(new Date(listenedAt), { addSuffix: true });
  return (
    <div className="flex items-center space-x-3 rounded-lg p-3 transition-colors hover:bg-accent hover:shadow-soft">
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

export default function PublicProfilePage() {
  const router = useRouter();
  const pathname = usePathname();
  const usernameFromUrl = pathname.split("/").pop(); // Get the username from the URL

  const { user: clerkUser, isLoaded: isClerkLoaded, isSignedIn } = useUser();
  const currentUserConvex = useQuery(
    api.queries.users.getMe, // Query for the current logged-in user's Convex doc
    !isClerkLoaded || !isSignedIn ? "skip" : undefined,
  );
  // Query the profile data for the user being viewed
  const viewedUser = useQuery(
    api.queries.users.getUserByUsername, // Use the new getUserByUsername query
    usernameFromUrl ? { username: usernameFromUrl } : "skip",
  );

  const recentlyListened = useQuery(
    api.queries.music.getUserRecentlyListened, // Use the new getUserRecentlyListened query
    viewedUser?._id ? { userId: viewedUser._id, limit: 10 } : "skip",
  );

  const followUser = useMutation(api.queries.friends.followUser); // Use the new friends mutation
  const unfollowUser = useMutation(api.queries.friends.unfollowUser); // Use the new friends mutation
  const friendStatus = useQuery(
    api.queries.friends.getFriendStatus, // New query to check friendship status
    currentUserConvex && viewedUser ? { targetUserId: viewedUser._id } : "skip"
  );


  const [isFollowActionLoading, setIsFollowActionLoading] = useState(false);

  // Determine if the current logged-in user is following the viewed user
  const isFollowing = friendStatus?.isFollowing;

  // If viewing own profile, redirect to /profile/me
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
    } catch (error: any) {
      console.error("Failed to toggle follow status:", error);
      toast.error("Failed to update follow status.", {
        description: error.message ?? "An unexpected error occurred.",
      });
    } finally {
      setIsFollowActionLoading(false);
    }
  };

  // ... (loading states as before, ensure they correctly use viewedUser, currentUserConvex and friendStatus)

  if (!isClerkLoaded || !isSignedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
        <Card className="w-full max-w-md p-6 text-center shadow-lg-soft">
          <CardHeader>
            <CardTitle className="text-xl">Authentication Required</CardTitle>
            <CardDescription>
              Please sign in to view user profiles.
            </CardDescription>
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

  if (!usernameFromUrl) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
        <Card className="w-full max-w-md p-6 text-center shadow-lg-soft">
          <CardHeader>
            <CardTitle className="text-xl text-destructive">
              Invalid Profile URL
            </CardTitle>
            <CardDescription>
              The username in the URL is missing or invalid.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/home">
              <Button className="shadow-soft hover:scale-[1.02]">
                Back to Home
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (viewedUser === undefined || currentUserConvex === undefined || friendStatus === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-lg text-muted-foreground">Loading user profile...</p>
          <Skeleton className="h-64 w-96 rounded-lg shadow-soft" />
        </div>
      </div>
    );
  }

  if (viewedUser === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
        <Card className="w-full max-w-md p-6 text-center shadow-lg-soft">
          <CardHeader>
            <CardTitle className="text-xl text-destructive">User Not Found</CardTitle>
            <CardDescription>
              The profile for @{usernameFromUrl} does not exist.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/search">
              <Button className="shadow-soft hover:scale-[1.02]">
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
      <Card className="container mx-auto mt-8 w-full max-w-2xl p-6 shadow-lg-soft">
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
            {viewedUser.displayName ?? viewedUser.username}&apos;s Profile
          </CardTitle>
          <div className="w-[88px]" /> {/* Spacer */}
        </CardHeader>

        <CardContent className="space-y-8 p-0 pt-6">
          <div className="flex flex-col items-center gap-4">
            <Avatar className="h-32 w-32 border-2 border-primary shadow-lg-soft">
              <AvatarImage
                src={viewedUser.profilePictureUrl ?? undefined}
                alt={viewedUser.displayName ?? viewedUser.username ?? "User Avatar"}
              />
              <AvatarFallback className="text-5xl">
                {(viewedUser.displayName ?? viewedUser.username ?? "U")
                  .charAt(0)
                  .toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <h3 className="text-3xl font-bold text-foreground">
              {viewedUser.displayName ?? viewedUser.username}
            </h3>
            <p className="text-xl text-muted-foreground">
              @{viewedUser.username}
            </p>
            {/* Only show follow button if not viewing own profile AND logged in */}
            {currentUserConvex && currentUserConvex._id !== viewedUser._id && (
              <Button
                variant={isFollowing ? "outline" : "default"}
                onClick={handleFollowToggle}
                disabled={isFollowActionLoading || !currentUserConvex}
                className="w-full max-w-[200px] shadow-soft hover:scale-[1.01]"
              >
                {isFollowActionLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : isFollowing ? (
                  <>
                    <UserRoundCheck className="mr-2 h-4 w-4" /> Following
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-2 h-4 w-4" /> Follow
                  </>
                )}
              </Button>
            )}
          </div>

          {(viewedUser.bio ?? (recentlyListened && recentlyListened.length > 0)) ? (
            <div className="space-y-6">
              {viewedUser.bio && (
                <section className="rounded-lg border border-border p-4 shadow-soft">
                  <h2 className="mb-3 flex items-center gap-2 text-xl font-semibold text-foreground">
                    <BookOpenText className="h-5 w-5 text-primary" /> Bio
                  </h2>
                  <p className="text-muted-foreground">{viewedUser.bio}</p>
                </section>
              )}

              {recentlyListened && recentlyListened.length > 0 && (
                <section className="rounded-lg border border-border p-4 shadow-soft">
                  <h2 className="mb-3 flex items-center gap-2 text-xl font-semibold text-foreground">
                    <Clock className="h-5 w-5 text-primary" /> Recently Listened
                  </h2>
                  <div className="space-y-3">
                    {recentlyListened.map((entry: any) => (
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
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-4 py-8 text-center text-muted-foreground">
                <Headphones className="h-12 w-12" />
                <p className="text-lg">This user hasn't added a bio or listened to anything recently.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}