import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../context/AuthContext";
import {
  submitStudioFeedback,
  type FeedbackNotionType,
} from "../services/feedbackSubmissionService";

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  isPro: boolean;
  isStarter: boolean;
}

const TYPES: { value: FeedbackNotionType; label: string }[] = [
  { value: "Bug", label: "Bug" },
  { value: "Feature", label: "Feature" },
  { value: "UX", label: "UX" },
  { value: "Question", label: "Question" },
  { value: "Other", label: "Other" },
];

const FeedbackModal: React.FC<FeedbackModalProps> = ({
  isOpen,
  onClose,
  isPro,
  isStarter,
}) => {
  const { user } = useAuth();
  const needsCaptcha = !user;
  const turnstileRef = useRef<HTMLDivElement>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [type, setType] = useState<FeedbackNotionType>("Other");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setCaptchaToken(null);
      setStatus("idle");
      setErrorMsg(null);
      setTitle("");
      setMessage("");
      setType("Other");
      return;
    }

    if (!needsCaptcha || !turnstileRef.current) return;

    const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
    if (!turnstileSiteKey) return;

    turnstileRef.current.innerHTML = "";
    const widgetId = window.turnstile?.render(turnstileRef.current, {
      sitekey: turnstileSiteKey,
      callback: (token: string) => setCaptchaToken(token),
      "error-callback": () => setCaptchaToken(null),
      "expired-callback": () => setCaptchaToken(null),
      "timeout-callback": () => setCaptchaToken(null),
    });

    return () => {
      if (widgetId && window.turnstile) {
        window.turnstile.remove(widgetId);
      }
    };
  }, [isOpen, needsCaptcha]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      setErrorMsg("Please enter a message.");
      return;
    }
    if (needsCaptcha && !captchaToken) {
      setErrorMsg("Please complete the security check.");
      return;
    }

    setSubmitting(true);
    setStatus("idle");
    setErrorMsg(null);

    const result = await submitStudioFeedback({
      title: title.trim() || undefined,
      message: message.trim(),
      type,
      turnstileToken: needsCaptcha ? captchaToken ?? undefined : undefined,
    });

    setSubmitting(false);
    if (result.ok) {
      setStatus("success");
    } else {
      setStatus("error");
      setErrorMsg(result.error || "Something went wrong.");
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
        aria-hidden
      />
      <div
        className="relative bg-audafact-surface-1 border border-audafact-divider rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-labelledby="feedback-modal-title"
      >
        <div className="flex items-center justify-between p-6 border-b border-audafact-divider">
          <h2
            id="feedback-modal-title"
            className="text-xl font-medium text-audafact-text-primary"
          >
            {isPro ? "Priority feedback" : "Send feedback"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-audafact-text-secondary hover:text-audafact-text-primary transition-colors"
            aria-label="Close"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4">
          {isPro ? (
            <p className="text-sm text-audafact-text-secondary leading-relaxed">
              Direct line to the builder — we aim to provide a response within{" "}
              <span className="text-audafact-text-primary font-medium">
                24 hours
              </span>
              . You can also email{" "}
              <a
                href="mailto:david@audafact.com?subject=Audafact%20priority%20feedback"
                className="text-audafact-accent-cyan hover:underline"
              >
                david@audafact.com
              </a>
              .
            </p>
          ) : isStarter ? (
            <p className="text-sm text-audafact-text-secondary leading-relaxed">
              Starter: we prioritize your feedback over free accounts and aim to
              provide a response within a few business days. We value
              everyone&apos;s feedback, but we need to prioritize responses from
              Pro members when time is limited. General email:{" "}
              <a
                href="mailto:hello@audafact.com"
                className="text-audafact-accent-cyan hover:underline"
              >
                hello@audafact.com
              </a>
              .
            </p>
          ) : (
            <p className="text-sm text-audafact-text-secondary leading-relaxed">
              We read every message. There&apos;s no guaranteed response time for
              free accounts — upgrade to Pro for priority handling. General email:{" "}
              <a
                href="mailto:hello@audafact.com"
                className="text-audafact-accent-cyan hover:underline"
              >
                hello@audafact.com
              </a>
              .
            </p>
          )}

          {status === "success" ? (
            <div className="text-center py-6">
              <p className="text-audafact-text-primary text-lg font-medium">
                Thanks — your feedback was sent.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-6 px-4 py-2 bg-audafact-surface-2 text-audafact-text-primary rounded hover:bg-audafact-surface-3 transition-colors"
              >
                Close
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="fb-type"
                  className="block text-sm text-audafact-text-secondary mb-1"
                >
                  Type
                </label>
                <select
                  id="fb-type"
                  value={type}
                  onChange={(e) =>
                    setType(e.target.value as FeedbackNotionType)
                  }
                  className="w-full px-3 py-2 bg-audafact-bg-primary border border-audafact-divider rounded text-audafact-text-primary text-sm focus:outline-none focus:ring-1 focus:ring-audafact-accent-cyan"
                >
                  {TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="fb-title"
                  className="block text-sm text-audafact-text-secondary mb-1"
                >
                  Short summary (optional)
                </label>
                <input
                  id="fb-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-audafact-bg-primary border border-audafact-divider rounded text-audafact-text-primary text-sm focus:outline-none focus:ring-1 focus:ring-audafact-accent-cyan"
                  placeholder="One line"
                />
              </div>
              <div>
                <label
                  htmlFor="fb-message"
                  className="block text-sm text-audafact-text-secondary mb-1"
                >
                  Message *
                </label>
                <textarea
                  id="fb-message"
                  required
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full px-3 py-2 bg-audafact-bg-primary border border-audafact-divider rounded text-audafact-text-primary text-sm focus:outline-none focus:ring-1 focus:ring-audafact-accent-cyan resize-none"
                  placeholder="What happened? What would help?"
                />
              </div>

              {needsCaptcha && (
                <div className="flex justify-center">
                  <div ref={turnstileRef} />
                </div>
              )}

              {status === "error" && errorMsg && (
                <p className="text-sm text-red-400">{errorMsg}</p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm bg-audafact-surface-2 text-audafact-text-primary rounded hover:bg-audafact-surface-3 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm bg-audafact-accent-cyan text-white rounded hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {submitting ? "Sending…" : "Send"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default FeedbackModal;
