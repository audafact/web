import { useState, useEffect, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../services/supabase";
import { UserTier, FeatureAccess, UsageLimits } from "../types/music";

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

export const useUserTier = () => {
  const { user } = useAuth();
  const [accessTier, setAccessTier] = useState<"free" | "pro" | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {

    const fetchUserTier = async () => {
      if (!user) {

        setAccessTier(null);
        setLoading(false);
        return;
      }

      try {

        setLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from("users")
          .select("access_tier")
          .eq("id", user.id)
          .single();

        if (fetchError) {
          console.error("❌ Error fetching user tier:", fetchError);
          setError(fetchError.message);
          setAccessTier("free");
        } else {
          setAccessTier(data?.access_tier || "free");
        }
      } catch (err) {
        console.error("❌ Exception fetching user tier:", err);
        setError("Failed to fetch user tier");
        setAccessTier("free");
      } finally {
        setLoading(false);
      }
    };

    fetchUserTier();
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
    tier,
    isGuest: tier.id === "guest",
    isFree: tier.id === "free",
    isPro: tier.id === "pro",
    features: tier.features,
    limits: tier.limits,
    loading,
    error,
  };
};
