import type { Server } from "socket.io";
import {
  DAWN_DISPLAY_SECONDS,
  DAY_DISCUSSION_SECONDS,
  MINI_DISCUSSION_SECONDS,
  NIGHT_ACTION_SECONDS,
  RESOLUTION_DISPLAY_SECONDS,
  ROLE_REVEAL_SECONDS,
  VOTING_SECONDS,
  computeVideoPermission,
  type ClientToServerEvents,
  type GamePhase,
  type NarratorSoundId,
  type Role,
  type RolePayload,
  type RoomActionResult,
  type ServerToClientEvents,
} from "@mafija/shared";
import { assignRoles } from "./game/roles";
import { resolveNight } from "./game/night";
import { applyElimination, resolveVote } from "./game/voting";
import { checkWinCondition, type WinResult } from "./game/winCondition";
import { setMainRoomPublishPermission } from "./livekit";
import {
  emptyNightActions,
  findPlayerByPublicId,
  toPublicState,
  type Player,
  type Room,
} from "./roomManager";

/** Trenutna video prava igraca prema deljenim pravilima iz @mafija/shared. */
export function videoPermissionFor(room: Room, player: Player) {
  return computeVideoPermission({
    phase: room.phase,
    alive: player.alive,
    silenced: player.sessionId === room.silencedSessionId,
  });
}

/**
 * Orkestracija faza partije: zove cist engine iz `./game/*` i njegove
 * rezultate primenjuje na `Room` (mutacija + Socket.IO emitovanje).
 * Sama logika ostaje testabilna bez ovog sloja — ovaj fajl samo vezuje
 * tajmere i mrezu za nju.
 */
