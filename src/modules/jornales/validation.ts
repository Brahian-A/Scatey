import { z } from "zod";
import { vacioANull } from "@/core/lib/texto";
import { esFechaIso } from "./fechas";
import { FRACCIONES, VALORES_MOTIVO, type MotivoAusencia } from "./schema";

/** Máximo de celdas por operación (una semana completa de ~80 trabajadores). */
export const MAX_CELDAS = 500;

export const fechaInput = z.string().refine(esFechaIso, "Fecha inválida.");

export const celdaInput = z.object({
  fecha: fechaInput,
  trabajadorId: z.uuid({ error: "Trabajador inválido." }),
});
export type Celda = z.infer<typeof celdaInput>;

const comunes = {
  ...celdaInput.shape,
  fraccion: z.literal(FRACCIONES, { error: "La fracción debe ser 1 o ½." }).default(1),
  nota: z.string().trim().max(200, "Máximo 200 caracteres.").nullish().transform(vacioANull),
};

// Mismas reglas que el CHECK de la tabla: trabajo ⇒ obra sin motivo; ausente ⇒ motivo sin obra.
export const jornalInput = z.discriminatedUnion(
  "estado",
  [
    z.object({
      ...comunes,
      estado: z.literal("trabajo"),
      obraId: z.uuid({ error: "Elegí una obra." }),
      motivoAusencia: z.null({ error: "Un día trabajado no lleva motivo de ausencia." }).default(null),
    }),
    z.object({
      ...comunes,
      estado: z.literal("ausente"),
      obraId: z.null({ error: "Una ausencia no lleva obra." }).default(null),
      motivoAusencia: z.enum(VALORES_MOTIVO, { error: "Elegí un motivo de ausencia." }),
    }),
  ],
  { error: "Elegí una obra o un motivo de ausencia." },
);

export type JornalInput = z.input<typeof jornalInput>;
export type Jornal = z.output<typeof jornalInput>;

export function claveCelda(c: Celda): string {
  return `${c.fecha}|${c.trabajadorId}`;
}

type ValorJornal = Pick<Jornal, "estado" | "obraId" | "motivoAusencia" | "fraccion">;

/** Mismo contenido de celda (la nota no cuenta). */
export function mismoValor(a: ValorJornal, b: ValorJornal): boolean {
  return a.estado === b.estado && a.obraId === b.obraId && a.motivoAusencia === b.motivoAusencia && a.fraccion === b.fraccion;
}

// ── Reportes ─────────────────────────────────────────────────────────────────

export const VISTAS_REPORTE = ["trabajador", "obra", "detalle"] as const;
export type VistaReporte = (typeof VISTAS_REPORTE)[number];

export function parsearVistaReporte(valor: unknown): VistaReporte {
  return z.enum(VISTAS_REPORTE).catch("trabajador").parse(valor);
}

/** `?filtro=` del detalle: "obra:<id>" o "motivo:<motivo>". */
const filtroDetalle = z.union([
  z
    .templateLiteral(["obra:", z.uuid()])
    .transform((v) => ({ tipo: "obra" as const, id: v.slice("obra:".length) })),
  z
    .templateLiteral(["motivo:", z.enum(VALORES_MOTIVO)])
    .transform((v) => ({ tipo: "motivo" as const, motivo: v.slice("motivo:".length) as MotivoAusencia })),
]);

const filtrosDetalle = z.object({
  trabajador: z.uuid().optional().catch(undefined),
  filtro: filtroDetalle.optional().catch(undefined),
});
export type FiltrosDetalle = z.output<typeof filtrosDetalle>;

/** Filtros inválidos se ignoran (se muestra todo). */
export function parsearFiltrosDetalle(params: Record<string, string | string[] | undefined>): FiltrosDetalle {
  return filtrosDetalle.parse({ trabajador: params.trabajador, filtro: params.filtro });
}
