import { asegurarCarpetaDb, DATABASE_URL } from "./env";

asegurarCarpetaDb();

const { migrate } = await import("drizzle-orm/libsql/migrator");
const { db } = await import("../src/core/db/client");

await migrate(db, { migrationsFolder: "./drizzle" });
console.log(`✔ Migraciones aplicadas en ${DATABASE_URL}`);
