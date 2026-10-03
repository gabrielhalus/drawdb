import { useEffect, useState } from "react";
import { fetchInstanceInfo } from "../api/auth";

/**
 * Instance-level facts the auth screens need before anyone is signed in:
 * whether registration is open, and whether any account exists at all.
 *
 * A failed lookup leaves `signupOpen` false: offering a registration form we
 * could not confirm is worse than hiding it, since the sign-in form stays
 * available either way.
 */
export default function useInstanceInfo() {
  const [state, setState] = useState({
    status: "loading",
    signupOpen: false,
    hasAccounts: true,
  });

  useEffect(() => {
    let active = true;
    fetchInstanceInfo()
      .then((info) => {
        if (!active) return;
        setState({
          status: "ready",
          signupOpen: Boolean(info.signupOpen),
          hasAccounts: Boolean(info.hasAccounts),
        });
      })
      .catch(() => {
        if (active)
          setState({ status: "error", signupOpen: false, hasAccounts: true });
      });
    return () => {
      active = false;
    };
  }, []);

  return state;
}
