"use client";

import { useSyncExternalStore } from "react";

const CLAVE = "jornales:mostrarSabado";
const suscriptores = new Set<() => void>();
// Respaldo en memoria por si localStorage no está disponible (modo privado, bloqueado…).
let enMemoria = false;

function leer(): boolean {
  try {
    const valor = localStorage.getItem(CLAVE);
    return valor === null ? enMemoria : valor === "1";
  } catch {
    return enMemoria;
  }
}

function escribir(valor: boolean) {
  enMemoria = valor;
  try {
    localStorage.setItem(CLAVE, valor ? "1" : "0");
  } catch {
    // Sin persistencia: queda el valor en memoria hasta recargar.
  }
  for (const avisar of suscriptores) avisar();
}

function suscribir(avisar: () => void) {
  suscriptores.add(avisar);
  window.addEventListener("storage", avisar);
  return () => {
    suscriptores.delete(avisar);
    window.removeEventListener("storage", avisar);
  };
}

/** Preferencia "Mostrar sábado", guardada por navegador. */
export function useMostrarSabado(): [boolean, (valor: boolean) => void] {
  return [useSyncExternalStore(suscribir, leer, () => false), escribir];
}
