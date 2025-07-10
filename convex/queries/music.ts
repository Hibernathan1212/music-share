// convex/music.ts - FINAL REVISED VERSION
import { internal } from "../_generated/api";
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "../_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";

// --- User Listening History Queries ---

// This query is for the *logged-in user's* private listening history.
export const getMyListeningHistory = query({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity!.subject))
      .unique();

    // Ensure the authenticated user is requesting their OWN history
    if (!identity || !currentUser || currentUser._id !== args.userId) {
      throw new Error("Not authorized to view this user's history.");
    }

    const history = await ctx.db
      .query("userListeningHistory")
      .withIndex("by_user_listenedAt", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(args.limit || 50);

    const hydratedHistory = await Promise.all(
      history.map(async (entry) => {
        const song = await ctx.db.get(entry.songId);
        let artist = null;
        if (song?.artistId) {
          artist = await ctx.db.get(song.artistId);
        }
        let album = null;
        if (song?.albumId) {
          album = await ctx.db.get(song.albumId);
        }

        return {
          ...entry,
          song: {
            title: song?.title ?? "Unknown Song",
            artist: artist?.name ?? "Unknown Artist",
            album: album?.title ?? "Unknown Album",
            coverImageUrl: album?.coverImageUrl,
            previewUrl: song?.previewUrl,
            durationMs: song?.durationMs,
          },
        };
      }),
    );
    return hydratedHistory;
  },
});

// This query is for public profiles to show *any user's* recently listened tracks.
export const getUserRecentlyListened = query({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // No auth check for viewing public profiles' recently listened.
    // If you add private profiles, add a check here.

    const history = await ctx.db
      .query("userListeningHistory")
      .withIndex("by_user_listenedAt", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(args.limit || 10); // Default to 10 for "recently listened" on a public profile

    const hydratedHistory = await Promise.all(
      history.map(async (entry) => {
        const song = await ctx.db.get(entry.songId);
        let artist = null;
        if (song?.artistId) {
          artist = await ctx.db.get(song.artistId);
        }
        let album = null;
        if (song?.albumId) {
          album = await ctx.db.get(song.albumId);
        }

        return {
          ...entry,
          song: {
            title: song?.title ?? "Unknown Song",
            artist: artist?.name ?? "Unknown Artist",
            album: album?.title ?? "Unknown Album",
            coverImageUrl: album?.coverImageUrl,
            previewUrl: song?.previewUrl,
            durationMs: song?.durationMs,
          },
        };
      }),
    );
    return hydratedHistory;
  },
});

