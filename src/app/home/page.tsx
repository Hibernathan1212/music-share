// src/app/home/page.tsx
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
import { Suspense } from "react"; // For loading states
import Image from "next/image";

export default async function HomePage() {
  const user = await currentUser();

  if (!user) {
    redirect("/");
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Navbar/Header */}
      <nav className="sticky top-0 z-50 flex w-full items-center justify-between border-b border-border bg-card/80 px-4 py-3 shadow-lg-soft backdrop-blur-md md:px-8">
        <Link
          href="/home"
          className="flex items-center gap-2 text-2xl font-bold text-primary transition-colors hover:text-primary/90"
        >
          <Home className="h-6 w-6" />
          {/* <div className="h-6 w-6">
            <img
              src="/logo.png"
              alt="Musishare Logo"
              // layout="fill"
              // objectFit="contain"
              className="drop-shadow-lg h-6 w-6"
            />
          </div> */}
          Musishare
        </Link>
        <div className="flex items-center gap-4">
          {/* Desktop Navigation */}
          <div className="hidden items-center gap-2 md:flex">
            <Link href="/search">
              <Button
                variant="ghost"
                className="group text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <Search className="mr-2 h-4 w-4" /> Search
              </Button>
            </Link>
            <Link href="/friends">
              <Button
                variant="ghost"
                className="group text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <Users className="mr-2 h-4 w-4" /> Friends
              </Button>
            </Link>
            <Link href="/profile/me">
              <Button
                variant="ghost"
                className="group text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <User className="mr-2 h-4 w-4" /> Profile
              </Button>
            </Link>
            <Link href="/settings">
              <Button
                variant="ghost"
                className="group text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <Settings className="mr-2 h-4 w-4" /> Settings
              </Button>
            </Link>
            {/* Optional: Notifications button */}
            <Button
              variant="ghost"
              size="icon"
              className="group text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <Bell className="h-5 w-5" />
            </Button>
          </div>
          <ToggleTheme />
          <UserButton afterSignOutUrl="/" />
        </div>
      </nav>

      {/* Main Content */}
      <main className="container mx-auto flex w-full flex-1 flex-col gap-8 px-4 py-8 md:flex-row md:gap-12">
        {/* Left Column: User's Now Playing */}
        <section className="sticky top-20 h-fit w-full rounded-lg border border-border bg-card p-6 shadow-lg-soft md:w-1/3">
          <h2 className="mb-5 text-2xl font-bold text-primary">Your Status</h2>
          <Suspense fallback={<Skeleton className="h-48 w-full rounded-md" />}>
            <NowPlayingDisplay />
          </Suspense>
        </section>

        {/* Right Column: Friend Feed */}
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
      </main>

      {/* Mobile Bottom Navigation (Optional but Recommended for Social Apps) */}
      <nav className="fixed bottom-0 left-0 z-50 flex w-full items-center justify-around border-t border-border bg-card px-4 py-3 shadow-xl-soft md:hidden">
        <Link href="/home" className="flex flex-col items-center text-primary">
          <Home className="h-5 w-5" />
          <span className="text-xs">Home</span>
        </Link>
        <Link
          href="/search"
          className="flex flex-col items-center text-muted-foreground transition-colors hover:text-foreground"
        >
          <Search className="h-5 w-5" />
          <span className="text-xs">Search</span>
        </Link>
        <Link
          href="/friends"
          className="flex flex-col items-center text-muted-foreground transition-colors hover:text-foreground"
        >
          <Users className="h-5 w-5" />
          <span className="text-xs">Friends</span>
        </Link>
        <Link
          href="/profile/me"
          className="flex flex-col items-center text-muted-foreground transition-colors hover:text-foreground"
        >
          <User className="h-5 w-5" />
          <span className="text-xs">Profile</span>
        </Link>
        <Link
          href="/settings"
          className="flex flex-col items-center text-muted-foreground transition-colors hover:text-foreground"
        >
          <Settings className="h-5 w-5" />
          <span className="text-xs">Settings</span>
        </Link>
      </nav>
    </div>
  );
}