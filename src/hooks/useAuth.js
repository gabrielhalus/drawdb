import { useSession } from "../api/auth";

/**
 * The signed-in user, or `null` while loading and when signed out.
 *
 * Thin wrapper over Better Auth's session store so components depend on a
 * shape of our own rather than on the client's field names. `isLoading` is kept
 * separate from `user`: "not known yet" and "signed out" must not look alike,
 * or the app would flash the sign-in screen on every reload.
 */
export default function useAuth() {
  const { data, isPending, error, refetch } = useSession();

  return {
    user: data?.user ?? null,
    isAuthenticated: Boolean(data?.user),
    isLoading: isPending,
    error,
    refetch,
  };
}
