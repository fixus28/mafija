import { randomUUID } from "node:crypto";
import {
  EMPTY_ROOM_TTL_MS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  type GamePhase,
  type PublicRoomState,
  type Role,
} from "@mafija/shared";
import type { NightActions } from "./game/night";

/**
 * Interni model igraca — sadrzi i ono sto NIKAD ne ide svima
 * (sessionId, uloga). U javno stanje se prevodi kroz toPublicState().
 */
export interface Player {
  sessionId: string;
  /** Javni id — jedino ovo od identifikatora vide ostali klijenti. */
  publicId: string;
  name: string;
  isHost: boolean;
  connected: boolean;
  alive: boolean;
  socketId: string | null;
  /** Null pre nego sto partija pocne (LOBBY). */
  role: Role | null;
}

/** Prazan set nocnih izbora — pocetno stanje i reset posle svake noci. */
export function emptyNightActions(): NightActions {
  return {
    mafiaTarget: null,
    accompliceTarget: null,
    doctorTarget: null,
    detectiveTarget: null,
  };
}

export interface Room {
  code: string;
  phase: GamePhase;
  /** Kljuc je sessionId — to omogucava reconnect posle refresh-a. */
  players: Map<string, Player>;
  cleanupTimer: NodeJS.Timeout | null;
  /** Faza 3: stanje partije u toku — sve se resetuje kad partija pocne/zavrsi. */
  nightActions: NightActions;
  /** Kljuc je sessionId glasaca, vrednost sessionId mete ili null za "preskoci". */
  votes: Map<string, string | null>;
  /** sessionId igraca utisanog za TEKUCI dan (do sledece noci), ili null. */
  silencedSessionId: string | null;
  /** Tajmer koji na isteku trenutne faze pokrece prelaz na sledecu. */
  phaseTimer: NodeJS.Timeout | null;
  /** Kad trenutna faza istice (ms epoha), za `PublicRoomState.phaseEndsAt`. */
  phaseEndsAt: number | null;
  /**
   * Postavljeno kad je glasanje nereseno izmedju 2+ igraca: ti igraci ne
   * glasaju u reglasavanju (excludedVoters), a bira se samo medju njima
   * (candidates). Null van reglasavanja.
   */
  voteRunoff: { candidates: string[]; excludedVoters: string[] } | null;
}

export type JoinResult =
  | { ok: true; room: Room; player: Player; reconnected: boolean }
  | { ok: false; error: string };

const rooms = new Map<string, Room>();

/** Brza veza socket → (soba, igrac), potrebna kod disconnect-a. */
const socketIndex = new Map<string, { code: string; sessionId: string }>();

function generateCode(): string {
  let code = "";
  do {
    code = "";
    for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
      code +=
        ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)];
    }
  } while (rooms.has(code)); // u praksi se nikad ne ponavlja, ali za svaki slucaj
  return code;
}

export function getRoom(code: string): Room | undefined {
  return rooms.get(code.toUpperCase());
}

export function getBindingForSocket(socketId: string) {
  return socketIndex.get(socketId);
}

export function toPublicState(room: Room): PublicRoomState {
  const silenced = room.silencedSessionId
    ? (room.players.get(room.silencedSessionId)?.publicId ?? null)
    : null;
  const runoff = room.voteRunoff
    ? {
        candidateIds: room.voteRunoff.candidates
          .map((id) => room.players.get(id)?.publicId)
          .filter((id): id is string => !!id),
        excludedPlayerIds: room.voteRunoff.excludedVoters
          .map((id) => room.players.get(id)?.publicId)
          .filter((id): id is string => !!id),
      }
    : null;
  return {
    code: room.code,
    phase: room.phase,
    players: [...room.players.values()].map((p) => ({
      id: p.publicId,
      name: p.name,
      isHost: p.isHost,
      connected: p.connected,
      alive: p.alive,
    })),
    minPlayers: MIN_PLAYERS,
    maxPlayers: MAX_PLAYERS,
    phaseEndsAt: room.phaseEndsAt,
    silencedPlayerId: silenced,
    runoff,
  };
}

/** Nalazi igraca po javnom id-ju — koristi se kad klijent salje metu akcije/glasa. */
export function findPlayerByPublicId(room: Room, publicId: string): Player | undefined {
  return [...room.players.values()].find((p) => p.publicId === publicId);
}

function cancelCleanup(room: Room) {
  if (room.cleanupTimer) {
    clearTimeout(room.cleanupTimer);
    room.cleanupTimer = null;
  }
}

