"use server";

import { and, between, inArray, max, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/core/db/client";
import { obras, trabajadores } from "@/core/db/schema";
import { falla, ok, type ResultadoAccion } from "@/core/lib/acciones";
import { listarObras, obraInput, PALETA_OBRAS, type Obra, type TipoObra } from "@/modules/obras/queries";
import { listarTrabajadores, nombreCompleto, trabajadorInput } from "@/modules/personal/queries";
import { fechaCorta } from "../fechas";
import { ETIQUETA_MOTIVO, importAliases, jornales, MOTIVOS_AUSENCIA, type TipoAlias } from "../schema";
import { upsert } from "../upsert";
import { claveCelda, jornalInput, MAX_CELDAS, mismoValor, type Jornal } from "../validation";
import { buscarCoincidencia, normalizar } from "./coincidencias";
import { ErrorPlanilla, parsearPlanillaLegacy, type Advertencia, type FilaLegacy } from "./parse-legacy-xlsx";
import {
  importacionInput,
  MAX_FILAS_IMPORTACION,
  type DecisionDestino,
  type DecisionTrabajador,
  type ImportacionInput,
} from "./validation";

const MAX_BYTES = 10 * 1024 * 1024;

type Ejecutor = Pick<typeof db, "select">;

function primerError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Datos inválidos.";
}

// ── Paso 1: leer el archivo y sugerir a qué corresponde cada texto ──────────

/** De dónde sale una decisión pre-cargada. "alias" = confirmada en una importación anterior. */
export type Origen = "alias" | "exacta" | "aproximada";

export interface TextoAMapear<D> {
  clave: string;
  /** La variante más frecuente, para mostrar. */
  texto: string;
  variantes: string[];
  ocurrencias: number;
  sugerencia: { decision: D; origen: Origen } | null;
}

export interface Analisis {
  resumen: { semanas: number; desde: string; hasta: string; registros: number; faltas: number; sinDestino: number };
  advertencias: Advertencia[];
  filas: FilaLegacy[];
  trabajadores: TextoAMapear<DecisionTrabajador>[];
  destinos: TextoAMapear<DecisionDestino>[];
  opciones: {
    trabajadores: Array<{ id: string; nombre: string; activo: boolean }>;
    obras: Array<Pick<Obra, "id" | "nombre" | "color" | "tipo" | "estado">>;
  };
}

/** Agrupa textos por clave normalizada: "Ramon Moreira" y "RAMON MOREIRA" son uno solo. */
function agrupar(textos: string[]): Array<{ clave: string; texto: string; variantes: string[]; ocurrencias: number }> {
  const grupos = new Map<string, Map<string, number>>();
  for (const t of textos) {
    const clave = normalizar(t);
    const variantes = grupos.get(clave) ?? new Map<string, number>();
    variantes.set(t, (variantes.get(t) ?? 0) + 1);
    grupos.set(clave, variantes);
  }
  return [...grupos]
    .map(([clave, variantes]) => {
      const orden = [...variantes].sort((a, b) => b[1] - a[1]);
      return {
        clave,
        texto: orden[0]![0],
        variantes: orden.map(([v]) => v),
        ocurrencias: orden.reduce((s, [, n]) => s + n, 0),
      };
    })
    .sort((a, b) => b.ocurrencias - a.ocurrencias || a.clave.localeCompare(b.clave));
}

async function leerAliases(ejecutor: Ejecutor) {
  const filas = await ejecutor.select().from(importAliases);
  return new Map(filas.map((a) => [`${a.tipo}|${a.clave}`, a]));
}

const claveAlias = (tipo: TipoAlias, clave: string) => `${tipo}|${clave}`;

