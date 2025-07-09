// convex/queries/api_integrations.ts
import { env } from "../../src/env";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  query,
} from "../_generated/server";
import { v } from "convex/values";
import axios from "axios";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { Query } from "convex/server"; // Import Query for typing `q`

const ENCRYPTION_KEY = env.ENCRYPTION_KEY;

async function encrypt(text: string): Promise<string> {
  if (!ENCRYPTION_KEY) {
    throw new Error("ENCRYPTION_KEY is not configured");
  }
  
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32)),
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );
  
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    data
  );
  
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  const binaryString = String.fromCharCode(...combined);
  return btoa(binaryString);
}

async function decrypt(encryptedText: string): Promise<string> {
  if (!ENCRYPTION_KEY) {
    throw new Error("ENCRYPTION_KEY is not configured");
  }
  
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  
  const binaryString = atob(encryptedText);
  const combined = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    combined[i] = binaryString.charCodeAt(i);
  }
  
  const iv = combined.slice(0, 12);
  const encrypted = combined.slice(12);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32)),
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );
  
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    encrypted
  );
  
  return decoder.decode(decrypted);
}

const SPOTIFY_API_BASE_URL = "https://api.spotify.com/v1";

export const handleSpotifyCallback = action({
  args: {
    clerkUserId: v.string(),
    code: v.string(),
    redirectUri: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      // Create the request body as a properly formatted URLSearchParams
      const params = new URLSearchParams();
      params.append('grant_type', 'authorization_code');
      params.append('code', args.code);
      params.append('redirect_uri', args.redirectUri);
      params.append('client_id', env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID);
      params.append('client_secret', env.SPOTIFY_CLIENT_SECRET);

      const tokenResponse = await axios.post(
        "https://accounts.spotify.com/api/token",
        params.toString(), // Convert to string explicitly
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        },
      );

      const { access_token, refresh_token, expires_in } = tokenResponse.data;

      // FIX: Look up user by Clerk ID instead of using getMe
      const convexUser = await ctx.runQuery(api.queries.users.getUserByClerkId, {
        clerkId: args.clerkUserId,
      });
      
      if (!convexUser) {
        throw new Error(`Convex user not found for Clerk ID: ${args.clerkUserId}`);
      }

      const encryptedAccessToken = await encrypt(access_token);
      const encryptedRefreshToken = await encrypt(refresh_token);

      await ctx.runMutation(
        internal.queries.api_integrations.storePlatformTokens,
        {
          userId: convexUser._id,
          platform: "spotify",
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken,
          expiresAt: Date.now() + expires_in * 1000,
          scope: tokenResponse.data.scope,
          platformUserId: "",
        },
      );

      console.log("Spotify tokens stored successfully for user:", convexUser._id);
    } catch (error) {
      console.error("Error exchanging Spotify code for tokens:", error);
      throw new Error(
        `Failed to connect Spotify account: ${(error as Error).message}`,
      );
    }
  },
});

export const storePlatformTokens = internalMutation({
  args: {
    userId: v.id("users"),
    platform: v.union(v.literal("spotify"), v.literal("apple_music")),
    accessToken: v.string(),
    refreshToken: v.string(),
    expiresAt: v.number(),
    scope: v.string(),
    platformUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("userPlatformAccounts")
      .withIndex("by_userId_platform", (q) =>
        q.eq("userId", args.userId).eq("platform", args.platform),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        accessToken: args.accessToken,
        refreshToken: args.refreshToken,
        expiresAt: args.expiresAt,
        scope: args.scope,
        platformUserId: args.platformUserId || existing.platformUserId,
      });
      return existing._id;
    } else {
      const newAccountId = await ctx.db.insert("userPlatformAccounts", args);
      return newAccountId;
    }
  },
});

export const getPlatformAccount = query({
  args: {
    userId: v.id("users"),
    platform: v.union(v.literal("spotify"), v.literal("apple_music")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity!.subject))
      .unique();

    if (!identity || !currentUser || String(currentUser._id) !== String(args.userId)) {
      throw new Error("Not authorized.");
    }

    const account = await ctx.db
      .query("userPlatformAccounts")
      .withIndex("by_userId_platform", (q) =>
        q.eq("userId", args.userId).eq("platform", args.platform),
      )
      .unique();

    if (!account) return null;

    return {
      _id: account._id,
      userId: account.userId,
      platform: account.platform,
      platformUserId: account.platformUserId,
      expiresAt: account.expiresAt,
      scope: account.scope,
    };
  },
});

