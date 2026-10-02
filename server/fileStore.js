import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DIAGRAM_ID_PATTERN } from "./protocol.js";

/* global process */

const DEFAULT_STORE_PATH = path.resolve("data/diagrams");

/**
 * Server-side diagram storage: one JSON file per diagram, named after its ID.
 *
 * Diagrams are kept in the same flat shape the editor already uses (tables,
 * references, notes, areas, ...), so a stored file is a readable, diffable
 * document rather than an opaque blob.
 */
export function createDiagramStore(storePath = process.env.DIAGRAM_STORE_PATH) {
  const root = path.resolve(storePath || DEFAULT_STORE_PATH);
  fs.mkdirSync(root, { recursive: true });

  // IDs arrive from URL params and request bodies, so every path is rebuilt
  // from a validated ID rather than trusted as given.
  const filePath = (id) =>
    DIAGRAM_ID_PATTERN.test(id ?? "") ? path.join(root, `${id}.json`) : null;

  const read = (id) => {
    const target = filePath(id);
    if (!target) return null;
    let raw;
    try {
      raw = fs.readFileSync(target, "utf8");
    } catch (error) {
      if (error.code === "ENOENT") return null;
      throw error;
    }
    // A corrupt file is surfaced rather than reported as missing: treating it
    // as absent would let the next save silently replace recoverable data.
    return JSON.parse(raw);
  };

  // Written to a temporary sibling and renamed, so an interrupted write cannot
  // leave a half-serialised diagram in place of the previous good one.
  const write = (diagram) => {
    const target = filePath(diagram.diagramId);
    if (!target) throw new Error("Invalid diagram ID");
    const temporary = `${target}.${crypto.randomBytes(6).toString("hex")}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(diagram, null, 2));
    fs.renameSync(temporary, target);
    return diagram;
  };

  const summarise = (diagram) => ({
    diagramId: diagram.diagramId,
    name: diagram.name,
    database: diagram.database ?? null,
    lastModified: diagram.lastModified,
    loadedFromGistId: diagram.loadedFromGistId ?? "",
    tableCount: Array.isArray(diagram.tables) ? diagram.tables.length : 0,
  });

  const all = () =>
    fs
      .readdirSync(root)
      .filter((entry) => entry.endsWith(".json"))
      .map((entry) => {
        try {
          return read(path.basename(entry, ".json"));
        } catch (error) {
          // One unreadable file must not take down the whole collection.
          console.error(`Skipping unreadable diagram ${entry}:`, error.message);
          return null;
        }
      })
      .filter(Boolean);

  const byNewest = (a, b) =>
    String(b.lastModified ?? "").localeCompare(String(a.lastModified ?? ""));

  return {
    list() {
      return all().sort(byNewest).map(summarise);
    },

    /** Full records, used by the "export all saved data" flow. */
    listFull() {
      return all().sort(byNewest);
    },

    get(id) {
      return read(id);
    },

    latest() {
      return all().sort(byNewest)[0] ?? null;
    },

    findByGistId(gistId) {
      if (!gistId) return null;
      return all().find((diagram) => diagram.loadedFromGistId === gistId) ?? null;
    },

    create(diagram) {
      return write({
        ...diagram,
        lastModified: diagram.lastModified ?? new Date().toISOString(),
      });
    },

    update(id, patch) {
      const current = read(id);
      if (!current) return null;
      return write({
        ...current,
        ...patch,
        diagramId: current.diagramId,
        lastModified: patch.lastModified ?? new Date().toISOString(),
      });
    },

    delete(id) {
      const target = filePath(id);
      if (!target) return false;
      try {
        fs.unlinkSync(target);
        return true;
      } catch (error) {
        if (error.code === "ENOENT") return false;
        throw error;
      }
    },
  };
}
