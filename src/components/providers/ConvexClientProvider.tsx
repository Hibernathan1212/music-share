// src/components/providers/ConvexClientProvider.tsx
"use client";

import type { ReactNode } from "react";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { useAuth } from "@clerk/nextjs";
import { env } from "~/env"; // Import your t3 env

const convex = new ConvexReactClient(env.NEXT_PUBLIC_CONVEX_URL); // Use env for URL

export default function ConvexClientProvider({
  children,
}: {
  children: ReactNode;
}) {
  return (
    // ClerkProvider should be higher in the tree, typically in layout.tsx.
    // If you already have it in layout.tsx, this is fine.
    // If not, you need to wrap this in ClerkProvider.
    // Given your layout.tsx, this setup is correct.
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  );
}