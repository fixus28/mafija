/**
 * Zajednicki tipovi igre — koriste ih i server i klijent.
 * Server je jedini izvor istine; klijent samo renderuje ovo stanje.
 */

/** Faze kroz koje server vodi partiju (game engine stize u fazi 3 razvoja). */
export type GamePhase =
  | "LOBBY"
  | "ROLE_REVEAL"
  | "NIGHT"
  | "DAWN"
  | "DAY_DISCUSSION"
  | "VOTING"
  | "MINI_DISCUSSION"
  | "RESOLUTION"
  | "GAME_OVER";

/**
 * ACCOMPLICE = dama: radi sa mafijom i zna ko je mafija (jedina uloga sa
 * tom privilegijom), ali za policajca vazi kao "nije mafija".
 */
export type Role = "MAFIA" | "ACCOMPLICE" | "DOCTOR" | "DETECTIVE" | "CIVILIAN";

/**
 * Javni prikaz igraca — ono sto SVI u sobi smeju da vide.
 * Namerno ne sadrzi sessionId ni ulogu: uloge se kasnije salju
 * iskljucivo privatno, svakom igracu posebno.
 */
export interface PublicPlayer {
  /** Javni identifikator igraca (nije sessionId!). */
  id: string;
  name: string;
  isHost: boolean;
  connected: boolean;
  alive: boolean;
  /** Selfie snimljen na pocetku partije (data URL) — null dok se ne posalje. */
  photoUrl: string | null;
}

/** Javno stanje sobe koje server emituje svima u sobi. */
export interface PublicRoomState {
  code: string;
  phase: GamePhase;
  players: PublicPlayer[];
  minPlayers: number;
  maxPlayers: number;
  /** Kad trenutna faza istice (ms epoha) — klijent sam renderuje odbrojavanje. Null van tajmerskih faza. */
  phaseEndsAt: number | null;
  /**
   * Javni id igraca kog je dama utisala za tekucu diskusiju. Namerno javno
   * (ne samo tom igracu) — kasnije ce mu se u ovoj situaciji vidljivo gasiti
   * mikrofon dok su svima ostalima upaljeni, pa i ovde svi znaju ko je utisan.
   */
  silencedPlayerId: string | null;
  /**
   * Postavljeno kad je glasanje nereseno izmedju dva ili vise igraca:
   * ti igraci ne glasaju u reglasavanju, a bira se samo izmedju njih
   * (ili "preskoci"). Null van reglasavanja.
   */
  runoff: { candidateIds: string[]; excludedPlayerIds: string[] } | null;
  /**
   * Ko je za koga glasao u POSLEDNJEM zavrsenom glasanju (javno — ne
   * otkriva uloge, samo ponasanje). Null pre prvog glasanja; posle toga se
   * PREPISUJE (ne gomila istoriju) svakim novim glasanjem, ukljucujuci
   * reglasavanja. targetId je null za glas "preskoci".
   */
  lastVoteBreakdown: { voterId: string; targetId: string | null }[] | null;
}
