import { query } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";

export const searchUsers = query({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    if (args.query.length < 3) return [];

    const lowerCaseQuery = args.query.toLowerCase();

    const users = await ctx.db.query("users").collect();
    return users.filter(
      (user) =>
        user.username.toLowerCase().includes(lowerCaseQuery) ||
        (user.displayName && user.displayName.toLowerCase().includes(lowerCaseQuery)),
    );
  },
});

export const searchMusic = query({
  args: {
    query: v.string(), 
  },
  handler: async (ctx, args) => {
    if (args.query.length < 3) return [];

    const songs = await ctx.db
      .query("songs")
      .withSearchIndex("search_title", (q) => q.search("title", args.query))
      .take(10); 
    const artists = await ctx.db
      .query("artists")
      .withSearchIndex("search_name", (q) => q.search("name", args.query))
      .take(10); 

    const hydratedSongs = await Promise.all(
      songs.map(async (song) => {
        let artistName = "Unknown Artist";
        if (song.artistId) {
          const artist = await ctx.db.get(song.artistId);
          artistName = artist?.name ?? artistName;
        }
        let albumTitle = "Unknown Album";
        let coverImageUrl = null;
        if (song.albumId) {
          const album = await ctx.db.get(song.albumId);
          albumTitle = album?.title ?? albumTitle;
          coverImageUrl = album?.coverImageUrl ?? null;
        }
        return {
          _id: song._id,
          type: "song",
          title: song.title,
          artistName,
          albumTitle,
          coverImageUrl,
          spotifyId: song.spotifyId,
        };
      }),
    );

    const formattedArtists = artists.map((artist) => ({
      _id: artist._id,
      type: "artist",
      name: artist.name,
      imageUrl: artist.imageUrl,
      spotifyId: artist.spotifyId,
    }));

    return { songs: hydratedSongs, artists: formattedArtists };
  },
});
