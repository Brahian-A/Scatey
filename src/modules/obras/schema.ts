import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { id, timestamps } from "../../core/db/columns";
import { ESTADOS_OBRA, TIPOS_OBRA } from "./constants";

export const obras = sqliteTable(
  "obras",
  {
    id: id(),
    nombre: text("nombre").notNull(),
    tipo: text("tipo", { enum: TIPOS_OBRA }).notNull(),
    ubicacion: text("ubicacion"),
    color: text("color").notNull(),
    estado: text("estado", { enum: ESTADOS_OBRA }).notNull().default("activa"),
    notas: text("notas"),
    ...timestamps,
  },
  (t) => [index("obras_estado_idx").on(t.estado)],
);
