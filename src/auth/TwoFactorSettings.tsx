import React, { useCallback, useEffect, useState } from "react";
import { authService } from "./authService";

type LoadState = "idle" | "loading" | "ready" | "error";

export const TwoFactorSettings: React.FC = () => {
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [listError, setListError] = useState("");
  const [hasTotp, setHasTotp] = useState(false);
  const [factorIdToRemove, setFactorIdToRemove] = useState<string | null>(null);

  const [enrolling, setEnrolling] = useState(false);
  const [pendingFactorId, setPendingFactorId] = useState<string | null>(null);
  const [qrData, setQrData] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [enrollError, setEnrollError] = useState("");
  const [enrollMessage, setEnrollMessage] = useState("");

  const [unenrollLoading, setUnenrollLoading] = useState(false);
  const [unenrollError, setUnenrollError] = useState("");

  const refreshFactors = useCallback(async () => {
    setLoadState("loading");
    setListError("");
    const res = await authService.listMfaFactors();
    if (!res.success || !res.totp) {
      setLoadState("error");
      setListError(res.error ?? "Could not load two-factor status");
      setHasTotp(false);
      return;
    }
    const verified = res.totp.filter((f) => f.status === "verified");
    setHasTotp(verified.length > 0);
    setFactorIdToRemove(verified[0]?.id ?? null);
    setLoadState("ready");
  }, []);

  useEffect(() => {
    void refreshFactors();
  }, [refreshFactors]);

  const startEnroll = async () => {
    setEnrolling(true);
    setEnrollError("");
    setEnrollMessage("");
    setVerifyCode("");
    setQrData(null);
    setSecret(null);
    setPendingFactorId(null);

    const res = await authService.enrollTotpMfa();
    if (!res.success || !res.factorId || !res.qrCode) {
      setEnrollError(res.error ?? "Enrollment failed");
      setEnrolling(false);
      return;
    }
    setPendingFactorId(res.factorId);
    setQrData(res.qrCode);
    setSecret(res.secret ?? null);
    setEnrolling(false);
  };

  const cancelEnroll = () => {
    setPendingFactorId(null);
    setQrData(null);
    setSecret(null);
    setVerifyCode("");
    setEnrollError("");
    setEnrollMessage("");
  };

  const submitVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingFactorId || !verifyCode.trim()) return;

    setEnrolling(true);
    setEnrollError("");
    const res = await authService.completeTotpEnrollment(
      pendingFactorId,
      verifyCode
    );
    setEnrolling(false);

    if (!res.success) {
      setEnrollError(res.error ?? "Verification failed");
      return;
    }

    setPendingFactorId(null);
    setQrData(null);
    setSecret(null);
    setVerifyCode("");
    setEnrollError("");
    setEnrollMessage("Two-factor authentication is enabled.");
    await refreshFactors();
  };

  const confirmUnenroll = async () => {
    if (!factorIdToRemove) return;
    if (
      !window.confirm(
        "Remove authenticator app protection from your account? You can enable it again later."
      )
    ) {
      return;
    }
    setUnenrollLoading(true);
    setUnenrollError("");
    const res = await authService.unenrollMfaFactor(factorIdToRemove);
    setUnenrollLoading(false);
    if (!res.success) {
      setUnenrollError(res.error ?? "Could not remove 2FA");
      return;
    }
    await refreshFactors();
  };

  // supabase-js already prefixes TOTP qr_code with data:image/svg+xml;utf-8,
  const qrSrc =
    qrData &&
    (qrData.startsWith("data:") ? qrData : `data:image/svg+xml;utf-8,${qrData}`);

  return (
    <div className="space-y-4">
      {loadState === "loading" || loadState === "idle" ? (
        <p className="text-sm audafact-text-secondary">Loading security settings…</p>
      ) : null}

      {loadState === "error" ? (
        <p className="text-sm text-audafact-alert-red">{listError}</p>
      ) : null}

      {loadState === "ready" && !pendingFactorId ? (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="font-medium audafact-heading">
              {hasTotp ? "Enabled" : "Not enabled"}
            </p>
            <p className="text-sm audafact-text-secondary">
              {hasTotp
                ? "Your account asks for an authenticator code when you sign in with a password."
                : "Use an authenticator app for codes at sign-in."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {!hasTotp ? (
              <button
                type="button"
                onClick={() => void startEnroll()}
                disabled={enrolling || unenrollLoading}
                className="text-audafact-accent-blue hover:text-opacity-80 text-sm font-medium transition-colors disabled:opacity-50"
              >
                {enrolling ? "Starting…" : "Enable 2FA"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void confirmUnenroll()}
                disabled={unenrollLoading || enrolling}
                className="text-audafact-alert-red hover:text-opacity-80 text-sm font-medium transition-colors disabled:opacity-50"
              >
                {unenrollLoading ? "Removing…" : "Disable 2FA"}
              </button>
            )}
          </div>
        </div>
      ) : null}

      {unenrollError ? (
        <p className="text-sm text-audafact-alert-red">{unenrollError}</p>
    ) : null}

      {pendingFactorId && qrSrc ? (
        <div className="p-4 border border-audafact-divider rounded-lg space-y-4 bg-audafact-surface-2/30">
          <p className="text-sm audafact-text-secondary">
            Scan this QR code with your authenticator app (1Password, Google Authenticator, etc.), then enter the 6-digit code to confirm.
          </p>
          <div className="flex justify-center">
            <img
              src={qrSrc}
              alt="Authenticator QR code"
              className="max-w-[200px] w-full h-auto rounded bg-white p-2"
            />
          </div>
          {secret ? (
            <div>
              <p className="text-xs audafact-text-secondary mb-1">
                If you cannot scan the code, enter this secret manually:
              </p>
              <p className="font-mono text-sm audafact-heading break-all">{secret}</p>
            </div>
          ) : null}

          <form onSubmit={(e) => void submitVerify(e)} className="space-y-3">
            <div>
              <label
                htmlFor="totp-verify"
                className="block text-sm font-medium audafact-text-secondary mb-1"
              >
                Verification code
              </label>
              <input
                id="totp-verify"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={verifyCode}
                onChange={(e) =>
                  setVerifyCode(e.target.value.replace(/\s/g, ""))
                }
                className="w-full px-3 py-2 bg-audafact-surface-2 border border-audafact-divider rounded-lg focus:outline-none focus:ring-2 focus:ring-audafact-accent-cyan text-audafact-text-primary"
                placeholder="000000"
                maxLength={12}
              />
            </div>
            {enrollError ? (
              <p className="text-sm text-audafact-alert-red">{enrollError}</p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={enrolling || verifyCode.trim().length < 6}
                className="audafact-button-primary text-sm py-2 px-4 disabled:opacity-50"
              >
                {enrolling ? "Verifying…" : "Confirm and enable"}
              </button>
              <button
                type="button"
                onClick={cancelEnroll}
                className="text-sm audafact-text-secondary hover:text-audafact-heading px-2"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {enrollMessage ? (
        <p className="text-sm text-audafact-accent-green">{enrollMessage}</p>
      ) : null}
    </div>
  );
};
