import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Carga .env si existe (Next lo hace solo; los scripts no).
if (existsSync(".env")) process.loadEnvFile(".env");

export const DATABASE_URL = process.env.DATABASE_URL ?? "file:./data/app.db";

/** Ruta absoluta del archivo de la base si DATABASE_URL es `file:`; si no, null. */
export function rutaArchivoDb(): string | null {
  if (!DATABASE_URL.startsWith("file:")) return null;
  const ruta = DATABASE_URL.slice("file:".length);
  return ruta.startsWith("//") ? fileURLToPath(DATABASE_URL) : resolve(ruta);
}

/** Crea la carpeta de la base si no existe (por ejemplo, en un clon nuevo). */
export function asegurarCarpetaDb() {
  const ruta = rutaArchivoDb();
  if (ruta) mkdirSync(dirname(ruta), { recursive: true });
}
