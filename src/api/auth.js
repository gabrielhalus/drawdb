import { createAuthClient } from "better-auth/react";

/**
 * Client for the self-hosted Better Auth instance.
 *
 * The API is served from the same origin as the app (directly in production,
 * through the Vite proxy in development), so no base URL is configured: the
 * session cookie then travels with every request without any CORS setup.
 */
export const authClient = createAuthClient({ basePath: "/api/auth" });

export const { signIn, signUp, signOut, useSession } = authClient;

/** Rejection code the server returns when registration is closed. */
export const SIGNUP_CLOSED_ERROR = "signup_closed";

/**
 * Whether this instance still accepts registrations, which is true only until
 * the first account exists unless the owner set `ALLOW_SIGNUP`.
 *
 * Lets the sign-in screen offer registration on a brand-new instance and point
 * at the owner once it is set up, instead of showing a form that always fails.
 */
export async function fetchInstanceInfo() {
  const response = await fetch("/api/instance");
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json();
}
