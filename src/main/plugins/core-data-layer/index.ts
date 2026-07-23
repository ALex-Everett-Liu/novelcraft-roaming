import type { MainPlugin } from "../../plugin-system/PluginManifest";
import type { MainPluginContext } from "../../plugin-system/PluginManifest";
import { manifest } from "./manifest";

const plugin: MainPlugin = {
  manifest,

  async onLoad(ctx: MainPluginContext) {
    const db = ctx.getDatabase();

    // ─── Migrations ──────────────────────────────
    ctx.runMigration(1, "create_projects", `
      CREATE TABLE IF NOT EXISTS projects (
        id         TEXT PRIMARY KEY,
        name       TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    ctx.runMigration(2, "create_fragments", `
      CREATE TABLE IF NOT EXISTS fragments (
        id           TEXT PRIMARY KEY,
        project_id   TEXT NOT NULL REFERENCES projects(id),
        title        TEXT DEFAULT '',
        content      TEXT NOT NULL,
        type         TEXT DEFAULT 'scene',
        tags         TEXT DEFAULT '[]',
        sort_order   INTEGER NOT NULL,
        word_count   INTEGER DEFAULT 0,
        created_at   TEXT NOT NULL,
        updated_at   TEXT NOT NULL
      )
    `);

    ctx.runMigration(3, "create_chapters", `
      CREATE TABLE IF NOT EXISTS chapters (
        id                  TEXT PRIMARY KEY,
        project_id          TEXT NOT NULL REFERENCES projects(id),
        title               TEXT DEFAULT '',
        content             TEXT NOT NULL,
        source_fragment_ids TEXT DEFAULT '[]',
        word_count          INTEGER DEFAULT 0,
        created_at          TEXT NOT NULL
      )
    `);

    ctx.runMigration(4, "index_fragments_project", `
      CREATE INDEX IF NOT EXISTS idx_fragments_project ON fragments(project_id, sort_order)
    `);

    ctx.runMigration(5, "index_chapters_project", `
      CREATE INDEX IF NOT EXISTS idx_chapters_project ON chapters(project_id)
    `);

    // ─── Prepared Statements ─────────────────────
    const insertProject = db.prepare(`
      INSERT INTO projects (id, name, created_at, updated_at) VALUES ($id, $name, $createdAt, $updatedAt)
    `);

    const getProject = db.prepare(`SELECT * FROM projects WHERE id = $id`);

    const insertFragment = db.prepare(`
      INSERT INTO fragments (id, project_id, title, content, type, tags, sort_order, word_count, created_at, updated_at)
      VALUES ($id, $projectId, $title, $content, $type, $tags, $sortOrder, $wordCount, $createdAt, $updatedAt)
    `);

    const getFragment = db.prepare(`SELECT * FROM fragments WHERE id = $id`);

    const listFragments = db.prepare(`
      SELECT * FROM fragments WHERE project_id = $projectId ORDER BY sort_order ASC
    `);

    const updateFragment = db.prepare(`
      UPDATE fragments SET title = $title, content = $content, type = $type, tags = $tags, sort_order = $sortOrder, word_count = $wordCount, updated_at = $updatedAt WHERE id = $id
    `);

    const deleteFragment = db.prepare(`DELETE FROM fragments WHERE id = $id`);

    const getMaxOrder = db.prepare(`
      SELECT COALESCE(MAX(sort_order), -1) as max_order FROM fragments WHERE project_id = $projectId
    `);

    const updateFragmentOrder = db.prepare(`
      UPDATE fragments SET sort_order = $sortOrder WHERE id = $id
    `);

    const insertChapter = db.prepare(`
      INSERT INTO chapters (id, project_id, title, content, source_fragment_ids, word_count, created_at)
      VALUES ($id, $projectId, $title, $content, $sourceFragmentIds, $wordCount, $createdAt)
    `);

    const listChapters = db.prepare(`
      SELECT * FROM chapters WHERE project_id = $projectId ORDER BY created_at ASC
    `);

    // ─── Helpers ─────────────────────────────────
    function now(): string {
      return String(Date.now());
    }

    function countWords(text: string): number {
      const trimmed = text.trim();
      if (!trimmed) return 0;
      return trimmed.split(/\s+/).length;
    }

    function mapFragment(row: Record<string, unknown>) {
      return {
        id: row.id as string,
        projectId: row.project_id as string,
        title: row.title as string,
        content: row.content as string,
        type: row.type as string,
        tags: JSON.parse(row.tags as string),
        order: row.sort_order as number,
        wordCount: row.word_count as number,
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
      };
    }

    function mapChapter(row: Record<string, unknown>) {
      return {
        id: row.id as string,
        projectId: row.project_id as string,
        title: row.title as string,
        content: row.content as string,
        sourceFragmentIds: JSON.parse(row.source_fragment_ids as string),
        wordCount: row.word_count as number,
        createdAt: row.created_at as string,
      };
    }

    // ─── RPC Handlers ────────────────────────────

    ctx.registerRpcHandler("projectCreate", (params: { name: string }) => {
      const id = Bun.randomUUIDv7();
      const ts = now();
      insertProject.run({
        $id: id,
        $name: params.name,
        $createdAt: ts,
        $updatedAt: ts,
      });
      const row = getProject.get({ $id: id }) as Record<string, unknown>;
      return {
        success: true,
        data: { id: row.id, name: row.name, createdAt: row.created_at, updatedAt: row.updated_at },
      };
    }, { noPrefix: true });

    ctx.registerRpcHandler("projectGet", (params: { id: string }) => {
      const row = getProject.get({ $id: params.id }) as Record<string, unknown> | undefined;
      if (!row) return { success: false, error: "Project not found" };
      return {
        success: true,
        data: { id: row.id, name: row.name, createdAt: row.created_at, updatedAt: row.updated_at },
      };
    }, { noPrefix: true });

    ctx.registerRpcHandler("fragmentsList", (params: { projectId: string }) => {
      const rows = listFragments.all({ $projectId: params.projectId }) as Record<string, unknown>[];
      return { success: true, data: rows.map(mapFragment) };
    }, { noPrefix: true });

    ctx.registerRpcHandler("fragmentsGet", (params: { id: string }) => {
      const row = getFragment.get({ $id: params.id }) as Record<string, unknown> | undefined;
      if (!row) return { success: false, error: "Fragment not found" };
      return { success: true, data: mapFragment(row) };
    }, { noPrefix: true });

    ctx.registerRpcHandler("fragmentsCreate", (params: {
      projectId: string;
      title?: string;
      content: string;
      type?: string;
      order?: number;
    }) => {
      console.log("[data-layer] fragmentsCreate called:", params.projectId, "content:", params.content.slice(0, 50));
      const id = Bun.randomUUIDv7();
      const ts = now();
      const maxRow = getMaxOrder.get({ $projectId: params.projectId }) as Record<string, unknown>;
      const order = params.order ?? ((maxRow.max_order as number) + 1);
      const title = params.title ?? "";
      const type = params.type ?? "scene";
      const wordCount = countWords(params.content);

      insertFragment.run({
        $id: id,
        $projectId: params.projectId,
        $title: title,
        $content: params.content,
        $type: type,
        $tags: "[]",
        $sortOrder: order,
        $wordCount: wordCount,
        $createdAt: ts,
        $updatedAt: ts,
      });

      const row = getFragment.get({ $id: id }) as Record<string, unknown>;
      return { success: true, data: mapFragment(row) };
    }, { noPrefix: true });

    ctx.registerRpcHandler("fragmentsUpdate", (params: {
      id: string;
      title?: string;
      content?: string;
      type?: string;
      tags?: string[];
      order?: number;
    }) => {
      const existing = getFragment.get({ $id: params.id }) as Record<string, unknown> | undefined;
      if (!existing) return { success: false, error: "Fragment not found" };

      const ts = now();
      const title = params.title !== undefined ? params.title : existing.title as string;
      const content = params.content !== undefined ? params.content : existing.content as string;
      const type = params.type !== undefined ? params.type : existing.type as string;
      const tags = params.tags !== undefined ? JSON.stringify(params.tags) : existing.tags as string;
      const sortOrder = params.order !== undefined ? params.order : existing.sort_order as number;
      const wordCount = params.content !== undefined ? countWords(content) : (existing.word_count as number);

      updateFragment.run({
        $id: params.id,
        $title: title,
        $content: content,
        $type: type,
        $tags: tags,
        $sortOrder: sortOrder,
        $wordCount: wordCount,
        $updatedAt: ts,
      });

      const row = getFragment.get({ $id: params.id }) as Record<string, unknown>;
      return { success: true, data: mapFragment(row) };
    }, { noPrefix: true });

    ctx.registerRpcHandler("fragmentsDelete", (params: { id: string }) => {
      const existing = getFragment.get({ $id: params.id }) as Record<string, unknown> | undefined;
      if (!existing) return { success: false, error: "Fragment not found" };
      deleteFragment.run({ $id: params.id });
      return { success: true };
    }, { noPrefix: true });

    ctx.registerRpcHandler("fragmentsReorder", (params: { orderedIds: string[] }) => {
      const stmt = db.prepare("UPDATE fragments SET sort_order = $sortOrder, updated_at = $updatedAt WHERE id = $id");
      const ts = now();
      db.transaction(() => {
        params.orderedIds.forEach((id, index) => {
          stmt.run({ $sortOrder: index, $updatedAt: ts, $id: id });
        });
      })();
      return { success: true };
    }, { noPrefix: true });

    ctx.registerRpcHandler("chaptersList", (params: { projectId: string }) => {
      const rows = listChapters.all({ $projectId: params.projectId }) as Record<string, unknown>[];
      return { success: true, data: rows.map(mapChapter) };
    }, { noPrefix: true });

    ctx.registerRpcHandler("chaptersCreate", (params: {
      projectId: string;
      title?: string;
      content: string;
      sourceFragmentIds: string[];
    }) => {
      const id = Bun.randomUUIDv7();
      const ts = now();
      const title = params.title ?? "";
      const wordCount = countWords(params.content);

      insertChapter.run({
        $id: id,
        $projectId: params.projectId,
        $title: title,
        $content: params.content,
        $sourceFragmentIds: JSON.stringify(params.sourceFragmentIds),
        $wordCount: wordCount,
        $createdAt: ts,
      });

      const getChapter = db.prepare("SELECT * FROM chapters WHERE id = $id");
      const row = getChapter.get({ $id: id }) as Record<string, unknown>;
      return { success: true, data: mapChapter(row) };
    }, { noPrefix: true });

    ctx.registerRpcHandler("importTxt", (params: {
      projectId: string;
      content: string;
      delimiter?: string;
    }) => {
      const delim = params.delimiter || "\n\n";
      const chunks = params.content.split(delim).filter((c: string) => c.trim().length > 0);

      const created: any[] = [];
      const ts = now();

      db.transaction(() => {
        for (let i = 0; i < chunks.length; i++) {
          const id = Bun.randomUUIDv7();
          const maxRow = getMaxOrder.get({ $projectId: params.projectId }) as Record<string, unknown>;
          const order = ((maxRow.max_order as number) + 1 + i);

          insertFragment.run({
            $id: id,
            $projectId: params.projectId,
            $title: "",
            $content: chunks[i].trim(),
            $type: "scene",
            $tags: "[]",
            $sortOrder: order,
            $wordCount: countWords(chunks[i]),
            $createdAt: ts,
            $updatedAt: ts,
          });

          const row = getFragment.get({ $id: id }) as Record<string, unknown>;
          created.push(mapFragment(row));
        }
      })();

      return { success: true, data: created };
    }, { noPrefix: true });

    ctx.log("Data layer ready");
  },
};

export default plugin;
