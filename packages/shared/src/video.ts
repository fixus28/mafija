import type { GamePhase } from "./types";

export interface VideoPermission {
  camera: boolean;
  microphone: boolean;
}

/**
 * Da li igrac sme da objavljuje kameru/mikrofon u glavnoj video sobi za
 * dato stanje partije. Deljeno izmedju servera (postavlja stvarna prava
 * preko LiveKit API-ja — server je autoritativan) i klijenta (reaguje
 * odmah, bez cekanja mreze) — ista pravila, jedno mesto.
 *
 * Kamere/mikrofoni su upaljeni samo tokom dnevne diskusije; utisan igrac
 * zadrzava kameru ali mu je mikrofon iskljucen. Mrtvi nemaju nijedno.
 */
export function computeVideoPermission(params: {
  phase: GamePhase;
  alive: boolean;
  silenced: boolean;
}): VideoPermission {
  if (!params.alive) return { camera: false, microphone: false };
  const discussing = params.phase === "DAY_DISCUSSION" || params.phase === "MINI_DISCUSSION";
  if (!discussing) return { camera: false, microphone: false };
  return { camera: true, microphone: !params.silenced };
}
