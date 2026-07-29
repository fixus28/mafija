import { createServer } from "node:http";
import { Server } from "socket.io";
import {
  MIN_PLAYERS,
  NAME_MAX_LENGTH,
  NAME_MIN_LENGTH,
  type ClientToServerEvents,
  type ServerToClientEvents,
} from "@mafija/shared";
import {
  createRoom,
  getBindingForSocket,
  getRoom,
  handleDisconnect,
  joinRoom,
  leaveRoom,
  toPublicState,
  type Room,
} from "./roomManager";
import { createGameEngine, videoPermissionFor } from "./phaseMachine";
import { createLiveKitToken, createMafiaChannelToken, getLiveKitUrl } from "./livekit";

const PORT = Number(process.env.PORT ?? 3001);

const httpServer = createServer();

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    // Za razvoj (i testiranje sa telefona na istoj mrezi) pustamo sve.
    // Pred deployment ovo suzavamo na domen aplikacije.
    origin: true,
  },
});

/** Posle svake promene, svi u sobi dobijaju sveze javno stanje. */
function broadcastState(room: Room) {
  io.to(room.code).emit("room:state", toPublicState(room));
}

const game = createGameEngine(io);

/**
 * Ako je ovaj socket vec vezan za neku sobu, oslobadja ga pre ulaska u novu
 * (stari igrac ostaje sacuvan kao "nepovezan", pa moze da se vrati).
 */
function detachFromCurrentRoom(socketId: string, leave: (code: string) => void) {
  const prev = getBindingForSocket(socketId);
  if (!prev) return;
  const oldRoom = handleDisconnect(socketId);
  leave(prev.code);
  if (oldRoom) broadcastState(oldRoom);
}

function validateName(raw: string): { ok: true; name: string } | { ok: false; error: string } {
  const name = raw.trim();
  if (name.length < NAME_MIN_LENGTH || name.length > NAME_MAX_LENGTH) {
    return {
      ok: false,
      error: `Ime mora imati između ${NAME_MIN_LENGTH} i ${NAME_MAX_LENGTH} znakova.`,
    };
  }
  return { ok: true, name };
}

