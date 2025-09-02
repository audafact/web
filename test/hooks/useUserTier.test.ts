import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useUser } from "../../src/hooks/useUser";

// Mock the AuthContext
vi.mock("../../src/context/AuthContext", () => ({
  useAuth: vi.fn(),
}));

// Mock supabase
vi.mock("../../src/services/supabase", () => ({
  supabase: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(),
  },
}));

import { useAuth } from "../../src/context/AuthContext";
import { supabase } from "../../src/services/supabase";

describe("useUser", () => {
  const mockUseAuth = useAuth as ReturnType<typeof vi.fn>;
  const mockSupabase = supabase as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return guest tier for anonymous users", async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      signIn: vi.fn(),
      signOut: vi.fn(),
      loading: false,
    });

    const { result } = renderHook(() => useUser());

    // Wait for the effect to complete
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(result.current.tier.id).toBe("guest");
    expect(result.current.isGuest).toBe(true);
    expect(result.current.isFree).toBe(false);
    expect(result.current.isPro).toBe(false);
    expect(result.current.tier.name).toBe("Guest");
    expect(result.current.features.canUpload).toBe(false);
    expect(result.current.features.canBrowseLibrary).toBe(true);
  });

  it("should return pro tier for pro users", async () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: "123",
        email: "test@example.com",
      },
      signIn: vi.fn(),
      signOut: vi.fn(),
      loading: false,
    });

    mockSupabase.single.mockResolvedValue({
      data: { access_tier: "pro" },
      error: null,
    });

    const { result } = renderHook(() => useUser());

    // Wait for the effect to complete
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(result.current.tier.id).toBe("pro");
    expect(result.current.isGuest).toBe(false);
    expect(result.current.isFree).toBe(false);
    expect(result.current.isPro).toBe(true);
    expect(result.current.tier.name).toBe("Pro Creator");
    expect(result.current.features.canUpload).toBe(true);
    expect(result.current.features.canRecord).toBe(true);
    expect(result.current.features.canDownload).toBe(true);
    expect(result.current.limits.maxUploads).toBe(Infinity);
  });

  it("should return free tier for free users", async () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: "123",
        email: "test@example.com",
      },
      signIn: vi.fn(),
      signOut: vi.fn(),
      loading: false,
    });

    mockSupabase.single.mockResolvedValue({
      data: { access_tier: "free" },
      error: null,
    });

    const { result } = renderHook(() => useUser());

    // Wait for the effect to complete
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(result.current.tier.id).toBe("free");
    expect(result.current.isGuest).toBe(false);
    expect(result.current.isFree).toBe(true);
    expect(result.current.isPro).toBe(false);
    expect(result.current.tier.name).toBe("Free User");
    expect(result.current.features.canUpload).toBe(true);
    expect(result.current.features.canRecord).toBe(false);
    expect(result.current.features.canDownload).toBe(false);
    expect(result.current.limits.maxUploads).toBe(3);
  });

  it("should return free tier when access_tier is null", async () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: "123",
        email: "test@example.com",
      },
      signIn: vi.fn(),
      signOut: vi.fn(),
      loading: false,
    });

    mockSupabase.single.mockResolvedValue({
      data: { access_tier: null },
      error: null,
    });

    const { result } = renderHook(() => useUser());

    // Wait for the effect to complete
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(result.current.tier.id).toBe("free");
    expect(result.current.isFree).toBe(true);
  });

  it("should handle database errors gracefully", async () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: "123",
        email: "test@example.com",
      },
      signIn: vi.fn(),
      signOut: vi.fn(),
      loading: false,
    });

    mockSupabase.single.mockResolvedValue({
      data: null,
      error: { message: "Database error" },
    });

    const { result } = renderHook(() => useUser());

    // Wait for the effect to complete
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(result.current.tier.id).toBe("free");
    expect(result.current.error).toBe("Database error");
  });
});
