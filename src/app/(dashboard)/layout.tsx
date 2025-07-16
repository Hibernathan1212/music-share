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


export default function HomePage(props: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <nav className="sticky top-0 z-50 flex w-full items-center justify-between border-b border-border bg-card/80 px-4 py-3 shadow-lg-soft backdrop-blur-md md:px-8">
        <Link
          href="/home"
          className="flex items-center gap-2 text-2xl font-bold text-primary transition-colors hover:text-primary/90"
        >
          {/* <Home className="h-6 w-6" /> */}
          {/* <div className="h-6 w-6">
            <img
              src="/logo.png"
              alt="Musishare Logo"
              // layout="fill"
              // objectFit="contain"
              className="drop-shadow-lg h-6 w-6"
            />
          </div> */}
          musishare
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
            {/* <Link href="/settings">
              <Button
                variant="ghost"
                className="group text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <Settings className="mr-2 h-4 w-4" /> Settings
              </Button>
            </Link> */}
            {/* todo: notifications */}
            {/* <Button
              variant="ghost"
              size="icon"
              className="group text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <Bell className="h-5 w-5" />
            </Button> */}  
          </div>
          <Link href="/settings">
              <Button
                variant="ghost"
                className="group text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <Settings className="mr-2 h-4 w-4" />
              </Button>
            </Link>
          {/* <ToggleTheme /> */}
          <UserButton afterSignOutUrl="/" />
        </div>
      </nav>

      <main>
        {props.children}
      </main>
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
        {/* <Link
          href="/settings"
          className="flex flex-col items-center text-muted-foreground transition-colors hover:text-foreground"
        >
          <Settings className="h-5 w-5" />
          <span className="text-xs">Settings</span>
        </Link> */}
      </nav>
    </div>
  );
}