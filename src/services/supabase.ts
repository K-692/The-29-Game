import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Environment variables for Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  !supabaseUrl.includes('placeholder') &&
  !supabaseAnonKey.includes('placeholder')
);

export let supabase: SupabaseClient | null = null;

if (isSupabaseConfigured) {
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
  } catch (err) {
    console.warn('Supabase initialization failed, falling back to local multiplayer relay:', err);
    supabase = null;
  }
}

/**
 * Guest Player Identity Management (Persistent in localStorage)
 */
export interface LocalUserProfile {
  id: string;
  name: string;
  avatarSeed: string;
}

const STORAGE_KEY_USER = 'twenty_nine_user_profile';

export const getOrCreateUserProfile = (customName?: string): LocalUserProfile => {
  if (typeof window === 'undefined') {
    return { id: 'player_server', name: customName || 'Player', avatarSeed: 'seed_1' };
  }

  const stored = localStorage.getItem(STORAGE_KEY_USER);
  if (stored) {
    try {
      const parsed: LocalUserProfile = JSON.parse(stored);
      if (customName && customName.trim() && parsed.name !== customName.trim()) {
        parsed.name = customName.trim();
        localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(parsed));
      }
      return parsed;
    } catch {
      // Fall through to regenerate
    }
  }

  const generated: LocalUserProfile = {
    id: `guest_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    name: customName?.trim() || `Player ${Math.floor(1000 + Math.random() * 9000)}`,
    avatarSeed: Math.random().toString(36).substring(2, 7),
  };

  localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(generated));
  return generated;
};

export const updateUserProfileName = (newName: string): LocalUserProfile => {
  const current = getOrCreateUserProfile();
  current.name = newName.trim() || current.name;
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(current));
  }
  return current;
};

