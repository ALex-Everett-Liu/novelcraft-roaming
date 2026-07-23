import { Database } from "bun:sqlite";
import path from "path";
import { mkdirSync, existsSync, copyFileSync, unlinkSync } from "fs";
import { Utils } from "electrobun/bun";

let db: Database | null = null;

const DB_FILENAME = "novelcraft-data.db";
const BACKUP_SUFFIX = ".backup";

export function getDataDir(): string {
  if (process.env.ELECTROBUN_APP_DATA) {
    return path.resolve(process.env.ELECTROBUN_APP_DATA);
  }
  let dir = path.resolve(".");
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(dir, "data");
    if (existsSync(path.join(candidate, DB_FILENAME))) {
      return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return Utils.paths.userData;
}

export function getDbPath(): string {
  return path.join(getDataDir(), DB_FILENAME);
}

function getBackupPath(): string {
  return getDbPath() + BACKUP_SUFFIX;
}

export function getDatabase(): Database {
  if (db) return db;

  const dbPath = getDbPath();
  const dataDir = getDataDir();

  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  db = new Database(dbPath, { create: true });
  console.log("[NovelCraft] Database:", dbPath);

  db.run("PRAGMA journal_mode = TRUNCATE");
  db.run("PRAGMA foreign_keys = ON");
  db.run("PRAGMA synchronous = NORMAL");
  db.run("PRAGMA cache_size = -64000");

  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

export function ensureBackup(): void {
  const backupPath = getBackupPath();
  if (existsSync(backupPath)) return;

  const dbPath = getDbPath();
  if (!existsSync(dbPath)) return;

  if (!db) return;
  copyFileSync(dbPath, backupPath);
  console.log("[NovelCraft] Backup created:", backupPath);
}

export function restoreFromBackup(): { success: boolean; error?: string } {
  const backupPath = getBackupPath();
  const dbPath = getDbPath();
  if (!existsSync(backupPath)) {
    return { success: false, error: "No backup to restore from" };
  }

  try {
    closeDatabase();
    copyFileSync(backupPath, dbPath);
    for (const suffix of ["-wal", "-shm"]) {
      const p = dbPath + suffix;
      if (existsSync(p)) unlinkSync(p);
    }
    getDatabase();
    return { success: true };
  } catch (e) {
    getDatabase();
    return { success: false, error: String(e) };
  }
}

export function commitSave(): void {
  const backupPath = getBackupPath();
  if (existsSync(backupPath)) {
    try {
      unlinkSync(backupPath);
      console.log("[NovelCraft] Backup removed (saved)");
    } catch (e) {
      console.warn("[NovelCraft] Failed to remove backup:", e);
    }
  }
}

export function hasBackup(): boolean {
  return existsSync(getBackupPath());
}
