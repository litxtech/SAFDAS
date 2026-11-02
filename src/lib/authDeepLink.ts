import * as Linking from 'expo-linking';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import { requireSupabase } from '@/lib/supabase';
import { setPendingSignupEmail } from '@/lib/pendingSignup';

/** Deep link target for email confirmation / recovery (must be allowlisted in Supabase Auth). */
export function authRedirectTo() {
  return Linking.createURL('auth/callback');
}

function hasAuthPayload(url: string) {
  return /[?&#](access_token|refresh_token|code|type)=/.test(url);
}

export function isAuthCallbackUrl(url: string | null | undefined) {
  if (!url) return false;
  return url.includes('auth/callback') || hasAuthPayload(url);
}

/**
 * Creates a Supabase session from an email confirmation / magic / recovery deep link.
 * Supports PKCE (`code`) and implicit (`access_token` + `refresh_token`) payloads.
 */
export async function createSessionFromUrl(url: string) {
  if (!isAuthCallbackUrl(url) && !hasAuthPayload(url)) {
    return { session: null as null, error: null as Error | null, handled: false };
  }

  const { params, errorCode } = QueryParams.getQueryParams(url);
  if (errorCode) {
    return { session: null, error: new Error(errorCode), handled: true };
  }

  const errorDescription =
    typeof params.error_description === 'string'
      ? params.error_description.replace(/\+/g, ' ')
      : typeof params.error === 'string'
        ? params.error
        : null;
  if (errorDescription) {
    return { session: null, error: new Error(errorDescription), handled: true };
  }

  const client = requireSupabase();
  const code = typeof params.code === 'string' ? params.code : undefined;
  if (code) {
    const { data, error } = await client.auth.exchangeCodeForSession(code);
    if (error) return { session: null, error, handled: true };
    setPendingSignupEmail(null);
    return { session: data.session, error: null, handled: true };
  }

  const access_token = typeof params.access_token === 'string' ? params.access_token : undefined;
  const refresh_token = typeof params.refresh_token === 'string' ? params.refresh_token : undefined;
  if (access_token && refresh_token) {
    const { data, error } = await client.auth.setSession({ access_token, refresh_token });
    if (error) return { session: null, error, handled: true };
    setPendingSignupEmail(null);
    return { session: data.session, error: null, handled: true };
  }

  return { session: null, error: null, handled: false };
}
