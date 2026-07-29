import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@mafija/shared";

/**
 * Trajni identitet igraca za trajanje jednog taba. Refresh stranice
 * (ili pad mreze) vraca igraca na NJEGOVO mesto u sobi, a ne kao novog.
 */
export function getSessionId(): string {
  const KEY = "mafija:sessionId";
  // sessionStorage, NE localStorage: identitet je po tabu, pa dva taba
  // u istom browseru mogu da budu dva razlicita igraca. Refresh taba
  // i dalje cuva identitet (sessionStorage prezivi reload).
  let id = sessionStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(KEY, id);
  }
  return id;
}

/**
 * URL servera: u razvoju gadja isti host na portu 3001 (radi i kad
 * stranicu otvoris sa telefona preko lokalne IP adrese racunara). U
 * produkciji klijent i server dele isti origin — Caddy proksira
 * /socket.io/* ka serveru, pa nema posebnog porta.
 */
const SERVER_URL = import.meta.env.DEV
  ? `${window.location.protocol}//${window.location.hostname}:3001`
  : window.location.origin;

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> =
  io(SERVER_URL);
