import { currentUser } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { FriendFeed } from "~/components/FriendFeed";
import { NowPlayingDisplay } from "~/components/NowPlayingDisplay";
import ToggleTheme from "~/components/ToggleTheme";
import { redirect } from "next/navigation";
import { Home, Settings, Users, Search, Bell, User } from "lucide-react";
import { Skeleton } from "~/components/ui/skeleton";
import { Suspense } from "react"; 

export default async function HomePage() {
  const user = await currentUser();

  if (!user) {
    redirect("/");
  }

  return (
    <div className="container mx-auto flex w-full flex-1 flex-col gap-8 px-4 py-8 md:flex-row md:gap-12">
      <section className="sticky top-20 h-fit w-full rounded-lg border border-border bg-card p-6 shadow-lg-soft md:w-1/3">
        <h2 className="mb-5 text-2xl font-bold text-primary">Your Status</h2>
        <Suspense fallback={<Skeleton className="h-48 w-full rounded-md" />}>
          <NowPlayingDisplay />
        </Suspense>
      </section>

      <section className="w-full rounded-lg border border-border bg-card p-6 shadow-lg-soft md:w-2/3">
        <h2 className="mb-5 text-2xl font-bold text-primary">
          Friends&apos; Listening Stream
        </h2>
        <Suspense
          fallback={
            <div className="space-y-4">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-lg" />
              ))}
            </div>
          }
        >
          <FriendFeed />
        </Suspense>
      </section>
    </div>
  );
}