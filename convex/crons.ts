// convex/crons.ts
import { cronJobs } from "convex/server";

const crons = cronJobs();

import { internal } from "./_generated/api";
// No need to import `query` here as it's not defining a query
// import { query } from "./_generated/server";

// crons.interval(
//   "poll currently playing",
//   { minutes: 1 }, // Poll every minute
//   internal.queries.api_integrations.pollAllCurrentlyPlaying, // Correct internal path
// );

export default crons;