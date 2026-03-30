import { describe, it, expect, vi, beforeEach } from "vitest";

const signInWithPassword = vi.fn();
const getAuthenticatorAssuranceLevel = vi.fn();
const listFactors = vi.fn();
const mfaChallenge = vi.fn();
const mfaVerify = vi.fn();
const mfaEnroll = vi.fn();
const mfaChallengeAndVerify = vi.fn();
const mfaUnenroll = vi.fn();

vi.mock("../../src/services/supabase", () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args: unknown[]) => signInWithPassword(...args),
      mfa: {
        getAuthenticatorAssuranceLevel: () =>
          getAuthenticatorAssuranceLevel(),
        listFactors: () => listFactors(),
        challenge: (...args: unknown[]) => mfaChallenge(...args),
        verify: (...args: unknown[]) => mfaVerify(...args),
        enroll: (...args: unknown[]) => mfaEnroll(...args),
        challengeAndVerify: (...args: unknown[]) =>
          mfaChallengeAndVerify(...args),
        unenroll: (...args: unknown[]) => mfaUnenroll(...args),
      },
    },
  },
}));

import { authService } from "../../src/auth/authService";

describe("authService MFA", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockUser = { id: "u1", email: "a@test.com" };

  it("signIn sets mfaRequired when AAL must step up to aal2", async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });
    getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: "aal1", nextLevel: "aal2" },
      error: null,
    });
    listFactors.mockResolvedValue({
      data: {
        totp: [{ id: "factor-1", status: "verified", factor_type: "totp" }],
        phone: [],
        all: [],
      },
      error: null,
    });

    const result = await authService.signIn(
      "a@test.com",
      "secret",
      "captcha"
    );

    expect(result.success).toBe(true);
    expect(result.mfaRequired).toBe(true);
    expect(result.mfaTotpFactorIds).toEqual(["factor-1"]);
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "a@test.com",
      password: "secret",
      options: { captchaToken: "captcha" },
    });
  });

  it("signIn succeeds without mfaRequired when already at aal2", async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });
    getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: "aal2", nextLevel: "aal2" },
      error: null,
    });

    const result = await authService.signIn("a@test.com", "secret");

    expect(result.success).toBe(true);
    expect(result.mfaRequired).toBeFalsy();
    expect(result.user).toEqual(mockUser);
    expect(listFactors).not.toHaveBeenCalled();
  });

  it("verifyMfaLogin returns error when challenge fails", async () => {
    mfaChallenge.mockResolvedValue({
      data: null,
      error: { message: "factor not found" },
    });

    const result = await authService.verifyMfaLogin("bad-factor", "123456");

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/factor not found/);
    expect(mfaVerify).not.toHaveBeenCalled();
  });

  it("verifyMfaLogin returns user when verify succeeds", async () => {
    mfaChallenge.mockResolvedValue({
      data: { id: "ch-1", type: "totp" as const, expires_at: 0 },
      error: null,
    });
    const verifiedUser = { ...mockUser, id: "u2" };
    mfaVerify.mockResolvedValue({
      data: {
        access_token: "a",
        token_type: "bearer",
        expires_in: 3600,
        refresh_token: "r",
        user: verifiedUser,
      },
      error: null,
    });

    const result = await authService.verifyMfaLogin("factor-1", "123456");

    expect(result.success).toBe(true);
    expect(result.user).toEqual(verifiedUser);
    expect(mfaVerify).toHaveBeenCalledWith({
      factorId: "factor-1",
      challengeId: "ch-1",
      code: "123456",
    });
  });

  it("enrollTotpMfa surfaces enroll errors", async () => {
    listFactors.mockResolvedValue({
      data: { all: [], totp: [], phone: [] },
      error: null,
    });
    mfaEnroll.mockResolvedValue({
      data: null,
      error: { message: "MFA not enabled for this project" },
    });

    const result = await authService.enrollTotpMfa();

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/MFA not enabled/);
  });

  it("enrollTotpMfa unenrolls unverified TOTP factors before enrolling", async () => {
    listFactors.mockResolvedValue({
      data: {
        all: [
          {
            id: "pend-1",
            factor_type: "totp" as const,
            status: "unverified" as const,
          },
        ],
        totp: [],
        phone: [],
      },
      error: null,
    });
    mfaUnenroll.mockResolvedValue({ data: { id: "pend-1" }, error: null });
    mfaEnroll.mockResolvedValue({
      data: {
        id: "new-1",
        type: "totp" as const,
        totp: {
          qr_code: "data:image/svg+xml;utf-8,<svg/>",
          secret: "ABC",
          uri: "otpauth://",
        },
      },
      error: null,
    });

    const result = await authService.enrollTotpMfa();

    expect(mfaUnenroll).toHaveBeenCalledWith({ factorId: "pend-1" });
    expect(result.success).toBe(true);
    expect(result.factorId).toBe("new-1");
  });
});
