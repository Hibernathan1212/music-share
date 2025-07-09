/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as crons from "../crons.js";
import type * as http from "../http.js";
import type * as queries_api_integrations from "../queries/api_integrations.js";
import type * as queries_friends from "../queries/friends.js";
import type * as queries_music from "../queries/music.js";
import type * as queries_search from "../queries/search.js";
import type * as queries_users from "../queries/users.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  crons: typeof crons;
  http: typeof http;
  "queries/api_integrations": typeof queries_api_integrations;
  "queries/friends": typeof queries_friends;
  "queries/music": typeof queries_music;
  "queries/search": typeof queries_search;
  "queries/users": typeof queries_users;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
