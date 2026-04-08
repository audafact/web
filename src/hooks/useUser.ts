import { useState, useEffect, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../services/supabase";
import type { UserTier, LibraryTrack } from "../types/music";
import {
  GUEST_FEATURES,
  GUEST_LIMITS,
  FREE_FEATURES,
  FREE_LIMITS,
  STARTER_FEATURES,
  STARTER_LIMITS,
  PRO_FEATURES,
  PRO_LIMITS,
  getLibraryCatalogBannerText,
  LIBRARY_TIER_VISIBLE_CAPS,
} from "../config/tierConfig";
import {
  LibraryService,
  DatabaseLibraryTrack,
} from "../services/libraryService";
import {
  CRISTIAN_SIGLER_DEMO_COLLECTION_KEY,
  isDemoLibraryAccount,
} from "../config/demoLibrary";

type ResolvedTier = "free" | "starter" | "pro";

export const useUser = () => {
  const { user } = useAuth();
  const [accessTier, setAccessTier] = useState<ResolvedTier | null>(null);
  const [libraryTracks, setLibraryTracks] = useState<LibraryTrack[]>([]);
  const [demoCollectionTracks, setDemoCollectionTracks] = useState<
    LibraryTrack[]
  >([]);
  const [demoCollectionLoading, setDemoCollectionLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) {
        setAccessTier(null);
        setLibraryTracks([]);
        setDemoCollectionTracks([]);
        setDemoCollectionLoading(false);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        setDemoCollectionTracks([]);

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
          const raw = (userData?.access_tier || "free").toLowerCase();
          const tier: ResolvedTier =
            raw === "starter"
              ? "starter"
              : raw === "pro" || raw === "enterprise"
                ? "pro"
                : "free";
          setAccessTier(tier);

          if (tier === "free" || tier === "starter" || tier === "pro") {
            const { data: tracksData, error: tracksError } = await supabase.rpc(
              "get_user_tracks",
              { user_id: user.id }
            );

            if (tracksError) {
              console.error("❌ Error fetching library tracks:", tracksError);
            } else {
              const transformedTracks = LibraryService.transformDatabaseTracks(
                (tracksData ?? []) as DatabaseLibraryTrack[]
              );
              setLibraryTracks(transformedTracks);
            }
          }
        }

        if (isDemoLibraryAccount(user.email)) {
          try {
            setDemoCollectionLoading(true);
            const { data: demoData, error: demoErr } = await supabase.rpc(
              "get_demo_collection_tracks",
              { p_slug: CRISTIAN_SIGLER_DEMO_COLLECTION_KEY }
            );
            if (demoErr) {
              console.error("❌ Error fetching demo collection tracks:", demoErr);
              setDemoCollectionTracks([]);
            } else {
              setDemoCollectionTracks(
                LibraryService.transformDatabaseTracks(
                  (demoData ?? []) as DatabaseLibraryTrack[]
                )
              );
            }
          } finally {
            setDemoCollectionLoading(false);
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
  }, [user?.id, user?.email]);

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
        name: "Pro",
        features: PRO_FEATURES,
        limits: PRO_LIMITS,
      };
    }

    if (accessTier === "starter") {
      return {
        id: "starter",
        name: "Starter",
        features: STARTER_FEATURES,
        limits: STARTER_LIMITS,
      };
    }

    return {
      id: "free",
      name: "Free",
      features: FREE_FEATURES,
      limits: FREE_LIMITS,
    };
  }, [user, accessTier]);

  const libraryCatalogBanner = useMemo(
    () =>
      getLibraryCatalogBannerText({
        tierId: tier.id,
        tierName: tier.name,
        visibleCount:
          tier.id === "guest"
            ? LIBRARY_TIER_VISIBLE_CAPS.guest
            : libraryTracks.length,
      }),
    [tier.id, tier.name, libraryTracks.length]
  );

  return {
    user,
    tier,
    /** @deprecated use `tier.id`; kept for hooks that still read `userTier` */
    userTier: tier.id,
    libraryTracks,
    demoCollectionTracks,
    demoCollectionLoading,
    libraryCatalogBanner,
    isGuest: tier.id === "guest",
    isFree: tier.id === "free",
    isStarter: tier.id === "starter",
    isPro: tier.id === "pro",
    features: tier.features,
    limits: tier.limits,
    loading,
    error,
  };
};
