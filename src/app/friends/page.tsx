// src/app/friends/page.tsx - REVISED
"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api"; // Correct path to _generated/api
import { useUser } from "@clerk/nextjs";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  Users,
  UserPlus,
  ArrowLeft,
  UserRoundCheck,
  Loader2,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { toast } from "sonner";
import { useState } from "react";
import { Id } from "../../../convex/_generated/dataModel"; // Import Id for Convex IDs
import { Doc } from "../../../convex/_generated/dataModel"; // Import Doc for full document types

// Define the expected user type for the UserListItem component
type UserDoc = Doc<"users">; // Full user document type from Convex

interface UserListItemProps {
  user: UserDoc;
  isFollowing: boolean;
  onFollowToggle: (userId: Id<"users">, currentStatus: boolean) => void;
  showToggle?: boolean;
  isActionLoading?: boolean;
}

const UserListItem: React.FC<UserListItemProps> = ({
  user,
  isFollowing,
  onFollowToggle,
  showToggle = true,
  isActionLoading = false,
}) => {
  return (
    <div className="flex items-center justify-between rounded-md p-3 transition-colors hover:bg-accent hover:shadow-soft">
      <Link
        href={`/profile/${user.username}`}
        className="flex flex-1 items-center space-x-4"
      >
        <Avatar className="h-14 w-14">
          <AvatarImage
            src={user.profilePictureUrl ?? undefined}
            alt={user.displayName ?? user.username ?? "User Avatar"}
          />
          <AvatarFallback>
            {(user.displayName ?? user.username ?? "U")
              .charAt(0)
              .toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="font-semibold text-foreground">
            {user.displayName ?? user.username}
          </p>
          <p className="text-sm text-muted-foreground">@{user.username}</p>
        </div>
      </Link>
      {showToggle && (
        <Button
          variant={isFollowing ? "outline" : "default"}
          size="sm"
          onClick={() => onFollowToggle(user._id, isFollowing)}
          disabled={isActionLoading}
          className="shadow-soft hover:scale-[1.01]"
        >
          {isActionLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
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
  );
};

export default function FriendsPage() {
  const { isLoaded, isSignedIn } = useUser();

  const convexUser = useQuery(
    api.queries.users.getMe,
    !isLoaded || !isSignedIn ? "skip" : undefined,
  );

  const following = useQuery(
    api.queries.friends.getFollowing,
    isLoaded && isSignedIn && convexUser ? { userId: convexUser._id } : "skip",
  );
  const followers = useQuery(
    api.queries.friends.getFollowers,
    isLoaded && isSignedIn && convexUser ? { userId: convexUser._id } : "skip",
  );

  const followUser = useMutation(api.queries.friends.followUser);
  const unfollowUser = useMutation(api.queries.friends.unfollowUser);

  const [actionLoadingId, setActionLoadingId] = useState<Id<"users"> | null>(
    null,
  );

  const handleFollowToggle = async (
    targetUserId: Id<"users">,
    currentStatus: boolean,
  ) => {
    if (!convexUser) return; // Should not happen if button is disabled, but good guard

    setActionLoadingId(targetUserId);
    try {
      if (currentStatus) {
        await unfollowUser({ followingId: targetUserId });
        toast.success(
          `Unfollowed @${
            (following ?? []).find((f) => f?._id === targetUserId)?.username ?? // Added (following ?? []) and null check for 'f'
            (followers ?? []).find((f) => f?._id === targetUserId)?.username ?? // Added (followers ?? []) and null check for 'f'
            "user"
          }.`,
        );
      } else {
        await followUser({ followingId: targetUserId });
        toast.success(
          `Now following @${
            (following ?? []).find((f) => f?._id === targetUserId)?.username ?? // Added (following ?? []) and null check for 'f'
            (followers ?? []).find((f) => f?._id === targetUserId)?.username ?? // Added (followers ?? []) and null check for 'f'
            "user"
          }.`,
        );
      }
    } catch (error) {
      console.error("Failed to toggle follow status:", error);
      toast.error("Failed to update follow status.", {
        description: "An unexpected error occurred.",
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  if (!isLoaded || !isSignedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
        <Card className="w-full max-w-md p-6 text-center shadow-lg-soft">
          <CardHeader>
            <CardTitle className="text-xl">Authentication Required</CardTitle>
            <CardDescription>
              Please sign in to manage your friends.
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

  if (!convexUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-lg text-muted-foreground">
            Loading your profile data...
          </p>
          <Skeleton className="h-20 w-48 rounded-md shadow-soft" />
        </div>
      </div>
    );
  }

  // Check if following or followers data is undefined (still loading)
  if (following === undefined || followers === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-lg text-muted-foreground">Loading friends data...</p>
          <Skeleton className="h-40 w-64 rounded-md shadow-soft" />
        </div>
      </div>
    );
  }

  // Now, `following` and `followers` are guaranteed to be `UserDoc[]`
  const followedUserIds = new Set(following.map((user) => String(user!._id)));

  return (
    <div className="flex min-h-screen flex-col items-center bg-background p-4 text-foreground">
      <Card className="container mx-auto mt-8 w-full max-w-lg p-6 shadow-lg-soft">
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
            Friends
          </CardTitle>
          <div className="w-[88px]" /> {/* Spacer */}
        </CardHeader>

        <CardContent className="p-0 pt-6">
          <Tabs defaultValue="following" className="w-full">
            <TabsList className="grid w-full grid-cols-2 shadow-soft">
              <TabsTrigger value="following" className="shadow-inset-soft">
                Following ({following.length ?? 0}){" "}
                {/* `following` is UserDoc[] here */}
              </TabsTrigger>
              <TabsTrigger value="followers" className="shadow-inset-soft">
                Followers ({followers.length ?? 0}){" "}
                {/* `followers` is UserDoc[] here */}
              </TabsTrigger>
            </TabsList>
            <TabsContent
              value="following"
              className="mt-4 rounded-lg border border-border p-4 shadow-soft"
            >
              {following.length === 0 ? (
                <div className="flex flex-col items-center gap-4 py-8 text-center text-muted-foreground">
                  <UserPlus className="h-12 w-12" />
                  <p className="text-lg">You&apos;re not following anyone yet!</p>
                  <Link href="/search">
                    <Button className="shadow-soft hover:scale-[1.02]">
                      Find People to Follow
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {following.map((user) => (
                    // `user` is UserDoc here
                    <UserListItem
                      key={user!._id}
                      user={user!}
                      isFollowing={true}
                      onFollowToggle={handleFollowToggle}
                      isActionLoading={actionLoadingId === user!._id}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
            <TabsContent
              value="followers"
              className="mt-4 rounded-lg border border-border p-4 shadow-soft"
            >
              {followers.length === 0 ? (
                <div className="flex flex-col items-center gap-4 py-8 text-center text-muted-foreground">
                  <Users className="h-12 w-12" />
                  <p className="text-lg">No one is following you yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {followers.map((user) => (
                    // `user` is UserDoc here
                    <UserListItem
                      key={user!._id}
                      user={user!}
                      isFollowing={followedUserIds.has(String(user!._id))}
                      onFollowToggle={handleFollowToggle}
                      isActionLoading={actionLoadingId === user!._id}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}