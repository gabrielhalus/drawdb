export const DEFAULT_DESTINATION = "/";

/** Name of the query parameter carrying where to go after signing in. */
export const REDIRECT_PARAM = "next";

/**
 * Keeps `?next=` pointing inside the app.
 *
 * The parameter reaches the auth screens from whatever page bounced the
 * visitor, so an absolute or protocol-relative URL would turn the sign-in form
 * into an open redirect.
 */
export function safeDestination(value) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return DEFAULT_DESTINATION;
  }
  return value;
}