function bindSocket(room: Room, player: Player, socketId: string) {
  player.socketId = socketId;
  player.connected = true;
  socketIndex.set(socketId, { code: room.code, sessionId: player.sessionId });
  cancelCleanup(room);
}

export function createRoom(
  sessionId: string,
  name: string,
  socketId: string,
): { room: Room; player: Player } {
  const room: Room = {
    code: generateCode(),
    phase: "LOBBY",
    players: new Map(),
    cleanupTimer: null,
    nightActions: emptyNightActions(),
    votes: new Map(),
    silencedSessionId: null,
    phaseTimer: null,
    phaseEndsAt: null,
    voteRunoff: null,
  };
  const player: Player = {
    sessionId,
    publicId: randomUUID(),
    name,
    isHost: true,
    connected: true,
    alive: true,
    socketId: null,
    role: null,
  };
  room.players.set(sessionId, player);
  rooms.set(room.code, room);
  bindSocket(room, player, socketId);
  return { room, player };
}

export function joinRoom(
  rawCode: string,
  sessionId: string,
  name: string,
  socketId: string,
): JoinResult {
  const code = rawCode.trim().toUpperCase();
  const room = rooms.get(code);
  if (!room) {
    return { ok: false, error: `Soba ${code} ne postoji. Proveri kod.` };
  }

  // Reconnect: isti sessionId se vraca na svoje mesto (refresh, pad mreze).
  const existing = room.players.get(sessionId);
  if (existing) {
    bindSocket(room, existing, socketId);
    return { ok: true, room, player: existing, reconnected: true };
  }

  if (room.phase !== "LOBBY") {
    return { ok: false, error: "Partija je već u toku — sačekaj sledeću." };
  }
  if (room.players.size >= MAX_PLAYERS) {
    return { ok: false, error: `Soba je puna (${MAX_PLAYERS}/${MAX_PLAYERS}).` };
  }
  const nameTaken = [...room.players.values()].some(
    (p) => p.name.toLowerCase() === name.toLowerCase(),
  );
  if (nameTaken) {
    return { ok: false, error: "To ime je već zauzeto u ovoj sobi." };
  }

  const player: Player = {
    sessionId,
    publicId: randomUUID(),
    name,
    isHost: false,
    connected: true,
    alive: true,
    socketId: null,
    role: null,
  };
  room.players.set(sessionId, player);
  bindSocket(room, player, socketId);
  return { ok: true, room, player, reconnected: false };
}

/**
 * Igrac svesno napusta sobu (nije isto sto i disconnect!).
 * Vraca sobu ako i dalje postoji, ili null ako je obrisana.
 */
export function leaveRoom(socketId: string): Room | null {
  const binding = socketIndex.get(socketId);
  if (!binding) return null;
  socketIndex.delete(socketId);

  const room = rooms.get(binding.code);
  if (!room) return null;

  const leaving = room.players.get(binding.sessionId);
  room.players.delete(binding.sessionId);

  if (room.players.size === 0) {
    destroyRoom(room);
    return null;
  }

  // Ako je otisao domacin, uloga prelazi na prvog povezanog igraca.
  if (leaving?.isHost) {
    const next =
      [...room.players.values()].find((p) => p.connected) ??
      [...room.players.values()][0];
    next.isHost = true;
  }
  return room;
}

/**
 * Socket je pukao (zatvoren tab, pad mreze). Igraca NE brisemo —
 * oznacavamo ga kao nepovezanog da bi mogao da se vrati istim sessionId-jem.
 */
export function handleDisconnect(socketId: string): Room | null {
  const binding = socketIndex.get(socketId);
  if (!binding) return null;
  socketIndex.delete(socketId);

  const room = rooms.get(binding.code);
  if (!room) return null;

  const player = room.players.get(binding.sessionId);
  if (player && player.socketId === socketId) {
    player.connected = false;
    player.socketId = null;
  }

  const anyoneConnected = [...room.players.values()].some((p) => p.connected);
  if (!anyoneConnected && !room.cleanupTimer) {
    room.cleanupTimer = setTimeout(() => {
      // Ako se u medjuvremenu niko nije vratio, soba se gasi.
      const stillEmpty = ![...room.players.values()].some((p) => p.connected);
      if (stillEmpty) destroyRoom(room);
    }, EMPTY_ROOM_TTL_MS);
  }
  return room;
}

function destroyRoom(room: Room) {
  cancelCleanup(room);
  for (const p of room.players.values()) {
    if (p.socketId) socketIndex.delete(p.socketId);
  }
  rooms.delete(room.code);
}
