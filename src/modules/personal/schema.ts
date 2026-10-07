import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { id, timestamps } from "../../core/db/columns";

export const trabajadores = sqliteTable(
  "trabajadores",
  {
    id: id(),
    nombre: text("nombre").notNull(),
    // Algunos trabajadores se conocen solo por el nombre: apellido vacío en ese caso.
    apellido: text("apellido").notNull().default(""),
    apodo: text("apodo"),
    telefono: text("telefono"),
    activo: integer("activo", { mode: "boolean" }).notNull().default(true),
    orden: integer("orden").notNull().default(0),
    notas: text("notas"),
    ...timestamps,
  },
  (t) => [index("trabajadores_activo_orden_idx").on(t.activo, t.orden)],
);
