// src/app/page.tsx
import { currentUser } from "@clerk/nextjs/server";
import { SignInButton } from "@clerk/nextjs";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { redirect } from "next/navigation";
import Image from "next/image";
import { ArrowRight } from "lucide-react";

export default async function LandingPage() {
  const user = await currentUser();

  if (user) {
    redirect("/home");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-8 text-center text-foreground">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-8 py-16">
        <div className="relative h-28 w-28 sm:h-36 sm:w-36">
          <Image
            src="/musishare-logo.svg" // Make sure you have this in your public folder
            alt="Musishare Logo"
            layout="fill"
            objectFit="contain"
            className="drop-shadow-lg"
          />
        </div>
        <h1 className="text-5xl font-extrabold tracking-tight text-primary sm:text-6xl lg:text-7xl">
          Musishare
        </h1>
        <p className="max-w-prose text-lg text-muted-foreground sm:text-xl leading-relaxed">
          Connect with friends, discover new music, and share your listening
          journey in real-time. See what&apos;s playing, or what they've listened to
          recently.
        </p>
        <div className="flex flex-col gap-4 sm:flex-row">
          <SignInButton mode="modal">
            <Button
              size="lg"
              className="group relative overflow-hidden text-lg shadow-lg-soft transition-all duration-300 hover:scale-[1.02]"
            >
              Get Started
              <ArrowRight className="ml-2 h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
            </Button>
          </SignInButton>
          <Link href="/learn-more" className="block sm:inline-block">
            <Button
              variant="outline"
              size="lg"
              className="text-lg shadow-soft transition-all duration-300 hover:scale-[1.02]"
            >
              Learn More
            </Button>
          </Link>
        </div>
      </div>
      <footer className="absolute bottom-6 text-sm text-muted-foreground">
        © {new Date().getFullYear()} Musishare. All rights reserved.
      </footer>
    </main>
  );
}