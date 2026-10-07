import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

export const DATABASE_URL = process.env.DATABASE_URL ?? "file:./data/app.db";

// En desarrollo Next recarga módulos; reutilizamos la conexión entre recargas.
const globalForDb = globalThis as unknown as { libsqlClient?: Client };

const client = globalForDb.libsqlClient ?? createClient({ url: DATABASE_URL });
if (process.env.NODE_ENV !== "production") globalForDb.libsqlClient = client;

export const db = drizzle(client, { schema });
export type Db = typeof db;
