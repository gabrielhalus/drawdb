import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { betterAuth, getCurrentAdapter } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { fromNodeHeaders } from "better-auth/node";

/* global process */

const DEFAULT_AUTH_DB_PATH = path.resolve("data/auth.db");
const DEFAULT_SECRET_PATH = path.resolve("data/auth.secret");

export const AUTH_BASE_PATH = "/api/auth";

/** The first account to register owns the instance; everyone else is a member. */
export const ROLES = { OWNER: "owner", MEMBER: "member" };

/** Returned to the client when registration is closed, so the UI can explain why. */
export const SIGNUP_CLOSED_ERROR = "signup_closed";

const envFlag = (value) => value === "true" || value === "1";

/**
 * Sessions are signed with this secret, so a value that changed on every boot
 * would log everybody out on each restart. An explicit `BETTER_AUTH_SECRET`
 * always wins; otherwise one is generated once and persisted next to the
 * database, which keeps a self-hosted instance working with no configuration.
 */
function resolveSecret(secretPath) {
  if (process.env.BETTER_AUTH_SECRET) return process.env.BETTER_AUTH_SECRET;

  const target = path.resolve(secretPath || DEFAULT_SECRET_PATH);
  try {
    const existing = fs.readFileSync(target, "utf8").trim();
    if (existing) return existing;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const generated = crypto.randomBytes(32).toString("base64url");
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${generated}\n`, { mode: 0o600 });
  return generated;
}

/**
 * Builds the origin allow-list used to reject cross-site requests.
 *
 * drawDB serves the SPA and the API from one process, so a request whose
 * `Origin` matches its own `Host` is same-origin and inherently not cross-site.
 * Accepting those is what lets a deployment answer on any hostname without
 * being told about it; a reverse proxy that rewrites `Host` still needs
 * `AUTH_BASE_URL` or `AUTH_TRUSTED_ORIGINS`.
 */
function createTrustedOrigins(baseURL) {
  const configured = (process.env.AUTH_TRUSTED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  // The Vite dev server proxies `/api` from its own port, so it shows up as a
  // separate origin during local development.
  const always = [
    baseURL,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    ...configured,
  ];

  return (request) => {
    const host = request?.headers?.get("host");
    const origin = request?.headers?.get("origin");
    if (!host || !origin) return [...new Set(always)];

    let sameOrigin;
    try {
      sameOrigin = new URL(origin).host === host ? origin : null;
    } catch {
      sameOrigin = null; // A malformed Origin header is simply not trusted.
    }
    return [...new Set([...always, sameOrigin].filter(Boolean))];
  };
}

/**
 * Creates the Better Auth instance backed by a SQLite file, running its
 * migrations first so a fresh checkout works with `npm start` alone.
 *
 * Diagrams stay plain JSON documents on disk; only accounts and sessions need
 * relational storage, and `node:sqlite` covers that without pulling in a
 * native dependency.
 *
 * @param store the diagram store, used to hand pre-auth diagrams to the owner
 */
export async function createAuth({ dbPath, secretPath, store } = {}) {
  const databaseFile = path.resolve(
    dbPath || process.env.AUTH_DB_PATH || DEFAULT_AUTH_DB_PATH,
  );
  fs.mkdirSync(path.dirname(databaseFile), { recursive: true });

  const baseURL =
    process.env.AUTH_BASE_URL ||
    process.env.BETTER_AUTH_URL ||
    `http://localhost:${process.env.PORT || "3000"}`;

  // `ALLOW_SIGNUP=true` reopens registration on an instance that already has an
  // owner; left unset, only the very first account can be created.
  const signupAlwaysOpen = envFlag(process.env.ALLOW_SIGNUP);

  let auth;

  /**
   * Counts accounts through the adapter that is currently active.
   *
   * `getCurrentAdapter` matters here: the user-creation hook below runs inside
   * a transaction, and the SQLite dialect holds its single connection for the
   * duration. Querying through the plain adapter from in there would wait for
   * a connection the transaction already owns, and the sign-up request would
   * hang instead of failing.
   */
  const countUsers = async () => {
    const { adapter } = await auth.$context;
    const active = await getCurrentAdapter(adapter);
    return active.count({ model: "user" });
  };

  /**
   * What the auth screens need to know before anyone is signed in.
   *
   * `hasAccounts` is reported separately from `signupOpen` so the sign-in
   * screen can tell a brand-new instance waiting for its owner apart from one
   * that simply left registration open.
   */
  const instanceInfo = async () => {
    const accounts = await countUsers();
    return {
      hasAccounts: accounts > 0,
      signupOpen: signupAlwaysOpen || accounts === 0,
    };
  };

  const options = {
    appName: "drawDB",
    baseURL,
    basePath: AUTH_BASE_PATH,
    secret: resolveSecret(secretPath),
    database: new DatabaseSync(databaseFile),
    trustedOrigins: createTrustedOrigins(baseURL),
    emailAndPassword: {
      enabled: true,
      // There is no mail transport in a self-hosted drawDB, so demanding a
      // verification click would lock every new account out of its diagrams.
      requireEmailVerification: false,
      minPasswordLength: 8,
    },
    user: {
      additionalFields: {
        role: {
          type: "string",
          required: false,
          defaultValue: ROLES.MEMBER,
          // Assigned by the bootstrap rule below; never read from the request
          // body, or anyone could sign up as the owner.
          input: false,
        },
      },
      validateUserInfo: async ({ source }) => {
        if (source.action !== "create-user") return;
        if ((await instanceInfo()).signupOpen) return;
        return {
          error: SIGNUP_CLOSED_ERROR,
          errorDescription:
            "Registration is closed on this instance. Ask the owner for an account.",
        };
      },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => ({
            data: {
              ...user,
              role: (await countUsers()) === 0 ? ROLES.OWNER : ROLES.MEMBER,
            },
          }),
          after: async (user) => {
            // Diagrams saved before authentication existed have no owner. The
            // account that bootstraps the instance adopts them, so upgrading
            // an existing deployment does not strand its data.
            if (user.role === ROLES.OWNER) store?.claimUnowned(user.id);
          },
        },
      },
    },
  };

  // Migrating before `betterAuth()` matters: the instance checks its schema as
  // soon as it initialises, and would otherwise report the tables as missing
  // while they are still being created.
  const { runMigrations } = await getMigrations(options);
  await runMigrations();

  auth = betterAuth(options);
  return { auth, instanceInfo };
}

/**
 * Express middleware putting the authenticated user on `req.user`.
 *
 * Every diagram route sits behind it, so a handler can treat `req.user.id` as
 * present and trustworthy rather than re-checking the session itself.
 */
export function createRequireAuth(auth) {
  return async (req, res, next) => {
    try {
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
      });
      if (!session?.user) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }
      req.user = session.user;
      next();
    } catch (error) {
      next(error);
    }
  };
}
