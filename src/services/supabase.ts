import { createClient } from "@supabase/supabase-js";

// Use environment variables or fallback to development values
const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || "https://your-project.supabase.co";
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY || "your-anon-key";

// Only throw error in production
if (import.meta.env.PROD && (!supabaseUrl || !supabaseAnonKey)) {
  throw new Error("Missing Supabase environment variables");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
