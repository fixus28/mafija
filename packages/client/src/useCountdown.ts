import { useEffect, useState } from "react";

/**
 * Racuna preostale sekunde do phaseEndsAt i sam se osvezava dok tajmer tice.
 * Server je jedini izvor istine za trajanje faze — ovo je samo prikaz.
 */
export function useCountdown(phaseEndsAt: number | null): number | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (phaseEndsAt === null) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [phaseEndsAt]);

  if (phaseEndsAt === null) return null;
  return Math.max(0, Math.ceil((phaseEndsAt - now) / 1000));
}
