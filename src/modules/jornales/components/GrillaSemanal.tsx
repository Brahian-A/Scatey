"use client";

import { ChevronDown, Copy } from "lucide-react";
import { useEffect, useMemo, useOptimistic, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { borrarJornales, guardarJornales } from "../actions";
import { diaMes, nombreDia } from "../fechas";
import { formatearJornales } from "../formato";
import type { GrillaSemana, ObraResumen } from "../queries";
import { ETIQUETA_MOTIVO } from "../schema";
import { claveCelda, jornalInput, type Celda, type Jornal } from "../validation";
import { ChipJornal } from "./ChipJornal";
import { SelectorJornal, type ValorCelda } from "./SelectorJornal";

type Pos = { f: number; c: number };
type Cambio = { tipo: "guardar"; registros: Jornal[] } | { tipo: "borrar"; claves: string[] };

function aplicarCambio(actual: Jornal[], cambio: Cambio): Jornal[] {
  const porClave = new Map(actual.map((r) => [claveCelda(r), r]));
  if (cambio.tipo === "guardar") for (const r of cambio.registros) porClave.set(claveCelda(r), r);
  else for (const k of cambio.claves) porClave.delete(k);
  return [...porClave.values()];
}

function conValor(celda: Celda, previo: Jornal | undefined, valor: ValorCelda): Jornal {
  const base = { ...celda, fraccion: previo?.fraccion ?? 1, nota: previo?.nota ?? null };
  return valor.estado === "trabajo"
    ? { ...base, estado: "trabajo", obraId: valor.obraId, motivoAusencia: null }
    : { ...base, estado: "ausente", obraId: null, motivoAusencia: valor.motivoAusencia };
}

export function GrillaSemanal({
  grilla,
  dias,
  hoy,
  copiando,
  onCopiarDia,
}: {
  grilla: GrillaSemana;
  /** Días visibles (YYYY-MM-DD), de lunes a viernes o sábado. */
  dias: string[];
  hoy: string;
  copiando: boolean;
  onCopiarDia: (fecha: string) => void;
}) {
  const { trabajadores, obrasActivas } = grilla;
  const [registros, aplicar] = useOptimistic(grilla.registros, aplicarCambio);
  const [, startTransition] = useTransition();

  const porClave = useMemo(() => new Map(registros.map((r) => [claveCelda(r), r])), [registros]);
  const obrasPorId = useMemo(() => new Map(grilla.obras.map((o) => [o.id, o])), [grilla.obras]);

  // ── Selección: celda activa + ancla forman un rectángulo ──────────────────
  const filas = trabajadores.length;
  const columnas = dias.length;
  const limitar = (p: Pos): Pos => ({
    f: Math.max(0, Math.min(p.f, filas - 1)),
    c: Math.max(0, Math.min(p.c, columnas - 1)),
  });
  const [cursor, setCursor] = useState<{ activa: Pos; ancla: Pos }>({ activa: { f: 0, c: 0 }, ancla: { f: 0, c: 0 } });
  // Si se oculta el sábado, la selección se ajusta a las columnas visibles.
  const activa = limitar(cursor.activa);
  const ancla = limitar(cursor.ancla);
  const rango = {
    f0: Math.min(activa.f, ancla.f),
    f1: Math.max(activa.f, ancla.f),
    c0: Math.min(activa.c, ancla.c),
    c1: Math.max(activa.c, ancla.c),
  };
  const enRango = (f: number, c: number) => f >= rango.f0 && f <= rango.f1 && c >= rango.c0 && c <= rango.c1;

  const [abierto, setAbierto] = useState(false);
  const arrastrando = useRef(false);
  const celdas = useRef(new Map<string, HTMLTableCellElement>());
  const activaRef = useRef(activa);
  activaRef.current = activa;

  const enfocar = (p: Pos) => celdas.current.get(`${p.f}:${p.c}`)?.focus();

  function seleccion(): Celda[] {
    const res: Celda[] = [];
    for (let f = rango.f0; f <= rango.f1; f++) {
      for (let c = rango.c0; c <= rango.c1; c++) res.push({ fecha: dias[c]!, trabajadorId: trabajadores[f]!.id });
    }
    return res;
  }
  const registrosSeleccionados = () =>
    seleccion()
      .map((c) => porClave.get(claveCelda(c)))
      .filter((r): r is Jornal => r !== undefined);

  // Al soltar el mouse (clic o arrastre) se abre el selector sobre la selección.
  useEffect(() => {
    function alSoltar() {
      if (!arrastrando.current) return;
      arrastrando.current = false;
      setAbierto(true);
    }
    window.addEventListener("mouseup", alSoltar);
    return () => window.removeEventListener("mouseup", alSoltar);
  }, []);

  // ── Escrituras (optimistas; si el servidor falla, se revierte solo) ───────
  function guardar(nuevos: Jornal[]) {
    if (nuevos.length === 0) return;
    const validados: Jornal[] = [];
    for (const n of nuevos) {
      const parsed = jornalInput.safeParse(n);
      if (!parsed.success) {
        toast.error(parsed.error.issues[0]?.message ?? "Datos inválidos.");
        return;
      }
      validados.push(parsed.data);
    }
    startTransition(async () => {
      aplicar({ tipo: "guardar", registros: validados });
      const res = await guardarJornales(validados);
      if (!res.ok) toast.error(res.error);
    });
  }

  function asignar(valor: ValorCelda) {
    setAbierto(false);
    guardar(seleccion().map((c) => conValor(c, porClave.get(claveCelda(c)), valor)));
  }

  function alternarMedio() {
    setAbierto(false);
    const regs = registrosSeleccionados();
    const fraccion = regs.every((r) => r.fraccion === 0.5) ? 1 : 0.5;
    guardar(regs.map((r) => ({ ...r, fraccion })));
  }

  function guardarNota(nota: string) {
    setAbierto(false);
    guardar(registrosSeleccionados().map((r) => ({ ...r, nota })));
  }

  function vaciar() {
    setAbierto(false);
    const regs = registrosSeleccionados();
    if (regs.length === 0) return;
    startTransition(async () => {
      aplicar({ tipo: "borrar", claves: regs.map(claveCelda) });
      const res = await borrarJornales(regs.map(({ fecha, trabajadorId }) => ({ fecha, trabajadorId })));
      if (!res.ok) toast.error(res.error);
    });
  }

  // ── Teclado y mouse ───────────────────────────────────────────────────────
  function mover(df: number, dc: number, extender: boolean) {
    const nueva = limitar({ f: activa.f + df, c: activa.c + dc });
    setCursor({ activa: nueva, ancla: extender ? ancla : nueva });
    enfocar(nueva);
  }

  function alTeclear(e: React.KeyboardEvent<HTMLTableElement>) {
    // Ignora lo que llega desde el selector (está en un portal pero burbujea por React).
    if (!(e.target instanceof HTMLElement) || e.target.dataset.celda === undefined) return;
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    switch (e.key) {
      case "ArrowUp":
        mover(-1, 0, e.shiftKey);
        break;
      case "ArrowDown":
        mover(1, 0, e.shiftKey);
        break;
      case "ArrowLeft":
        mover(0, -1, e.shiftKey);
        break;
      case "ArrowRight":
        mover(0, 1, e.shiftKey);
        break;
      case "Enter":
      case "F2":
        setAbierto(true);
        break;
      case "Delete":
      case "Backspace":
        vaciar();
        break;
      case "Escape":
        setCursor({ activa, ancla: activa });
        break;
      case "f":
      case "F":
        asignar({ estado: "ausente", motivoAusencia: "falta" });
        break;
      default:
        return;
    }
    e.preventDefault();
  }

  function alPresionar(e: React.MouseEvent<HTMLTableCellElement>, pos: Pos) {
    if (e.button !== 0 || !e.currentTarget.contains(e.target as Node)) return;
    e.preventDefault(); // evita seleccionar texto al arrastrar; el foco se maneja a mano
    e.currentTarget.focus();
    setCursor({ activa: pos, ancla: e.shiftKey ? ancla : pos });
    setAbierto(false);
    arrastrando.current = true;
  }

  // ── Totales y resumen ─────────────────────────────────────────────────────
  const totales = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of registros) if (r.estado === "trabajo") m.set(r.trabajadorId, (m.get(r.trabajadorId) ?? 0) + r.fraccion);
    return m;
  }, [registros]);

  const resumenPorDia = useMemo(() => {
    const m = new Map<string, { obras: Map<string, number>; faltas: number }>();
    for (const r of registros) {
      const dia = m.get(r.fecha) ?? { obras: new Map<string, number>(), faltas: 0 };
      if (r.estado === "trabajo") dia.obras.set(r.obraId, (dia.obras.get(r.obraId) ?? 0) + 1);
      else if (r.motivoAusencia === "falta") dia.faltas++;
      m.set(r.fecha, dia);
    }
    return m;
  }, [registros]);

  if (filas === 0) {
    return (
      <div className="rounded-lg border border-dashed py-16 text-center text-sm text-muted-foreground">
        No hay trabajadores activos. Agregalos en Personal.
      </div>
    );
  }

  const seleccionadas = (rango.f1 - rango.f0 + 1) * (rango.c1 - rango.c0 + 1);
  const conRegistro = abierto ? registrosSeleccionados() : [];

  return (
    <div className="grid gap-2">
      <div className="max-h-[calc(100svh-11rem)] overflow-auto rounded-lg border">
        <table
          role="grid"
          aria-label="Jornales de la semana"
          aria-multiselectable
          className="w-full table-fixed border-separate border-spacing-0 text-sm"
          onKeyDown={alTeclear}
        >
          <colgroup>
            <col className="w-40" />
            {dias.map((d) => (
              <col key={d} />
            ))}
            <col className="w-16" />
          </colgroup>
          <thead>
            <tr>
              <th className="sticky top-0 left-0 z-30 border-b bg-background px-3 py-2 text-left font-medium">
                Trabajador
              </th>
              {dias.map((fecha) => (
                <th
                  key={fecha}
                  className={cn(
                    "sticky top-0 z-20 border-b border-l bg-background py-1 pr-1 pl-2 text-left font-medium",
                    fecha === hoy && "bg-amber-50",
                  )}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate">
                      {nombreDia(fecha)} <span className="font-normal text-muted-foreground">{diaMes(fecha)}</span>
                    </span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-xs" aria-label={`Opciones del ${nombreDia(fecha)} ${diaMes(fecha)}`}>
                          <ChevronDown />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-auto">
                        <DropdownMenuItem disabled={copiando} onSelect={() => onCopiarDia(fecha)}>
                          <Copy /> Copiar del día anterior
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </th>
              ))}
              <th className="sticky top-0 z-20 border-b border-l bg-background px-2 py-2 text-right font-medium" title="Jornales trabajados en la semana">
                Total
              </th>
            </tr>
          </thead>

          <tbody>
            {trabajadores.map((t, f) => {
              const total = totales.get(t.id) ?? 0;
              return (
                <tr key={t.id}>
                  <th
                    scope="row"
                    className={cn(
                      "sticky left-0 z-10 truncate border-b bg-background px-3 text-left font-medium",
                      !t.activo && "text-muted-foreground",
                    )}
                    title={t.nombre}
                  >
                    {t.nombre}
                    {!t.activo && <span className="ml-1.5 text-xs font-normal">(inactivo)</span>}
                  </th>
                  {dias.map((fecha, c) => {
                    const reg = porClave.get(claveCelda({ fecha, trabajadorId: t.id }));
                    const esActiva = f === activa.f && c === activa.c;
                    const seleccionada = enRango(f, c);
                    return (
                      <td
                        key={fecha}
                        ref={(el) => {
                          if (el) celdas.current.set(`${f}:${c}`, el);
                          else celdas.current.delete(`${f}:${c}`);
                        }}
                        role="gridcell"
                        data-celda=""
                        tabIndex={esActiva ? 0 : -1}
                        aria-selected={seleccionada}
                        aria-label={`${t.nombre}, ${nombreDia(fecha)} ${diaMes(fecha)}: ${describir(reg, obrasPorId)}`}
                        title={reg?.nota ?? undefined}
                        className={cn(
                          "relative h-10 cursor-pointer border-b border-l px-1 outline-none select-none",
                          fecha === hoy && "bg-amber-50/50",
                          seleccionada && "bg-sky-100/70",
                          esActiva && "ring-2 ring-sky-500/60 ring-inset focus:ring-sky-600",
                        )}
                        onMouseDown={(e) => alPresionar(e, { f, c })}
                        onMouseEnter={() => {
                          if (arrastrando.current) setCursor((cur) => ({ ...cur, activa: { f, c } }));
                        }}
                      >
                        {reg && <ChipJornal jornal={reg} obra={reg.obraId ? obrasPorId.get(reg.obraId) : undefined} />}
                        {reg?.nota && (
                          <span
                            className="absolute top-0 right-0 size-0 border-t-[7px] border-l-[7px] border-t-amber-500 border-l-transparent"
                            aria-hidden
                          />
                        )}
                        {esActiva && (
                          <Popover open={abierto} onOpenChange={setAbierto}>
                            <PopoverAnchor asChild>
                              <span className="pointer-events-none absolute inset-0" />
                            </PopoverAnchor>
                            <PopoverContent
                              align="start"
                              className="w-72 p-0"
                              onCloseAutoFocus={(e) => {
                                e.preventDefault();
                                if (document.activeElement === document.body) enfocar(activaRef.current);
                              }}
                            >
                              <SelectorJornal
                                obrasActivas={obrasActivas}
                                actual={seleccionadas === 1 ? reg : undefined}
                                cantidad={seleccionadas}
                                conRegistro={conRegistro.length}
                                todosMedio={conRegistro.every((r) => r.fraccion === 0.5)}
                                onAsignar={asignar}
                                onMedio={alternarMedio}
                                onNota={guardarNota}
                                onVaciar={vaciar}
                              />
                            </PopoverContent>
                          </Popover>
                        )}
                      </td>
                    );
                  })}
                  <td
                    className={cn(
                      "border-b border-l px-2 text-right font-semibold tabular-nums",
                      total === 0 && "font-normal text-muted-foreground",
                    )}
                  >
                    {formatearJornales(total)}
                  </td>
                </tr>
              );
            })}
          </tbody>

          <tfoot>
            <tr>
              <th className="sticky bottom-0 left-0 z-30 bg-muted px-3 py-2 text-left align-top text-xs font-medium text-muted-foreground">
                Resumen
              </th>
              {dias.map((fecha) => (
                <td key={fecha} className="sticky bottom-0 z-20 border-l bg-muted px-2 py-1.5 align-top">
                  <ResumenDia resumen={resumenPorDia.get(fecha)} obrasPorId={obrasPorId} />
                </td>
              ))}
              <td className="sticky bottom-0 z-20 border-l bg-muted" />
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Clic o Enter: elegir · Arrastrar o Shift+flechas: seleccionar varias · F: falta · Supr: vaciar · Esc: cancelar
      </p>
    </div>
  );
}

