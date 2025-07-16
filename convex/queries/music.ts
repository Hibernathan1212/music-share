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

export const getUserRecentlyListened = query({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {

    const history = await ctx.db
      .query("userListeningHistory")
      .withIndex("by_user_listenedAt", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(args.limit || 10); 

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
    userId: v.id("users"), 
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

    const friendHistoryPromises = friendIds.map(async (friendId) => {
      return await ctx.db
        .query("userListeningHistory")
        .withIndex("by_user_listenedAt", (q) => q.eq("userId", friendId))
        .order("desc") 
        .take(20); 
    });

    const historiesByFriend = await Promise.all(friendHistoryPromises);

    const allFriendListens = historiesByFriend.flat();

    if (allFriendListens.length === 0) {
      return []; 
    }

    const sortedAndLimitedListens = allFriendListens
      .sort((a, b) => b.listenedAt - a.listenedAt)
      .slice(0, args.limit ?? 50); 

    const songIdsToFetch = new Set<Doc<"songs">["_id"]>();
    const artistIdsToFetch = new Set<Doc<"artists">["_id"]>();
    const albumIdsToFetch = new Set<Doc<"albums">["_id"]>();
    const userIdsToFetch = new Set<Doc<"users">["_id"]>();

    sortedAndLimitedListens.forEach((listen) => {
      songIdsToFetch.add(listen.songId);
      userIdsToFetch.add(listen.userId); 
    });

    const songs = await Promise.all(
      Array.from(songIdsToFetch).map((id) => ctx.db.get(id)),
    );
    const songMap = new Map<Doc<"songs">["_id"], Doc<"songs"> | null>(
      songs.map((s) => [s!._id, s]),
    );

    songs.forEach((song) => {
      if (song?.artistId) artistIdsToFetch.add(song.artistId);
      if (song?.albumId) albumIdsToFetch.add(song.albumId);
    });

    const artists = await Promise.all(
      Array.from(artistIdsToFetch).map((id) => ctx.db.get(id)),
    );
    const artistMap = new Map<Doc<"artists">["_id"], Doc<"artists"> | null>(
      artists.map((a) => [a!._id, a]),
    );

    const albums = await Promise.all(
      Array.from(albumIdsToFetch).map((id) => ctx.db.get(id)),
    );
    const albumMap = new Map<Doc<"albums">["_id"], Doc<"albums"> | null>(
      albums.map((a) => [a!._id, a]),
    );

    const listeningUsers = await Promise.all(
      Array.from(userIdsToFetch).map((id) => ctx.db.get(id)),
    );
    const listeningUserMap = new Map<Doc<"users">["_id"], Doc<"users"> | null>(
      listeningUsers.map((u) => [u!._id, u]),
    );

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
        _id: listen._id, 
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
          _id: listeningUser?._id, 
          username: listeningUser?.username ?? "Unknown User",
          displayName: listeningUser?.displayName ?? null,
          profilePictureUrl: listeningUser?.profilePictureUrl ?? null,
        },
      };
    });

    return hydratedFeed;
  },
});


export const addListeningEntry = mutation({
  args: {
    userId: v.id("users"),
    songId: v.id("songs"), 
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
    isPlaying: v.boolean(),
  },
  handler: async (ctx, args) => {
    let song = await ctx.db
      .query("songs")
      .withIndex("by_spotifyId", (q) => q.eq("spotifyId", args.spotifyTrackId))
      .unique();

    if (!song) {
      await ctx.scheduler.runAfter(
        0,
        internal.queries.api_integrations.fetchAndStoreMusicMetadata,
        {
          type: "track",
          spotifyId: args.spotifyTrackId,
        },
      );

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
        currentSongId: args.isPlaying ? song._id : undefined, 
        recentListen: Date.now(),
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
    // 4. (future feature) The playback state changed (e.g., paused to playing the same song) - optional, for more granular history
    if (
      !lastEntry ||
      lastEntry.songId !== song._id ||
      (lastEntry.songId === song._id &&
        Date.now() - lastEntry.listenedAt > 10 * 60 * 1000)
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
        currentSongId: undefined, 
      });
    }
  },
});

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


