// Supabase client used only for authentication (sign in/up/out, session).
//
// Configure via a frontend .env (see frontend/.env.example):
//   VITE_SUPABASE_URL       your Supabase project (or self-hosted) URL
//   VITE_SUPABASE_ANON_KEY  the project's anon/public key
//
// These are public, client-side values by design — the anon key is safe to ship
// in the bundle. The backend independently verifies the signed JWT.
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && anonKey);

export const supabase = supabaseConfigured ? createClient(url, anonKey) : null;
