import { createClient } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL     || 'https://cvbjoexzfwesgiapdcve.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2YmpvZXh6Zndlc2dpYXBkY3ZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NjY2NzgsImV4cCI6MjA5MDM0MjY3OH0.SOhCZuFLN5iowxGyed3c3nN7qPaIRnQNth3UCSVt0-k';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // PKCE flow is required for native apps (Android/iOS) to securely
    // exchange the code returned by the deep link back to a session.
    // On web it falls back gracefully.
    flowType: 'pkce',

    // Let Supabase auto-detect the session from URL params / hash on load.
    detectSessionInUrl: true,

    // Persist session in localStorage (works in both web & Capacitor WebView)
    persistSession: true,
    storage: window.localStorage,
  },
});