export const refreshAccessToken = internalAction({
  args: {
    platformAccountId: v.id("userPlatformAccounts"),
  },
  handler: async (ctx, args) => {
    const account = await ctx.runQuery(
      internal.queries.api_integrations._getPlatformAccountInternal,
      {
        platformAccountId: args.platformAccountId,
      },
    );

    if (!account || !account.refreshToken) {
      throw new Error("Account or refresh token not found.");
    }

    const decryptedRefreshToken = await decrypt(account.refreshToken);
    let tokenResponse;

    if (account.platform === "spotify") {
      const params = new URLSearchParams();
      params.append('grant_type', 'refresh_token');
      params.append('refresh_token', decryptedRefreshToken);
      params.append('client_id', env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID);
      params.append('client_secret', env.SPOTIFY_CLIENT_SECRET);

      tokenResponse = await axios.post(
        "https://accounts.spotify.com/api/token",
        params.toString(),
        {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        },
      );
    } else {
      throw new Error("Unsupported platform for token refresh.");
    }

    const {
      access_token,
      expires_in,
      refresh_token: new_refresh_token,
    } = tokenResponse.data;

    const encryptedAccessToken = await encrypt(access_token);
    const encryptedNewRefreshToken = new_refresh_token
      ? await encrypt(new_refresh_token)
      : account.refreshToken;

    await ctx.runMutation(
      internal.queries.api_integrations.storePlatformTokens,
      {
        userId: account.userId,
        platform: account.platform,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedNewRefreshToken,
        expiresAt: Date.now() + expires_in * 1000,
        scope: account.scope,
        platformUserId: account.platformUserId,
      },
    );

    return access_token;
  },
});

export const _getPlatformAccountInternal = internalQuery({
  args: {
    platformAccountId: v.optional(v.id("userPlatformAccounts")),
    userId: v.optional(v.id("users")),
    platform: v.optional(
      v.union(v.literal("spotify"), v.literal("apple_music")),
    ),
  },
  handler: async (ctx, args) => {
    if (args.platformAccountId) {
      return await ctx.db.get(args.platformAccountId);
    } else if (args.userId && args.platform) {
      return await ctx.db
        .query("userPlatformAccounts")
        .withIndex("by_userId_platform", (q) =>
          q.eq("userId", args.userId!).eq("platform", args.platform!),
        )
        .unique();
    }
    return null;
  },
});

export const pollAllCurrentlyPlaying = internalAction({
  args: {},
  handler: async (ctx) => {
    // FIX: Changed api.queries.users.getAllUsers to query for users with spotifyUserId
    const users = await ctx.runQuery(
      api.queries.users.getAllUsers,
    ); // Assuming you'll add this query
    for (const user of users) {
      if (user.spotifyUserId) {
        await ctx.runAction(
          internal.queries.api_integrations.pollCurrentlyPlayingForUser,
          { userId: user._id },
        );
      }
    }
  },
});

// THIS IS THE PUBLIC ACTION THE CLIENT WILL CALL
export const fetchSpotifyCurrentlyPlaying = action({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    // FIX: Fetch by Convex ID, not Clerk ID.
    const currentUser = await ctx.runQuery(api.queries.users.getMe);
    if (!identity || !currentUser || String(currentUser._id) !== String(args.userId)) {
      throw new Error("Not authorized to fetch this user's playing status.");
    }

    const platformAccount = await ctx.runQuery(
      internal.queries.api_integrations._getPlatformAccountInternal,
      {
        userId: args.userId,
        platform: "spotify",
      },
    );

    if (!platformAccount) {
      await ctx.runMutation(internal.queries.music.clearCurrentPlaying, {
        userId: args.userId,
      });
      return null;
    }

    let decryptedAccessToken = await decrypt(platformAccount.accessToken);

    if (platformAccount.expiresAt < Date.now() + 5 * 60 * 1000) {
      try {
        decryptedAccessToken = await ctx.runAction(
          internal.queries.api_integrations.refreshAccessToken,
          {
            platformAccountId: platformAccount._id,
          },
        );
      } catch (e) {
        console.error(
          `Failed to refresh token for user ${currentUser.clerkId}:`,
          e,
        );
        await ctx.runMutation(internal.queries.music.clearCurrentPlaying, {
          userId: args.userId,
        });
        return null;
      }
    }

    try {
      const response = await axios.get(
        `${SPOTIFY_API_BASE_URL}/me/player/currently-playing`,
        {
          headers: {
            Authorization: `Bearer ${decryptedAccessToken}`,
          },
        },
      );

      if (response.status === 204 || !response.data.item) {
        await ctx.runMutation(internal.queries.music.clearCurrentPlaying, {
          userId: args.userId,
        });
        return null;
      }

      const currentTrack = response.data.item;
      const isPlaying = response.data.is_playing;

      await ctx.runMutation(internal.queries.music.logCurrentPlaying, {
        userId: args.userId,
        spotifyTrackId: currentTrack.id,
        platform: "spotify",
        progress_ms: response.data.progress_ms,
        duration_ms: currentTrack.duration_ms,
        isPlaying: isPlaying, // Pass isPlaying flag
      });

      return {
        title: currentTrack.name,
        artistName: currentTrack.artists.map((a: any) => a.name).join(", "),
        albumCover: currentTrack.album.images?.[0]?.url,
        isPlaying: isPlaying,
        progress_ms: response.data.progress_ms,
        duration_ms: currentTrack.duration_ms,
      };
    } catch (error: any) {
      if (error.response?.status === 401) {
        console.error(
          `Spotify API Unauthorized for user ${currentUser.clerkId}. Token might be invalid.`,
        );
      } else {
        console.error(
          `Error fetching currently playing for user ${currentUser.clerkId}:`,
          error,
        );
      }
      await ctx.runMutation(internal.queries.music.clearCurrentPlaying, {
        userId: args.userId,
      });
      throw new Error(
        `Failed to get current playing status: ${(error as Error).message}`,
      );
    }
  },
});

