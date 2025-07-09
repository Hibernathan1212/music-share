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
import type { Id } from "../_generated/dataModel";

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
    limit: v.optional(v.number()),
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

    const followingRelations = await ctx.db
      .query("friendships")
      .withIndex("by_follower", (q) => q.eq("followerId", args.userId))
      .collect();

    const friendIds = followingRelations.map((f) => f.followingId);

    if (friendIds.length === 0) {
      return [];
    }

    const friendStatuses = await ctx.db
      .query("users")
      .filter((q) =>
        q.and(
          q.or(...friendIds.map((id) => q.eq(q.field("_id"), id))),
          q.neq(q.field("currentSongId"), undefined), // Ensure they have a current song
          q.neq(q.field("recentListen"), undefined), // Ensure they have a recent listen timestamp
        ),
      )
      .collect();

    const sortedFriendStatuses = friendStatuses
      .sort((a, b) => (b.recentListen || 0) - (a.recentListen || 0)) // Sort by most recent listen (descending)
      .slice(0, args.limit || 50);

    const hydratedFeed = await Promise.all(
      sortedFriendStatuses.map(async (userDoc) => {
        const song = userDoc.currentSongId
          ? await ctx.db.get(userDoc.currentSongId)
          : null;
        let artist = null;
        if (song?.artistId) {
          artist = await ctx.db.get(song.artistId);
        }
        let album = null;
        if (song?.albumId) {
          album = await ctx.db.get(song.albumId);
        }

        return {
          _id: userDoc._id, // User's ID is the primary key for feed entry
          listenedAt: userDoc.recentListen!,
          song: {
            title: song?.title ?? "Unknown Song",
            artist: artist?.name ?? "Unknown Artist",
            album: album?.title ?? "Unknown Album",
            coverImageUrl: album?.coverImageUrl,
            previewUrl: song?.previewUrl,
            durationMs: song?.durationMs,
          },
          listeningUser: {
            // Full user details for display in feed
            username: userDoc.username,
            displayName: userDoc.displayName || null, // Ensure explicit null
            profilePictureUrl: userDoc.profilePictureUrl || null, // Ensure explicit null
          },
        };
      }),
    );
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
    // 3. The same song is playing, but it's been more than 60 seconds (1 minute) since the last log.
    // 4. The playback state changed (e.g., paused to playing the same song) - optional, for more granular history
    if (
      !lastEntry ||
      lastEntry.songId !== song._id ||
      (lastEntry.songId === song._id &&
        Date.now() - lastEntry.listenedAt > 60 * 1000)
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