export const getFriendFeed = query({
  args: {
    userId: v.id("users"), // The logged-in user
    limit: v.optional(v.number()), // Number of history entries to return
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity!.subject))
      .unique();

    if (!identity || !currentUser || currentUser._id !== args.userId) {
      throw new Error("Not authorized to view this feed.");
    }

    // 1. Get all friends that the current user is following
    const followingRelations = await ctx.db
      .query("friendships")
      .withIndex("by_follower", (q) => q.eq("followerId", args.userId))
      .collect();

    const friendIds = followingRelations.map((f) => f.followingId);

    if (friendIds.length === 0) {
      return []; // No friends, no feed
    }

    // 2. Fetch listening history for each friend
    // We'll collect all promises and run them in parallel
    const friendHistoryPromises = friendIds.map(async (friendId) => {
      // Fetch a reasonable number of recent listens per friend,
      // e.g., 20, to ensure we have enough to sort globally later.
      // Adjust this number based on how many "total" listens you want
      // and how active your users are.
      return await ctx.db
        .query("userListeningHistory")
        .withIndex("by_user_listenedAt", (q) => q.eq("userId", friendId))
        .order("desc") // Most recent first
        .take(20); // Take a few recent listens per friend
    });

    const historiesByFriend = await Promise.all(friendHistoryPromises);

    // Flatten the array of arrays into a single array of all friend listens
    const allFriendListens = historiesByFriend.flat();

    if (allFriendListens.length === 0) {
      return []; // Friends, but no listening history found
    }

    // 3. Sort all friend listens by listenedAt (most recent first)
    // and apply the overall limit
    const sortedAndLimitedListens = allFriendListens
      .sort((a, b) => b.listenedAt - a.listenedAt)
      .slice(0, args.limit ?? 50); // Default limit to 50 if not provided

    // If you need unique songs per user in the feed (e.g., only show the *most* recent song per user)
    // you would add a step here to filter unique user listens.
    // For a general "feed", showing multiple listens from the same user is fine.

    // 4. Pre-fetch all necessary song, artist, album, and user details in batches
    // This reduces the number of individual ctx.db.get calls.

    const songIdsToFetch = new Set<Doc<"songs">["_id"]>();
    const artistIdsToFetch = new Set<Doc<"artists">["_id"]>();
    const albumIdsToFetch = new Set<Doc<"albums">["_id"]>();
    const userIdsToFetch = new Set<Doc<"users">["_id"]>();

    sortedAndLimitedListens.forEach((listen) => {
      songIdsToFetch.add(listen.songId);
      userIdsToFetch.add(listen.userId); // Add the listener's ID
    });

    // Fetch songs
    const songs = await Promise.all(
      Array.from(songIdsToFetch).map((id) => ctx.db.get(id)),
    );
    const songMap = new Map<Doc<"songs">["_id"], Doc<"songs"> | null>(
      songs.map((s) => [s!._id, s]),
    );

    // From fetched songs, collect artist and album IDs
    songs.forEach((song) => {
      if (song?.artistId) artistIdsToFetch.add(song.artistId);
      if (song?.albumId) albumIdsToFetch.add(song.albumId);
    });

    // Fetch artists
    const artists = await Promise.all(
      Array.from(artistIdsToFetch).map((id) => ctx.db.get(id)),
    );
    const artistMap = new Map<Doc<"artists">["_id"], Doc<"artists"> | null>(
      artists.map((a) => [a!._id, a]),
    );

    // Fetch albums
    const albums = await Promise.all(
      Array.from(albumIdsToFetch).map((id) => ctx.db.get(id)),
    );
    const albumMap = new Map<Doc<"albums">["_id"], Doc<"albums"> | null>(
      albums.map((a) => [a!._id, a]),
    );

    // Fetch listening users (friends) details
    const listeningUsers = await Promise.all(
      Array.from(userIdsToFetch).map((id) => ctx.db.get(id)),
    );
    const listeningUserMap = new Map<Doc<"users">["_id"], Doc<"users"> | null>(
      listeningUsers.map((u) => [u!._id, u]),
    );

    // 5. Hydrate the feed with complete song, artist, album, and user data
    const hydratedFeed = sortedAndLimitedListens.map((listen) => {
      const song = songMap.get(listen.songId);
      const artist = song?.artistId
        ? artistMap.get(song.artistId)
        : null;
      const album = song?.albumId
        ? albumMap.get(song.albumId)
        : null;
      const listeningUser = listeningUserMap.get(listen.userId);

      return {
        _id: listen._id, // This is the ID of the specific listening history entry
        listenedAt: listen.listenedAt,
        song: {
          title: song?.title ?? "Unknown Song",
          artist: artist?.name ?? "Unknown Artist",
          album: album?.title ?? "Unknown Album",
          coverImageUrl: album?.coverImageUrl,
          previewUrl: song?.previewUrl,
          durationMs: song?.durationMs,
        },
        listeningUser: {
          _id: listeningUser?._id, // Include user ID if needed for client-side links
          username: listeningUser?.username ?? "Unknown User",
          displayName: listeningUser?.displayName ?? null,
          profilePictureUrl: listeningUser?.profilePictureUrl ?? null,
        },
      };
    });

    return hydratedFeed;
  },
});

// --- User Listening Mutations ---

// This mutation could be used for external webhooks or other background processes.
// It assumes song metadata is already handled or will be fetched asynchronously.
export const addListeningEntry = mutation({
  args: {
    userId: v.id("users"),
    songId: v.id("songs"), // Directly pass song ID if known
    platform: v.union(v.literal("appleMusic"), v.literal("spotify")),
    listenedAt: v.number(),
    durationListenedMs: v.optional(v.number()),
    context: v.optional(v.any()),
    device: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity!.subject))
      .unique();
    if (!identity || !currentUser || currentUser._id !== args.userId) {
      throw new Error("Not authorized to add listening history for this user.");
    }

    const entryId = await ctx.db.insert("userListeningHistory", {
      userId: args.userId,
      songId: args.songId,
      platform: args.platform,
      listenedAt: args.listenedAt,
      durationListenedMs: args.durationListenedMs,
      context: args.context,
      device: args.device,
    });

    // Optionally update user's current song here too
    await ctx.db.patch(args.userId, {
      currentSongId: args.songId,
      recentListen: args.listenedAt,
    });

    return entryId;
  },
});

