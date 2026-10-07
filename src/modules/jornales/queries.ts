import "server-only";
import { and, asc, between, countDistinct, desc, eq, isNotNull, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/core/db/client";
import { obras, trabajadores } from "@/core/db/schema";
import { listarObras, type Obra } from "@/modules/obras/queries";
import { nombreCompleto } from "@/modules/personal/queries";
import { hoyIso, sumarDias, type Rango } from "./fechas";
import { jornales, VALORES_MOTIVO, type EstadoJornal, type Fraccion, type MotivoAusencia } from "./schema";
import type { FiltrosDetalle, Jornal } from "./validation";

export type { Jornal } from "./validation";
export { parsearSemana, parsearRango, hoyIso, type Rango } from "./fechas";
export { parsearFiltrosDetalle, parsearVistaReporte, type FiltrosDetalle, type VistaReporte } from "./validation";

export type ObraResumen = Pick<Obra, "id" | "nombre" | "color" | "tipo" | "estado">;
export type TrabajadorSemana = { id: string; nombre: string; activo: boolean };

export interface GrillaSemana {
  /** Lunes de la semana (YYYY-MM-DD). */
  semana: string;
  /** Activos + los inactivos que tienen jornales esa semana, en el orden de Personal. */
  trabajadores: TrabajadorSemana[];
  registros: Jornal[];
  /** Obras activas para el selector: primero las de clientes, después las internas. */
  obrasActivas: ObraResumen[];
  /** Todas las obras que hacen falta para dibujar la semana (incluye terminadas). */
  obras: ObraResumen[];
}

const resumenObra = (o: ObraResumen): ObraResumen => ({
  id: o.id,
  nombre: o.nombre,
  color: o.color,
  tipo: o.tipo,
  estado: o.estado,
});

/**
 * Toda la semana sale de una sola consulta (trabajadores ⟕ jornales ⟕ obras).
 * Las obras activas del selector se piden en paralelo.
 */
export async function obtenerGrillaSemana(semana: string): Promise<GrillaSemana> {
  const [filas, activas] = await Promise.all([
    db
      .select({
        trabajador: {
          id: trabajadores.id,
          nombre: trabajadores.nombre,
          apellido: trabajadores.apellido,
          activo: trabajadores.activo,
        },
        jornal: {
          fecha: jornales.fecha,
          estado: jornales.estado,
          obraId: jornales.obraId,
          motivoAusencia: jornales.motivoAusencia,
          fraccion: jornales.fraccion,
          nota: jornales.nota,
        },
        obra: { id: obras.id, nombre: obras.nombre, color: obras.color, tipo: obras.tipo, estado: obras.estado },
      })
      .from(trabajadores)
      .leftJoin(
        jornales,
        and(eq(jornales.trabajadorId, trabajadores.id), between(jornales.fecha, semana, sumarDias(semana, 6))),
      )
      .leftJoin(obras, eq(obras.id, jornales.obraId))
      .where(or(eq(trabajadores.activo, true), isNotNull(jornales.id)))
      .orderBy(asc(trabajadores.orden), asc(trabajadores.nombre), asc(jornales.fecha)),
    listarObras({ estado: "activa" }),
  ]);

  const porTrabajador = new Map<string, TrabajadorSemana>();
  const obrasPorId = new Map<string, ObraResumen>();
  const registros: Jornal[] = [];

  for (const { trabajador: t, jornal: j, obra } of filas) {
    if (!porTrabajador.has(t.id)) porTrabajador.set(t.id, { id: t.id, nombre: nombreCompleto(t), activo: t.activo });
    if (obra) obrasPorId.set(obra.id, obra);
    if (!j) continue;
    // El CHECK de la tabla garantiza que estado/obra/motivo son coherentes.
    registros.push({ ...j, trabajadorId: t.id } as Jornal);
  }

  const obrasActivas = activas
    .map(resumenObra)
    .sort((a, b) => (a.tipo === b.tipo ? 0 : a.tipo === "cliente" ? -1 : 1));
  for (const o of obrasActivas) obrasPorId.set(o.id, o);

  return {
    semana,
    trabajadores: [...porTrabajador.values()],
    registros,
    obrasActivas,
    obras: [...obrasPorId.values()],
  };
}

// ── Reportes ─────────────────────────────────────────────────────────────────
// Todas las sumas y conteos los hace SQLite; en JS solo se le da forma al resultado.
// `fraccion` vale 1 o 0.5, así que sumarla cuenta el medio jornal como 0.5.

const enRango = ({ desde, hasta }: Rango) => between(jornales.fecha, desde, hasta);

/** coalesce(sum(expr), 0) como número. */
const suma = (expr: SQL) => sql<number>`coalesce(sum(${expr}), 0)`.mapWith(Number);
const sumaSi = (condicion: SQL) => suma(sql`CASE WHEN ${condicion} THEN ${jornales.fraccion} END`);

/**
 * Día hábil: lunes a viernes. El sábado cuenta solo si en el rango hay algún
 * registro (de cualquier trabajador) en un sábado.
 */
function esDiaHabil(fecha: SQL | typeof jornales.fecha, { desde, hasta }: Rango): SQL {
  const sabadoCuenta = sql`EXISTS (SELECT 1 FROM ${jornales} s WHERE s.fecha BETWEEN ${desde} AND ${hasta} AND strftime('%w', s.fecha) = '6')`;
  return sql`(strftime('%w', ${fecha}) BETWEEN '1' AND '5' OR (strftime('%w', ${fecha}) = '6' AND ${sabadoCuenta}))`;
}

export interface FilaPorTrabajador {
  id: string;
  nombre: string;
  activo: boolean;
  /** Jornales trabajados (suma de fracciones). */
  jornales: number;
  /** Ausencias por motivo (suma de fracciones). */
  ausencias: Record<MotivoAusencia, number>;
  /** Días hábiles del rango (hasta hoy) sin ningún registro. */
  sinRegistro: number;
}

/**
 * Una fila por trabajador (activos + inactivos con registros en el rango), en el
 * orden de Personal. Los días sin registro se cuentan solo hasta hoy: los días
 * futuros todavía no se cargaron.
 */
export async function reportePorTrabajador(rango: Rango, hoy = hoyIso()): Promise<FilaPorTrabajador[]> {
  const tope = rango.hasta < hoy ? rango.hasta : hoy;
  const diasHabiles = sql`(
    WITH RECURSIVE dias(d) AS (
      SELECT ${rango.desde} WHERE ${rango.desde} <= ${tope}
      UNION ALL SELECT date(d, '+1 day') FROM dias WHERE d < ${tope}
    )
    SELECT count(*) FROM dias WHERE ${esDiaHabil(sql`d`, rango)}
  )`;
  const conRegistro = sql`count(CASE WHEN ${jornales.fecha} <= ${tope} AND ${esDiaHabil(jornales.fecha, rango)} THEN 1 END)`;

  const ausencias = Object.fromEntries(
    VALORES_MOTIVO.map((m) => [m, sumaSi(sql`${jornales.motivoAusencia} = ${m}`)]),
  ) as Record<MotivoAusencia, SQL.Aliased<number> | SQL<number>>;

  const filas = await db
    .select({
      id: trabajadores.id,
      nombre: trabajadores.nombre,
      apellido: trabajadores.apellido,
      activo: trabajadores.activo,
      jornales: sumaSi(sql`${jornales.estado} = 'trabajo'`),
      ausencias,
      sinRegistro: sql<number>`${diasHabiles} - ${conRegistro}`.mapWith(Number),
    })
    .from(trabajadores)
    .leftJoin(jornales, and(eq(jornales.trabajadorId, trabajadores.id), enRango(rango)))
    .where(or(eq(trabajadores.activo, true), isNotNull(jornales.id)))
    .groupBy(trabajadores.id)
    .orderBy(asc(trabajadores.orden), asc(trabajadores.nombre));

  return filas.map(({ apellido, ...f }) => ({ ...f, nombre: nombreCompleto({ nombre: f.nombre, apellido }) }));
}

export interface FilaPorObra extends ObraResumen {
  jornales: number;
  trabajadores: number;
  primerDia: string;
  ultimoDia: string;
  /** Jornales de cada trabajador en la obra, en el orden de Personal. */
  porTrabajador: Array<{ id: string; nombre: string; jornales: number }>;
}

/** Una fila por obra con jornales en el rango, de la que más tuvo a la que menos. */
export async function reportePorObra(rango: Rango): Promise<FilaPorObra[]> {
  const trabajado = and(enRango(rango), eq(jornales.estado, "trabajo"));
  const total = suma(sql`${jornales.fraccion}`);

  const [porObra, detalle] = await Promise.all([
    db
      .select({
        id: obras.id,
        nombre: obras.nombre,
        color: obras.color,
        tipo: obras.tipo,
        estado: obras.estado,
        jornales: total,
        trabajadores: countDistinct(jornales.trabajadorId),
        primerDia: sql<string>`min(${jornales.fecha})`,
        ultimoDia: sql<string>`max(${jornales.fecha})`,
      })
      .from(jornales)
      .innerJoin(obras, eq(obras.id, jornales.obraId))
      .where(trabajado)
      .groupBy(obras.id)
      .orderBy(desc(total), asc(obras.nombre)),
    db
      .select({
        obraId: jornales.obraId,
        id: trabajadores.id,
        nombre: trabajadores.nombre,
        apellido: trabajadores.apellido,
        jornales: total,
      })
      .from(jornales)
      .innerJoin(trabajadores, eq(trabajadores.id, jornales.trabajadorId))
      .where(trabajado)
      .groupBy(jornales.obraId, trabajadores.id)
      .orderBy(asc(trabajadores.orden), asc(trabajadores.nombre)),
  ]);

  const filas = porObra.map((o): FilaPorObra => ({ ...o, porTrabajador: [] }));
  const porId = new Map(filas.map((o) => [o.id, o]));
  for (const { obraId, apellido, ...t } of detalle) {
    porId.get(obraId!)?.porTrabajador.push({ ...t, nombre: nombreCompleto({ nombre: t.nombre, apellido }) });
  }
  return filas;
}

export interface FilaDetalle {
  id: string;
  fecha: string;
  trabajadorId: string;
  trabajador: string;
  estado: EstadoJornal;
  obra: { id: string; nombre: string; color: string } | null;
  motivoAusencia: MotivoAusencia | null;
  fraccion: Fraccion;
  nota: string | null;
}

/** Máximo de filas que se muestran en pantalla (el Excel lleva todas). */
export const LIMITE_DETALLE = 2000;

/**
 * Registros del rango, uno por fila, por fecha y orden de Personal.
 * `total` es la cantidad que cumple los filtros aunque `limite` corte antes.
 */
export async function reporteDetalle(
  rango: Rango,
  filtros: FiltrosDetalle = {},
  limite?: number,
): Promise<{ filas: FilaDetalle[]; total: number }> {
  const { trabajador, filtro } = filtros;
  const consulta = db
    .select({
      id: jornales.id,
      fecha: jornales.fecha,
      trabajadorId: jornales.trabajadorId,
      nombre: trabajadores.nombre,
      apellido: trabajadores.apellido,
      estado: jornales.estado,
      obra: { id: obras.id, nombre: obras.nombre, color: obras.color },
      motivoAusencia: jornales.motivoAusencia,
      fraccion: jornales.fraccion,
      nota: jornales.nota,
      total: sql<number>`count(*) OVER ()`.mapWith(Number),
    })
    .from(jornales)
    .innerJoin(trabajadores, eq(trabajadores.id, jornales.trabajadorId))
    .leftJoin(obras, eq(obras.id, jornales.obraId))
    .where(
      and(
        enRango(rango),
        trabajador ? eq(jornales.trabajadorId, trabajador) : undefined,
        filtro?.tipo === "obra" ? eq(jornales.obraId, filtro.id) : undefined,
        filtro?.tipo === "motivo" ? eq(jornales.motivoAusencia, filtro.motivo) : undefined,
      ),
    )
    .orderBy(asc(jornales.fecha), asc(trabajadores.orden), asc(trabajadores.nombre))
    .$dynamic();

  const filas = await (limite === undefined ? consulta : consulta.limit(limite));
  return {
    total: filas[0]?.total ?? 0,
    filas: filas.map(({ nombre, apellido, total: _, ...f }) => ({ ...f, trabajador: nombreCompleto({ nombre, apellido }) })),
  };
}

/** Trabajadores y obras que aparecen en el rango, para los filtros del detalle. */
export async function opcionesDetalle(rango: Rango) {
  const [conRegistros, obrasEnRango] = await Promise.all([
    db
      .selectDistinct({ id: trabajadores.id, nombre: trabajadores.nombre, apellido: trabajadores.apellido, orden: trabajadores.orden })
      .from(jornales)
      .innerJoin(trabajadores, eq(trabajadores.id, jornales.trabajadorId))
      .where(enRango(rango))
      .orderBy(asc(trabajadores.orden), asc(trabajadores.nombre)),
    db
      .selectDistinct({ id: obras.id, nombre: obras.nombre, color: obras.color })
      .from(jornales)
      .innerJoin(obras, eq(obras.id, jornales.obraId))
      .where(enRango(rango))
      .orderBy(asc(obras.nombre)),
  ]);
  return {
    trabajadores: conRegistros.map((t) => ({ id: t.id, nombre: nombreCompleto(t) })),
    obras: obrasEnRango,
  };
}
export type OpcionesDetalle = Awaited<ReturnType<typeof opcionesDetalle>>;
