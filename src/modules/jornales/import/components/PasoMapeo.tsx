"use client";

import { ArrowLeft, ArrowRight, Check, CheckCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { MOTIVOS_AUSENCIA, type MotivoAusencia } from "../../schema";
import type { Analisis, Origen, TextoAMapear } from "../actions";
import type { DecisionDestino, DecisionTrabajador } from "../validation";
import { listo, obraNueva, trabajadorNuevo, type EstadoMapeo, type Mapeo, type TipoObraOpcion } from "./ImportarView";

type Opciones = Analisis["opciones"];

const ETIQUETA_ORIGEN: Record<Origen, string> = {
  alias: "Importación anterior",
  exacta: "Mismo nombre",
  aproximada: "Nombre parecido",
};

// ── Valor del <Select> ⇄ decisión ────────────────────────────────────────────

function valorTrabajador(d: DecisionTrabajador | null): string {
  if (!d) return "";
  return d.accion === "existente" ? `t:${d.id}` : d.accion;
}

function decisionTrabajador(valor: string, texto: string, actual: DecisionTrabajador | null): DecisionTrabajador {
  if (valor.startsWith("t:")) return { accion: "existente", id: valor.slice(2) };
  if (valor === "nuevo") return actual?.accion === "nuevo" ? actual : trabajadorNuevo(texto);
  return { accion: "ignorar" };
}

function valorDestino(d: DecisionDestino | null): string {
  if (!d) return "";
  if (d.accion === "existente") return `o:${d.id}`;
  if (d.accion === "ausente") return `m:${d.motivo}`;
  return d.accion;
}

function decisionDestino(valor: string, texto: string, actual: DecisionDestino | null): DecisionDestino {
  if (valor.startsWith("o:")) return { accion: "existente", id: valor.slice(2) };
  if (valor.startsWith("m:")) return { accion: "ausente", motivo: valor.slice(2) as MotivoAusencia };
  if (valor === "nuevo") return actual?.accion === "nuevo" ? actual : obraNueva(texto);
  return { accion: "ignorar" };
}

export function PasoMapeo({
  analisis,
  mapeo,
  setMapeo,
  tiposObra,
  onVolver,
  onContinuar,
}: {
  analisis: Analisis;
  mapeo: Mapeo;
  setMapeo: React.Dispatch<React.SetStateAction<Mapeo>>;
  tiposObra: TipoObraOpcion[];
  onVolver: () => void;
  onContinuar: () => void;
}) {
  const { opciones } = analisis;

  function cambiar<K extends keyof Mapeo>(tipo: K, clave: string, cambio: Partial<Mapeo[K][string]>) {
    setMapeo((m) => ({ ...m, [tipo]: { ...m[tipo], [clave]: { ...m[tipo][clave]!, ...cambio } } }));
  }

  /** Confirma de una vez todas las sugerencias con el mismo nombre (sin las parecidas). */
  function confirmarExactas() {
    setMapeo((m) => {
      const confirmar = <D,>(r: Record<string, EstadoMapeo<D>>) =>
        Object.fromEntries(
          Object.entries(r).map(([k, e]) => [k, e.origen === "exacta" && e.decision ? { ...e, confirmado: true } : e]),
        );
      return { trabajadores: confirmar(m.trabajadores), destinos: confirmar(m.destinos) };
    });
  }

  const estados = [...Object.values(mapeo.trabajadores), ...Object.values(mapeo.destinos)];
  const pendientes = estados.filter((e) => !listo(e)).length;
  const exactasSinConfirmar = estados.filter((e) => e.origen === "exacta" && e.decision && !e.confirmado).length;

  return (
    <div className="grid gap-8">
      <p className="max-w-3xl text-sm text-muted-foreground">
        Elegí a qué corresponde cada texto de la planilla. Las sugerencias ya vienen elegidas pero hay que confirmarlas
        (las resaltadas). Lo que confirmes se recuerda para la próxima importación.
      </p>

      <Seccion
        titulo="Trabajadores"
        textos={analisis.trabajadores}
        mapeo={mapeo.trabajadores}
        onConfirmar={(clave) => cambiar("trabajadores", clave, { confirmado: true })}
      >
        {(t, e) => (
          <ControlTrabajador
            texto={t.texto}
            estado={e}
            opciones={opciones}
            onCambiar={(cambio) => cambiar("trabajadores", t.clave, cambio)}
          />
        )}
      </Seccion>

      <Seccion
        titulo="Destinos"
        descripcion='Las X ("XXX") ya se cargan como falta y no aparecen acá.'
        textos={analisis.destinos}
        mapeo={mapeo.destinos}
        onConfirmar={(clave) => cambiar("destinos", clave, { confirmado: true })}
      >
        {(t, e) => (
          <ControlDestino
            texto={t.texto}
            estado={e}
            opciones={opciones}
            tiposObra={tiposObra}
            onCambiar={(cambio) => cambiar("destinos", t.clave, cambio)}
          />
        )}
      </Seccion>

      <div className="sticky bottom-0 -mx-1 flex flex-wrap items-center gap-3 border-t bg-background px-1 py-3">
        <Button variant="outline" onClick={onVolver}>
          <ArrowLeft /> Volver
        </Button>
        {exactasSinConfirmar > 0 && (
          <Button variant="outline" onClick={confirmarExactas}>
            <CheckCheck /> Confirmar las de mismo nombre ({exactasSinConfirmar})
          </Button>
        )}
        <span className="ml-auto text-sm text-muted-foreground">
          {pendientes === 0 ? "Todo asignado." : `Faltan ${pendientes} por decidir o confirmar.`}
        </span>
        <Button onClick={onContinuar} disabled={pendientes > 0}>
          Continuar <ArrowRight />
        </Button>
      </div>
    </div>
  );
}

function Seccion<D extends DecisionTrabajador | DecisionDestino>({
  titulo,
  descripcion,
  textos,
  mapeo,
  onConfirmar,
  children,
}: {
  titulo: string;
  descripcion?: string;
  textos: TextoAMapear<D>[];
  mapeo: Record<string, EstadoMapeo<D>>;
  onConfirmar: (clave: string) => void;
  children: (t: TextoAMapear<D>, e: EstadoMapeo<D>) => React.ReactNode;
}) {
  return (
    <section aria-labelledby={`seccion-${titulo}`} className="grid gap-2">
      <div>
        <h2 id={`seccion-${titulo}`} className="text-base font-medium">
          {titulo} <span className="text-muted-foreground">({textos.length})</span>
        </h2>
        {descripcion && <p className="text-sm text-muted-foreground">{descripcion}</p>}
      </div>
      {textos.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay nada para asignar.</p>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>En la planilla</TableHead>
                <TableHead className="text-right">Veces</TableHead>
                <TableHead>Corresponde a</TableHead>
                <TableHead className="w-48">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {textos.map((t) => {
                const e = mapeo[t.clave]!;
                const porConfirmar = e.decision !== null && !e.confirmado;
                return (
                  <TableRow
                    key={t.clave}
                    className={cn(porConfirmar && "bg-amber-50 hover:bg-amber-100/70 dark:bg-amber-950/30")}
                  >
                    <TableCell className="align-top">
                      <div className="font-medium">{t.texto}</div>
                      {t.variantes.length > 1 && (
                        <div className="text-xs text-muted-foreground">También: {t.variantes.slice(1).join(" · ")}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-right align-top tabular-nums">{t.ocurrencias}</TableCell>
                    <TableCell className="align-top">{children(t, e)}</TableCell>
                    <TableCell className="align-top">
                      <EstadoFila estado={e} onConfirmar={() => onConfirmar(t.clave)} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}

function EstadoFila<D extends DecisionTrabajador | DecisionDestino>({
  estado: e,
  onConfirmar,
}: {
  estado: EstadoMapeo<D>;
  onConfirmar: () => void;
}) {
  if (!e.decision) return <span className="text-sm text-destructive">Elegí una opción</span>;
  if (!e.confirmado) {
    return (
      <div className="flex flex-col items-start gap-1">
        <Badge variant="outline" className="border-amber-400 text-amber-800 dark:text-amber-300">
          {e.origen ? ETIQUETA_ORIGEN[e.origen] : "Sugerido"}
        </Badge>
        <Button size="sm" variant="outline" className="h-7" onClick={onConfirmar}>
          <Check /> Confirmar
        </Button>
      </div>
    );
  }
  if (!listo(e)) return <span className="text-sm text-destructive">Completá el nombre</span>;
  return (
    <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <Check className="size-4 text-green-600" />
      {e.origen === "alias" ? ETIQUETA_ORIGEN.alias : "Confirmado"}
    </span>
  );
}

function ControlTrabajador({
  texto,
  estado,
  opciones,
  onCambiar,
}: {
  texto: string;
  estado: EstadoMapeo<DecisionTrabajador>;
  opciones: Opciones;
  onCambiar: (cambio: Partial<EstadoMapeo<DecisionTrabajador>>) => void;
}) {
  const d = estado.decision;
  return (
    <div className="grid gap-2">
      <Select
        value={valorTrabajador(d)}
        onValueChange={(v) => onCambiar({ decision: decisionTrabajador(v, texto, d), confirmado: true, origen: null })}
      >
        <SelectTrigger className="w-64" aria-label={`Trabajador para ${texto}`}>
          <SelectValue placeholder="Elegí…" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Personal</SelectLabel>
            {opciones.trabajadores.map((t) => (
              <SelectItem key={t.id} value={`t:${t.id}`}>
                {t.nombre}
                {!t.activo && <span className="text-muted-foreground"> (inactivo)</span>}
              </SelectItem>
            ))}
          </SelectGroup>
          <SelectSeparator />
          <SelectItem value="nuevo">Crear trabajador nuevo</SelectItem>
          <SelectItem value="ignorar">Ignorar (no cargar sus jornales)</SelectItem>
        </SelectContent>
      </Select>
      {d?.accion === "nuevo" && (
        <div className="flex gap-2">
          <Input
            aria-label="Nombre"
            placeholder="Nombre"
            className="w-32"
            value={d.nombre}
            onChange={(e) => onCambiar({ decision: { ...d, nombre: e.target.value }, confirmado: true })}
          />
          <Input
            aria-label="Apellido"
            placeholder="Apellido"
            className="w-32"
            value={d.apellido}
            onChange={(e) => onCambiar({ decision: { ...d, apellido: e.target.value }, confirmado: true })}
          />
        </div>
      )}
    </div>
  );
}

function ControlDestino({
  texto,
  estado,
  opciones,
  tiposObra,
  onCambiar,
}: {
  texto: string;
  estado: EstadoMapeo<DecisionDestino>;
  opciones: Opciones;
  tiposObra: TipoObraOpcion[];
  onCambiar: (cambio: Partial<EstadoMapeo<DecisionDestino>>) => void;
}) {
  const d = estado.decision;
  const activas = opciones.obras.filter((o) => o.estado === "activa");
  const terminadas = opciones.obras.filter((o) => o.estado !== "activa");
  const itemObra = (o: Opciones["obras"][number]) => (
    <SelectItem key={o.id} value={`o:${o.id}`}>
      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: o.color }} aria-hidden />
      {o.nombre}
    </SelectItem>
  );

  return (
    <div className="grid gap-2">
      <Select
        value={valorDestino(d)}
        onValueChange={(v) => onCambiar({ decision: decisionDestino(v, texto, d), confirmado: true, origen: null })}
      >
        <SelectTrigger className="w-64" aria-label={`Destino para ${texto}`}>
          <SelectValue placeholder="Elegí…" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Obras activas</SelectLabel>
            {activas.map(itemObra)}
          </SelectGroup>
          {terminadas.length > 0 && (
            <SelectGroup>
              <SelectLabel>Obras terminadas</SelectLabel>
              {terminadas.map(itemObra)}
            </SelectGroup>
          )}
          <SelectSeparator />
          <SelectGroup>
            <SelectLabel>Ausente</SelectLabel>
            {MOTIVOS_AUSENCIA.map((m) => (
              <SelectItem key={m.value} value={`m:${m.value}`}>
                Ausente: {m.label}
              </SelectItem>
            ))}
          </SelectGroup>
          <SelectSeparator />
          <SelectItem value="nuevo">Crear obra nueva</SelectItem>
          <SelectItem value="ignorar">Ignorar (no cargar)</SelectItem>
        </SelectContent>
      </Select>
      {d?.accion === "nuevo" && (
        <div className="flex gap-2">
          <Input
            aria-label="Nombre de la obra"
            placeholder="Nombre de la obra"
            className="w-40"
            value={d.nombre}
            onChange={(e) => onCambiar({ decision: { ...d, nombre: e.target.value }, confirmado: true })}
          />
          <Select
            value={d.tipo}
            onValueChange={(tipo) =>
              onCambiar({ decision: { ...d, tipo: tipo as TipoObraOpcion["value"] }, confirmado: true })
            }
          >
            <SelectTrigger className="w-28" aria-label="Tipo de obra">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {tiposObra.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
