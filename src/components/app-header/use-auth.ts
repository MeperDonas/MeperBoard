"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

/** Per-user GitHub rate-limit snapshot exposed by `/api/auth/me`. */
export interface AuthRateLimit {
  remaining: number | null;
  resetAt: number | null;
}

export interface AuthUser {
  login: string;
  avatar_url: string;
  /** Best-effort rate-limit snapshot, or `null`/absent when `/me` could not read it. */
  rate_limit?: AuthRateLimit | null;
}

export interface UseAuthResult {
  /** The authenticated user, or null when logged out / not yet known. */
  user: AuthUser | null;
  /** True while the initial session check is still resolving. */
  isLoading: boolean;
  /** True when a session is established and exposed. */
  isAuthenticated: boolean;
  /** A non-auth error that prevented resolving the session (network, 5xx). */
  error: Error | null;
  /** Start the GitHub web-flow: navigate to `/api/auth/login`. */
  login: () => void;
  /** Revoke the session best-effort and reset the in-memory auth state. */
  logout: () => Promise<void>;
}

export const AUTH_QUERY_KEY = ["auth", "me"] as const;

/**
 * Resolve the current user from the session cookie. A 401 is the expected
 * "not signed in" outcome (the server clears the session cookie), so it maps
 * to `null` rather than an error. Any other non-OK response is surfaced.
 */
async function fetchMe(signal?: AbortSignal): Promise<AuthUser | null> {
  const res = await fetch("/api/auth/me", {
    headers: { accept: "application/json" },
    signal,
  });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`Failed to load account: ${res.status}`);
  return (await res.json()) as AuthUser;
}

/**
 * Reactive authentication state for the header.
 *
 * Reads the session via `/api/auth/me` inside a React Query cache (key
 * `["auth","me"]`), so any component calling `useAuth` shares one fetch and
 * re-renders together on login/logout. `/api/auth/me` is the public profile
 * endpoint only — the session token never reaches the client. Rate-limit and
 * repo shows are deliberately not wired here (Slice 5 owns the live repo).
 */
export function useAuth(): UseAuthResult {
  const queryClient = useQueryClient();
  const query = useQuery<AuthUser | null, Error>({
    queryKey: AUTH_QUERY_KEY,
    queryFn: ({ signal }) => fetchMe(signal),
  });

  const login = useCallback(() => {
    window.location.assign("/api/auth/login");
  }, []);

  const logoutMutation = useMutation<void, Error>({
    mutationFn: async () => {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (!res.ok) throw new Error(`Failed to disconnect: ${res.status}`);
    },
    onSuccess: () => {
      queryClient.setQueryData(AUTH_QUERY_KEY, null);
    },
  });

  const logout = useCallback(async () => {
    await logoutMutation.mutateAsync();
  }, [logoutMutation]);

  return {
    user: query.data ?? null,
    isLoading: query.isLoading,
    isAuthenticated: Boolean(query.data),
    error: query.error ?? null,
    login,
    logout,
  };
}
