// src/app/search/page.tsx - REVISED
"use client";

import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
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
  Search as SearchIcon,
  User as UserIcon,
  Music,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Doc, Id } from "../../../convex/_generated/dataModel"; // Import Doc and Id types

// Define types for music search results to help TypeScript
type SongSearchResult = {
  _id: Id<"songs">;
  type: "song";
  title: string;
  artistName: string;
  albumTitle: string;
  coverImageUrl: string | null;
  spotifyId: string | undefined;
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

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);

    return () => {
      clearTimeout(handler);
    };
  }, [searchTerm]);

  const searchUsersResult = useQuery( // Removed generic type here
    api.queries.search.searchUsers,
    isLoaded && isSignedIn && debouncedSearchTerm.length > 2 && searchType === "users"
      ? { query: debouncedSearchTerm }
      : "skip",
  );

  const searchMusicResult = useQuery(
  api.queries.search.searchMusic,
  isLoaded &&
    isSignedIn &&
    debouncedSearchTerm.length > 2 &&
    searchType === "music"
    ? { query: debouncedSearchTerm }
    : "skip",
) as MusicSearchResults | undefined;

  if (!isLoaded || !isSignedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
        <Card className="w-full max-w-md p-6 text-center shadow-lg-soft">
          <CardHeader>
            <CardTitle className="text-xl">Authentication Required</CardTitle>
            <CardDescription>
              Please sign in to search for content.
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

  const isLoading =
    (searchType === "users" && searchUsersResult === undefined) ||
    (searchType === "music" && searchMusicResult === undefined);

  return (
    <div className="flex min-h-screen flex-col items-center bg-background p-4 text-foreground">
      <Card className="container mx-auto mt-8 w-full max-w-3xl p-6 shadow-lg-soft">
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
            Search
          </CardTitle>
          <div className="w-[88px]" /> {/* Spacer */}
        </CardHeader>

        <CardContent className="space-y-6 p-0 pt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:space-x-2">
            <Input
              placeholder={`Search for ${searchType}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 shadow-inset-soft"
            />
            <div className="flex justify-center gap-2">
              <Button
                variant={searchType === "users" ? "default" : "outline"}
                onClick={() => setSearchType("users")}
                className="shadow-soft w-1/2 sm:w-auto"
              >
                <UserIcon className="mr-2 h-4 w-4" /> Users
              </Button>
              <Button
                variant={searchType === "music" ? "default" : "outline"}
                onClick={() => setSearchType("music")}
                className="shadow-soft w-1/2 sm:w-auto"
              >
                <Music className="mr-2 h-4 w-4" /> Music
              </Button>
            </div>
          </div>

          <div className="min-h-[200px] rounded-lg border border-border bg-card p-4 shadow-soft">
            {isLoading && debouncedSearchTerm.length > 2 && (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-2 text-lg text-muted-foreground">Searching...</p>
              </div>
            )}
            {!isLoading && debouncedSearchTerm.length <= 2 && (
              <p className="text-center text-muted-foreground p-8">
                Start typing to search for users or music.
              </p>
            )}
            {!isLoading &&
              debouncedSearchTerm.length > 2 &&
              searchType === "users" &&
              searchUsersResult && // Ensure it's not undefined
              searchUsersResult.length === 0 && ( // Length property now safe to access
                <p className="text-center text-muted-foreground p-8">
                  No users found for "{debouncedSearchTerm}".
                </p>
              )}
            {!isLoading &&
              debouncedSearchTerm.length > 2 &&
              searchType === "music" &&
              searchMusicResult && // Ensure it's not undefined
              (searchMusicResult.songs.length === 0 &&
                searchMusicResult.artists.length === 0) && (
                <p className="text-center text-muted-foreground p-8">
                  No music found for "{debouncedSearchTerm}".
                </p>
              )}

            {/* Display Search Results */}
            <div className="space-y-3">
              {searchType === "users" &&
                searchUsersResult && // Ensure it's not undefined
                searchUsersResult.map((user: Doc<"users">) => (
                  // Type here
                  <Link href={`/profile/${user.username}`} key={user._id}>
                    <div className="flex cursor-pointer items-center space-x-4 rounded-md p-3 transition-colors hover:bg-accent hover:shadow-soft">
                      <Avatar className="h-14 w-14">
                        <AvatarImage
                          src={user.profilePictureUrl || undefined}
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
                          {user.displayName || user.username}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          @{user.username}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}

              {searchType === "music" && searchMusicResult && ( // Ensure searchMusicResult is not undefined
                <>
                  {searchMusicResult.songs.length > 0 && ( // Length property now safe to access
                    <div className="space-y-3">
                      <h3 className="text-lg font-semibold text-primary">Songs</h3>
                      {searchMusicResult.songs.map((item: SongSearchResult) => (
                        <div
                          key={item._id}
                          className="flex items-center space-x-4 rounded-md p-3 transition-colors hover:bg-accent hover:shadow-soft"
                        >
                          {item.coverImageUrl ? (
                            <img
                              src={item.coverImageUrl}
                              alt={item.title}
                              className="h-16 w-16 rounded-md object-cover shadow-soft"
                            />
                          ) : (
                            <div className="flex h-16 w-16 items-center justify-center rounded-md bg-muted text-muted-foreground shadow-inset-soft">
                              <Music className="h-8 w-8" />
                            </div>
                          )}
                          <div>
                            <p className="font-semibold text-foreground">
                              {item.title}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              by {item.artistName}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {searchMusicResult.artists.length > 0 && ( // Length property now safe to access
                    <div className="space-y-3 mt-6">
                      <h3 className="text-lg font-semibold text-primary">
                        Artists
                      </h3>
                      {searchMusicResult.artists.map((item: ArtistSearchResult) => (
                        <div
                          key={item._id}
                          className="flex items-center space-x-4 rounded-md p-3 transition-colors hover:bg-accent hover:shadow-soft"
                        >
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="h-16 w-16 rounded-full object-cover shadow-soft"
                            />
                          ) : (
                            <Avatar className="h-16 w-16">
                              <AvatarFallback className="text-xl">
                                {item.name.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                          )}
                          <div>
                            <p className="font-semibold text-foreground">
                              {item.name}
                            </p>
                            <p className="text-sm text-muted-foreground">Artist</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
              {isLoading && debouncedSearchTerm.length > 2 && (
                <div className="space-y-3">
                  <Skeleton className="h-20 w-full rounded-md" />
                  <Skeleton className="h-20 w-full rounded-md" />
                  <Skeleton className="h-20 w-full rounded-md" />
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}