import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseConfigured = Boolean(url && key);

export const supabase = createClient(url ?? 'http://localhost:54321', key ?? 'missing-key', {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'nomi-auth' },
});

let sessionPromise: Promise<void> | null = null;

/** Nobody signs in: each device gets an invisible anonymous Supabase session. */
export function ensureSession(): Promise<void> {
  sessionPromise ??= (async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) return;
    const { error } = await supabase.auth.signInAnonymously();
    if (error) {
      sessionPromise = null;
      throw new Error(
        error.message.includes('disabled')
          ? 'Anonymous sign-ins are disabled in Supabase (Authentication → Providers → Anonymous).'
          : /fetch/i.test(error.message) ? 'Can’t reach the server. Check your connection.' : error.message,
      );
    }
  })();
  return sessionPromise;
}
