import { socket } from "./socket";

/**
 * Procenjena razlika (ms) izmedju serverovog i klijentovog sata. `phaseEndsAt`
 * je apsolutan trenutak po SERVEROVOM satu — ako je klijentov sat pogresno
 * podesen (cest slucaj na desktopu), tajmer bi bez ovoga izgledao kraci/duzi
 * ili se zaglavio na 0 dok stvarna promena faze ne stigne sa servera.
 */
let offsetMs = 0;

export function getServerNow(): number {
  return Date.now() + offsetMs;
}

/** Meri razliku sata jednim round-trip-om preko Socket.IO — pozvati pri (re)konekciji. */
export function syncClock(): void {
  const t0 = Date.now();
  socket.emit("time:sync", (res) => {
    const roundTrip = Date.now() - t0;
    // Serverovo vreme je otprilike u sredini round-trip-a (pretpostavlja simetrican put).
    offsetMs = res.serverNow - (t0 + roundTrip / 2);
  });
}