/** Recibe el .xlsx y el año de la primera semana. No escribe nada. */
export async function analizarPlanilla(formData: FormData): Promise<ResultadoAccion<Analisis>> {
  const archivo = formData.get("archivo");
  const anio = z.coerce.number().int().min(2000).max(2100).safeParse(formData.get("anio"));
  if (!(archivo instanceof File) || archivo.size === 0) return falla("Elegí un archivo .xlsx.");
  if (archivo.size > MAX_BYTES) return falla("El archivo es demasiado grande (máximo 10 MB).");
  if (!anio.success) return falla("Elegí un año válido.");

  let parseo;
  try {
    parseo = await parsearPlanillaLegacy(await archivo.arrayBuffer(), anio.data);
  } catch (e) {
    if (e instanceof ErrorPlanilla) return falla(e.message);
    console.error("analizarPlanilla", e);
    return falla("No se pudo leer el archivo.");
  }
  if (parseo.semanas.length === 0) return falla('No se encontró ninguna semana (filas "SEMANA DEL dd/mm AL dd/mm").');
  if (parseo.filas.length > MAX_FILAS_IMPORTACION) {
    return falla(`El archivo tiene ${parseo.filas.length} registros; el máximo por importación es ${MAX_FILAS_IMPORTACION}.`);
  }

  const [listaTrabajadores, listaObras, aliases] = await Promise.all([
    listarTrabajadores({ incluirInactivos: true }),
    listarObras({ estado: "todas" }),
    leerAliases(db),
  ]);
  const idsTrabajadores = new Set(listaTrabajadores.map((t) => t.id));
  const idsObras = new Set(listaObras.map((o) => o.id));

  const candidatosTrabajador = listaTrabajadores.map((t) => ({
    id: t.id,
    nombres: [nombreCompleto(t), ...(t.apodo ? [t.apodo] : [])],
  }));
  // Un destino puede ser una obra o un motivo escrito a mano ("LLUVIA").
  const candidatosDestino = [
    ...listaObras.map((o) => ({ id: o.id, nombres: [o.nombre] })),
    ...MOTIVOS_AUSENCIA.map((m) => ({ id: `motivo:${m.value}`, nombres: [m.label] })),
  ];

  const trabajadoresAMapear = agrupar(parseo.filas.map((f) => f.trabajador)).map(
    (g): TextoAMapear<DecisionTrabajador> => {
      const alias = aliases.get(claveAlias("trabajador", g.clave));
      if (alias && (alias.targetId === null || idsTrabajadores.has(alias.targetId))) {
        const decision: DecisionTrabajador = alias.targetId
          ? { accion: "existente", id: alias.targetId }
          : { accion: "ignorar" };
        return { ...g, sugerencia: { decision, origen: "alias" } };
      }
      const c = buscarCoincidencia(g.clave, candidatosTrabajador);
      return {
        ...g,
        sugerencia: c && { decision: { accion: "existente", id: c.id }, origen: c.exacta ? "exacta" : "aproximada" },
      };
    },
  );

  const destinosAMapear = agrupar(parseo.filas.flatMap((f) => (f.destino === null ? [] : [f.destino]))).map(
    (g): TextoAMapear<DecisionDestino> => {
      const alias = aliases.get(claveAlias("destino", g.clave));
      if (alias && (alias.targetId === null || idsObras.has(alias.targetId))) {
        const decision: DecisionDestino = alias.targetId
          ? { accion: "existente", id: alias.targetId }
          : alias.motivo
            ? { accion: "ausente", motivo: alias.motivo }
            : { accion: "ignorar" };
        return { ...g, sugerencia: { decision, origen: "alias" } };
      }
      const c = buscarCoincidencia(g.clave, candidatosDestino);
      if (!c) return { ...g, sugerencia: null };
      const origen = c.exacta ? "exacta" : "aproximada";
      const motivo = MOTIVOS_AUSENCIA.find((m) => c.id === `motivo:${m.value}`);
      const decision: DecisionDestino = motivo
        ? { accion: "ausente", motivo: motivo.value }
        : { accion: "existente", id: c.id };
      return { ...g, sugerencia: { decision, origen } };
    },
  );

  const fechas = parseo.semanas.flatMap((s) => [s.desde, s.hasta]).sort();
  return ok({
    resumen: {
      semanas: parseo.semanas.length,
      desde: fechas[0]!,
      hasta: fechas.at(-1)!,
      registros: parseo.filas.length,
      faltas: parseo.filas.filter((f) => f.destino === null).length,
      sinDestino: parseo.sinDestino,
    },
    advertencias: parseo.advertencias,
    filas: parseo.filas,
    trabajadores: trabajadoresAMapear,
    destinos: destinosAMapear,
    opciones: {
      trabajadores: listaTrabajadores.map((t) => ({ id: t.id, nombre: nombreCompleto(t), activo: t.activo })),
      obras: listaObras.map((o) => ({ id: o.id, nombre: o.nombre, color: o.color, tipo: o.tipo, estado: o.estado })),
    },
  });
}

