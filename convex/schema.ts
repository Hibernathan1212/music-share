// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // --- User Data ---
  users: defineTable({
    clerkId: v.string(), // Clerk's unique user ID (immutable) (identity.tokenIdentifier)
    username: v.string(), // Unique, user-chosen handle
    email: v.optional(v.string()), // User's email
    displayName: v.optional(v.string()), // Display name (can be non-unique)
    profilePictureUrl: v.optional(v.string()), // URL to avatar
    bio: v.optional(v.string()), // Short user bio
    spotifyUserId: v.optional(v.string()), // Spotify's user ID for this user (from their external profile)
    appleMusicUserId: v.optional(v.string()), // Apple Music's user ID for this user

    // Denormalized fields for quick access to current listening status
    recentListen: v.optional(v.number()), // Unix timestamp of last song update
    currentSongId: v.optional(v.id("songs")), // Foreign key to the currently playing song
  })
    .index("by_clerkId", ["clerkId"]) // Crucial for auth sync and user lookup
    .index("by_username", ["username"]), // For unique username enforcement and lookup

  friendships: defineTable({
    followerId: v.id("users"), // person following (the one who initiated the follow)
    followingId: v.id("users"), // person followed (the one being followed)
  })
    .index("by_follower", ["followerId"]) // Efficiently find who a user follows
    .index("by_following", ["followingId"]) // Efficiently find a user's followers
    .index("by_follower_following", ["followerId", "followingId"]), // Ensure unique relationship

  // --- Music Metadata (Cached from APIs) ---
  // Store these to avoid repeated API calls and for faster queries

  artists: defineTable({
    spotifyId: v.optional(v.string()),
    appleMusicId: v.optional(v.string()),
    name: v.string(),
    imageUrl: v.optional(v.string()),
  })
    .index("by_spotifyId", ["spotifyId"])
    .index("by_appleMusicId", ["appleMusicId"])
    .searchIndex("search_name", { searchField: "name" }),

  albums: defineTable({
    spotifyId: v.optional(v.string()),
    appleMusicId: v.optional(v.string()),
    title: v.string(),
    artistId: v.optional(v.id("artists")), // FIX: Make artistId optional in schema
    releaseDate: v.optional(v.string()),
    coverImageUrl: v.optional(v.string()),
  })
    .index("by_spotifyId", ["spotifyId"])
    .index("by_appleMusicId", ["appleMusicId"])
    .index("by_artist", ["artistId"]),

  songs: defineTable({
    spotifyId: v.optional(v.string()),
    appleMusicId: v.optional(v.string()),
    title: v.string(),
    artistId: v.optional(v.id("artists")), // FIX: Make artistId optional in schema
    albumId: v.optional(v.id("albums")),
    durationMs: v.optional(v.number()),
    previewUrl: v.optional(v.string()),
  })
    .index("by_spotifyId", ["spotifyId"])
    .index("by_appleMusicId", ["appleMusicId"])
    .index("by_artist", ["artistId"])
    .index("by_album", ["albumId"])
    .searchIndex("search_title", { searchField: "title" }),

  // --- User Activity & Integration ---

  userListeningHistory: defineTable({
    userId: v.id("users"), // User who listened
    songId: v.id("songs"), // Song that was listened to
    platform: v.union(v.literal("spotify"), v.literal("appleMusic")), // Source of the listen (consistent casing)
    listenedAt: v.number(), // Unix timestamp (milliseconds) of when they listened
    durationListenedMs: v.optional(v.number()), // How long they listened
    context: v.optional(v.any()), // Raw JSON from API about the listening context (e.g., playlist, album)
    device: v.optional(v.string()), // e.g., "iPhone", "Desktop"
  })
    .index("by_user", ["userId"]) // Get a user's full listening history
    .index("by_song", ["songId"]) // Find who listened to a particular song
    .index("by_user_listenedAt", ["userId", "listenedAt"]), // Efficiently query and sort a user's history

  userPlatformAccounts: defineTable({
    userId: v.id("users"), // The Convex user ID
    platform: v.union(v.literal("spotify"), v.literal("apple_music")), // Consistent casing
    platformUserId: v.string(), // The user's ID on Spotify/Apple Music (e.g., Spotify ID for the user)
    accessToken: v.string(), // **Crucial: Store Encrypted!**
    refreshToken: v.string(), // **Crucial: Store Encrypted!**
    expiresAt: v.number(), // Unix timestamp of token expiry
    scope: v.string(), // Permissions granted by the user
  })
    .index("by_userId_platform", ["userId", "platform"]), // Ensure a user only has one account per platform
  // Consider an index by platformUserId if you ever need to lookup by external ID
});