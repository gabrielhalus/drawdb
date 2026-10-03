import { Link } from "react-router-dom";
import { useSettings, useThemedPage } from "../../hooks";
import logo_light from "../../assets/logo_light_160.png";
import logo_dark from "../../assets/logo_dark_160.png";

/**
 * Shared chrome for the sign-in and sign-up screens: a centred card on a muted
 * page, matching the diagram collection it leads to.
 */
export default function AuthCard({ title, subtitle, children, footer }) {
  useThemedPage();
  const { settings } = useSettings();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-zinc-50 px-6 py-12 text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
      <Link to="/welcome" aria-label="drawDB">
        <img
          src={settings.mode === "dark" ? logo_dark : logo_light}
          alt="drawDB"
          className="h-10"
        />
      </Link>

      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
        <h1 className="text-xl font-bold">{title}</h1>
        {subtitle && (
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {subtitle}
          </p>
        )}
        <div className="mt-6">{children}</div>
      </div>

      {footer && (
        <div className="text-sm text-zinc-500 dark:text-zinc-400">{footer}</div>
      )}
    </div>
  );
}
