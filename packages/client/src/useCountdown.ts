import { useEffect, useState } from "react";
import { getServerNow } from "./clockSync";

/**
 * Racuna preostale sekunde do phaseEndsAt i sam se osvezava dok tajmer tice.
 * Server je jedini izvor istine za trajanje faze — ovo je samo prikaz.
 * Koristi getServerNow() (ne goli Date.now()) jer je phaseEndsAt apsolutan
 * trenutak po SERVEROVOM satu — na klijentu sa pogresno podesenim satom bi
 * inace tajmer izgledao kraci/duzi ili se zaglavio na 0.
 */
export function useCountdown(phaseEndsAt: number | null): number | null {
  const [now, setNow] = useState(() => getServerNow());

  useEffect(() => {
    if (phaseEndsAt === null) return;
    const id = setInterval(() => setNow(getServerNow()), 250);
    return () => clearInterval(id);
  }, [phaseEndsAt]);

  if (phaseEndsAt === null) return null;
  return Math.max(0, Math.ceil((phaseEndsAt - now) / 1000));
}