// ── Pasos 2 y 3: aplicar las decisiones ──────────────────────────────────────

type TrabajadorNuevo = { id: string; nombre: string; apellido: string };
type ObraNueva = { id: string; nombre: string; tipo: TipoObra };
type AliasNuevo = { tipo: TipoAlias; clave: string; textoOriginal: string; targetId: string | null; motivo: Jornal["motivoAusencia"] };

interface Resolucion {
  registros: Array<Jornal & { fila: number }>;
  trabajadoresNuevos: TrabajadorNuevo[];
  obrasNuevas: ObraNueva[];
  aliases: AliasNuevo[];
  ignorados: number;
  advertencias: Advertencia[];
  /** Nombres para describir conflictos. */
  nombreTrabajador: Map<string, string>;
  nombreObra: Map<string, string>;
}

/**
 * Traduce cada fila de la planilla a un jornal según las decisiones del usuario.
 * Los trabajadores y obras nuevos reciben su id acá (todavía no se crean).
 */
async function resolver(ejecutor: Ejecutor, input: z.output<typeof importacionInput>): Promise<Resolucion | string> {
  const decisionesT = new Map(Object.entries(input.trabajadores));
  const decisionesD = new Map(Object.entries(input.destinos));

  const idsT = [...decisionesT.values()].flatMap((d) => (d.accion === "existente" ? [d.id] : []));
  const idsO = [...decisionesD.values()].flatMap((d) => (d.accion === "existente" ? [d.id] : []));
  const [existentesT, existentesO] = await Promise.all([
    idsT.length
      ? ejecutor
          .select({ id: trabajadores.id, nombre: trabajadores.nombre, apellido: trabajadores.apellido })
          .from(trabajadores)
          .where(inArray(trabajadores.id, idsT))
      : [],
    idsO.length
      ? ejecutor.select({ id: obras.id, nombre: obras.nombre }).from(obras).where(inArray(obras.id, idsO))
      : [],
  ]);
  const nombreTrabajador = new Map(existentesT.map((t) => [t.id, nombreCompleto(t)]));
  const nombreObra = new Map(existentesO.map((o) => [o.id, o.nombre]));

  // Varios textos pueden pedir crear el mismo trabajador u obra: se crea uno solo.
  const trabajadoresNuevos = new Map<string, TrabajadorNuevo>();
  const obrasNuevas = new Map<string, ObraNueva>();
  /** clave del texto → id del trabajador (null = ignorar). */
  const destinoT = new Map<string, string | null>();
  const destinoD = new Map<string, { obraId: string } | { motivo: NonNullable<Jornal["motivoAusencia"]> } | null>();

  const res: Resolucion = {
    registros: [],
    trabajadoresNuevos: [],
    obrasNuevas: [],
    aliases: [],
    ignorados: 0,
    advertencias: [],
    nombreTrabajador,
    nombreObra,
  };
  const textoOriginal = new Map<string, string>();
  const vistos = new Map<string, number>();

  for (const f of input.filas) {
    // Trabajador
    const ct = normalizar(f.trabajador);
    if (!destinoT.has(ct)) {
      const d = decisionesT.get(ct);
      if (!d) return `Falta elegir qué hacer con el trabajador "${f.trabajador}" (fila ${f.fila}).`;
      if (d.accion === "existente") {
        if (!nombreTrabajador.has(d.id)) return `El trabajador elegido para "${f.trabajador}" ya no existe.`;
        destinoT.set(ct, d.id);
      } else if (d.accion === "nuevo") {
        const p = trabajadorInput.safeParse({ nombre: d.nombre, apellido: d.apellido });
        if (!p.success) return `Trabajador nuevo para "${f.trabajador}": ${primerError(p.error)}`;
        const clave = normalizar(`${p.data.nombre} ${p.data.apellido}`);
        const { nombre, apellido } = p.data;
        const nuevo = trabajadoresNuevos.get(clave) ?? { id: crypto.randomUUID(), nombre, apellido };
        trabajadoresNuevos.set(clave, nuevo);
        nombreTrabajador.set(nuevo.id, nombreCompleto(nuevo));
        destinoT.set(ct, nuevo.id);
      } else {
        destinoT.set(ct, null);
      }
      textoOriginal.set(claveAlias("trabajador", ct), f.trabajador);
    }

    // Destino (null = falta, no se mapea)
    let destino: { obraId: string } | { motivo: NonNullable<Jornal["motivoAusencia"]> } | null = { motivo: "falta" };
    if (f.destino !== null) {
      const cd = normalizar(f.destino);
      if (!destinoD.has(cd)) {
        const d = decisionesD.get(cd);
        if (!d) return `Falta elegir qué hacer con el destino "${f.destino}" (fila ${f.fila}).`;
        if (d.accion === "existente") {
          if (!nombreObra.has(d.id)) return `La obra elegida para "${f.destino}" ya no existe.`;
          destinoD.set(cd, { obraId: d.id });
        } else if (d.accion === "nuevo") {
          // El color se asigna al crearla; acá solo se valida el resto.
          const p = obraInput.safeParse({ nombre: d.nombre, tipo: d.tipo, color: PALETA_OBRAS[0].hex });
          if (!p.success) return `Obra nueva para "${f.destino}": ${primerError(p.error)}`;
          const clave = normalizar(p.data.nombre);
          const nueva = obrasNuevas.get(clave) ?? { id: crypto.randomUUID(), nombre: p.data.nombre, tipo: p.data.tipo };
          obrasNuevas.set(clave, nueva);
          nombreObra.set(nueva.id, nueva.nombre);
          destinoD.set(cd, { obraId: nueva.id });
        } else if (d.accion === "ausente") {
          destinoD.set(cd, { motivo: d.motivo });
        } else {
          destinoD.set(cd, null);
        }
        textoOriginal.set(claveAlias("destino", cd), f.destino);
      }
      destino = destinoD.get(cd)!;
    }

    const trabajadorId = destinoT.get(ct)!;
    if (trabajadorId === null || destino === null) {
      res.ignorados++;
      continue;
    }

    // Dos textos distintos mapeados al mismo trabajador el mismo día.
    const clave = claveCelda({ fecha: f.fecha, trabajadorId });
    const previa = vistos.get(clave);
    if (previa !== undefined) {
      res.advertencias.push({
        fila: f.fila,
        mensaje: `${nombreTrabajador.get(trabajadorId)} ya tiene un registro el ${fechaCorta(f.fecha)} (fila ${previa}): se usa el primero.`,
      });
      continue;
    }
    vistos.set(clave, f.fila);

    res.registros.push({
      fila: f.fila,
      fecha: f.fecha,
      trabajadorId,
      fraccion: 1,
      nota: null,
      ...("obraId" in destino
        ? { estado: "trabajo", obraId: destino.obraId, motivoAusencia: null }
        : { estado: "ausente", obraId: null, motivoAusencia: destino.motivo }),
    });
  }

  // Se recuerdan solo las decisiones de textos que aparecen en el archivo.
  for (const [ct, id] of destinoT) {
    const k = claveAlias("trabajador", ct);
    res.aliases.push({ tipo: "trabajador", clave: ct, textoOriginal: textoOriginal.get(k)!, targetId: id, motivo: null });
  }
  for (const [cd, d] of destinoD) {
    const k = claveAlias("destino", cd);
    res.aliases.push({
      tipo: "destino",
      clave: cd,
      textoOriginal: textoOriginal.get(k)!,
      targetId: d && "obraId" in d ? d.obraId : null,
      motivo: d && "motivo" in d ? d.motivo : null,
    });
  }
  res.trabajadoresNuevos = [...trabajadoresNuevos.values()];
  res.obrasNuevas = [...obrasNuevas.values()];

  const validos = z.array(jornalInput).safeParse(res.registros);
  if (!validos.success) return primerError(validos.error);
  return res;
}

