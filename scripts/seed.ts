import { asegurarCarpetaDb } from "./env";

asegurarCarpetaDb();

const { and, eq, max } = await import("drizzle-orm");
const { db } = await import("../src/core/db/client");
const { obras, trabajadores } = await import("../src/core/db/schema");
const { aTitleCase } = await import("../src/core/lib/texto");

// Idempotente: se puede correr varias veces sin duplicar datos.

const TRABAJADORES: Array<[nombre: string, apellido?: string]> = [
  ["Ramón", "Moreira"],
  ["Lucas", "Moreira"],
  ["Carlos", "Noguera"],
  ["Brahian"],
  ["Sebastián", "Maguna"],
  ["Walter"],
  ["Germán", "Sima"],
  ["Julio", "Rocha"],
  ["Federico"],
];

const OBRAS: Array<typeof obras.$inferInsert> = [
  { nombre: "Fábrica", tipo: "interna", color: "#475569" },
  { nombre: "ODS varias", tipo: "interna", color: "#92400e" },
  { nombre: "Diana Aguiar", tipo: "cliente", color: "#2563eb" },
  { nombre: "El Pinar", tipo: "cliente", ubicacion: "El Pinar", color: "#16a34a" },
];

let creados = 0;
const [ultimo] = await db.select({ orden: max(trabajadores.orden) }).from(trabajadores);
let orden = (ultimo?.orden ?? -1) + 1;

for (const [nombreCrudo, apellidoCrudo = ""] of TRABAJADORES) {
  const nombre = aTitleCase(nombreCrudo);
  const apellido = aTitleCase(apellidoCrudo);
  const existe = await db.query.trabajadores.findFirst({
    where: and(eq(trabajadores.nombre, nombre), eq(trabajadores.apellido, apellido)),
  });
  if (existe) continue;
  await db.insert(trabajadores).values({ nombre, apellido, orden: orden++ });
  creados++;
}
console.log(`✔ Trabajadores: ${creados} creados, ${TRABAJADORES.length - creados} ya existían`);

creados = 0;
for (const obra of OBRAS) {
  const nombre = aTitleCase(obra.nombre);
  const existe = await db.query.obras.findFirst({ where: eq(obras.nombre, nombre) });
  if (existe) continue;
  await db.insert(obras).values({ ...obra, nombre, ubicacion: obra.ubicacion ? aTitleCase(obra.ubicacion) : null });
  creados++;
}
console.log(`✔ Obras: ${creados} creadas, ${OBRAS.length - creados} ya existían`);
