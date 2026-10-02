import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { createDiagramStore } from "./fileStore.js";
import { DIAGRAM_ID_PATTERN, isPlainObject } from "./protocol.js";

/* global process */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MAX_DOCUMENT_BYTES = "8mb";

export function createApplication({ storePath, staticPath } = {}) {
  const store = createDiagramStore(storePath);
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(express.json({ limit: MAX_DOCUMENT_BYTES }));

  const validId = (req, res, next) => {
    if (!DIAGRAM_ID_PATTERN.test(req.params.id || "")) {
      res.status(400).json({ error: "Invalid diagram ID" });
      return;
    }
    next();
  };

  const validDiagram = (body) =>
    isPlainObject(body) &&
    typeof body.name === "string" &&
    body.name.length <= 200;

  app.get("/api/diagrams", (req, res) => {
    // `?full=1` returns whole diagrams for the export-all-data flow; the
    // collection and the open dialog only need summaries.
    res.json({
      diagrams: req.query.full ? store.listFull() : store.list(),
    });
  });

  app.get("/api/diagrams/latest", (_req, res) => {
    const diagram = store.latest();
    if (!diagram) res.status(404).json({ error: "No diagrams saved" });
    else res.json(diagram);
  });

  app.get("/api/diagrams/by-gist/:gistId", (req, res) => {
    const diagram = store.findByGistId(req.params.gistId);
    if (!diagram) res.status(404).json({ error: "Diagram not found" });
    else res.json(diagram);
  });

  app.post("/api/diagrams", (req, res, next) => {
    try {
      if (!validDiagram(req.body)) {
        res.status(400).json({ error: "A valid diagram is required" });
        return;
      }
      const diagramId = req.body.diagramId ?? crypto.randomUUID();
      if (!DIAGRAM_ID_PATTERN.test(diagramId)) {
        res.status(400).json({ error: "Invalid diagram ID" });
        return;
      }
      if (store.get(diagramId)) {
        res.status(409).json({ error: "Diagram already exists" });
        return;
      }
      res.status(201).json(store.create({ ...req.body, diagramId }));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/diagrams/:id", validId, (req, res) => {
    const diagram = store.get(req.params.id);
    if (!diagram) res.status(404).json({ error: "Diagram not found" });
    else res.json(diagram);
  });

  app.put("/api/diagrams/:id", validId, (req, res) => {
    if (!isPlainObject(req.body)) {
      res.status(400).json({ error: "A valid diagram is required" });
      return;
    }
    const updated = store.update(req.params.id, req.body);
    if (!updated) res.status(404).json({ error: "Diagram not found" });
    else res.json(updated);
  });

  app.delete("/api/diagrams/:id", validId, (req, res) => {
    if (!store.delete(req.params.id))
      res.status(404).json({ error: "Diagram not found" });
    else res.status(204).end();
  });

  const assets = staticPath || path.resolve(__dirname, "../dist");
  if (fs.existsSync(assets)) {
    app.use(express.static(assets));
    app.get("*splat", (_req, res) =>
      res.sendFile(path.join(assets, "index.html")),
    );
  }

  app.use((error, _req, res, next) => {
    void next;
    console.error("Request failed:", error.message);
    if (error?.type === "entity.too.large") {
      res.status(413).json({ error: "Request body is too large" });
    } else {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  const server = http.createServer(app);
  return { app, server, store };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number.parseInt(process.env.PORT || "3000", 10);
  const { server } = createApplication();
  server.listen(port, "0.0.0.0", () => {
    console.log(`drawDB listening on http://0.0.0.0:${port}`);
  });
}