export const logCurrentPlaying = internalMutation({
  args: {
    userId: v.id("users"),
    spotifyTrackId: v.string(),
    platform: v.union(v.literal("spotify"), v.literal("appleMusic")),
    progress_ms: v.optional(v.number()),
    duration_ms: v.optional(v.number()),
    isPlaying: v.boolean(), // Crucial: tell us if it's playing or paused
  },
  handler: async (ctx, args) => {
    let song = await ctx.db
      .query("songs")
      .withIndex("by_spotifyId", (q) => q.eq("spotifyId", args.spotifyTrackId))
      .unique();

    if (!song) {
      await ctx.scheduler.runAfter(
        0,
        internal.queries.api_integrations.fetchAndStoreMusicMetadata, // Corrected path
        {
          type: "track",
          spotifyId: args.spotifyTrackId,
        },
      );
      // Give a tiny moment, but ideally, this action runs quick enough.
      // Or, this `logCurrentPlaying` could return early and rely on the next poll.
      // For now, re-query after scheduling.
      song = await ctx.db
        .query("songs")
        .withIndex("by_spotifyId", (q) => q.eq("spotifyId", args.spotifyTrackId))
        .unique();
    }

    if (!song) {
      console.error(
        `Failed to get or create song metadata for track ID ${args.spotifyTrackId}. Skipping history log.`,
      );
      return;
    }

    const userDoc = await ctx.db.get(args.userId);
    if (userDoc) {
      await ctx.db.patch(userDoc._id, {
        currentSongId: args.isPlaying ? song._id : undefined, // Only set if playing
        recentListen: Date.now(), // Always update last activity
      });
    }

    const lastEntry = await ctx.db
      .query("userListeningHistory")
      .withIndex("by_user_listenedAt", (q) => q.eq("userId", args.userId))
      .order("desc")
      .first();

    // Log a new entry if:
    // 1. There's no previous entry.
    // 2. The new song is different from the last logged song.
    // 3. The same song is playing, but it's been more than 10 minutes since the last log.
    // 4. The playback state changed (e.g., paused to playing the same song) - optional, for more granular history
    if (
      !lastEntry ||
      lastEntry.songId !== song._id ||
      (lastEntry.songId === song._id &&
        Date.now() - lastEntry.listenedAt > 10 * 60 * 1000)
      // Add more conditions if you want to log pauses/resumes as separate events
    ) {
      await ctx.db.insert("userListeningHistory", {
        userId: args.userId,
        songId: song._id,
        platform: args.platform,
        listenedAt: Date.now(),
        durationListenedMs: args.duration_ms,
      });
    }
  },
});

export const clearCurrentPlaying = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const userDoc = await ctx.db.get(args.userId);
    if (userDoc) {
      await ctx.db.patch(userDoc._id, {
        currentSongId: undefined, // Clear the current song
      });
    }
  },
});

// --- Internal Metadata Store/Update Functions (consolidated from original paste) ---
// These are internal helper mutations to upsert artist, album, and song data.

export const storeArtist = internalMutation({
  args: {
    spotifyId: v.string(),
    name: v.string(),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("artists")
      .withIndex("by_spotifyId", (q) => q.eq("spotifyId", args.spotifyId))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { name: args.name, imageUrl: args.imageUrl });
      return existing._id;
    } else {
      return await ctx.db.insert("artists", args);
    }
  },
});

export const storeAlbum = internalMutation({
  args: {
    spotifyId: v.string(),
    title: v.string(),
    artistId: v.optional(v.id("artists")),
    releaseDate: v.optional(v.string()),
    coverImageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("albums")
      .withIndex("by_spotifyId", (q) => q.eq("spotifyId", args.spotifyId))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        title: args.title,
        artistId: args.artistId,
        releaseDate: args.releaseDate,
        coverImageUrl: args.coverImageUrl,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("albums", args);
    }
  },
});

export const storeSong = internalMutation({
  args: {
    spotifyId: v.string(),
    title: v.string(),
    artistId: v.optional(v.id("artists")),
    albumId: v.optional(v.id("albums")),
    durationMs: v.optional(v.number()),
    previewUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("songs")
      .withIndex("by_spotifyId", (q) => q.eq("spotifyId", args.spotifyId))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        title: args.title,
        artistId: args.artistId,
        albumId: args.albumId,
        durationMs: args.durationMs,
        previewUrl: args.previewUrl,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("songs", args);
    }
  },
});

// Internal queries for metadata lookup (useful for api_integrations action)
export const _getArtistBySpotifyId = internalQuery({
  args: { spotifyId: v.string() },
  handler: async (ctx, args) =>
    ctx.db.query("artists").withIndex("by_spotifyId", (q) => q.eq("spotifyId", args.spotifyId)).unique(),
});
export const _getAlbumBySpotifyId = internalQuery({
  args: { spotifyId: v.string() },
  handler: async (ctx, args) =>
    ctx.db.query("albums").withIndex("by_spotifyId", (q) => q.eq("spotifyId", args.spotifyId)).unique(),
});
export const _getSongBySpotifyId = internalQuery({
  args: { spotifyId: v.string() },
  handler: async (ctx, args) =>
    ctx.db.query("songs").withIndex("by_spotifyId", (q) => q.eq("spotifyId", args.spotifyId)).unique(),
});