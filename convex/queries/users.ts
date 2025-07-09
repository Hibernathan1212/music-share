// convex/users.ts (Combined & REVISED)
import { mutation, query, internalMutation, internalQuery, type QueryCtx } from "../_generated/server";
import { v, type Validator } from "convex/values";
import type { UserJSON } from "@clerk/backend"; // Assuming you have Clerk Backend installed for webhooks
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

    // If user doesn't exist, it's either first login or webhook hasn't run yet.
    // The client will display loading or sign-in prompt.
    return user;
  },
});

export const getUserByClerkId = query({
  // Renamed for clarity to match args
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

// New query to get a user by their Convex _id
export const getUserByConvexId = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

export const getUserByUsername = query({
  // This is what the public profile page will use
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
    if (args.username.length < 3) return null; // Don't check until minimum length
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

    // Username is available if no one has it, OR if the existing user is *you*
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
    userId: v.id("users"), // Convex internal ID
    displayName: v.optional(v.string()),
    bio: v.optional(v.string()),
    profilePictureUrl: v.optional(v.string()),
    username: v.optional(v.string()), // Username update is handled here
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const currentUserDoc = await ctx.db.get(args.userId); // Fetch the user doc by _id

    // Ensure the authenticated user is the owner of the profile being updated
    if (!identity || !currentUserDoc || identity.subject !== currentUserDoc.clerkId) {
      throw new Error("Unauthorized to update this profile.");
    }

    // Handle username uniqueness check
    if (args.username !== undefined && args.username !== currentUserDoc.username) {
      const existingUsername = await ctx.db
        .query("users")
        .withIndex("by_username", (q) => q.eq("username", args.username!))
        .unique();
      if (existingUsername && existingUsername._id !== args.userId) {
        // Ensure it's not taken by someone else
        throw new Error("Username is already taken.");
      }
    }

    await ctx.db.patch(args.userId, {
      displayName: args.displayName,
      bio: args.bio,
      profilePictureUrl: args.profilePictureUrl,
      username: args.username, // Apply the new username if provided
    });
    return true;
  },
});

// New query for `pollAllCurrentlyPlaying`
export const getUsersWithSpotifyAccount = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("users")
      .filter((q) => q.neq(q.field("spotifyUserId"), undefined))
      .collect();
  },
});

// Internal mutations for Clerk webhook sync
export const createOrUpdateUserInternal = internalMutation({
  // This is what the Clerk webhook will call
  args: {
    clerkId: v.string(),
    username: v.string(), // Initially generated, or empty
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
      // Only patch fields that Clerk might update directly (e.g., profile picture, email, display name from Clerk)
      // Do NOT patch username here if user can set it uniquely in your app.
      // Or, only patch username if existingUser.username is empty, meaning it's a new user.
      await ctx.db.patch(existingUser._id, {
        email: args.email,
        displayName: args.displayName,
        profilePictureUrl: args.profilePictureUrl,
        // If username is set by Clerk webhook, and you want users to override:
        // if (!existingUser.username) { username: args.username }
        // For simplicity, let's assume Clerk webhook might pass an initial username.
        // If you want user to ALWAYS explicitly set it:
        // username: existingUser.username ?? "", // Keep existing if not empty
      });
      return existingUser._id;
    } else {
      // First creation: Set initial username to empty string so user is forced to choose
      const newUserId = await ctx.db.insert("users", {
        clerkId: args.clerkId,
        username: "", // Crucial for first-time user flow
        email: args.email,
        displayName: args.displayName,
        profilePictureUrl: args.profilePictureUrl,
        bio: "", // New users start with no bio
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
      // TODO: Also delete associated data like userListeningHistory, userPlatformAccounts, friendships
    }
  },
});

export const upsertFromClerk = internalMutation({
  args: { data: v.any() as Validator<UserJSON> }, // no runtime validation, trust Clerk
  async handler(ctx, { data }) {
    const userAttributes = {
      displayName: `${data.first_name} ${data.last_name}`,
      clerkId: data.id,
      username: "",
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