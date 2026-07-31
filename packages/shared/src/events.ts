import type { PublicRoomState, Role } from "./types";

/**
 * Protokol dogadjaja. Zato sto i server i klijent uvoze OVE iste tipove,
 * TypeScript ne dozvoljava da jedna strana posalje dogadjaj ili payload
 * koji druga strana ne razume.
 */

export interface CreateRoomPayload {
  /** Trajni identitet igraca (UUID iz localStorage) — sluzi za reconnect. */
  sessionId: string;
  name: string;
}

export interface JoinRoomPayload {
  sessionId: string;
  name: string;
  code: string;
}

/** Standardan odgovor servera na zahteve klijenta (Socket.IO acknowledgement). */
export interface RoomActionResult {
  ok: boolean;
  /** Poruka o gresci, spremna za prikaz korisniku. */
  error?: string;
  /** Kod sobe — vraca se pri uspesnom create/join. */
  roomCode?: string;
  /** Javni id ovog igraca, da klijent zna "ko sam ja" u listi. */
  playerId?: string;
}

export interface NightActionPayload {
  /** Javni id mete, ili null da igrac otkaze svoj trenutni izbor. */
  targetId: string | null;
}

export interface VotePayload {
  /** Javni id igraca za kog se glasa, ili null za "preskoci" (niko ne ispada). */
  targetId: string | null;
}

export interface PhotoSubmitPayload {
  /** Selfie kao data URL (JPEG, umanjen na klijentu pre slanja). */
  dataUrl: string;
}

/** Odgovor na zahtev za LiveKit token — odvojeno od RoomActionResult jer nosi drugacija polja. */
export interface LiveKitTokenResult {
  ok: boolean;
  error?: string;
  /** JWT za povezivanje na LiveKit sobu. */
  token?: string;
  /** Adresa LiveKit servera (razlicita za razvoj i produkciju). */
  url?: string;
}

/** Dogadjaji koje klijent salje serveru. */
export interface ClientToServerEvents {
  "room:create": (
    payload: CreateRoomPayload,
    ack: (res: RoomActionResult) => void,
  ) => void;
  "room:join": (
    payload: JoinRoomPayload,
    ack: (res: RoomActionResult) => void,
  ) => void;
  "room:leave": (ack: (res: RoomActionResult) => void) => void;
  "game:start": (ack: (res: RoomActionResult) => void) => void;
  /** Nocni izbor mete — salju samo MAFIA/ACCOMPLICE/DOCTOR/DETECTIVE dok je faza NIGHT. */
  "night:action": (
    payload: NightActionPayload,
    ack: (res: RoomActionResult) => void,
  ) => void;
  /** Glas na dnevnom glasanju — samo dok je faza VOTING, samo zivi igraci. */
  "vote:cast": (
    payload: VotePayload,
    ack: (res: RoomActionResult) => void,
  ) => void;
  /** Trazi token za pridruzivanje LiveKit sobi koja odgovara trenutnoj sobi igre. */
  "livekit:token": (ack: (res: LiveKitTokenResult) => void) => void;
  /**
   * Trazi token za privatni nocni audio kanal mafije i dame. Server ga
   * daje samo MAFIA/ACCOMPLICE, samo dok je faza NIGHT, samo ako oboje
   * (jos) postoje u igri.
   */
  "livekit:mafiaToken": (ack: (res: LiveKitTokenResult) => void) => void;
  /** Salje selfie snimljen na pocetku partije — server ga cuva i prosledjuje svima kroz room:state. */
  "photo:submit": (
    payload: PhotoSubmitPayload,
    ack: (res: RoomActionResult) => void,
  ) => void;
  /**
   * Merenje razlike izmedju klijentovog i serverovog sata — `phaseEndsAt`
   * je apsolutan trenutak po SERVEROVOM satu, pa ako je klijentov sat
   * pogresno podesen (cest slucaj na desktopu), tajmer bi izgledao
   * kraci/duzi ili se zaglavio na 0. Klijent ovo pozove jednom po konekciji.
   */
  "time:sync": (ack: (res: { serverNow: number }) => void) => void;
}

export interface RolePayload {
  role: Role;
  /**
   * Samo za MAFIA/ACCOMPLICE — jedini slucaj da igrac sme da zna tudju
   * ulogu, jer rade zajedno.
   */
  partner?: { id: string; name: string };
}

export interface DetectiveResultPayload {
  targetId: string;
  isMafia: boolean;
}

/**
 * Identifikuje snimljenu naratorovu frazu koju treba pustiti uz poruku
 * (umesto TTS-a). Fiksni deo recenice je snimljen unapred; ime igraca (kad
 * postoji) se NE izgovara — samo prikazuje tekstom u naratorovom logu.
 */
export type NarratorSoundId =
  | "night_victim"
  | "night_saved"
  | "night_calm"
  | "vote_eliminated"
  | "vote_skipped"
  | "vote_tie"
  | "town_wins"
  | "mafia_wins";

export interface NarratorMessagePayload {
  text: string;
  /** Ako postoji, klijent pusta ovaj snimak; ako ga (jos) nema, pada na TTS. */
  sound?: NarratorSoundId;
}

/** Dogadjaji koje server salje klijentima. */
export interface ServerToClientEvents {
  /** Kompletno javno stanje sobe — emituje se svima posle svake promene. */
  "room:state": (state: PublicRoomState) => void;
  /** Soba je ugasena (npr. svi napustili) — klijent se vraca na pocetni ekran. */
  "room:closed": (reason: string) => void;
  /** Privatno, samo tom igracu — njegova uloga za ovu partiju. */
  "game:role": (payload: RolePayload) => void;
  /** Privatno, samo policajcu — rezultat provere posle noci. */
  "game:detectiveResult": (payload: DetectiveResultPayload) => void;
  /** Javna naratorova objava (rezultat noci, glasanja, kraj igre...). */
  "narrator:message": (payload: NarratorMessagePayload) => void;
}
