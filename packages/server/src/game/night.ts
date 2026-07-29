import type { Role } from "@mafija/shared";

export interface NightActions {
  /** Zrtva koju mafija bira za ubistvo. */
  mafiaTarget: string | null;
  /** Koga dama utisava za sledecu diskusiju — postoji samo dok ACCOMPLICE igra. */
  accompliceTarget: string | null;
  /** Koga lekar leci ove noci. */
  doctorTarget: string | null;
  /** Koga policajac proverava ove noci. */
  detectiveTarget: string | null;
}

export interface NightResult {
  /** Ko je umro ove noci — null ako niko (lekar je pogodio, ili mafija nije birala). */
  killed: string | null;
  /** Da li je lekar spasao metu mafije (za narator poruku "pokusaj ubistva"). */
  savedByDoctor: boolean;
  /** Koga je dama utisala; vazi samo za narednu DAY_DISCUSSION fazu. */
  silenced: string | null;
  /** Privatan odgovor policajcu. */
  detectiveResult: { target: string; isMafia: boolean } | null;
}

/**
 * Razresava jednu noc. Dama je za policajca namerno "cista" (isMafia: false)
 * cak i dok jos radi sa mafijom — to joj je jedina zastita od otkrivanja.
 */
export function resolveNight(
  roles: ReadonlyMap<string, Role>,
  actions: NightActions,
): NightResult {
  const victim = actions.mafiaTarget;
  const savedByDoctor = victim !== null && victim === actions.doctorTarget;
  const killed = savedByDoctor ? null : victim;

  const detectiveResult = actions.detectiveTarget
    ? {
        target: actions.detectiveTarget,
        isMafia: roles.get(actions.detectiveTarget) === "MAFIA",
      }
    : null;

  return {
    killed,
    savedByDoctor,
    silenced: actions.accompliceTarget,
    detectiveResult,
  };
}
