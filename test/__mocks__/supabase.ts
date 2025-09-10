import { vi } from "vitest";

export const supabase = {
  auth: {
    getSession: vi.fn().mockResolvedValue({
      data: {
        session: {
          access_token: "test-token",
          user: { id: "test-user-id" },
        },
      },
      error: null,
    }),
    onAuthStateChange: vi.fn().mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    }),
  },
  from: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    }),
  }),
};
