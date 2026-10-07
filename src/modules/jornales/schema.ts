import { sql } from "drizzle-orm";
import { check, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { id, timestamps } from "../../core/db/columns";
// Única excepción a "no importar internos de otro módulo": las FKs necesitan la tabla.
import { obras } from "../obras/schema";
import { trabajadores } from "../personal/schema";

export const ESTADOS_JORNAL = ["trabajo", "ausente"] as const;
export type EstadoJornal = (typeof ESTADOS_JORNAL)[number];

/**
 * Motivos de ausencia, en el orden en que aparecen en el selector.
 * Para agregar uno alcanza con sumar una línea acá (la base no restringe los valores).
 */
export const MOTIVOS_AUSENCIA = [
  { value: "falta", label: "Falta" },
  { value: "lluvia", label: "Lluvia" },
  { value: "licencia", label: "Licencia" },
  { value: "libre", label: "Libre" },
  { value: "sin_asignar", label: "Sin asignar" },
] as const;
export type MotivoAusencia = (typeof MOTIVOS_AUSENCIA)[number]["value"];
export const VALORES_MOTIVO = MOTIVOS_AUSENCIA.map((m) => m.value) as [MotivoAusencia, ...MotivoAusencia[]];
export const ETIQUETA_MOTIVO = Object.fromEntries(MOTIVOS_AUSENCIA.map((m) => [m.value, m.label])) as Record<
  MotivoAusencia,
  string
>;

/** Jornal completo o medio jornal. */
export const FRACCIONES = [1, 0.5] as const;
export type Fraccion = (typeof FRACCIONES)[number];

export const jornales = sqliteTable(
  "jornales",
  {
    id: id(),
    /** Día en formato YYYY-MM-DD (hora de Montevideo). */
    fecha: text("fecha").notNull(),
    trabajadorId: text("trabajador_id")
      .notNull()
      .references(() => trabajadores.id),
    estado: text("estado", { enum: ESTADOS_JORNAL }).notNull(),
    /** Obligatoria si estado = 'trabajo'; null si es una ausencia. */
    obraId: text("obra_id").references(() => obras.id),
    /** Obligatorio si estado = 'ausente'; null si trabajó. */
    motivoAusencia: text("motivo_ausencia", { enum: VALORES_MOTIVO }),
    fraccion: real("fraccion").$type<Fraccion>().notNull().default(1),
    nota: text("nota"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("jornales_fecha_trabajador_uq").on(t.fecha, t.trabajadorId),
    check(
      "jornales_estado_check",
      sql`(${t.estado} = 'trabajo' AND ${t.obraId} IS NOT NULL AND ${t.motivoAusencia} IS NULL)
        OR (${t.estado} = 'ausente' AND ${t.obraId} IS NULL AND ${t.motivoAusencia} IS NOT NULL)`,
    ),
    check("jornales_fraccion_check", sql`${t.fraccion} IN (1, 0.5)`),
    check("jornales_fecha_check", sql`${t.fecha} GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'`),
  ],
);

// ── Importación de planillas viejas ──────────────────────────────────────────

export const TIPOS_ALIAS = ["trabajador", "destino"] as const;
export type TipoAlias = (typeof TIPOS_ALIAS)[number];

/**
 * Cómo se resolvió cada texto de la planilla vieja, para que la próxima
 * importación del mismo archivo no vuelva a preguntar.
 * - trabajador: `target_id` = trabajador, o todo null = ignorar.
 * - destino: `target_id` = obra, `motivo` = ausencia, o todo null = ignorar.
 * `target_id` no tiene FK porque apunta a trabajadores u obras según `tipo`.
 */
export const importAliases = sqliteTable(
  "import_aliases",
  {
    id: id(),
    tipo: text("tipo", { enum: TIPOS_ALIAS }).notNull(),
    /** Texto normalizado (sin acentos, mayúsculas, espacios simples): la clave de búsqueda. */
    clave: text("clave").notNull(),
    /** El texto tal como apareció en la planilla (la primera variante vista). */
    textoOriginal: text("texto_original").notNull(),
    targetId: text("target_id"),
    motivo: text("motivo", { enum: VALORES_MOTIVO }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("import_aliases_tipo_clave_uq").on(t.tipo, t.clave),
    check("import_aliases_destino_check", sql`${t.targetId} IS NULL OR ${t.motivo} IS NULL`),
    check("import_aliases_motivo_check", sql`${t.tipo} = 'destino' OR ${t.motivo} IS NULL`),
  ],
);
