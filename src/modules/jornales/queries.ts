import "server-only";
import { and, asc, between, eq, isNotNull, or } from "drizzle-orm";
import { db } from "@/core/db/client";
import { obras, trabajadores } from "@/core/db/schema";
import { listarObras, type Obra } from "@/modules/obras/queries";
import { nombreCompleto } from "@/modules/personal/queries";
import { sumarDias } from "./fechas";
import { jornales } from "./schema";
import type { Jornal } from "./validation";

export type { Jornal } from "./validation";
export { parsearSemana, hoyIso } from "./fechas";

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
