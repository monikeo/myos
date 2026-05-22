import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.warn(
    "[MyOS] WARNING: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set. " +
    "Database features will be unavailable. See .env.example for setup instructions."
  );
}

// Server-side client — uses service role key (full access, bypass RLS)
export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseServiceRoleKey || "placeholder-key",
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);
