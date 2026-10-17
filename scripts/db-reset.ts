import { rmSync } from "node:fs";

const dbPath = process.env.DATABASE_PATH ?? "data/app.sqlite";

for (const path of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) rmSync(path, { force: true });
console.log(`Deleted ${dbPath}; the next start creates a fresh database.`);