function describir(reg: Jornal | undefined, obrasPorId: Map<string, ObraResumen>): string {
  if (!reg) return "vacío";
  const medio = reg.fraccion === 0.5 ? " (medio jornal)" : "";
  if (reg.estado === "trabajo") return `${obrasPorId.get(reg.obraId)?.nombre ?? "obra"}${medio}`;
  return `${ETIQUETA_MOTIVO[reg.motivoAusencia]}${medio}`;
}

function ResumenDia({
  resumen,
  obrasPorId,
}: {
  resumen: { obras: Map<string, number>; faltas: number } | undefined;
  obrasPorId: Map<string, ObraResumen>;
}) {
  if (!resumen) return <span className="text-xs text-muted-foreground">—</span>;
  const obras = [...resumen.obras.entries()].sort((a, b) => b[1] - a[1]);
  return (
    <div className="flex flex-wrap gap-x-1 gap-y-0.5 text-[11px] leading-tight">
      {obras.map(([id, n], i) => {
        const obra = obrasPorId.get(id);
        return (
          <span key={id} className="inline-flex min-w-0 items-center gap-1">
            {i > 0 && <span className="text-muted-foreground" aria-hidden>·</span>}
            <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: obra?.color }} aria-hidden />
            <span className="truncate">{obra?.nombre ?? "Obra"}</span>
            <span className="font-semibold tabular-nums">{n}</span>
          </span>
        );
      })}
      {resumen.faltas > 0 && (
        <span className="font-medium text-red-700">
          {obras.length > 0 && <span className="text-muted-foreground" aria-hidden>· </span>}
          Faltas <span className="tabular-nums">{resumen.faltas}</span>
        </span>
      )}
    </div>
  );
}
