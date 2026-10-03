import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createDiagramStore } from "./fileStore.js";
import { createApplication } from "./index.js";

/* global process */

const OWNER = "user-owner";
const OTHER = "user-other";

function temporaryStorePath(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "drawdb-store-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function sampleDiagram(overrides = {}) {
  return {
    diagramId: "diagram-1",
    name: "Sample",
    database: "postgresql",
    tables: [{ id: 0 }, { id: 1 }],
    references: [],
    notes: [],
    areas: [],
    lastModified: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

test("diagrams round-trip through one JSON file each", (t) => {
  const directory = temporaryStorePath(t);
  const store = createDiagramStore(directory);

  const created = store.create(sampleDiagram(), OWNER);
  assert.equal(created.diagramId, "diagram-1");
  assert.equal(created.ownerId, OWNER);

  const onDisk = JSON.parse(
    fs.readFileSync(path.join(directory, "diagram-1.json"), "utf8"),
  );
  assert.equal(onDisk.name, "Sample");
  assert.equal(onDisk.tables.length, 2);
  assert.equal(onDisk.ownerId, OWNER);

  // A second store over the same directory sees the persisted diagram.
  const reopened = createDiagramStore(directory);
  assert.equal(reopened.get("diagram-1", OWNER).name, "Sample");

  const [summary] = reopened.list(OWNER);
  assert.equal(summary.tableCount, 2);
  assert.equal(summary.database, "postgresql");
  assert.equal(summary.tables, undefined);
});

test("updates merge into the stored diagram and refresh lastModified", (t) => {
  const store = createDiagramStore(temporaryStorePath(t));
  store.create(sampleDiagram(), OWNER);

  const updated = store.update(
    "diagram-1",
    { name: "Renamed", tables: [{ id: 0 }] },
    OWNER,
  );
  assert.equal(updated.name, "Renamed");
  assert.equal(updated.tables.length, 1);
  assert.equal(updated.database, "postgresql", "untouched fields survive");
  assert.notEqual(updated.lastModified, "2026-01-01T00:00:00.000Z");

  assert.equal(store.update("missing", { name: "No" }, OWNER), null);
});

test("neither the ID nor the owner can be reassigned by an update", (t) => {
  const store = createDiagramStore(temporaryStorePath(t));
  store.create(sampleDiagram(), OWNER);

  const updated = store.update(
    "diagram-1",
    { diagramId: "somewhere-else", ownerId: OTHER },
    OWNER,
  );
  assert.equal(updated.diagramId, "diagram-1");
  assert.equal(updated.ownerId, OWNER);
});

test("latest returns the most recently modified diagram", (t) => {
  const store = createDiagramStore(temporaryStorePath(t));
  store.create(sampleDiagram({ diagramId: "older", name: "Older" }), OWNER);
  store.create(
    sampleDiagram({
      diagramId: "newer",
      name: "Newer",
      lastModified: "2026-06-01T00:00:00.000Z",
    }),
    OWNER,
  );

  assert.equal(store.latest(OWNER).name, "Newer");
  assert.deepEqual(
    store.list(OWNER).map((diagram) => diagram.name),
    ["Newer", "Older"],
  );
});

test("diagrams can be found by the gist they were imported from", (t) => {
  const store = createDiagramStore(temporaryStorePath(t));
  store.create(sampleDiagram({ loadedFromGistId: "gist-abc" }), OWNER);

  assert.equal(store.findByGistId("gist-abc", OWNER).diagramId, "diagram-1");
  assert.equal(store.findByGistId("gist-missing", OWNER), null);
  assert.equal(store.findByGistId("", OWNER), null);
  assert.equal(
    store.findByGistId("gist-abc", OTHER),
    null,
    "another user's import is not reachable",
  );
});

test("a diagram is invisible to everyone but its owner", (t) => {
  const store = createDiagramStore(temporaryStorePath(t));
  store.create(sampleDiagram(), OWNER);

  assert.equal(store.get("diagram-1", OTHER), null);
  assert.equal(store.latest(OTHER), null);
  assert.deepEqual(store.list(OTHER), []);
  assert.deepEqual(store.listFull(OTHER), []);
  assert.equal(store.update("diagram-1", { name: "Hijacked" }, OTHER), null);
  assert.equal(store.delete("diagram-1", OTHER), false);

  assert.equal(
    store.get("diagram-1", OWNER).name,
    "Sample",
    "the owner's own diagram is untouched",
  );
  assert.equal(
    store.exists("diagram-1"),
    true,
    "the ID stays taken instance-wide",
  );
});

test("a missing owner reaches nothing and cannot create", (t) => {
  const store = createDiagramStore(temporaryStorePath(t));
  store.create(sampleDiagram(), OWNER);

  assert.deepEqual(store.list(undefined), []);
  assert.equal(store.get("diagram-1", undefined), null);
  assert.throws(() => store.create(sampleDiagram({ diagramId: "x" })));
});

test("the first owner adopts diagrams stored before authentication", (t) => {
  const directory = temporaryStorePath(t);
  const store = createDiagramStore(directory);

  // Written the way the pre-auth version of the store did: no owner at all.
  fs.writeFileSync(
    path.join(directory, "legacy.json"),
    JSON.stringify(sampleDiagram({ diagramId: "legacy", name: "Legacy" })),
  );
  store.create(sampleDiagram({ diagramId: "owned" }), OTHER);

  assert.equal(store.get("legacy", OWNER), null, "unowned reaches nobody");

  assert.equal(store.claimUnowned(OWNER), 1, "only the orphan is claimed");
  assert.equal(store.get("legacy", OWNER).name, "Legacy");
  assert.equal(
    store.get("owned", OTHER).ownerId,
    OTHER,
    "an already-owned diagram is left alone",
  );
  assert.equal(store.claimUnowned(OWNER), 0, "claiming again is a no-op");
});

test("IDs that would escape the store directory are refused", (t) => {
  const directory = temporaryStorePath(t);
  const store = createDiagramStore(directory);

  assert.equal(store.get("../escape", OWNER), null);
  assert.equal(store.delete("../escape", OWNER), false);
  assert.throws(() =>
    store.create(sampleDiagram({ diagramId: "../escape" }), OWNER),
  );
  assert.deepEqual(fs.readdirSync(directory), []);
});

test("an unreadable file is skipped by list but reported by get", (t) => {
  const directory = temporaryStorePath(t);
  const store = createDiagramStore(directory);
  store.create(sampleDiagram(), OWNER);
  fs.writeFileSync(path.join(directory, "corrupt.json"), "{ not json");

  assert.deepEqual(
    store.list(OWNER).map((diagram) => diagram.diagramId),
    ["diagram-1"],
  );
  assert.throws(() => store.get("corrupt", OWNER));
});

/**
 * Boots a real application over HTTP with throwaway storage.
 *
 * `allowSignup` mirrors the `ALLOW_SIGNUP` environment variable, which is read
 * when the auth instance is built, so it is set around that call only.
 */
async function startApplication(t, { allowSignup = false } = {}) {
  const directory = temporaryStorePath(t);
  const previousAllowSignup = process.env.ALLOW_SIGNUP;
  const previousSecret = process.env.BETTER_AUTH_SECRET;
  process.env.ALLOW_SIGNUP = allowSignup ? "true" : "false";
  process.env.BETTER_AUTH_SECRET = "test-secret-not-used-outside-these-tests";

  let application;
  try {
    application = await createApplication({
      storePath: path.join(directory, "diagrams"),
      authDbPath: path.join(directory, "auth.db"),
      authSecretPath: path.join(directory, "auth.secret"),
    });
  } finally {
    process.env.ALLOW_SIGNUP = previousAllowSignup;
    process.env.BETTER_AUTH_SECRET = previousSecret;
  }

  await new Promise((resolve) =>
    application.server.listen(0, "127.0.0.1", resolve),
  );
  const { port } = application.server.address();
  t.after(() => application.server.close());
  const base = `http://127.0.0.1:${port}`;

  // The Origin is sent on every call: it matches the request's own Host, which
  // is exactly the same-origin case the trusted-origin rule has to accept.
  const send = (url, { method = "GET", body, cookie } = {}) =>
    fetch(base + url, {
      method,
      headers: {
        origin: base,
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(cookie ? { cookie } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

  /** Registers an account and returns its session cookie. */
  const register = async (email) => {
    const response = await send("/api/auth/sign-up/email", {
      method: "POST",
      body: { email, password: "a-long-enough-password", name: email },
    });
    assert.equal(response.status, 200, `sign-up for ${email}`);
    const { user } = await response.json();
    return {
      user,
      cookie: response.headers
        .getSetCookie()
        .map((value) => value.split(";")[0])
        .join("; "),
    };
  };

  return { base, send, register, store: application.store };
}

test("diagram routes are closed to anonymous callers", async (t) => {
  const { send } = await startApplication(t);

  for (const [url, options] of [
    ["/api/diagrams", {}],
    ["/api/diagrams/latest", {}],
    ["/api/diagrams/diagram-1", {}],
    ["/api/diagrams", { method: "POST", body: sampleDiagram() }],
    ["/api/diagrams/diagram-1", { method: "PUT", body: { name: "No" } }],
    ["/api/diagrams/diagram-1", { method: "DELETE" }],
  ]) {
    const response = await send(url, options);
    assert.equal(response.status, 401, `${options.method ?? "GET"} ${url}`);
  }
});

test("the first account owns the instance and then registration closes", async (t) => {
  const { send, register } = await startApplication(t);

  assert.deepEqual(await send("/api/instance").then((r) => r.json()), {
    hasAccounts: false,
    signupOpen: true,
  });

  const { user } = await register("owner@example.com");
  assert.equal(user.role, "owner");

  assert.deepEqual(await send("/api/instance").then((r) => r.json()), {
    hasAccounts: true,
    signupOpen: false,
  });

  const refused = await send("/api/auth/sign-up/email", {
    method: "POST",
    body: {
      email: "intruder@example.com",
      password: "a-long-enough-password",
      name: "Intruder",
    },
  });
  assert.equal(refused.status, 403);
  assert.equal((await refused.json()).code, "signup_closed");
});

test("a signed-up owner cannot grant itself the owner role", async (t) => {
  const { send, register } = await startApplication(t, { allowSignup: true });
  await register("owner@example.com");

  const response = await send("/api/auth/sign-up/email", {
    method: "POST",
    body: {
      email: "member@example.com",
      password: "a-long-enough-password",
      name: "Member",
      role: "owner",
    },
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).user.role, "member");
});

test("the HTTP API exposes the full diagram lifecycle for its owner", async (t) => {
  const { send, register } = await startApplication(t);
  const { cookie } = await register("owner@example.com");
  const as = (options = {}) => ({ ...options, cookie });

  const base = "/api/diagrams";
  const json = (response) => response.json();

  assert.deepEqual(await send(base, as()).then(json), { diagrams: [] });
  assert.equal(await send(`${base}/latest`, as()).then((r) => r.status), 404);

  const created = await send(base, as({ method: "POST", body: sampleDiagram() })).then(json);
  assert.equal(created.diagramId, "diagram-1");

  const duplicate = await send(base, as({ method: "POST", body: sampleDiagram() }));
  assert.equal(duplicate.status, 409);

  const { diagrams } = await send(base, as()).then(json);
  assert.equal(diagrams.length, 1);
  assert.equal(diagrams[0].tableCount, 2);

  const full = await send(`${base}?full=1`, as()).then(json);
  assert.equal(full.diagrams[0].tables.length, 2, "full listing keeps tables");

  assert.equal(
    await send(`${base}/latest`, as())
      .then(json)
      .then((diagram) => diagram.name),
    "Sample",
  );

  const updated = await send(
    `${base}/diagram-1`,
    as({ method: "PUT", body: { name: "Renamed" } }),
  ).then(json);
  assert.equal(updated.name, "Renamed");

  assert.equal(
    await send(`${base}/missing`, as({ method: "PUT", body: { name: "No" } })).then(
      (r) => r.status,
    ),
    404,
  );
  assert.equal(
    await send(`${base}/..%2Fescape`, as()).then((r) => r.status),
    400,
  );

  assert.equal(
    await send(`${base}/diagram-1`, as({ method: "DELETE" })).then((r) => r.status),
    204,
  );
  assert.equal(await send(`${base}/diagram-1`, as()).then((r) => r.status), 404);
});

test("one account never sees or touches another's diagrams", async (t) => {
  const { send, register } = await startApplication(t, { allowSignup: true });
  const owner = await register("owner@example.com");
  const other = await register("other@example.com");

  await send("/api/diagrams", {
    method: "POST",
    body: sampleDiagram({ name: "Private" }),
    cookie: owner.cookie,
  });

  const theirs = { cookie: other.cookie };
  assert.deepEqual(
    await send("/api/diagrams", theirs).then((r) => r.json()),
    { diagrams: [] },
    "the collection is per account",
  );
  assert.equal(
    await send("/api/diagrams/diagram-1", theirs).then((r) => r.status),
    404,
    "a diagram owned by someone else is reported as absent, not forbidden",
  );
  assert.equal(
    await send("/api/diagrams/latest", theirs).then((r) => r.status),
    404,
  );
  assert.equal(
    await send("/api/diagrams/diagram-1", {
      ...theirs,
      method: "PUT",
      body: { name: "Hijacked" },
    }).then((r) => r.status),
    404,
  );
  assert.equal(
    await send("/api/diagrams/diagram-1", {
      ...theirs,
      method: "DELETE",
    }).then((r) => r.status),
    404,
  );

  // The owner's diagram survived every attempt above.
  const mine = await send("/api/diagrams/diagram-1", {
    cookie: owner.cookie,
  }).then((r) => r.json());
  assert.equal(mine.name, "Private");
  assert.equal(mine.ownerId, owner.user.id);
});

test("the owner's account cannot be hijacked through the diagram payload", async (t) => {
  const { send, register } = await startApplication(t, { allowSignup: true });
  const owner = await register("owner@example.com");
  const other = await register("other@example.com");

  // A client claiming someone else's ownerId is stored under its own account.
  const created = await send("/api/diagrams", {
    method: "POST",
    body: sampleDiagram({ ownerId: owner.user.id }),
    cookie: other.cookie,
  }).then((r) => r.json());
  assert.equal(created.ownerId, other.user.id);

  assert.equal(
    await send("/api/diagrams/diagram-1", { cookie: owner.cookie }).then(
      (r) => r.status,
    ),
    404,
  );
});

test("unknown API paths answer with JSON rather than the SPA shell", async (t) => {
  const { send } = await startApplication(t);
  const response = await send("/api/nope");

  assert.equal(response.status, 404);
  assert.match(response.headers.get("content-type"), /application\/json/);
});
