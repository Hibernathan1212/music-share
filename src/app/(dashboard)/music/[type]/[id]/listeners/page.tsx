// app/music/[type]/[id]/listeners/page.tsx
"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../../../../convex/_generated/api";
import { useParams, useRouter } from "next/navigation";
import { Id } from "../../../../../../../convex/_generated/dataModel";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { ArrowLeft, User as UserIcon, Loader2 } from "lucide-react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";

// Define a type for the hydrated listener data
type HydratedListener = {
  user: {
    _id: Id<"users">;
    username: string;
    displayName: string | undefined | null;
    profilePictureUrl: string | undefined | null;
  };
  listenedAt: number;
};

export default function ListenersPage() {
  const params = useParams();
  const router = useRouter();

  const type = params.type as "song" | "artist" | "album";
  const id = params.id as Id<"songs"> | Id<"artists"> | Id<"albums">;

  // --- Fetch music item details (for title display) ---
  const musicItem = useQuery(
    api.queries.music.getSongById,
    type === "song" ? { songId: id as Id<"songs"> } : "skip",
  );
  const artistItem = useQuery(
    api.queries.music.getArtistById,
    type === "artist" ? { artistId: id as Id<"artists"> } : "skip",
  );
  const albumItem = useQuery(
    api.queries.music.getAlbumById,
    type === "album" ? { albumId: id as Id<"albums"> } : "skip",
  );

  const listenersBySong = useQuery(
    api.queries.music.getListenersBySong,
    type === "song" ? { songId: id as Id<"songs"> } : "skip",
  );

  const listenersByArtist = useQuery(
    api.queries.music.getListenersByArtist,
    type === "artist" ? { artistId: id as Id<"artists"> } : "skip",
  );

  const listenersByAlbum = useQuery(
    api.queries.music.getListenersByAlbum,
    type === "album" ? { albumId: id as Id<"albums"> } : "skip",
  );

  let listeners: HydratedListener[] | undefined;
  if (type === "song") {
    listeners = listenersBySong as HydratedListener[] | undefined;
  } else if (type === "artist") {
    listeners = listenersByArtist as HydratedListener[] | undefined;
  } else if (type === "album") {
    listeners = listenersByAlbum as HydratedListener[] | undefined;
  }

  const isLoading =
    listeners === undefined ||
    (type === "song" && musicItem === undefined) ||
    (type === "artist" && artistItem === undefined) ||
    (type === "album" && albumItem === undefined);

  const titleText =
    type === "song"
      ? musicItem?.title
      : type === "artist"
        ? artistItem?.name
        : type === "album"
          ? albumItem?.title
          : "Unknown";
  const typeLabel =
    type === "song" ? "Song" : type === "artist" ? "Artist" : "Album";

  return (
    <div className="flex min-h-screen flex-col items-center bg-background p-4 text-foreground">
      <Card className="container mx-auto m-8 w-full max-w-3xl p-6 shadow-lg-soft sm:p-8">
        <CardHeader className="mb-6 flex flex-row items-center justify-between px-0 py-0 sm:mb-8">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <CardTitle className="flex-grow text-center text-3xl font-extrabold text-primary sm:text-4xl">
            {isLoading ? (
              <Skeleton className="h-10 w-64 mx-auto" />
            ) : (
              `${typeLabel}: ${titleText}`
            )}
          </CardTitle>
          <div className="w-10"></div> {/* Spacer for alignment */}
        </CardHeader>

        <CardContent className="p-0">
          <h2 className="mb-4 text-center text-xl font-semibold text-foreground sm:text-2xl">
            Listeners
          </h2>

          <div className="min-h-[300px] rounded-xl border border-border bg-card p-4 shadow-soft sm:p-6">
            {isLoading && (
              <div className="flex h-full min-h-[inherit] flex-col items-center justify-center p-8 text-center">
                <Loader2 className="mb-4 h-12 w-12 animate-spin text-primary" />
                <p className="text-xl font-medium text-muted-foreground">
                  Loading listeners...
                </p>
                <div className="mt-8 w-full space-y-4">
                  <Skeleton className="h-20 w-full rounded-xl" />
                  <Skeleton className="h-20 w-full rounded-xl" />
                </div>
              </div>
            )}
            {!isLoading && listeners && listeners.length === 0 && (
              <div className="flex h-full min-h-[inherit] flex-col items-center justify-center p-8 text-center">
                <UserIcon className="mb-4 h-12 w-12 text-muted-foreground" />
                <p className="text-xl text-muted-foreground">
                  No one has listened to this {type} yet.
                </p>
              </div>
            )}

            {!isLoading && listeners && listeners.length > 0 && (
              <div className="space-y-4">
                {listeners.map((entry) => (
                  <Link
                    href={`/profile/${entry.user.username}`}
                    key={entry.user._id}
                    className="block"
                  >
                    <div className="flex transform cursor-pointer items-center space-x-4 rounded-xl p-3 transition-all duration-200 hover:bg-accent hover:shadow-soft active:scale-[0.98]">
                      <Avatar className="h-16 w-16 flex-shrink-0 rounded-full border border-border">
                        <AvatarImage
                          src={entry.user.profilePictureUrl ?? undefined}
                          alt={
                            entry.user.displayName ??
                            entry.user.username ??
                            "User Avatar"
                          }
                          className="object-cover"
                        />
                        <AvatarFallback className="flex h-full w-full items-center justify-center bg-primary text-xl font-bold text-primary-foreground">
                          {(entry.user.displayName ?? entry.user.username ?? "U")
                            .charAt(0)
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 overflow-hidden">
                        <p className="truncate text-xl font-semibold text-foreground">
                          {entry.user.displayName ?? entry.user.username}
                        </p>
                        <p className="truncate text-sm text-muted-foreground">
                          @{entry.user.username}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          Last listened:{" "}
                          {formatDistanceToNow(new Date(entry.listenedAt), {
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                      <ArrowLeft className="h-5 w-5 rotate-180 text-muted-foreground transition-transform duration-200 group-hover:translate-x-1" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}