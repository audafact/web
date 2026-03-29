import { supabase } from "./supabase";

const FEEDBACK_TYPES = ["Bug", "Feature", "UX", "Question", "Other"] as const;
export type FeedbackNotionType = (typeof FEEDBACK_TYPES)[number];

export async function getFeedbackAuthHeaders(): Promise<HeadersInit> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token ?? supabaseAnonKey;
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export async function submitContactForm(payload: {
  name: string;
  email: string;
  subject: string;
  message: string;
  inquiryType: string;
  turnstileToken: string;
}): Promise<{ ok: boolean; error?: string }> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const res = await fetch(`${supabaseUrl}/functions/v1/feedback-submission`, {
    method: "POST",
    headers: await getFeedbackAuthHeaders(),
    body: JSON.stringify({
      kind: "contact",
      turnstileToken: payload.turnstileToken,
      name: payload.name,
      email: payload.email,
      subject: payload.subject,
      message: payload.message,
      inquiryType: payload.inquiryType,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: (data as { error?: string }).error || "Request failed" };
  }
  return { ok: true };
}

export async function submitStudioFeedback(payload: {
  title?: string;
  message: string;
  type: FeedbackNotionType;
  turnstileToken?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const res = await fetch(`${supabaseUrl}/functions/v1/feedback-submission`, {
    method: "POST",
    headers: await getFeedbackAuthHeaders(),
    body: JSON.stringify({
      kind: "feedback",
      title: payload.title,
      message: payload.message,
      type: payload.type,
      turnstileToken: payload.turnstileToken,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: (data as { error?: string }).error || "Request failed" };
  }
  return { ok: true };
}
