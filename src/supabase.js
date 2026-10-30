import { createClient } from "@supabase/supabase-js";

// Vite injects environment variables at BUILD/START time.
// Prefer VITE_ (the native Vite convention), while retaining compatibility
// with existing NEXT_PUBLIC_ deployments.
const env = import.meta.env || {};

const url = (
  env.VITE_SUPABASE_URL ||
  env.NEXT_PUBLIC_SUPABASE_URL ||
  ""
).trim();

const key = (
  env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  ""
).trim();

export const supabaseConfigStatus = {
  hasUrl: Boolean(url),
  hasPublishableKey: Boolean(key),
  urlLooksValid: /^https:\/\//i.test(url),
};

export const supabaseConfigured =
  supabaseConfigStatus.hasUrl &&
  supabaseConfigStatus.hasPublishableKey &&
  supabaseConfigStatus.urlLooksValid;

if (!supabaseConfigured) {
  // Deliberately log variable names/status only, never the key itself.
  console.error("[SAT R&R] Supabase configuration is incomplete.", {
    VITE_SUPABASE_URL: supabaseConfigStatus.hasUrl,
    VITE_SUPABASE_PUBLISHABLE_KEY: supabaseConfigStatus.hasPublishableKey,
    urlLooksValid: supabaseConfigStatus.urlLooksValid,
  });
}

export const supabase = supabaseConfigured
  ? createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