/** Jornales ya cargados para los trabajadores y fechas del archivo. */
async function existentes(ejecutor: Ejecutor, registros: Jornal[]) {
  if (registros.length === 0) return new Map<string, Jornal>();
  const fechas = registros.map((r) => r.fecha).sort();
  const ids = [...new Set(registros.map((r) => r.trabajadorId))];
  const filas = await ejecutor
    .select({
      fecha: jornales.fecha,
      trabajadorId: jornales.trabajadorId,
      estado: jornales.estado,
      obraId: jornales.obraId,
      motivoAusencia: jornales.motivoAusencia,
      fraccion: jornales.fraccion,
      nota: jornales.nota,
    })
    .from(jornales)
    .where(and(inArray(jornales.trabajadorId, ids), between(jornales.fecha, fechas[0]!, fechas.at(-1)!)));
  return new Map(filas.map((f) => [claveCelda(f), f as Jornal]));
}

/** Separa los registros del archivo según lo que ya hay en la base. */
function clasificar(registros: Resolucion["registros"], actuales: Map<string, Jornal>) {
  const nuevos: Resolucion["registros"] = [];
  const conflictos: Array<{ registro: Resolucion["registros"][number]; actual: Jornal }> = [];
  let iguales = 0;
  for (const r of registros) {
    const actual = actuales.get(claveCelda(r));
    if (!actual) nuevos.push(r);
    else if (mismoValor(actual, r)) iguales++;
    else conflictos.push({ registro: r, actual });
  }
  return { nuevos, conflictos, iguales };
}

