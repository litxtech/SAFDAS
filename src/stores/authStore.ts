import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';

export type Profile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  username: string | null;
  bio: string | null;
  country: string | null;
  city: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  is_private: boolean;
  verified: boolean;
  language: string | null;
};

type AuthState = {
  ready: boolean;
  session: Session | null;
  profile: Profile | null;
  isStaff: boolean;
  setReady: (ready: boolean) => void;
  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;
  setStaff: (isStaff: boolean) => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  ready: false,
  session: null,
  profile: null,
  isStaff: false,
  setReady: (ready) => set({ ready }),
  setSession: (session) => set({ session }),
  setProfile: (profile) => set({ profile }),
  setStaff: (isStaff) => set({ isStaff }),
}));

export function isProfileComplete(profile: Profile | null): boolean {
  return Boolean(profile?.username && profile.display_name);
}
