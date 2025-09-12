import { useState, useEffect, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../services/supabase";
import {
  UserTier,
  FeatureAccess,
  UsageLimits,
  LibraryTrack,
} from "../types/music";
import {
  LibraryService,
  DatabaseLibraryTrack,
} from "../services/libraryService";

// Tier configurations as specified in PRD 2
const GUEST_FEATURES: FeatureAccess = {
  canUpload: false,
  canSaveSession: false,
  canRecord: false,
  canDownload: false,
  canEditCues: false,
  canEditLoops: false,
  canBrowseLibrary: true, // View only
  canAccessProTracks: false,
};

const FREE_FEATURES: FeatureAccess = {
  canUpload: true,
  canSaveSession: true,
  canRecord: true,
  canDownload: false,
  canEditCues: true,
  canEditLoops: true,
  canBrowseLibrary: true,
  canAccessProTracks: false,
};

const PRO_FEATURES: FeatureAccess = {
  canUpload: true,
  canSaveSession: true,
  canRecord: true,
  canDownload: true,
  canEditCues: true,
  canEditLoops: true,
  canBrowseLibrary: true,
  canAccessProTracks: true,
};

const GUEST_LIMITS: UsageLimits = {
  maxUploads: 0,
  maxSessions: 0,
  maxRecordings: 0,
  maxLibraryTracks: 10,
};

const FREE_LIMITS: UsageLimits = {
  maxUploads: 3,
  maxSessions: 2,
  maxRecordings: 1,
  maxLibraryTracks: 10,
};

const PRO_LIMITS: UsageLimits = {
  maxUploads: Infinity,
  maxSessions: Infinity,
  maxRecordings: Infinity,
  maxLibraryTracks: Infinity,
};

export const useUser = () => {
  const { user } = useAuth();
  const [accessTier, setAccessTier] = useState<"free" | "pro" | null>(null);
  const [libraryTracks, setLibraryTracks] = useState<LibraryTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) {
        setAccessTier(null);
        setLibraryTracks([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Fetch user tier
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("access_tier")
          .eq("id", user.id)
          .single();

        if (userError) {
          console.error("❌ Error fetching user tier:", userError);
          setError(userError.message);
          setAccessTier("free");
        } else {
          const tier = userData?.access_tier || "free";
          setAccessTier(tier);

          // Fetch library tracks if user has access
          if (tier === "free" || tier === "pro") {
            const { data: tracksData, error: tracksError } = await supabase.rpc(
              "get_user_tracks",
              {
                user_id: user.id,
              }
            );

            if (tracksError) {
              console.error("❌ Error fetching library tracks:", tracksError);
            } else {
              // Transform tracks using LibraryService
              const transformedTracks = LibraryService.transformDatabaseTracks(
                (tracksData ?? []) as DatabaseLibraryTrack[]
              );
              setLibraryTracks(transformedTracks);
            }
          }
        }
      } catch (err) {
        console.error("❌ Exception fetching user data:", err);
        setError("Failed to fetch user data");
        setAccessTier("free");
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [user?.id]); // Only depend on user.id, not the entire user object

  const tier = useMemo((): UserTier => {
    if (!user) {
      return {
        id: "guest",
        name: "Guest",
        features: GUEST_FEATURES,
        limits: GUEST_LIMITS,
      };
    }

    if (accessTier === "pro") {
      return {
        id: "pro",
        name: "Pro Creator",
        features: PRO_FEATURES,
        limits: PRO_LIMITS,
      };
    }

    return {
      id: "free",
      name: "Free User",
      features: FREE_FEATURES,
      limits: FREE_LIMITS,
    };
  }, [user, accessTier]);

  return {
    user,
    tier,
    libraryTracks,
    isGuest: tier.id === "guest",
    isFree: tier.id === "free",
    isPro: tier.id === "pro",
    features: tier.features,
    limits: tier.limits,
    loading,
    error,
  };
};