export const pollCurrentlyPlayingForUser = internalAction({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    // Fix 1: Removed direct ctx.db.get here, call `getUserByConvexId` query instead (assuming you'll add this)
    const user = await ctx.runQuery(api.queries.users.getUserByConvexId, {
      userId: args.userId,
    });
    if (!user) return; // If user not found (e.g., deleted), stop here.

    const platformAccount = await ctx.runQuery(
      internal.queries.api_integrations._getPlatformAccountInternal,
      {
        userId: user._id,
        platform: "spotify",
      },
    );

    if (!platformAccount) {
      console.log(`No Spotify account linked for user ${user.clerkId}.`);
      await ctx.runMutation(internal.queries.music.clearCurrentPlaying, {
        userId: user._id,
      });
      return;
    }

    let decryptedAccessToken = await decrypt(platformAccount.accessToken);

    if (platformAccount.expiresAt < Date.now() + 5 * 60 * 1000) {
      try {
        decryptedAccessToken = await ctx.runAction(
          internal.queries.api_integrations.refreshAccessToken,
          {
            platformAccountId: platformAccount._id,
          },
        );
      } catch (e) {
        console.error(`Failed to refresh token for user ${user.clerkId}:`, e);
        return;
      }
    }

    try {
      const response = await axios.get(
        `${SPOTIFY_API_BASE_URL}/me/player/currently-playing`,
        {
          headers: {
            Authorization: `Bearer ${decryptedAccessToken}`,
          },
        },
      );

      if (response.status === 204 || !response.data.item) {
        await ctx.runMutation(internal.queries.music.clearCurrentPlaying, {
          userId: user._id,
        });
        return;
      }

      const currentTrack = response.data.item;
      const isPlaying = response.data.is_playing;

      if (isPlaying) {
        await ctx.runMutation(internal.queries.music.logCurrentPlaying, {
          userId: user._id,
          spotifyTrackId: currentTrack.id,
          platform: "spotify",
          progress_ms: response.data.progress_ms,
          duration_ms: currentTrack.duration_ms,
          isPlaying: isPlaying, // Pass isPlaying flag
        });
      } else {
        await ctx.runMutation(internal.queries.music.clearCurrentPlaying, {
          userId: user._id,
        });
      }
    } catch (error: any) {
      if (error.response?.status === 401) {
        console.error("Spotify API Unauthorized for user:", user.clerkId);
      } else {
        console.error(
          "Error fetching currently playing for user:",
          user.clerkId,
          error,
        );
      }
    }
  },
});