export function createGameEngine(io: Server<ClientToServerEvents, ServerToClientEvents>) {
  /** Uzivo prepisuje LiveKit prava svih igraca da odgovaraju trenutnoj fazi. */
  async function syncVideoPermissions(room: Room) {
    await Promise.all(
      [...room.players.values()].map((p) =>
        setMainRoomPublishPermission(room.code, p.publicId, videoPermissionFor(room, p)),
      ),
    );
  }

  function broadcastState(room: Room) {
    io.to(room.code).emit("room:state", toPublicState(room));
  }

  function narrate(room: Room, text: string, sound?: NarratorSoundId) {
    io.to(room.code).emit("narrator:message", { text, sound });
  }

  function currentRoles(room: Room): Map<string, Role> {
    const roles = new Map<string, Role>();
    for (const [id, p] of room.players) {
      if (p.role) roles.set(id, p.role);
    }
    return roles;
  }

  function aliveSessionIds(room: Room): string[] {
    return [...room.players.values()].filter((p) => p.alive).map((p) => p.sessionId);
  }

  function clearPhaseTimer(room: Room) {
    if (room.phaseTimer) {
      clearTimeout(room.phaseTimer);
      room.phaseTimer = null;
    }
  }

  /**
   * Menja fazu. Video prava se SINHRONO cekaju PRE nego sto klijenti saznaju
   * za novu fazu — inace klijent (na osnovu iste te vesti) odmah pokusa da
   * objavi kameru, a LiveKit server ga odbije jer updateParticipant poziv
   * ka njemu jos nije stigao (trka izmedju REST poziva i Socket.IO objave).
   */
  async function setPhase(room: Room, phase: GamePhase, durationMs: number | null) {
    clearPhaseTimer(room);
    room.phase = phase;
    room.phaseEndsAt = durationMs === null ? null : Date.now() + durationMs;
    await syncVideoPermissions(room);
    broadcastState(room);
    if (durationMs !== null) {
      room.phaseTimer = setTimeout(() => void advancePhase(room), durationMs);
    }
  }

  async function advancePhase(room: Room) {
    room.phaseTimer = null;
    switch (room.phase) {
      case "ROLE_REVEAL":
        await startNight(room);
        break;
      case "NIGHT":
        await resolveNightPhase(room);
        break;
      case "DAWN":
        await setPhase(room, "DAY_DISCUSSION", DAY_DISCUSSION_SECONDS * 1000);
        break;
      case "DAY_DISCUSSION":
        await setPhase(room, "VOTING", VOTING_SECONDS * 1000);
        break;
      case "VOTING":
        await resolveVotingPhase(room);
        break;
      case "MINI_DISCUSSION":
        // Reglasavanje: samo izmedju izjednacenih, oni sami ne glasaju.
        await setPhase(room, "VOTING", VOTING_SECONDS * 1000);
        break;
      case "RESOLUTION":
        await startNight(room);
        break;
      default:
        break;
    }
  }

  async function startNight(room: Room) {
    room.nightActions = emptyNightActions();
    // Utisanost i eventualni ostaci reglasavanja vaze samo za dan koji se upravo zavrsio.
    room.silencedSessionId = null;
    room.voteRunoff = null;
    await setPhase(room, "NIGHT", NIGHT_ACTION_SECONDS * 1000);
  }

  async function resolveNightPhase(room: Room) {
    const roles = currentRoles(room);
    const result = resolveNight(roles, room.nightActions);

    if (result.killed) {
      const victim = room.players.get(result.killed);
      if (victim) victim.alive = false;
    }
    room.silencedSessionId = result.silenced;

    if (result.detectiveResult) {
      const detective = [...room.players.values()].find((p) => p.role === "DETECTIVE");
      const target = room.players.get(result.detectiveResult.target);
      if (detective?.socketId && target) {
        io.to(detective.socketId).emit("game:detectiveResult", {
          targetId: target.publicId,
          isMafia: result.detectiveResult.isMafia,
        });
      }
    }

    if (result.killed) {
      narrate(
        room,
        `Nova žrtva noći: ${room.players.get(result.killed)?.name ?? "nepoznat igrač"}.`,
        "night_victim",
      );
    } else if (result.savedByDoctor) {
      narrate(room, "Ove noći je bio pokušaj ubistva — meta je spašena.", "night_saved");
    } else {
      narrate(room, "Ova noć je prošla mirno.", "night_calm");
    }

    room.nightActions = emptyNightActions();

    const win = checkWinCondition(roles, aliveSessionIds(room));
    if (win) {
      await endGame(room, win);
      return;
    }
    await setPhase(room, "DAWN", DAWN_DISPLAY_SECONDS * 1000);
  }

  async function resolveVotingPhase(room: Room) {
    const roles = currentRoles(room);
    const alive = aliveSessionIds(room);
    const eligibleVoters = room.voteRunoff
      ? alive.filter((id) => !room.voteRunoff!.excludedVoters.includes(id))
      : alive;
    const candidates = room.voteRunoff ? room.voteRunoff.candidates : alive;
    const voteOutcome = resolveVote(room.votes, eligibleVoters, candidates);

    room.lastVoteBreakdown = [...room.votes.entries()]
      .filter(([voterId]) => eligibleVoters.includes(voterId))
      .map(([voterSessionId, targetSessionId]) => ({
        voterId: room.players.get(voterSessionId)!.publicId,
        targetId: targetSessionId ? (room.players.get(targetSessionId)?.publicId ?? null) : null,
      }));
    room.votes = new Map();

    if (voteOutcome.status === "tie") {
      // Ako bi iskljucivanje izjednacenih ostavilo NIKOG ko sme da glasa
      // (svi zivi su medju izjednacenima), nema ko drugi da presudi — pusti
      // i njih da glasaju u reglasavanju, inace bi partija zaglavila u
      // beskonacnom reglasavanju bez ijednog glasaca.
      const wouldStrandEveryone = alive.every((id) => voteOutcome.candidates.includes(id));
      room.voteRunoff = {
        candidates: voteOutcome.candidates,
        excludedVoters: wouldStrandEveryone ? [] : voteOutcome.candidates,
      };
      const names = voteOutcome.candidates
        .map((id) => room.players.get(id)?.name ?? "igrač")
        .join(", ");
      narrate(
        room,
        `Nerešeno između: ${names}. Sledi kratka diskusija pa novo glasanje — samo medju njima.`,
        "vote_tie",
      );
      await setPhase(room, "MINI_DISCUSSION", MINI_DISCUSSION_SECONDS * 1000);
      return;
    }

    room.voteRunoff = null;
    const eliminatedId = voteOutcome.status === "eliminated" ? voteOutcome.targetId : null;

    if (eliminatedId) {
      const eliminated = room.players.get(eliminatedId);
      if (eliminated) eliminated.alive = false;
      narrate(room, `Grad je presudio: ${eliminated?.name ?? "igrač"} napušta selo.`, "vote_eliminated");
    } else {
      narrate(room, "Grad je odlučio da danas niko ne napušta selo.", "vote_skipped");
    }

    const outcome = applyElimination(roles, eliminatedId);
    for (const [id, role] of outcome.roles) {
      const p = room.players.get(id);
      if (p) p.role = role;
    }

    if (outcome.accompliceConverted) {
      const newMafia = [...room.players.values()].find(
        (p) => p.role === "MAFIA" && p.sessionId !== eliminatedId,
      );
      if (newMafia?.socketId) {
        io.to(newMafia.socketId).emit("game:role", { role: "MAFIA" });
      }
    }

    const win = checkWinCondition(outcome.roles, aliveSessionIds(room));
    if (win) {
      await endGame(room, win);
      return;
    }
    await setPhase(room, "RESOLUTION", RESOLUTION_DISPLAY_SECONDS * 1000);
  }

  async function endGame(room: Room, winner: WinResult) {
    narrate(
      room,
      winner === "TOWN" ? "Grad je pobedio! Mafija je poražena." : "Mafija je pobedila! Grad je pao.",
      winner === "TOWN" ? "town_wins" : "mafia_wins",
    );
    await setPhase(room, "GAME_OVER", null);
  }

  function buildRolePayload(
    room: Room,
    role: Role,
    mafiaEntry: [string, Role] | undefined,
    accompliceEntry: [string, Role] | undefined,
  ): RolePayload {
    if (role === "MAFIA" && accompliceEntry) {
      const acc = room.players.get(accompliceEntry[0])!;
      return { role, partner: { id: acc.publicId, name: acc.name } };
    }
    if (role === "ACCOMPLICE" && mafiaEntry) {
      const mafia = room.players.get(mafiaEntry[0])!;
      return { role, partner: { id: mafia.publicId, name: mafia.name } };
    }
    return { role };
  }

  async function startGame(room: Room): Promise<RoomActionResult> {
    if (room.phase !== "LOBBY") {
      return { ok: false, error: "Partija je već počela." };
    }
    const roles = assignRoles([...room.players.keys()]);
    for (const [id, role] of roles) {
      room.players.get(id)!.role = role;
    }

    const mafiaEntry = [...roles.entries()].find(([, r]) => r === "MAFIA");
    const accompliceEntry = [...roles.entries()].find(([, r]) => r === "ACCOMPLICE");

    for (const [id, role] of roles) {
      const player = room.players.get(id)!;
      if (!player.socketId) continue;
      io.to(player.socketId).emit(
        "game:role",
        buildRolePayload(room, role, mafiaEntry, accompliceEntry),
      );
    }

    room.nightActions = emptyNightActions();
    room.votes = new Map();
    room.silencedSessionId = null;
    room.voteRunoff = null;
    await setPhase(room, "ROLE_REVEAL", ROLE_REVEAL_SECONDS * 1000);
    return { ok: true };
  }

  function submitNightAction(
    room: Room,
    sessionId: string,
    targetPublicId: string | null,
  ): RoomActionResult {
    if (room.phase !== "NIGHT") return { ok: false, error: "Nije noć." };
    const player = room.players.get(sessionId);
    if (!player || !player.alive) return { ok: false, error: "Mrtvi nemaju noćne moći." };

    let targetSessionId: string | null = null;
    if (targetPublicId) {
      const target = findPlayerByPublicId(room, targetPublicId);
      if (!target || !target.alive) return { ok: false, error: "Meta ne postoji ili nije živa." };
      targetSessionId = target.sessionId;
    }

    switch (player.role) {
      case "MAFIA":
        room.nightActions.mafiaTarget = targetSessionId;
        break;
      case "ACCOMPLICE":
        room.nightActions.accompliceTarget = targetSessionId;
        break;
      case "DOCTOR":
        room.nightActions.doctorTarget = targetSessionId;
        break;
      case "DETECTIVE":
        room.nightActions.detectiveTarget = targetSessionId;
        break;
      default:
        return { ok: false, error: "Tvoja uloga nema noćnu moć." };
    }
    return { ok: true };
  }

  function submitVote(
    room: Room,
    sessionId: string,
    targetPublicId: string | null,
  ): RoomActionResult {
    if (room.phase !== "VOTING") return { ok: false, error: "Nije vreme za glasanje." };
    const voter = room.players.get(sessionId);
    if (!voter || !voter.alive) return { ok: false, error: "Mrtvi ne glasaju." };
    if (room.voteRunoff?.excludedVoters.includes(sessionId)) {
      return { ok: false, error: "Izjednačen/a si — u ovom krugu ne glasaš." };
    }

    if (targetPublicId === null) {
      room.votes.set(sessionId, null);
      return { ok: true };
    }

    const target = findPlayerByPublicId(room, targetPublicId);
    if (!target || !target.alive) return { ok: false, error: "Meta ne postoji ili nije živa." };
    if (room.voteRunoff && !room.voteRunoff.candidates.includes(target.sessionId)) {
      return { ok: false, error: "U ovom krugu se bira samo između izjednačenih." };
    }
    room.votes.set(sessionId, target.sessionId);
    return { ok: true };
  }

  /** Posle reconnect-a usred partije, igrac mora ponovo da sazna svoju ulogu. */
  function resendRoleIfActive(room: Room, player: Player) {
    if (!player.role || !player.socketId) return;
    const roles = currentRoles(room);
    const mafiaEntry = [...roles.entries()].find(([, r]) => r === "MAFIA");
    const accompliceEntry = [...roles.entries()].find(([, r]) => r === "ACCOMPLICE");
    io.to(player.socketId).emit(
      "game:role",
      buildRolePayload(room, player.role, mafiaEntry, accompliceEntry),
    );
  }

  return { startGame, submitNightAction, submitVote, resendRoleIfActive };
}
