import { MIN_PLAYERS, type Role } from "@mafija/shared";

/**
 * Podela uloga. Dama (ACCOMPLICE) igra samo sa 7+ igraca; ispod toga je
 * jedina mracna uloga MAFIA, da partija ostane balansirana sa malo ljudi.
 * Uvek tacno jedan lekar i jedan policajac, ostalo gradjani.
 */
export function assignRoles(playerIds: readonly string[]): Map<string, Role> {
  if (playerIds.length < MIN_PLAYERS) {
    throw new Error(`Potrebno je bar ${MIN_PLAYERS} igraca za podelu uloga.`);
  }

  const shuffled = shuffle(playerIds);
  const roles = new Map<string, Role>();
  const useAccomplice = shuffled.length >= 7;

  let i = 0;
  roles.set(shuffled[i++], "MAFIA");
  if (useAccomplice) roles.set(shuffled[i++], "ACCOMPLICE");
  roles.set(shuffled[i++], "DOCTOR");
  roles.set(shuffled[i++], "DETECTIVE");
  for (; i < shuffled.length; i++) roles.set(shuffled[i], "CIVILIAN");

  return roles;
}

function shuffle<T>(items: readonly T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
