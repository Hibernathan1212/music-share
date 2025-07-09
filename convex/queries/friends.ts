// convex/friends.ts
import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api"; // Ensure api import for auth

export const getFollowing = query({
  args: {
    userId: v.id("users"), // Correctly typed
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const currentUser = await ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", identity!.subject)).unique();
    
    // Auth check: User can only see their own following list (or add broader logic)
    if (!identity || !currentUser || String(currentUser._id) !== String(args.userId)) {
      throw new Error("Not authorized.");
    }

    const followingRelations = await ctx.db.query("friendships")
      .withIndex("by_follower", (q) => q.eq("followerId", args.userId))
      .collect(); // Use collect() for all results

    // Hydrate with user details
    const followingUsers = await Promise.all(
        followingRelations.map(async (relation) => {
            const user = await ctx.db.get(relation.followingId);
            return user; // Return the full user object
        })
    );
    // Filter out any nulls if users were deleted
    return followingUsers.filter(Boolean);
  },
});

export const getFollowers = query({
  args: {
    userId: v.id("users"), // Correctly typed
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const currentUser = await ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", identity!.subject)).unique();
    
    // Auth check
    if (!identity || !currentUser || String(currentUser._id) !== String(args.userId)) {
      throw new Error("Not authorized.");
    }

    const followerRelations = await ctx.db.query("friendships")
      .withIndex("by_following", (q) => q.eq("followingId", args.userId))
      .collect();

    const followerUsers = await Promise.all(
        followerRelations.map(async (relation) => {
            const user = await ctx.db.get(relation.followerId);
            return user;
        })
    );
    return followerUsers.filter(Boolean);
  },
});

export const getFriendStatus = query({
  args: {
    targetUserId: v.id("users"), // The user whose friendship status with current user we're checking
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const currentUser = await ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", identity!.subject)).unique();
    if (!identity || !currentUser) {
      return { isFollowing: false, isFollowedBy: false }; // Not authenticated
    }

    const currentUserId = currentUser._id;

    const isFollowing = await ctx.db.query("friendships")
        .withIndex("by_follower_following", (q) =>
            q.eq("followerId", currentUserId).eq("followingId", args.targetUserId)
        ).first();

    const isFollowedBy = await ctx.db.query("friendships")
        .withIndex("by_follower_following", (q) =>
            q.eq("followerId", args.targetUserId).eq("followingId", currentUserId)
        ).first();

    return {
        isFollowing: !!isFollowing,
        isFollowedBy: !!isFollowedBy,
    };
  }
});


export const followUser = mutation({
  args: {
    followingId: v.id("users"), // The user to follow
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const currentUser = await ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", identity!.subject)).unique();

    if (!identity || !currentUser) {
      throw new Error("Unauthorized: User not authenticated.");
    }

    const followerId = currentUser._id;

    if (String(followerId) === String(args.followingId)) {
        throw new Error("Cannot follow yourself.");
    }

    const existingFollow = await ctx.db.query("friendships")
      .withIndex("by_follower_following", (q) =>
        q.eq("followerId", followerId).eq("followingId", args.followingId),
      )
      .first();

    if (existingFollow) {
      throw new Error("Already following this user.");
    }

    return await ctx.db.insert("friendships", {
      followerId: followerId,
      followingId: args.followingId,
    });
  },
});

export const unfollowUser = mutation({
  args: {
    followingId: v.id("users"), // The user to unfollow
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const currentUser = await ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", identity!.subject)).unique();

    if (!identity || !currentUser) {
      throw new Error("Unauthorized: User not authenticated.");
    }

    const followerId = currentUser._id;

    const existingFollow = await ctx.db.query("friendships")
      .withIndex("by_follower_following", (q) =>
        q.eq("followerId", followerId).eq("followingId", args.followingId),
      )
      .first();

    if (!existingFollow) {
      throw new Error("Not currently following this user.");
    }

    await ctx.db.delete(existingFollow._id);
    return true; // Indicate success
  },
});