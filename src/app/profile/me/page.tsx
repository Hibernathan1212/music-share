// src/app/profile/me/page.tsx - REVISED
"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import { Button } from "~/components/ui/button";
import Link from "next/link";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import {
  Loader2,
  ArrowLeft,
  User,
  Image as ImageIcon,
  BookOpenText,
  Save,
  Pencil,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Id } from "../../../../convex/_generated/dataModel";
import { Doc } from "../../../../convex/_generated/dataModel"; // Import Doc for user type

const profileSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters.")
    .max(20, "Username must be at most 20 characters.")
    .regex(
      /^[a-zA-Z0-9_.]+$/,
      "Username can only contain letters, numbers, underscores, and periods.",
    )
    .trim(),
  displayName: z
    .string()
    .max(50, "Display name must be at most 50 characters.")
    .nullable()
    .optional(),
  bio: z
    .string()
    .max(200, "Bio must be at most 200 characters.")
    .nullable()
    .optional(),
  profilePictureUrl: z.string().url("Must be a valid URL.").nullable().optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function MyProfilePage() {
  const { user: clerkUser, isLoaded: isClerkLoaded, isSignedIn } = useUser();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    setError,
    clearErrors,
    formState: { errors, isDirty },
    getValues,
    reset,
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    mode: "onChange",
    defaultValues: {
      username: "",
      displayName: null,
      bio: null,
      profilePictureUrl: null,
    },
  });

  const convexUser = useQuery( // Removed generic type here, will let Convex infer
    api.queries.users.getMe,
    !isClerkLoaded || !isSignedIn ? "skip" : undefined,
  );

  const updateUserProfile = useMutation(api.queries.users.updateUserProfile);
  const checkUsernameAvailability = useQuery(
    api.queries.users.isUsernameAvailable,
    getValues("username").length >= 3 &&
      getValues("username") !== convexUser?.username
      ? { username: getValues("username") }
      : "skip",
  );

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  const watchUsername = watch("username");

  useEffect(() => {
    // Only run if convexUser is available and it's the initial load
    if (convexUser && !initialLoadComplete) {
      reset({
        // Use reset to set form values from fetched data, and mark form as not dirty
        username: convexUser.username ?? "",
        displayName: convexUser.displayName || null, // Ensure null
        bio: convexUser.bio || null, // Ensure null
        profilePictureUrl: convexUser.profilePictureUrl || null, // Ensure null
      });
      setInitialLoadComplete(true);

      if (!convexUser.username) {
        setIsEditing(true);
        toast.info("Welcome to Musishare! Please set up your profile.", {
          description: "Choose a unique username and add some details.",
          duration: 5000,
          id: "first-time-profile-setup",
        });
      }
    }
  }, [convexUser, reset, initialLoadComplete]);

  useEffect(() => {
    if (
      isEditing &&
      watchUsername &&
      watchUsername.length >= 3 &&
      watchUsername !== convexUser?.username
    ) {
      if (checkUsernameAvailability === false) {
        setError("username", {
          type: "manual",
          message: "This username is already taken.",
        });
      } else if (checkUsernameAvailability === true) {
        clearErrors("username");
      }
    } else {
      clearErrors("username");
    }
  }, [
    watchUsername,
    checkUsernameAvailability,
    convexUser?.username,
    setError,
    clearErrors,
    isEditing,
  ]);

  const onSubmit = async (data: ProfileFormValues) => {
    if (Object.keys(errors).length > 0) {
      toast.error("Please fix the form errors before saving.");
      return;
    }
    if (
      watchUsername !== convexUser?.username &&
      checkUsernameAvailability === false
    ) {
      toast.error("The chosen username is already taken.");
      return;
    }

    setIsSaving(true);
    try {
      if (convexUser?._id) {
        await updateUserProfile({
          userId: convexUser._id,
          username: data.username,
          displayName: data.displayName ?? undefined, // This now correctly matches `v.optional(v.string())`
          bio: data.bio ?? undefined, // This now correctly matches `v.optional(v.string())`
          profilePictureUrl: data.profilePictureUrl ?? undefined, // This now correctly matches `v.optional(v.string())`
        });
        toast.success("Profile updated successfully!");
        setIsEditing(false);
      } else {
        toast.error("User ID not found. Cannot save profile.");
      }
    } catch (error: any) {
      console.error("Failed to update profile:", error);
      toast.error("Failed to update profile.", {
        description: error.message ?? "An unexpected error occurred.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!isClerkLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
        <Skeleton className="h-[600px] w-full max-w-lg rounded-lg shadow-lg-soft" />
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
        <Card className="w-full max-w-md p-6 text-center shadow-lg-soft">
          <CardHeader>
            <CardTitle className="text-xl">Authentication Required</CardTitle>
            <CardDescription>
              Please sign in to view and edit your profile.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/">
              <Button className="shadow-soft hover:scale-[1.02]">
                Go to Sign In
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!convexUser) {
    // If convexUser is null or undefined (loading)
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-lg text-muted-foreground">
            Loading your profile data...
          </p>
          <Skeleton className="h-40 w-64 rounded-md shadow-soft" />
        </div>
      </div>
    );
  }

  // After the above `if (!convexUser)` block, `convexUser` is guaranteed to be `Doc<"users">`
  const isSaveDisabled =
    isSaving ||
    !isDirty ||
    Object.keys(errors).length > 0 ||
    (watchUsername !== convexUser.username &&
      checkUsernameAvailability === false); // No optional chaining needed on convexUser

  return (
    <div className="flex min-h-screen flex-col items-center bg-background p-4 text-foreground">
      <Card className="container mx-auto mt-8 w-full max-w-lg p-6 shadow-lg-soft">
        <CardHeader className="flex flex-row items-center justify-between p-0 pb-6">
          {!isEditing && (
            <Link href="/home">
              <Button
                variant="ghost"
                className="group text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />{" "}
                Back to Home
              </Button>
            </Link>
          )}
          <CardTitle
            className={`text-3xl font-bold text-primary ${
              isEditing ? "mx-auto" : ""
            }`}
          >
            My Profile
          </CardTitle>
          {!isEditing ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(true)}
              className="shadow-soft hover:scale-[1.01]"
            >
              <Pencil className="mr-2 h-4 w-4" /> Edit
            </Button>
          ) : (
            <div className="w-[88px]" />
          )}
        </CardHeader>

        <CardContent className="space-y-6 p-0 pt-6">
          <div className="flex flex-col items-center gap-4">
            <Avatar className="h-28 w-28 border-2 border-primary shadow-lg-soft">
              <AvatarImage
                src={watch("profilePictureUrl") || clerkUser?.imageUrl || undefined}
                alt={watch("displayName") ?? watch("username") ?? "User Avatar"}
              />
              <AvatarFallback className="text-4xl">
                {(watch("displayName") ?? watch("username") ?? "U")
                  .charAt(0)
                  .toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <h3 className="text-2xl font-bold text-foreground">
              {watch("displayName") ?? watch("username") ?? "Set Your Name"}
            </h3>
            <p className="text-md text-muted-foreground">
              @{watch("username") ?? "username_needed"}
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="username" className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" /> Username
                {isEditing && errors.username?.message && (
                  <span className="ml-2 flex items-center text-xs font-medium text-destructive">
                    <AlertCircle className="mr-1 h-3 w-3" />
                    {errors.username.message}
                  </span>
                )}
                {isEditing &&
                  watchUsername &&
                  watchUsername.length >= 3 &&
                  watchUsername !== convexUser.username &&
                  checkUsernameAvailability === true &&
                  !errors.username && (
                    <span className="ml-2 flex items-center text-xs font-medium text-primary">
                      <CheckCircle className="mr-1 h-3 w-3" />
                      Available!
                    </span>
                  )}
                {isEditing &&
                  watchUsername &&
                  watchUsername.length >= 3 &&
                  watchUsername !== convexUser.username &&
                  checkUsernameAvailability === undefined && (
                    <span className="ml-2 flex items-center text-xs font-medium text-muted-foreground">
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Checking...
                    </span>
                  )}
              </Label>
              <Input
                id="username"
                {...register("username")}
                placeholder="Unique username"
                readOnly={!isEditing}
                className={`shadow-inset-soft ${
                  errors.username
                    ? "border-destructive focus-visible:ring-destructive"
                    : ""
                }`}
                autoComplete="off"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="displayName" className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" /> Display Name
                (Optional)
              </Label>
              <Input
                id="displayName"
                {...register("displayName")}
                placeholder="Your display name"
                readOnly={!isEditing}
                className="shadow-inset-soft"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio" className="flex items-center gap-2">
                <BookOpenText className="h-4 w-4 text-muted-foreground" /> Bio
                (Optional)
              </Label>
              <Textarea
                id="bio"
                {...register("bio")}
                placeholder="Tell us about yourself..."
                readOnly={!isEditing}
                rows={4}
                className="shadow-inset-soft resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="profilePictureUrl"
                className="flex items-center gap-2"
              >
                <ImageIcon className="h-4 w-4 text-muted-foreground" /> Profile
                Picture URL (Optional)
              </Label>
              <Input
                id="profilePictureUrl"
                {...register("profilePictureUrl")}
                placeholder="https://example.com/your-image.jpg"
                readOnly={!isEditing}
                className={`shadow-inset-soft ${
                  errors.profilePictureUrl
                    ? "border-destructive focus-visible:ring-destructive"
                    : ""
                }`}
                type="url"
              />
            </div>

            {isEditing && (
              <div className="flex flex-col gap-4 sm:flex-row">
                <Button
                  type="submit"
                  disabled={isSaveDisabled}
                  className="flex-1 shadow-primary hover:scale-[1.01] transition-all"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" /> Save Changes
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditing(false);
                    reset({
                      // Reset to current Convex user values
                      username: convexUser.username ?? "",
                      displayName: convexUser.displayName || null,
                      bio: convexUser.bio || null,
                      profilePictureUrl: convexUser.profilePictureUrl || null,
                    });
                    clearErrors();
                  }}
                  disabled={isSaving}
                  className="flex-1 shadow-soft hover:scale-[1.01]"
                >
                  Cancel
                </Button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}