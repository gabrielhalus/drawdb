import { Navigate, useLocation } from "react-router-dom";
import { Spin } from "@douyinfe/semi-ui";
import { useAuth } from "../../hooks";
import { REDIRECT_PARAM } from "../../utils/authRedirect";

/**
 * Gates the routes that read or write server-stored diagrams.
 *
 * While the session is still being resolved it renders a spinner rather than
 * redirecting: on a reload the session is briefly unknown, and treating that as
 * "signed out" would bounce a signed-in user to the sign-in screen.
 */
export default function RequireAuth({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-900">
        <Spin size="large" />
      </div>
    );
  }

  if (!isAuthenticated) {
    // Carries the attempted page along, so signing in lands where the visitor
    // was headed instead of on the collection.
    const next = `${location.pathname}${location.search}`;
    return (
      <Navigate
        to={`/sign-in?${REDIRECT_PARAM}=${encodeURIComponent(next)}`}
        replace
      />
    );
  }

  return children;
}