io.on("connection", (socket) => {
  socket.on("room:create", (payload, ack) => {
    const valid = validateName(payload.name ?? "");
    if (!valid.ok) return ack({ ok: false, error: valid.error });
    if (!payload.sessionId) return ack({ ok: false, error: "Nedostaje identitet sesije. Osveži stranicu." });

    detachFromCurrentRoom(socket.id, (code) => socket.leave(code));
    const { room, player } = createRoom(payload.sessionId, valid.name, socket.id);
    socket.join(room.code);
    ack({ ok: true, roomCode: room.code, playerId: player.publicId });
    broadcastState(room);
    console.log(`[soba ${room.code}] kreirana, domaćin: ${player.name}`);
  });

  socket.on("room:join", (payload, ack) => {
    const valid = validateName(payload.name ?? "");
    if (!valid.ok) return ack({ ok: false, error: valid.error });
    if (!payload.sessionId) return ack({ ok: false, error: "Nedostaje identitet sesije. Osveži stranicu." });

    const target = (payload.code ?? "").trim().toUpperCase();
    const prev = getBindingForSocket(socket.id);
    if (prev && prev.code !== target) {
      detachFromCurrentRoom(socket.id, (code) => socket.leave(code));
    }
    const result = joinRoom(target, payload.sessionId, valid.name, socket.id);
    if (!result.ok) return ack({ ok: false, error: result.error });

    socket.join(result.room.code);
    ack({ ok: true, roomCode: result.room.code, playerId: result.player.publicId });
    broadcastState(result.room);
    // Refresh usred partije: klijent je izgubio ulogu iz React state-a, salje se ponovo.
    if (result.reconnected) game.resendRoleIfActive(result.room, result.player);
    console.log(
      `[soba ${result.room.code}] ${result.player.name} ${result.reconnected ? "se ponovo povezao" : "je ušao"}`,
    );
  });

  socket.on("room:leave", (ack) => {
    const binding = getBindingForSocket(socket.id);
    const room = leaveRoom(socket.id);
    if (binding) socket.leave(binding.code);
    ack({ ok: true });
    if (room) broadcastState(room);
  });

  socket.on("game:start", (ack) => {
    const binding = getBindingForSocket(socket.id);
    const room = binding ? getRoom(binding.code) : undefined;
    if (!binding || !room) {
      return ack({ ok: false, error: "Nisi ni u jednoj sobi." });
    }
    const me = room.players.get(binding.sessionId);
    if (!me?.isHost) {
      return ack({ ok: false, error: "Samo domaćin može da pokrene partiju." });
    }
    const present = [...room.players.values()].filter((p) => p.connected).length;
    if (present < MIN_PLAYERS) {
      return ack({
        ok: false,
        error: `Potrebno je bar ${MIN_PLAYERS} povezanih igrača (trenutno: ${present}).`,
      });
    }
    ack(game.startGame(room));
  });

  socket.on("night:action", (payload, ack) => {
    const binding = getBindingForSocket(socket.id);
    const room = binding ? getRoom(binding.code) : undefined;
    if (!binding || !room) return ack({ ok: false, error: "Nisi ni u jednoj sobi." });
    ack(game.submitNightAction(room, binding.sessionId, payload.targetId));
  });

  socket.on("vote:cast", (payload, ack) => {
    const binding = getBindingForSocket(socket.id);
    const room = binding ? getRoom(binding.code) : undefined;
    if (!binding || !room) return ack({ ok: false, error: "Nisi ni u jednoj sobi." });
    ack(game.submitVote(room, binding.sessionId, payload.targetId));
  });

  socket.on("livekit:token", async (ack) => {
    const binding = getBindingForSocket(socket.id);
    const room = binding ? getRoom(binding.code) : undefined;
    const me = binding && room ? room.players.get(binding.sessionId) : undefined;
    if (!room || !me) return ack({ ok: false, error: "Nisi ni u jednoj sobi." });

    try {
      const token = await createLiveKitToken(room.code, me.publicId, me.name, videoPermissionFor(room, me));
      ack({ ok: true, token, url: getLiveKitUrl() });
    } catch (err) {
      console.error("[livekit] neuspesno pravljenje tokena:", err);
      ack({ ok: false, error: "Video server trenutno nije dostupan." });
    }
  });

  socket.on("livekit:mafiaToken", async (ack) => {
    const binding = getBindingForSocket(socket.id);
    const room = binding ? getRoom(binding.code) : undefined;
    const me = binding && room ? room.players.get(binding.sessionId) : undefined;
    if (!room || !me) return ack({ ok: false, error: "Nisi ni u jednoj sobi." });
    if (!me.alive) return ack({ ok: false, error: "Mrtvi nemaju pristup." });
    if (room.phase !== "NIGHT") {
      return ack({ ok: false, error: "Privatni kanal je dostupan samo noću." });
    }
    if (me.role !== "MAFIA" && me.role !== "ACCOMPLICE") {
      return ack({ ok: false, error: "Nemaš pristup ovom kanalu." });
    }
    const hasPartner = [...room.players.values()].some(
      (p) => p !== me && p.alive && (p.role === "MAFIA" || p.role === "ACCOMPLICE"),
    );
    if (!hasPartner) return ack({ ok: false, error: "Nema partnera za privatni kanal." });

    try {
      const token = await createMafiaChannelToken(room.code, me.publicId, me.name);
      ack({ ok: true, token, url: getLiveKitUrl() });
    } catch (err) {
      console.error("[livekit] neuspesno pravljenje mafijaškog tokena:", err);
      ack({ ok: false, error: "Video server trenutno nije dostupan." });
    }
  });

  socket.on("disconnect", () => {
    const room = handleDisconnect(socket.id);
    if (room) broadcastState(room);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Mafija server sluša na portu ${PORT}`);
});