export interface Previsualizacion {
  nuevos: number;
  conflictos: number;
  /** Ya cargados con el mismo valor: no se tocan. */
  iguales: number;
  ignorados: number;
  trabajadoresNuevos: string[];
  obrasNuevas: string[];
  advertencias: Advertencia[];
  /** Primeros conflictos, para mostrarlos. */
  muestraConflictos: Array<{ fila: number; fecha: string; trabajador: string; actual: string; nuevo: string }>;
}

const MUESTRA_CONFLICTOS = 100;

/** Paso 3: qué se va a escribir, sin escribir nada. */
export async function previsualizarImportacion(input: ImportacionInput): Promise<ResultadoAccion<Previsualizacion>> {
  const parsed = importacionInput.safeParse(input);
  if (!parsed.success) return falla(primerError(parsed.error));

  const res = await resolver(db, parsed.data);
  if (typeof res === "string") return falla(res);

  const actuales = await existentes(db, res.registros);
  // Las obras de los registros actuales pueden no estar entre las elegidas.
  const obrasActuales = [...actuales.values()].flatMap((j) => (j.obraId && !res.nombreObra.has(j.obraId) ? [j.obraId] : []));
  if (obrasActuales.length) {
    const filas = await db.select({ id: obras.id, nombre: obras.nombre }).from(obras).where(inArray(obras.id, obrasActuales));
    for (const o of filas) res.nombreObra.set(o.id, o.nombre);
  }
  const describir = (j: Jornal) =>
    j.estado === "trabajo" ? (res.nombreObra.get(j.obraId) ?? "Obra") : ETIQUETA_MOTIVO[j.motivoAusencia];

  const { nuevos, conflictos, iguales } = clasificar(res.registros, actuales);
  return ok({
    nuevos: nuevos.length,
    conflictos: conflictos.length,
    iguales,
    ignorados: res.ignorados,
    trabajadoresNuevos: res.trabajadoresNuevos.map(nombreCompleto),
    obrasNuevas: res.obrasNuevas.map((o) => o.nombre),
    advertencias: res.advertencias,
    muestraConflictos: conflictos.slice(0, MUESTRA_CONFLICTOS).map(({ registro, actual }) => ({
      fila: registro.fila,
      fecha: registro.fecha,
      trabajador: res.nombreTrabajador.get(registro.trabajadorId) ?? "",
      actual: describir(actual),
      nuevo: describir(registro),
    })),
  });
}

