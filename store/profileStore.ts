// store/profileStore.ts
import { create } from "zustand";
import { supabase } from "@lib/supabase";

export type WeightUnit = "kg" | "lbs";
export type HeightUnit = "cm" | "ft";
export type Sex = "male" | "female";
export type ActivityLevel =
    | "sedentary"
    | "light"
    | "moderate"
    | "active"
    | "very_active";
export type Goal =
    | "lose_weight"
    | "maintain"
    | "build_muscle"
    | "improve_endurance"
    | "stay_healthy";
export type AuthMethod = "password" | "google" | "passkey";

export interface UserProfile {
    id?: string;
    user_id?: string;
    username?: string;
    date_of_birth?: string;
    weight_value?: number;
    weight_unit?: WeightUnit;
    height_value?: number;
    height_unit?: HeightUnit;
    height_inches?: number;
    sex?: Sex;
    preferred_sport?: string;
    activity_level?: ActivityLevel;
    goal?: Goal;
    onboarding_completed?: boolean;
    primary_auth_method?: AuthMethod;
    has_passkey?: boolean;
    avatar_url?: string;
    username_changed_at?: string;
}

interface ProfileState {
    profile: UserProfile | null;
    loading: boolean;
    currentStep: number;
    totalSteps: number;

    // Temporary form data during onboarding
    formData: Partial<UserProfile>;

    // Actions
    setFormField: <K extends keyof UserProfile>(
        key: K,
        value: UserProfile[K],
    ) => void;
    nextStep: () => void;
    prevStep: () => void;
    setStep: (step: number) => void;
    fetchProfile: (userId: string) => Promise<UserProfile | null>;
    saveProfile: (
        userId: string,
    ) => Promise<{ success: boolean; error?: string }>;
    completeOnboarding: (
        userId: string,
    ) => Promise<{ success: boolean; error?: string }>;
    hasCompletedOnboarding: () => boolean;
    reset: () => void;
    updateAuthMethod: (
        userId: string,
        method: AuthMethod,
        hasPasskey?: boolean,
    ) => Promise<{ success: boolean; error?: string }>;
    uploadAvatar: (
        userId: string,
        imageUri: string,
    ) => Promise<{ success: boolean; avatarUrl?: string; error?: string }>;
    checkHasPasskey: (userId: string) => Promise<boolean>;
    deletePasskey: (
        userId: string,
    ) => Promise<{ success: boolean; error?: string }>;
    updateUsername: (
        userId: string,
        username: string,
    ) => Promise<{ success: boolean; error?: string }>;
    canChangeUsername: () => boolean;
}