export const getListenersBySong = query({
  args: {
    songId: v.id("songs"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Optionally, add auth check if only logged-in users can see this
    // const identity = await ctx.auth.getUserIdentity();
    // if (!identity) {
    //   throw new Error("Not authenticated");
    // }

    const listeningHistory = await ctx.db
      .query("userListeningHistory")
      .withIndex("by_song", (q) => q.eq("songId", args.songId))
      .order("desc") // Order by most recent listen for this song
      .take(args.limit || 100); // Limit results for performance

    const userIdsToFetch = new Set<Id<"users">>();
    listeningHistory.forEach((entry) => userIdsToFetch.add(entry.userId));

    if (userIdsToFetch.size === 0) {
      return [];
    }

    const users = await Promise.all(
      Array.from(userIdsToFetch).map((id) => ctx.db.get(id)),
    );
    const userMap = new Map<Id<"users">, Doc<"users"> | null>(
      users.map((u) => [u!._id, u]),
    );

    const hydratedListeners = listeningHistory
      .map((entry) => {
        const user = userMap.get(entry.userId);
        if (!user) {
          return null; // Should not happen if data integrity is good
        }
        return {
          user: {
            _id: user._id,
            username: user.username,
            displayName: user.displayName,
            profilePictureUrl: user.profilePictureUrl,
          },
          listenedAt: entry.listenedAt, // Include the listen timestamp
        };
      })
      .filter(Boolean); // Remove any null entries

    // Remove duplicates based on user ID and keep the most recent listen per user
    const uniqueListeners = new Map<Id<"users">, typeof hydratedListeners[0]>();
    hydratedListeners.forEach((item) => {
      if (
        item &&
        (!uniqueListeners.has(item.user._id) ||
          item.listenedAt > uniqueListeners.get(item.user._id)!.listenedAt)
      ) {
        uniqueListeners.set(item.user._id, item);
      }
    });

    if (Array.from(uniqueListeners.values()).length < 2) {
      return Array.from(uniqueListeners.values());
    } else {
      return Array.from(uniqueListeners.values()).sort(
        (a, b) => b!.listenedAt  - a!.listenedAt,
      );
    }
  },
});

export const getListenersByArtist = query({
  args: {
    artistId: v.id("artists"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Find all songs by this artist
    const songsByArtist = await ctx.db
      .query("songs")
      .withIndex("by_artist", (q) => q.eq("artistId", args.artistId))
      .collect();

    if (songsByArtist.length === 0) {
      return [];
    }

    const songIds = songsByArtist.map((song) => song._id);

    // Get listening history for all these songs
    // This part can be inefficient if an artist has thousands of songs.
    // For very large datasets, consider a denormalized `artistListeningHistory` table
    // or a more advanced search index on `userListeningHistory` that includes `artistId`.
    const allListens: Doc<"userListeningHistory">[] = [];
    for (const songId of songIds) {
      const listens = await ctx.db
        .query("userListeningHistory")
        .withIndex("by_song", (q) => q.eq("songId", songId))
        .collect();
      allListens.push(...listens);
    }

    const userIdsToFetch = new Set<Id<"users">>();
    allListens.forEach((entry) => userIdsToFetch.add(entry.userId));

    if (userIdsToFetch.size === 0) {
      return [];
    }

    const users = await Promise.all(
      Array.from(userIdsToFetch).map((id) => ctx.db.get(id)),
    );
    const userMap = new Map<Id<"users">, Doc<"users"> | null>(
      users.map((u) => [u!._id, u]),
    );

    const hydratedListeners = allListens
      .map((entry) => {
        const user = userMap.get(entry.userId);
        if (!user) {
          return null;
        }
        return {
          user: {
            _id: user._id,
            username: user.username,
            displayName: user.displayName,
            profilePictureUrl: user.profilePictureUrl,
          },
          listenedAt: entry.listenedAt,
        };
      })
      .filter(Boolean);

    // Remove duplicates based on user ID and keep the most recent listen per user
    const uniqueListeners = new Map<Id<"users">, typeof hydratedListeners[0]>();
    hydratedListeners.forEach((item) => {
      if (
        item &&
        (!uniqueListeners.has(item.user._id) ||
          item.listenedAt > uniqueListeners.get(item.user._id)!.listenedAt)
      ) {
        uniqueListeners.set(item.user._id, item);
      }
    });

    if (Array.from(uniqueListeners.values()).length < 2) {
      return Array.from(uniqueListeners.values());
    } else {
      return Array.from(uniqueListeners.values()).sort(
        (a, b) => b!.listenedAt  - a!.listenedAt,
      );
    }
  },
});

export const getListenersByAlbum = query({
  args: {
    albumId: v.id("albums"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Find all songs in this album
    const songsInAlbum = await ctx.db
      .query("songs")
      .withIndex("by_album", (q) => q.eq("albumId", args.albumId))
      .collect();

    if (songsInAlbum.length === 0) {
      return [];
    }

    const songIds = songsInAlbum.map((song) => song._id);

    const allListens: Doc<"userListeningHistory">[] = [];
    for (const songId of songIds) {
      const listens = await ctx.db
        .query("userListeningHistory")
        .withIndex("by_song", (q) => q.eq("songId", songId))
        .collect();
      allListens.push(...listens);
    }

    const userIdsToFetch = new Set<Id<"users">>();
    allListens.forEach((entry) => userIdsToFetch.add(entry.userId));

    if (userIdsToFetch.size === 0) {
      return [];
    }

    const users = await Promise.all(
      Array.from(userIdsToFetch).map((id) => ctx.db.get(id)),
    );
    const userMap = new Map<Id<"users">, Doc<"users"> | null>(
      users.map((u) => [u!._id, u]),
    );

    const hydratedListeners = allListens
      .map((entry) => {
        const user = userMap.get(entry.userId);
        if (!user) {
          return null;
        }
        return {
          user: {
            _id: user._id,
            username: user.username,
            displayName: user.displayName,
            profilePictureUrl: user.profilePictureUrl,
          },
          listenedAt: entry.listenedAt,
        };
      })
      .filter(Boolean);

    // Remove duplicates based on user ID and keep the most recent listen per user
    const uniqueListeners = new Map<Id<"users">, typeof hydratedListeners[0]>();
    hydratedListeners.forEach((item) => {
      if (
        item &&
        (!uniqueListeners.has(item.user._id) ||
          item.listenedAt > uniqueListeners.get(item.user._id)!.listenedAt)
      ) {
        uniqueListeners.set(item.user._id, item);
      }
    });

    if (Array.from(uniqueListeners.values()).length < 2) {
      return Array.from(uniqueListeners.values());
    } else {
      return Array.from(uniqueListeners.values()).sort(
        (a, b) => b!.listenedAt  - a!.listenedAt,
      );
    }
  },
});

export const getSongById = query({
  args: { songId: v.id("songs") },
  handler: async (ctx, args) => {
    return ctx.db.get(args.songId);
  },
});

export const getArtistById = query({
  args: { artistId: v.id("artists") },
  handler: async (ctx, args) => {
    return ctx.db.get(args.artistId);
  },
});

export const getAlbumById = query({
  args: { albumId: v.id("albums") },
  handler: async (ctx, args) => {
    return ctx.db.get(args.albumId);
  },
});

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