export interface ResultadoImportacion {
  insertados: number;
  sobrescritos: number;
  omitidos: number;
  /** Primera fecha importada, para ir a esa semana. */
  desde: string | null;
}

function enTandas<T>(lista: T[], tamano = MAX_CELDAS): T[][] {
  return Array.from({ length: Math.ceil(lista.length / tamano) }, (_, i) => lista.slice(i * tamano, (i + 1) * tamano));
}

/**
 * Escribe todo en una sola transacción: trabajadores y obras nuevos, las
 * decisiones (para la próxima importación) y los jornales. Si algo falla no
 * queda nada escrito.
 */
export async function importarPlanilla(
  input: ImportacionInput,
  sobrescribir: boolean,
): Promise<ResultadoAccion<ResultadoImportacion>> {
  const parsed = importacionInput.safeParse(input);
  if (!parsed.success || typeof sobrescribir !== "boolean") {
    return falla(parsed.success ? "Datos inválidos." : primerError(parsed.error));
  }

  let resultado: ResultadoImportacion | string;
  try {
    resultado = await db.transaction(async (tx) => {
      const res = await resolver(tx, parsed.data);
      if (typeof res === "string") return res;

      if (res.trabajadoresNuevos.length) {
        const [ultimo] = await tx.select({ orden: max(trabajadores.orden) }).from(trabajadores);
        const orden = (ultimo?.orden ?? -1) + 1;
        await tx.insert(trabajadores).values(res.trabajadoresNuevos.map((t, i) => ({ ...t, orden: orden + i })));
      }

      if (res.obrasNuevas.length) {
        // Cada obra nueva toma el color de la paleta menos usado hasta ahora.
        const uso = new Map<string, number>(PALETA_OBRAS.map((c) => [c.hex, 0]));
        for (const o of await tx.select({ color: obras.color }).from(obras)) {
          if (uso.has(o.color)) uso.set(o.color, uso.get(o.color)! + 1);
        }
        const valores = res.obrasNuevas.map((o) => {
          const color = [...uso.keys()].reduce((a, b) => (uso.get(b)! < uso.get(a)! ? b : a));
          uso.set(color, uso.get(color)! + 1);
          return { ...o, color };
        });
        await tx.insert(obras).values(valores);
      }

      for (const tanda of enTandas(res.aliases)) {
        await tx
          .insert(importAliases)
          .values(tanda)
          .onConflictDoUpdate({
            target: [importAliases.tipo, importAliases.clave],
            set: {
              targetId: sql`excluded.target_id`,
              motivo: sql`excluded.motivo`,
              updatedAt: sql`excluded.updated_at`,
            },
          });
      }

      const { nuevos, conflictos, iguales } = clasificar(res.registros, await existentes(tx, res.registros));
      // Al sobrescribir se conserva la nota que ya tenía la celda.
      const aEscribir: Jornal[] = [
        ...nuevos,
        ...(sobrescribir ? conflictos.map(({ registro, actual }) => ({ ...registro, nota: actual.nota })) : []),
      ].map(({ fila: _, ...j }) => j as Jornal);
      for (const tanda of enTandas(aEscribir)) {
        if (sobrescribir) await upsert(tx, tanda);
        else await tx.insert(jornales).values(tanda).onConflictDoNothing();
      }

      return {
        insertados: nuevos.length,
        sobrescritos: sobrescribir ? conflictos.length : 0,
        omitidos: iguales + (sobrescribir ? 0 : conflictos.length),
        desde: res.registros.map((r) => r.fecha).sort()[0] ?? null,
      };
    });
  } catch (e) {
    console.error("importarPlanilla", e);
    return falla("No se pudo importar. No se guardó nada.");
  }
  if (typeof resultado === "string") return falla(resultado);

  // Cambian jornales, personal y obras.
  revalidatePath("/", "layout");
  return ok(resultado);
}
