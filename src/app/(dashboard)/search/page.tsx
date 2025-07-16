"use client";

import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "~/components/ui/card";
import {
  User as UserIcon,
  Music,
  ArrowLeft,
  Loader2,
  Album,
} from "lucide-react";
import Link from "next/link"; // Import Link from next/link
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Doc, Id } from "../../../../convex/_generated/dataModel";

type SongSearchResult = {
  _id: Id<"songs">;
  type: "song";
  title: string;
  artistName: string;
  albumTitle: string;
  coverImageUrl: string | null;
  spotifyId: string | undefined;
  // Add albumId and artistId here if you want to link to their listeners
  albumId: Id<"albums"> | undefined;
  artistId: Id<"artists"> | undefined;
};

type ArtistSearchResult = {
  _id: Id<"artists">;
  type: "artist";
  name: string;
  imageUrl: string | undefined;
  spotifyId: string | undefined;
};

type MusicSearchResults = {
  songs: SongSearchResult[];
  artists: ArtistSearchResult[];
};

export default function SearchPage() {
  const { isLoaded, isSignedIn } = useUser();
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [searchType, setSearchType] = useState<"users" | "music">("users");

  // Debounce the search term to reduce API calls
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);

    return () => {
      clearTimeout(handler);
    };
  }, [searchTerm]);

  // Fetch user search results
  const searchUsersResult = useQuery(
    api.queries.search.searchUsers,
    isLoaded &&
      isSignedIn &&
      debouncedSearchTerm.length > 2 &&
      searchType === "users"
      ? { query: debouncedSearchTerm }
      : "skip",
  );

  // Fetch music search results
  const searchMusicResult = useQuery(
    api.queries.search.searchMusic,
    isLoaded &&
      isSignedIn &&
      debouncedSearchTerm.length > 2 &&
      searchType === "music"
      ? { query: debouncedSearchTerm }
      : "skip",
  ) as MusicSearchResults | undefined;

  // Render authentication required state
  if (!isLoaded || !isSignedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
        <Card className="w-full max-w-md p-6 text-center shadow-lg-soft">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-primary">
              Authentication Required
            </CardTitle>
            <CardDescription className="text-base text-muted-foreground">
              Please sign in to search for content.
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

  // Determine if content is currently loading
  const isLoading =
    (searchType === "users" && searchUsersResult === undefined) ||
    (searchType === "music" && searchMusicResult === undefined);

  return (
    <div className="flex min-h-screen flex-col items-center bg-background p-4 text-foreground">
      <Card className="container mx-auto mt-8 w-full max-w-3xl p-6 shadow-lg-soft sm:p-8">
        <CardHeader className="mb-6 flex flex-row items-center justify-between px-0 py-0 sm:mb-8">
          <CardTitle className="flex-grow text-center text-4xl font-extrabold text-primary sm:text-5xl">
            Search
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6 p-0">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Input
              placeholder={`Search for ${searchType}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 rounded-full px-4 py-2 text-base shadow-inset-soft transition-all duration-200 focus:border-primary focus:ring-1 focus:ring-primary"
            />
            <div className="flex w-full justify-center gap-3 sm:w-auto">
              <Button
                variant={searchType === "users" ? "default" : "outline"}
                onClick={() => setSearchType("users")}
                className="flex-1 shadow-soft transition-all duration-200 hover:scale-[1.02] sm:w-auto"
              >
                <UserIcon className="mr-2 h-5 w-5" /> Users
              </Button>
              <Button
                variant={searchType === "music" ? "default" : "outline"}
                onClick={() => setSearchType("music")}
                className="flex-1 shadow-soft transition-all duration-200 hover:scale-[1.02] sm:w-auto"
              >
                <Music className="mr-2 h-5 w-5" /> Music
              </Button>
            </div>
          </div>

          <div className="min-h-[300px] rounded-xl border border-border bg-card p-4 shadow-soft sm:p-6">
            {isLoading && debouncedSearchTerm.length > 2 && (
              <div className="flex h-full min-h-[inherit] flex-col items-center justify-center p-8 text-center">
                <Loader2 className="mb-4 h-12 w-12 animate-spin text-primary" />
                <p className="text-xl font-medium text-muted-foreground">
                  Searching for {searchType}...
                </p>
                <div className="mt-8 w-full space-y-4">
                  <Skeleton className="h-20 w-full rounded-xl" />
                  <Skeleton className="h-20 w-full rounded-xl" />
                </div>
              </div>
            )}
            {!isLoading && debouncedSearchTerm.length <= 2 && (
              <div className="flex h-full min-h-[inherit] flex-col items-center justify-center p-8 text-center">
                <UserIcon className="mb-4 h-12 w-12 text-primary" />
                <Music className="mb-4 h-12 w-12 text-primary" />
                <p className="text-xl text-muted-foreground">
                  Start typing in the search bar above to find users or music.
                </p>
              </div>
            )}
            {!isLoading &&
              debouncedSearchTerm.length > 2 &&
              searchType === "users" &&
              searchUsersResult &&
              searchUsersResult.length === 0 && (
                <div className="flex h-full min-h-[inherit] flex-col items-center justify-center p-8 text-center">
                  <UserIcon className="mb-4 h-12 w-12 text-muted-foreground" />
                  <p className="text-xl text-muted-foreground">
                    No users found for &quot;{debouncedSearchTerm}&quot;.
                  </p>
                </div>
              )}
            {!isLoading &&
              debouncedSearchTerm.length > 2 &&
              searchType === "music" &&
              searchMusicResult &&
              searchMusicResult.songs.length === 0 &&
              searchMusicResult.artists.length === 0 && (
                <div className="flex h-full min-h-[inherit] flex-col items-center justify-center p-8 text-center">
                  <Music className="mb-4 h-12 w-12 text-muted-foreground" />
                  <p className="text-xl text-muted-foreground">
                    No music found for &quot;{debouncedSearchTerm}&quot;.
                  </p>
                </div>
              )}

            <div className="space-y-4">
              {searchType === "users" &&
                searchUsersResult?.map((user: Doc<"users">) => (
                  <Link
                    href={`/profile/${user.username}`}
                    key={user._id}
                    className="block"
                  >
                    <div className="flex transform cursor-pointer items-center space-x-4 rounded-xl p-3 transition-all duration-200 hover:bg-accent hover:shadow-soft active:scale-[0.98]">
                      <Avatar className="h-16 w-16 flex-shrink-0 rounded-full border border-border">
                        <AvatarImage
                          src={user.profilePictureUrl ?? undefined}
                          alt={user.displayName ?? user.username ?? "User Avatar"}
                          className="object-cover"
                        />
                        <AvatarFallback className="flex h-full w-full items-center justify-center bg-primary text-xl font-bold text-primary-foreground">
                          {(user.displayName ?? user.username ?? "U")
                            .charAt(0)
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 overflow-hidden">
                        <p className="truncate text-xl font-semibold text-foreground">
                          {user.displayName ?? user.username}
                        </p>
                        <p className="truncate text-sm text-muted-foreground">
                          @{user.username}
                        </p>
                      </div>
                      <ArrowLeft className="h-5 w-5 rotate-180 text-muted-foreground transition-transform duration-200 group-hover:translate-x-1" />
                    </div>
                  </Link>
                ))}

              {searchType === "music" && searchMusicResult && (
                <>
                  {searchMusicResult.songs.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="mb-3 text-2xl font-bold text-primary">
                        Songs
                      </h3>
                      {searchMusicResult.songs.map((item: SongSearchResult) => (
                        <Link
                          href={`/music/song/${item._id}/listeners`} // Link to song listeners page
                          key={item._id}
                          className="block"
                        >
                          <div className="flex transform cursor-pointer items-center space-x-4 rounded-xl p-3 transition-all duration-200 hover:bg-accent hover:shadow-soft active:scale-[0.98]">
                            {item.coverImageUrl ? (
                              <img
                                src={item.coverImageUrl}
                                alt={item.title}
                                className="h-20 w-20 flex-shrink-0 rounded-lg object-cover shadow-soft"
                              />
                            ) : (
                              <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground shadow-inset-soft">
                                <Music className="h-10 w-10" />
                              </div>
                            )}
                            <div className="flex-1 overflow-hidden">
                              <p className="line-clamp-1 text-xl font-semibold text-foreground">
                                {item.title}
                              </p>
                              <p className="line-clamp-1 text-base text-muted-foreground">
                                by {item.artistName}
                              </p>
                              <p className="line-clamp-1 text-sm text-muted-foreground">
                                Album: {item.albumTitle}
                              </p>
                            </div>
                            <ArrowLeft className="h-5 w-5 rotate-180 text-muted-foreground transition-transform duration-200 group-hover:translate-x-1" />
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}

                  {searchMusicResult.artists.length > 0 && (
                    <div
                      className={`space-y-4 ${
                        searchMusicResult.songs.length > 0 ? "mt-8" : ""
                      }`}
                    >
                      <h3 className="mb-3 text-2xl font-bold text-primary">
                        Artists
                      </h3>
                      {searchMusicResult.artists.map(
                        (item: ArtistSearchResult) => (
                          <Link
                            href={`/music/artist/${item._id}/listeners`} // Link to artist listeners page
                            key={item._id}
                            className="block"
                          >
                            <div className="flex transform items-center space-x-4 rounded-xl p-3 transition-all duration-200 hover:bg-accent hover:shadow-soft active:scale-[0.98]">
                              {item.imageUrl ? (
                                <img
                                  src={item.imageUrl}
                                  alt={item.name}
                                  className="h-20 w-20 flex-shrink-0 rounded-full object-cover shadow-soft"
                                />
                              ) : (
                                <Avatar className="h-20 w-20 flex-shrink-0 rounded-full border border-border">
                                  <AvatarFallback className="flex h-full w-full items-center justify-center bg-muted text-3xl font-bold text-muted-foreground">
                                    {item.name.charAt(0).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                              )}
                              <div className="flex-1 overflow-hidden">
                                <p className="line-clamp-1 text-xl font-semibold text-foreground">
                                  {item.name}
                                </p>
                                <p className="text-base text-muted-foreground">
                                  Artist
                                </p>
                              </div>
                              <ArrowLeft className="h-5 w-5 rotate-180 text-muted-foreground transition-transform duration-200 group-hover:translate-x-1" />
                            </div>
                          </Link>
                        ),
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}