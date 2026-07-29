import type { Role } from "@mafija/shared";

export type WinResult = "TOWN" | "MAFIA" | null;

/**
 * Mracni igraci (MAFIA + ACCOMPLICE) ne mogu da umru nocu — mafija ne
 * bira sebe za zrtvu — pa jedini nacin da njihov broj padne na 0 je
 * glasanjem. Zato ova jedna provera (broj mracnih vs. ostalih zivih)
 * pokriva oba uslova iz pravila: "grad pobedjuje kad odu i mafija i dama"
 * i "mafija pobedjuje kad joj broj izjednaci ostale".
 */
export function checkWinCondition(
  roles: ReadonlyMap<string, Role>,
  aliveIds: readonly string[],
): WinResult {
  let evil = 0;
  let good = 0;
  for (const id of aliveIds) {
    const role = roles.get(id);
    if (role === "MAFIA" || role === "ACCOMPLICE") evil++;
    else good++;
  }
  if (evil === 0) return "TOWN";
  if (evil >= good) return "MAFIA";
  return null;
}
