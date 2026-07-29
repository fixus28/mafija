/** Pravila i granice — na jednom mestu, da ih i server i klijent citaju isto. */

/**
 * Minimalan broj igraca za start partije.
 * Realno pravilo je 6; drzimo 4 tokom razvoja da mozes da testiras
 * sa dve-tri kartice u browseru. Podigni na 6 pred odbranu.
 */
export const MIN_PLAYERS = 4;

export const MAX_PLAYERS = 12;

export const ROOM_CODE_LENGTH = 6;

/**
 * Alfabet za kod sobe — bez znakova koji se lako mesaju (0/O, 1/I/L).
 * Kod se cita naglas preko poziva, pa je citljivost bitnija od gustine.
 */
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Koliko dugo prazna soba (svi diskonektovani) zivi pre gasenja, u ms. */
export const EMPTY_ROOM_TTL_MS = 10 * 60 * 1000;

export const NAME_MIN_LENGTH = 2;
export const NAME_MAX_LENGTH = 16;

/** Trajanje faza partije, u sekundama. Lako podesivo dok balansiramo igru. */
export const ROLE_REVEAL_SECONDS = 10;
export const NIGHT_ACTION_SECONDS = 20;
export const DAWN_DISPLAY_SECONDS = 6;
export const DAY_DISCUSSION_SECONDS = 120;
export const VOTING_SECONDS = 30;
export const RESOLUTION_DISPLAY_SECONDS = 6;
/** Mini-diskusija pred reglasanje kad je nereseno — 4x kraca od redovne. */
export const MINI_DISCUSSION_SECONDS = DAY_DISCUSSION_SECONDS / 4;
