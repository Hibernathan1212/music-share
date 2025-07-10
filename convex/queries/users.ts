import { mutation, query, internalMutation, internalQuery, type QueryCtx } from "../_generated/server";
import { v, type Validator } from "convex/values";
import type { UserJSON } from "@clerk/backend"; 
import { api } from "../_generated/api";

export const getMe = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      return null;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    return user;
  },
});

export const getUserByClerkId = query({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
  },
});

export const getUserByConvexId = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

export const getUserByUsername = query({
  args: {
    username: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", args.username))
      .first();
  },
});

export const isUsernameAvailable = query({
  args: { username: v.string() },
  handler: async (ctx, args) => {
    if (args.username.length < 3) return null; 
    const identity = await ctx.auth.getUserIdentity();
    const currentUser = identity
      ? await ctx.db
          .query("users")
          .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
          .first()
      : null;

    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", args.username))
      .first();

    return !existingUser || (currentUser && existingUser._id === currentUser._id);
  },
});

export const getAllUsers = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db.query("users").collect();
  }
})

export const updateUserProfile = mutation({
  args: {
    userId: v.id("users"), 
    displayName: v.optional(v.string()),
    bio: v.optional(v.string()),
    profilePictureUrl: v.optional(v.string()),
    username: v.optional(v.string()), 
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const currentUserDoc = await ctx.db.get(args.userId); 

    if (!identity || !currentUserDoc || identity.subject !== currentUserDoc.clerkId) {
      throw new Error("Unauthorized to update this profile.");
    }

    if (args.username !== undefined && args.username !== currentUserDoc.username) {
      const existingUsername = await ctx.db
        .query("users")
        .withIndex("by_username", (q) => q.eq("username", args.username!))
        .unique();
      if (existingUsername && existingUsername._id !== args.userId) {
        throw new Error("Username is already taken.");
      }
    }

    await ctx.db.patch(args.userId, {
      displayName: args.displayName,
      bio: args.bio,
      profilePictureUrl: args.profilePictureUrl,
      username: args.username, 
    });
    return true;
  },
});

export const getUsersWithSpotifyAccount = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("users")
      .filter((q) => q.neq(q.field("spotifyUserId"), undefined))
      .collect();
  },
});

export const createOrUpdateUserInternal = internalMutation({
  args: {
    clerkId: v.string(),
    username: v.string(), 
    email: v.string(),
    displayName: v.string(),
    profilePictureUrl: v.optional(v.string()),
    bio: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (existingUser) {
      await ctx.db.patch(existingUser._id, {
        email: args.email,
        displayName: args.displayName,
        profilePictureUrl: args.profilePictureUrl,
      });
      return existingUser._id;
    } else {
      const newUserId = await ctx.db.insert("users", {
        clerkId: args.clerkId,
        username: "", 
        email: args.email,
        displayName: args.displayName,
        profilePictureUrl: args.profilePictureUrl,
        bio: "", 
      });
      return newUserId;
    }
  },
});

export const deleteUserInternal = internalMutation({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const userToDelete = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .unique();
    if (userToDelete) {
      await ctx.db.delete(userToDelete._id);

      // also delete data like userListeningHistory, userPlatformAccounts, friendships
    }
  },
});

export const upsertFromClerk = internalMutation({
  args: { data: v.any() as Validator<UserJSON> }, 
  async handler(ctx, { data }) {
    const userAttributes = {
      displayName: `${data.first_name} ${data.last_name ?? ""}`,
      clerkId: data.id,
      username: "",
      profilePictureUrl: data.image_url,
      email: JSON.stringify(data.email_addresses[0]),
    };

    const user = await userByExternalId(ctx, data.id);
    if (user === null) {
      await ctx.db.insert("users", userAttributes);
    } else {
      await ctx.db.patch(user._id, userAttributes);
    }
  },
});

async function userByExternalId(ctx: QueryCtx, externalId: string) {
  return await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", externalId))
    .unique();
}