export const useProfileStore = create<ProfileState>((set, get) => ({
    profile: null,
    loading: false,
    currentStep: 1,
    totalSteps: 8,
    formData: {},

    setFormField: (key, value) => {
        set((state) => ({
            formData: { ...state.formData, [key]: value },
        }));
    },

    nextStep: () => {
        set((state) => ({
            currentStep: Math.min(state.currentStep + 1, state.totalSteps),
        }));
    },

    prevStep: () => {
        set((state) => ({
            currentStep: Math.max(state.currentStep - 1, 1),
        }));
    },

    setStep: (step) => {
        set({ currentStep: step });
    },

    fetchProfile: async (userId: string) => {
        set({ loading: true });

        try {
            const { data, error } = await supabase
                .from("user_profiles")
                .select("*")
                .eq("user_id", userId)
                .single();

            if (error && error.code !== "PGRST116") {
                // PGRST116 = no rows found (expected for new users)
                console.error("Error fetching profile:", error);
                set({ loading: false });
                return null;
            }

            set({ profile: data, loading: false });
            return data;
        } catch (err) {
            console.error("fetchProfile error:", err);
            set({ loading: false });
            return null;
        }
    },

    saveProfile: async (userId: string) => {
        set({ loading: true });

        try {
            const { formData, profile } = get();

            const profileData = {
                user_id: userId,
                ...formData,
            };

            // Upsert profile (insert or update)
            const { error } = await supabase
                .from("user_profiles")
                .upsert(profileData, { onConflict: "user_id" });

            if (error) {
                console.error("Error saving profile:", error);
                set({ loading: false });
                return { success: false, error: error.message };
            }

            // Fetch updated profile
            await get().fetchProfile(userId);

            set({ loading: false });
            return { success: true };
        } catch (err: any) {
            console.error("saveProfile error:", err);
            set({ loading: false });
            return {
                success: false,
                error: err.message || "Failed to save profile",
            };
        }
    },

    completeOnboarding: async (userId: string) => {
        set({ loading: true });

        try {
            const { formData } = get();

            const profileData = {
                user_id: userId,
                ...formData,
                onboarding_completed: true,
            };

            const { error } = await supabase
                .from("user_profiles")
                .upsert(profileData, { onConflict: "user_id" });

            if (error) {
                console.error("Error completing onboarding:", error);
                set({ loading: false });
                return { success: false, error: error.message };
            }

            // Fetch updated profile
            await get().fetchProfile(userId);

            set({ loading: false, currentStep: 1, formData: {} });
            return { success: true };
        } catch (err: any) {
            console.error("completeOnboarding error:", err);
            set({ loading: false });
            return {
                success: false,
                error: err.message || "Failed to complete onboarding",
            };
        }
    },

    hasCompletedOnboarding: () => {
        const { profile } = get();
        return profile?.onboarding_completed === true;
    },

    reset: () => {
        set({
            profile: null,
            currentStep: 1,
            formData: {},
        });
    },

    updateAuthMethod: async (
        userId: string,
        method: AuthMethod,
        hasPasskey?: boolean,
    ) => {
        try {
            const updateData: Partial<UserProfile> = {
                primary_auth_method: method,
            };

            if (hasPasskey !== undefined) {
                updateData.has_passkey = hasPasskey;
            }

            const { error } = await supabase
                .from("user_profiles")
                .update(updateData)
                .eq("user_id", userId);

            if (error) {
                console.error("Error updating auth method:", error);
                return { success: false, error: error.message };
            }

            // Refresh profile
            await get().fetchProfile(userId);
            return { success: true };
        } catch (err: any) {
            console.error("updateAuthMethod error:", err);
            return {
                success: false,
                error: err.message || "Failed to update auth method",
            };
        }
    },

    uploadAvatar: async (userId: string, imageUri: string) => {
        try {
            set({ loading: true });

            // Get file extension
            const fileExt = imageUri.split(".").pop()?.toLowerCase() || "jpg";
            const fileName = `${userId}/avatar_${Date.now()}.${fileExt}`;
            const contentType = fileExt === "png" ? "image/png" : "image/jpeg";

            // Read the image as base64 and convert to ArrayBuffer
            const response = await fetch(imageUri);
            const arrayBuffer = await response.arrayBuffer();

            // Upload to Supabase Storage using ArrayBuffer
            const { data: uploadData, error: uploadError } = await supabase
                .storage
                .from("avatars")
                .upload(fileName, arrayBuffer, {
                    upsert: true,
                    contentType,
                });

            if (uploadError) {
                console.error("Error uploading avatar:", uploadError);
                set({ loading: false });
                return { success: false, error: uploadError.message };
            }

            // Get public URL
            const { data: urlData } = supabase.storage
                .from("avatars")
                .getPublicUrl(fileName);

            const avatarUrl = urlData.publicUrl;

            // Update profile with avatar URL
            const { error: updateError } = await supabase
                .from("user_profiles")
                .update({ avatar_url: avatarUrl })
                .eq("user_id", userId);

            if (updateError) {
                console.error("Error updating avatar URL:", updateError);
                set({ loading: false });
                return { success: false, error: updateError.message };
            }

            // Refresh profile
            await get().fetchProfile(userId);
            set({ loading: false });
            return { success: true, avatarUrl };
        } catch (err: any) {
            console.error("uploadAvatar error:", err);
            set({ loading: false });
            return {
                success: false,
                error: err.message || "Failed to upload avatar",
            };
        }
    },

    checkHasPasskey: async (userId: string) => {
        try {
            const { data, error } = await supabase
                .from("passkey_credentials")
                .select("id")
                .eq("user_id", userId)
                .limit(1);

            if (error) {
                console.error("Error checking passkey:", error);
                return false;
            }

            return data && data.length > 0;
        } catch (err) {
            console.error("checkHasPasskey error:", err);
            return false;
        }
    },

    deletePasskey: async (userId: string) => {
        try {
            const { error } = await supabase
                .from("passkey_credentials")
                .delete()
                .eq("user_id", userId);

            if (error) {
                console.error("Error deleting passkey:", error);
                return { success: false, error: error.message };
            }

            // Update profile to reflect no passkey
            await supabase
                .from("user_profiles")
                .update({ has_passkey: false })
                .eq("user_id", userId);

            // Refresh profile
            await get().fetchProfile(userId);
            return { success: true };
        } catch (err: any) {
            console.error("deletePasskey error:", err);
            return {
                success: false,
                error: err.message || "Failed to delete passkey",
            };
        }
    },

    updateUsername: async (userId: string, username: string) => {
        try {
            set({ loading: true });

            const { error } = await supabase
                .from("user_profiles")
                .update({
                    username,
                    username_changed_at: new Date().toISOString(),
                })
                .eq("user_id", userId);

            if (error) {
                console.error("Error updating username:", error);
                set({ loading: false });
                return { success: false, error: error.message };
            }

            // Refresh profile
            await get().fetchProfile(userId);
            set({ loading: false });
            return { success: true };
        } catch (err: any) {
            console.error("updateUsername error:", err);
            set({ loading: false });
            return {
                success: false,
                error: err.message || "Failed to update username",
            };
        }
    },

    canChangeUsername: () => {
        const { profile } = get();
        if (!profile?.username_changed_at) return true;

        const lastChanged = new Date(profile.username_changed_at);
        const now = new Date();
        const daysSinceChange = (now.getTime() - lastChanged.getTime()) /
            (1000 * 60 * 60 * 24);

        return daysSinceChange >= 7; // Can change after 7 days
    },
}));
