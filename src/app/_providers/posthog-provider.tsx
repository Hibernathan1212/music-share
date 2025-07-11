// app/providers.tsx
'use client'

import { usePathname, useSearchParams } from "next/navigation"
import { useEffect } from "react"
import { usePostHog } from 'posthog-js/react'

import posthog from 'posthog-js'
import { PostHogProvider as PHProvider } from 'posthog-js/react'
import { env } from "~/env"
import { useUser } from "@clerk/nextjs"

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    posthog.init(env.NEXT_PUBLIC_POSTHOG_KEY as string, {
      api_host: "/relay-vC2c", 
      ui_host: env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
      capture_pageview: false,
      person_profiles: 'identified_only', // or 'always' to create profiles for anonymous users as well
      defaults: '2025-05-24'
    })
  }, [])

  const userInfo = useUser();
  
  useEffect(() => {
    if (userInfo.user?.id) {
      posthog.identify(userInfo.user.id, {
        email: userInfo.user.emailAddresses[0]?.emailAddress,
      });
    } else {
      posthog.reset();
    }
  }, [posthog, userInfo.user])

  return (
    <PHProvider client={posthog}>
      {children}
    </PHProvider>
  )
}
