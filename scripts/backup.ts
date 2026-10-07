import { existsSync, mkdirSync } from "node:fs";
import { join, relative } from "node:path";
import { createClient } from "@libsql/client";
import { formatear } from "../src/core/lib/fecha";
import { DATABASE_URL, rutaArchivoDb } from "./env";

const origen = rutaArchivoDb();
if (!origen) {
  console.error(`✘ db:backup solo funciona con bases locales (file:). DATABASE_URL=${DATABASE_URL}`);
  process.exit(1);
}
if (!existsSync(origen)) {
  console.error(`✘ No existe la base ${origen}. ¿Corriste npm run db:migrate?`);
  process.exit(1);
}

const carpeta = join("data", "backups");
mkdirSync(carpeta, { recursive: true });
const destino = join(carpeta, `app-${formatear(Date.now(), "yyyyMMdd-HHmm")}.db`);
if (existsSync(destino)) {
  console.error(`✘ Ya existe ${destino}. Esperá un minuto y volvé a intentar.`);
  process.exit(1);
}

// VACUUM INTO genera una copia consistente aunque la app esté abierta.
const client = createClient({ url: DATABASE_URL });
await client.execute({ sql: "VACUUM INTO ?", args: [destino] });
client.close();

console.log(`✔ Backup creado: ${relative(process.cwd(), destino)}`);
