"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
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
  XCircle, // Added for clearer error icon
} from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Doc } from "../../../../../convex/_generated/dataModel";

// Zod schema for profile validation
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
    .optional()
    .transform((e) => (e === "" ? null : e)), // Convert empty string to null
  bio: z
    .string()
    .max(200, "Bio must be at most 200 characters.")
    .nullable()
    .optional()
    .transform((e) => (e === "" ? null : e)), // Convert empty string to null
  profilePictureUrl: z
    .string()
    .url("Must be a valid URL.")
    .nullable()
    .optional()
    .transform((e) => (e === "" ? null : e)), // Convert empty string to null
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function MyProfilePage() {
  const { user: clerkUser, isLoaded: isClerkLoaded, isSignedIn } = useUser();

  const {
    register,
    handleSubmit,
    watch,
    setError,
    clearErrors,
    formState: { errors, isDirty, isValid },
    getValues,
    reset,
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    mode: "onChange",
    defaultValues: {
      username: "",
      displayName: null,
      bio: "",
      profilePictureUrl: "",
    },
  });

  const convexUser = useQuery(
    api.queries.users.getMe,
    !isClerkLoaded || !isSignedIn ? "skip" : undefined,
  ) as Doc<"users"> | null | undefined; // Explicitly type to access properties

  const updateUserProfile = useMutation(api.queries.users.updateUserProfile);
  const checkUsernameAvailability = useQuery(
    api.queries.users.isUsernameAvailable,
    watch("username").length >= 3 &&
      watch("username") !== convexUser?.username && // Only check if username changed
      getValues("username") // Ensure value exists before query
      ? { username: getValues("username") }
      : "skip",
  );

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  const watchedUsername = watch("username");
  const watchedProfilePictureUrl = watch("profilePictureUrl");

  useEffect(() => {
    if (convexUser && !initialLoadComplete) {
      reset({
        username: convexUser.username ?? "",
        displayName: convexUser.displayName ?? null,
        bio: convexUser.bio ?? null,
        profilePictureUrl: convexUser.profilePictureUrl ?? null,
      });
      setInitialLoadComplete(true);

      if (!convexUser.username) {
        setIsEditing(true);
        toast.info("Welcome to Musishare! Please set up your profile.", {
          description: "Choose a unique username and add some details.",
          duration: 6000,
          id: "first-time-profile-setup", 
          action: {
            label: "Got it!",
            onClick: () => toast.dismiss("first-time-profile-setup"),
          },
        });
      }
    }
  }, [convexUser, reset, initialLoadComplete]);

  // Handle username availability feedback
  useEffect(() => {
    if (isEditing && watchedUsername && watchedUsername.length >= 3) {
      if (
        watchedUsername !== convexUser?.username &&
        checkUsernameAvailability === false
      ) {
        setError("username", {
          type: "manual",
          message: "This username is already taken.",
        });
      } else if (
        watchedUsername !== convexUser?.username &&
        checkUsernameAvailability === true
      ) {
        clearErrors("username");
      }
    } else if (watchedUsername === convexUser?.username) {
      // Clear error if username reverted to original
      clearErrors("username");
    }
  }, [
    watchedUsername,
    checkUsernameAvailability,
    convexUser?.username,
    setError,
    clearErrors,
    isEditing,
  ]);

  const onSubmit = async (data: ProfileFormValues) => {
    if (Object.keys(errors).length > 0) {
      toast.error("Please fix the form errors before saving.", {
        description: "Check the fields highlighted in red.",
      });
      return;
    }
    if (
      watchedUsername !== convexUser?.username &&
      checkUsernameAvailability === false
    ) {
      toast.error("The chosen username is already taken. Please pick another.");
      return;
    }

    setIsSaving(true);
    try {
      if (convexUser?._id) {
        await updateUserProfile({
          userId: convexUser._id,
          username: data.username,
          displayName: data.displayName ?? undefined,
          bio: data.bio ?? undefined,
          profilePictureUrl: data.profilePictureUrl ?? undefined,
        });
        toast.success("Profile updated successfully!");
        setIsEditing(false); // Exit editing mode on success
        // Reset form to current saved state, marking it as clean
        reset({ ...data });
      } else {
        toast.error("User ID not found. Cannot save profile.");
      }
    } catch (error) {
      console.error("Failed to update profile:", error);
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred.";
      toast.error("Failed to update profile.", {
        description: errorMessage,
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Render skeletal loading state for Clerk
  if (!isClerkLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
        <div className="flex flex-col items-center gap-6">
          <Loader2 className="mb-4 h-16 w-16 animate-spin text-primary" />
          <p className="text-xl font-medium text-muted-foreground">
            Loading authentication...
          </p>
          <Skeleton className="h-[600px] w-full max-w-lg rounded-xl shadow-lg-soft" />
        </div>
      </div>
    );
  }

  // Render authentication required state
  if (!isSignedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
        <Card className="w-full max-w-md p-6 text-center shadow-lg-soft">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-primary">
              Authentication Required
            </CardTitle>
            <CardDescription className="text-base text-muted-foreground">
              Please sign in to view and edit your profile.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <Link href="/" className="inline-block">
              <Button className="w-full min-w-[150px] shadow-soft transition-all duration-200 hover:scale-[1.02]">
                Go to Sign In
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render skeletal loading state for Convex user data
  if (!convexUser && isSignedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
        <div className="flex flex-col items-center gap-6">
          <Loader2 className="mb-4 h-16 w-16 animate-spin text-primary" />
          <p className="text-xl font-medium text-muted-foreground">
            Loading your profile data...
          </p>
          <div className="w-96 space-y-4">
            <Skeleton className="h-32 w-32 rounded-full" />
            <Skeleton className="h-8 w-64 rounded-md" />
            <Skeleton className="h-6 w-48 rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-24 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
        </div>
      </div>
    );
  }

  const isUsernameValidationLoading =
    isEditing &&
    watchedUsername.length >= 3 &&
    watchedUsername !== convexUser?.username &&
    checkUsernameAvailability === undefined;

  const isSaveDisabled =
    isSaving ||
    !isDirty || // Disable if no changes
    !isValid || // Disable if form has validation errors
    (watchedUsername !== convexUser!.username &&
      checkUsernameAvailability === false) || // Disable if username is taken
    isUsernameValidationLoading; // Disable if username availability is still checking

  return (
    <div className="flex min-h-screen flex-col items-center bg-background p-4 text-foreground">
      <Card className="container mx-auto m-8 w-full max-w-lg p-6 shadow-lg-soft sm:p-8">
        <CardHeader className="mb-6 flex flex-row items-center justify-between px-0 py-0 sm:mb-8">
          {/* {!isEditing && (
            <Link href="/home" className="flex-shrink-0">
              <Button
                variant="ghost"
                className="group text-muted-foreground transition-colors duration-200 hover:bg-accent hover:text-foreground"
              >
                <ArrowLeft className="mr-2 h-5 w-5 transition-transform duration-200 group-hover:-translate-x-1" />{" "}
                Back to Home
              </Button>
            </Link>
          )} */}
          <CardTitle
            className={`flex-grow text-center text-4xl font-extrabold text-primary sm:text-5xl ${
              isEditing ? "sm:ml-auto" : "" // Center title when editing, if no back button
            }`}
          >
            My Profile
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-8 p-0">
          {/* Avatar and Display Info */}
          <div className="flex flex-col items-center gap-6 py-4">
            <Avatar className="h-36 w-36 overflow-hidden rounded-full border-4 border-primary shadow-lg-soft sm:h-40 sm:w-40">
              <AvatarImage
                src={watchedProfilePictureUrl || clerkUser?.imageUrl || undefined}
                alt={watchedUsername ?? "User Avatar"}
                className="h-full w-full object-cover"
              />
              <AvatarFallback className="flex h-full w-full items-center justify-center bg-primary text-6xl font-bold text-primary-foreground">
                {(getValues("displayName") ?? getValues("username") ?? "U")
                  .charAt(0)
                  .toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="text-center">
              <h3 className="text-3xl font-bold text-foreground">
                {getValues("displayName") ||
                  getValues("username") ||
                  "Set Your Name"}
              </h3>
              <p className="text-xl text-muted-foreground">
                @{getValues("username") || "username_needed"}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Username Input */}
            <div className="space-y-2">
              <Label htmlFor="username" className="flex items-center gap-2">
                <User className="h-5 w-5 text-muted-foreground" /> Username
                {isEditing && errors.username && (
                  <span className="ml-2 flex items-center text-sm font-medium text-destructive">
                    <XCircle className="mr-1 h-4 w-4" />
                    {errors.username.message}
                  </span>
                )}
                {isEditing && isUsernameValidationLoading && (
                  <span className="ml-2 flex items-center text-sm font-medium text-muted-foreground">
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" /> Checking...
                  </span>
                )}
                {isEditing &&
                  watchedUsername &&
                  watchedUsername.length >= 3 &&
                  watchedUsername !== convexUser!.username &&
                  checkUsernameAvailability === true &&
                  !errors.username && (
                    <span className="ml-2 flex items-center text-sm font-medium text-primary">
                      <CheckCircle className="mr-1 h-4 w-4" /> Available!
                    </span>
                  )}
              </Label>
              <Input
                id="username"
                {...register("username")}
                placeholder="Unique username"
                readOnly={!isEditing}
                className={`rounded-lg px-4 py-2 text-base shadow-inset-soft transition-all duration-200 ${
                  errors.username
                    ? "border-destructive focus-visible:ring-destructive"
                    : "focus:border-primary focus:ring-1 focus:ring-primary"
                }`}
                autoComplete="off"
              />
            </div>

            {/* Display Name Input */}
            <div className="space-y-2">
              <Label htmlFor="displayName" className="flex items-center gap-2">
                <User className="h-5 w-5 text-muted-foreground" /> Display Name
                (Optional)
              </Label>
              <Input
                id="displayName"
                {...register("displayName")}
                placeholder="Your display name"
                readOnly={!isEditing}
                className={`rounded-lg px-4 py-2 text-base shadow-inset-soft transition-all duration-200 ${
                  errors.displayName
                    ? "border-destructive focus-visible:ring-destructive"
                    : "focus:border-primary focus:ring-1 focus:ring-primary"
                }`}
              />
            </div>

            {/* Bio Textarea */}
            <div className="space-y-2">
              <Label htmlFor="bio" className="flex items-center gap-2">
                <BookOpenText className="h-5 w-5 text-muted-foreground" /> Bio
                (Optional)
              </Label>
              <Textarea
                id="bio"
                {...register("bio")}
                placeholder="Tell us about yourself..."
                readOnly={!isEditing}
                rows={4}
                className={`rounded-lg px-4 py-2 text-base shadow-inset-soft transition-all duration-200 resize-none ${
                  errors.bio
                    ? "border-destructive focus-visible:ring-destructive"
                    : "focus:border-primary focus:ring-1 focus:ring-primary"
                }`}
              />
              {isEditing && errors.bio && (
                <p className="mt-1 flex items-center text-sm font-medium text-destructive">
                  <XCircle className="mr-1 h-4 w-4" />
                  {errors.bio.message}
                </p>
              )}
            </div>

            {/* Profile Picture URL Input */}
            <div className="space-y-2">
              <Label
                htmlFor="profilePictureUrl"
                className="flex items-center gap-2"
              >
                <ImageIcon className="h-5 w-5 text-muted-foreground" /> Profile
                Picture URL (Optional)
              </Label>
              <Input
                id="profilePictureUrl"
                {...register("profilePictureUrl")}
                placeholder="https://example.com/your-image.jpg"
                readOnly={!isEditing}
                className={`rounded-lg px-4 py-2 text-base shadow-inset-soft transition-all duration-200 ${
                  errors.profilePictureUrl
                    ? "border-destructive focus-visible:ring-destructive"
                    : "focus:border-primary focus:ring-1 focus:ring-primary"
                }`}
                type="url"
              />
              {isEditing && errors.profilePictureUrl && (
                <p className="mt-1 flex items-center text-sm font-medium text-destructive">
                  <XCircle className="mr-1 h-4 w-4" />
                  {errors.profilePictureUrl.message}
                </p>
              )}
            </div>

            {/* Action Buttons (Save/Cancel) */}
            {!isEditing ? (
              <div className="flex flex-col gap-4 sm:flex-row">
                <Button
                  type="submit"
                  className="flex-1 rounded-full px-6 py-3 text-lg font-semibold shadow-primary transition-all duration-200 hover:scale-[1.01] disabled:pointer-events-none disabled:opacity-60"
                  onClick={() => setIsEditing(true)}
                >
                  <Pencil className="mr-2 h-5 w-5" /> Edit
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-4 sm:flex-row">
                <Button
                  type="submit"
                  disabled={isSaveDisabled}
                  className="flex-1 rounded-full px-6 py-3 text-lg font-semibold shadow-primary transition-all duration-200 hover:scale-[1.01] disabled:pointer-events-none disabled:opacity-60"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-5 w-5" /> Save Changes
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditing(false);
                    reset({
                      username: convexUser!.username ?? "",
                      displayName: convexUser!.displayName ?? null,
                      bio: convexUser!.bio ?? null,
                      profilePictureUrl: convexUser!.profilePictureUrl ?? null,
                    });
                    clearErrors();
                    toast.info("Profile changes discarded.");
                  }}
                  disabled={isSaving}
                  className="flex-1 rounded-full px-6 py-3 text-lg font-semibold shadow-soft transition-all duration-200 hover:scale-[1.01]"
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