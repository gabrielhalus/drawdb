import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createDiagramStore } from "./fileStore.js";
import { createApplication } from "./index.js";

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

  const created = store.create(sampleDiagram());
  assert.equal(created.diagramId, "diagram-1");

  const onDisk = JSON.parse(
    fs.readFileSync(path.join(directory, "diagram-1.json"), "utf8"),
  );
  assert.equal(onDisk.name, "Sample");
  assert.equal(onDisk.tables.length, 2);

  // A second store over the same directory sees the persisted diagram.
  const reopened = createDiagramStore(directory);
  assert.equal(reopened.get("diagram-1").name, "Sample");

  const [summary] = reopened.list();
  assert.equal(summary.tableCount, 2);
  assert.equal(summary.database, "postgresql");
  assert.equal(summary.tables, undefined);
});

test("updates merge into the stored diagram and refresh lastModified", (t) => {
  const store = createDiagramStore(temporaryStorePath(t));
  store.create(sampleDiagram());

  const updated = store.update("diagram-1", {
    name: "Renamed",
    tables: [{ id: 0 }],
  });
  assert.equal(updated.name, "Renamed");
  assert.equal(updated.tables.length, 1);
  assert.equal(updated.database, "postgresql", "untouched fields survive");
  assert.notEqual(updated.lastModified, "2026-01-01T00:00:00.000Z");

  assert.equal(store.update("missing", { name: "No" }), null);
});

test("the ID in the stored record cannot be reassigned by an update", (t) => {
  const store = createDiagramStore(temporaryStorePath(t));
  store.create(sampleDiagram());

  const updated = store.update("diagram-1", { diagramId: "somewhere-else" });
  assert.equal(updated.diagramId, "diagram-1");
});

test("latest returns the most recently modified diagram", (t) => {
  const store = createDiagramStore(temporaryStorePath(t));
  store.create(sampleDiagram({ diagramId: "older", name: "Older" }));
  store.create(
    sampleDiagram({
      diagramId: "newer",
      name: "Newer",
      lastModified: "2026-06-01T00:00:00.000Z",
    }),
  );

  assert.equal(store.latest().name, "Newer");
  assert.deepEqual(
    store.list().map((diagram) => diagram.name),
    ["Newer", "Older"],
  );
});

test("diagrams can be found by the gist they were imported from", (t) => {
  const store = createDiagramStore(temporaryStorePath(t));
  store.create(sampleDiagram({ loadedFromGistId: "gist-abc" }));

  assert.equal(store.findByGistId("gist-abc").diagramId, "diagram-1");
  assert.equal(store.findByGistId("gist-missing"), null);
  assert.equal(store.findByGistId(""), null);
});

test("IDs that would escape the store directory are refused", (t) => {
  const directory = temporaryStorePath(t);
  const store = createDiagramStore(directory);

  assert.equal(store.get("../escape"), null);
  assert.equal(store.delete("../escape"), false);
  assert.throws(() => store.create(sampleDiagram({ diagramId: "../escape" })));
  assert.deepEqual(fs.readdirSync(directory), []);
});

test("an unreadable file is skipped by list but reported by get", (t) => {
  const directory = temporaryStorePath(t);
  const store = createDiagramStore(directory);
  store.create(sampleDiagram());
  fs.writeFileSync(path.join(directory, "corrupt.json"), "{ not json");

  assert.deepEqual(
    store.list().map((diagram) => diagram.diagramId),
    ["diagram-1"],
  );
  assert.throws(() => store.get("corrupt"));
});

test("the HTTP API exposes the full diagram lifecycle", async (t) => {
  const application = createApplication({
    storePath: temporaryStorePath(t),
  });
  await new Promise((resolve) =>
    application.server.listen(0, "127.0.0.1", resolve),
  );
  const { port } = application.server.address();
  t.after(() => application.server.close());

  const base = `http://127.0.0.1:${port}/api/diagrams`;
  const json = (response) => response.json();
  const send = (url, method, body) =>
    fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  assert.deepEqual(await fetch(base).then(json), { diagrams: [] });
  assert.equal(
    await fetch(`${base}/latest`).then((response) => response.status),
    404,
  );

  const created = await send(base, "POST", sampleDiagram()).then(json);
  assert.equal(created.diagramId, "diagram-1");

  const duplicate = await send(base, "POST", sampleDiagram());
  assert.equal(duplicate.status, 409);

  const { diagrams } = await fetch(base).then(json);
  assert.equal(diagrams.length, 1);
  assert.equal(diagrams[0].tableCount, 2);

  const full = await fetch(`${base}?full=1`).then(json);
  assert.equal(full.diagrams[0].tables.length, 2, "full listing keeps tables");

  assert.equal(await fetch(`${base}/latest`).then(json).then((d) => d.name), "Sample");

  const updated = await send(`${base}/diagram-1`, "PUT", {
    name: "Renamed",
  }).then(json);
  assert.equal(updated.name, "Renamed");

  assert.equal(
    await send(`${base}/missing`, "PUT", { name: "No" }).then((r) => r.status),
    404,
  );
  assert.equal(
    await fetch(`${base}/..%2Fescape`).then((response) => response.status),
    400,
  );

  assert.equal(
    await fetch(`${base}/diagram-1`, { method: "DELETE" }).then((r) => r.status),
    204,
  );
  assert.equal(
    await fetch(`${base}/diagram-1`).then((response) => response.status),
    404,
  );
});
