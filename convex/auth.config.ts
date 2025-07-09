import { env } from "../src/env";

export default {
  providers: [
    {
      domain: env.NEXT_PUBLIC_CLERK_FRONTEND_API_URL,
      applicationID: "convex",
    },
  ]
};