export const fetchAndStoreMusicMetadata = internalAction({
  args: {
    spotifyId: v.string(),
    type: v.union(v.literal("track"), v.literal("artist"), v.literal("album")),
  },
  handler: async (ctx, args) => {
    const spotifyAccessToken = await ctx.runAction(
      internal.queries.api_integrations._getAppSpotifyAccessToken,
    );

    if (!spotifyAccessToken) {
      throw new Error(
        "Cannot fetch music metadata: Spotify app access token missing.",
      );
    }

    let url: string;
    switch (args.type) {
      case "track":
        url = `${SPOTIFY_API_BASE_URL}/tracks/${args.spotifyId}`;
        break;
      case "artist":
        url = `${SPOTIFY_API_BASE_URL}/artists/${args.spotifyId}`;
        break;
      case "album":
        url = `${SPOTIFY_API_BASE_URL}/albums/${args.spotifyId}`;
        break;
      default:
        throw new Error("Invalid metadata type.");
    }

    try {
      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${spotifyAccessToken}`,
        },
      });

      const data = response.data;

      if (args.type === "artist") {
        await ctx.runMutation(internal.queries.music.storeArtist, {
          spotifyId: data.id,
          name: data.name,
          imageUrl: data.images?.[0]?.url || null,
        });
      } else if (args.type === "album") {
        const albumArtistSpotifyId = data.artists?.[0]?.id;
        let albumArtistId: Id<"artists"> | undefined;

        if (albumArtistSpotifyId) {
          await ctx.runAction(
            internal.queries.api_integrations.fetchAndStoreMusicMetadata,
            {
              spotifyId: albumArtistSpotifyId,
              type: "artist",
            },
          );
          // Fix 1: Use ctx.runQuery
          const artistDoc = await ctx.runQuery(
            internal.queries.music._getArtistBySpotifyId,
            { spotifyId: albumArtistSpotifyId },
          );
          if (artistDoc) {
            albumArtistId = artistDoc._id;
          }
        }

        await ctx.runMutation(internal.queries.music.storeAlbum, {
          spotifyId: data.id,
          title: data.name,
          artistId: albumArtistId, // Now correctly can be undefined
          releaseDate: data.release_date,
          coverImageUrl: data.images?.[0]?.url,
        });
      } else if (args.type === "track") {
        const primaryArtistSpotifyId = data.artists?.[0]?.id;
        let primaryArtistId: Id<"artists"> | undefined;

        if (primaryArtistSpotifyId) {
          await ctx.runAction(
            internal.queries.api_integrations.fetchAndStoreMusicMetadata,
            {
              spotifyId: primaryArtistSpotifyId,
              type: "artist",
            },
          );
          // Fix 1: Use ctx.runQuery
          const artistDoc = await ctx.runQuery(
            internal.queries.music._getArtistBySpotifyId,
            { spotifyId: primaryArtistSpotifyId },
          );
          if (artistDoc) {
            primaryArtistId = artistDoc._id;
          }
        }

        const songAlbumSpotifyId = data.album?.id;
        let albumId: Id<"albums"> | undefined = undefined;

        if (songAlbumSpotifyId) {
          await ctx.runAction(
            internal.queries.api_integrations.fetchAndStoreMusicMetadata,
            {
              spotifyId: songAlbumSpotifyId,
              type: "album",
            },
          );
          // Fix 1: Use ctx.runQuery
          const albumDoc = await ctx.runQuery(
            internal.queries.music._getAlbumBySpotifyId,
            { spotifyId: songAlbumSpotifyId },
          );
          if (albumDoc) {
            albumId = albumDoc._id;
          }
        }

        await ctx.runMutation(internal.queries.music.storeSong, {
          spotifyId: data.id,
          title: data.name,
          artistId: primaryArtistId, // Now correctly can be undefined
          albumId: albumId,
          durationMs: data.duration_ms,
          previewUrl: data.preview_url ?? undefined,
        });
      }
      console.log(
        `Successfully processed and stored ${args.type} metadata for ID: ${args.spotifyId}`,
      );
    } catch (error) {
      console.error(
        `Error fetching/storing Spotify ${args.type} metadata for ID ${args.spotifyId}:`,
        error,
      );
      throw new Error(
        `Failed to fetch and store music metadata: ${(error as Error).message}`,
      );
    }
  },
});


export const _getAppSpotifyAccessToken = internalAction({
  args: {},
  handler: async (ctx) => {
    const clientId = env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID;
    const clientSecret = env.SPOTIFY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error("Spotify client ID or secret not configured.");
    }

    try {
      const params = new URLSearchParams();
      params.append('grant_type', 'client_credentials');

      // Fix: Replace Buffer with Web API compatible base64 encoding
      const credentials = `${clientId}:${clientSecret}`;
      const encoder = new TextEncoder();
      const data = encoder.encode(credentials);
      const binaryString = String.fromCharCode(...data);
      const base64Credentials = btoa(binaryString);

      const response = await axios.post(
        "https://accounts.spotify.com/api/token",
        params.toString(),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${base64Credentials}`,
          },
        },
      );
      return response.data.access_token;
    } catch (error) {
      console.error("Error getting Spotify app access token:", error);
      throw new Error(
        `Failed to get Spotify app access token: ${(error as Error).message}`,
      );
    }
  },
});