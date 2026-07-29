import type { Role } from "@mafija/shared";

export type VoteOutcome =
  | { status: "eliminated"; targetId: string }
  | { status: "skipped" }
  | { status: "tie"; candidates: string[] };

/**
 * Prebrojava glasove. `votes` mapira glasaca na metu, gde null znaci
 * "preskoci". Racunaju se samo glasovi glasaca iz `eligibleVoters` na mete
 * iz `candidates` (ili null) — ovo isto pokriva i redovno glasanje (svi
 * zivi biraju medju svima zivima) i reglasavanje kad je nereseno (samo
 * neizjednaceni biraju, samo medju izjednacenima).
 *
 * Ako "preskoci" ima strogo najvise glasova, ili je nereseno izmedju
 * "preskoci" i najvise JEDNOG igraca, niko ne ispada (grad je oprezan).
 * Nereseno izmedju DVA ILI VISE igraca vraca taj skup — pozivalac onda
 * pokrece mini-diskusiju i reglasavanje samo medju njima.
 */
export function resolveVote(
  votes: ReadonlyMap<string, string | null>,
  eligibleVoters: readonly string[],
  candidates: readonly string[],
): VoteOutcome {
  const tally = new Map<string | null, number>();
  for (const [voter, target] of votes) {
    if (!eligibleVoters.includes(voter)) continue;
    if (target !== null && !candidates.includes(target)) continue;
    tally.set(target, (tally.get(target) ?? 0) + 1);
  }

  let best: (string | null)[] = [];
  let bestCount = 0;
  for (const [target, count] of tally) {
    if (count > bestCount) {
      best = [target];
      bestCount = count;
    } else if (count === bestCount) {
      best.push(target);
    }
  }

  if (best.length === 1) {
    const winner = best[0];
    return winner === null ? { status: "skipped" } : { status: "eliminated", targetId: winner };
  }

  const tiedPlayers = best.filter((id): id is string => id !== null).sort();
  if (tiedPlayers.length >= 2) {
    return { status: "tie", candidates: tiedPlayers };
  }
  // Prazno glasanje, ili nereseno gde je "preskoci" izjednaceno sa najvise
  // jednim igracem — u oba slucaja grad ne izbacuje nikog.
  return { status: "skipped" };
}

export interface EliminationOutcome {
  roles: Map<string, Role>;
  /** Da li se dama ovom eliminacijom pretvorila u novu mafiju. */
  accompliceConverted: boolean;
}

/**
 * Primenjuje posledice glasanja na uloge: ako je izbacena MAFIA, jedina
 * preostala ACCOMPLICE postaje nova MAFIA i gubi moc utisavanja. Ako je
 * izbacena ACCOMPLICE, mafija ostaje ista — nista se ne menja. Uloga
 * izbacenog igraca se namerno nikad ne otkriva (deo pravila, ne ovog koda).
 */
export function applyElimination(
  roles: ReadonlyMap<string, Role>,
  eliminatedId: string | null,
): EliminationOutcome {
  const next = new Map(roles);
  if (eliminatedId === null || next.get(eliminatedId) !== "MAFIA") {
    return { roles: next, accompliceConverted: false };
  }

  for (const [id, role] of next) {
    if (role === "ACCOMPLICE") {
      next.set(id, "MAFIA");
      return { roles: next, accompliceConverted: true };
    }
  }
  return { roles: next, accompliceConverted: false };
}
