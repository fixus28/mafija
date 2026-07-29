import { useState } from "react";
import type {
  DetectiveResultPayload,
  GamePhase,
  PublicPlayer,
  PublicRoomState,
  RolePayload,
} from "@mafija/shared";
import { socket } from "../socket";
import { useCountdown } from "../useCountdown";
import { NIGHT_ACTIVE_ROLES, NIGHT_PROMPT, ROLE_DESCRIPTION, ROLE_LABEL } from "../roles";
import PlayerPicker from "./PlayerPicker";
import VideoRoom from "./VideoRoom";

interface Props {
  room: PublicRoomState;
  myId: string;
  role: RolePayload | null;
  detectiveResults: DetectiveResultPayload[];
  narratorLog: string[];
  onLeave: () => void;
}

const PHASE_LABEL: Record<GamePhase, string> = {
  LOBBY: "Predvorje",
  ROLE_REVEAL: "Podela uloga",
  NIGHT: "Noć",
  DAWN: "Zora",
  DAY_DISCUSSION: "Dnevna diskusija",
  VOTING: "Glasanje",
  MINI_DISCUSSION: "Kratka diskusija",
  RESOLUTION: "Rezultat",
  GAME_OVER: "Kraj partije",
};

function formatSeconds(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function Game({ room, myId, role, detectiveResults, narratorLog, onLeave }: Props) {
  const seconds = useCountdown(room.phaseEndsAt);
  const me = room.players.find((p) => p.id === myId);
  const alivePlayers = room.players.filter((p) => p.alive);
  // Saznanja su rezultati privatnih provera po meti — drzimo samo najnoviji
  // po igracu (raniji je zastareo cim se njegova uloga eventualno promeni).
  const seenTargets = new Set<string>();
  const latestDetectiveResults = detectiveResults.filter((r) => {
    if (seenTargets.has(r.targetId)) return false;
    seenTargets.add(r.targetId);
    return true;
  });

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-6 px-6 py-10">
      <header className="flex items-baseline justify-between">
        <h1 className="font-display text-2xl font-black text-paper">Mafija</h1>
        <button
          onClick={onLeave}
          className="text-sm text-paper-dim underline-offset-4 transition-colors hover:text-paper hover:underline"
        >
          Napusti sobu
        </button>
      </header>

      <div className="flex items-baseline justify-between">
        <span className="font-mono text-xs uppercase tracking-[0.4em] text-brass">
          {PHASE_LABEL[room.phase]}
        </span>
        {seconds !== null && (
          <span className="font-mono text-sm text-paper-dim">{formatSeconds(seconds)}</span>
        )}
      </div>

      <VideoRoom />

      {role && <RoleReminder role={role} />}

      {narratorLog.length > 0 && (
        <section className="rounded border border-smoke-800 bg-smoke-900 px-4 py-3">
          <p className="text-sm text-paper">{narratorLog[0]}</p>
          {narratorLog.length > 1 && (
            <ul className="mt-2 flex flex-col gap-1 border-t border-smoke-800 pt-2">
              {narratorLog.slice(1, 5).map((msg, i) => (
                <li key={i} className="text-xs text-paper-dim">
                  {msg}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {role?.role === "DETECTIVE" && latestDetectiveResults.length > 0 && (
        <section className="rounded border border-brass/30 bg-smoke-900 px-4 py-3">
          <h2 className="text-xs font-medium uppercase tracking-widest text-paper-dim">
            Tvoja saznanja
          </h2>
          <ul className="mt-2 flex flex-col gap-1">
            {latestDetectiveResults.map((r, i) => {
              const target = room.players.find((p) => p.id === r.targetId);
              return (
                <li key={i} className="text-sm text-paper">
                  {target?.name ?? "Nepoznat igrač"} —{" "}
                  <span className={r.isMafia ? "text-seal-bright" : "text-paper-dim"}>
                    {r.isMafia ? "mafija" : "nije mafija"}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <PhasePanel room={room} myId={myId} role={role} me={me} alivePlayers={alivePlayers} />

      <Roster room={room} myId={myId} />
    </main>
  );
}

function RoleReminder({ role }: { role: RolePayload }) {
  return (
    <section className="rounded border border-brass/40 bg-smoke-900 px-4 py-3">
      <p className="font-mono text-[0.6rem] uppercase tracking-widest text-brass/70">
        Tvoja uloga
      </p>
      <p className="mt-1 font-display text-xl font-bold text-paper">{ROLE_LABEL[role.role]}</p>
      <p className="mt-1 text-sm text-paper-dim">{ROLE_DESCRIPTION[role.role]}</p>
      {role.partner && (
        <p className="mt-2 text-sm text-seal-bright">Radiš sa: {role.partner.name}</p>
      )}
    </section>
  );
}

function PhasePanel({
  room,
  myId,
  role,
  me,
  alivePlayers,
}: {
  room: PublicRoomState;
  myId: string;
  role: RolePayload | null;
  me: PublicPlayer | undefined;
  alivePlayers: PublicPlayer[];
}) {
  if (room.phase === "NIGHT") {
    return <NightPanel role={role} me={me} alivePlayers={alivePlayers} />;
  }
  if (room.phase === "DAY_DISCUSSION" || room.phase === "MINI_DISCUSSION") {
    return <DiscussionPanel room={room} myId={myId} />;
  }
  if (room.phase === "VOTING") {
    return <VotingPanel room={room} me={me} alivePlayers={alivePlayers} myId={myId} />;
  }
  if (room.phase === "GAME_OVER") {
    return (
      <p className="rounded border border-brass/40 bg-smoke-900 px-4 py-6 text-center text-lg text-paper">
        Partija je gotova.
      </p>
    );
  }
  return (
    <p className="text-center text-sm text-paper-dim">
      {room.phase === "ROLE_REVEAL" ? "Zapamti svoju ulogu…" : "Sačekaj trenutak…"}
    </p>
  );
}

function NightPanel({
  role,
  me,
  alivePlayers,
}: {
  role: RolePayload | null;
  me: PublicPlayer | undefined;
  alivePlayers: PublicPlayer[];
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!me?.alive) {
    return <p className="text-center text-sm text-paper-dim">Grad spava… Ti posmatraš.</p>;
  }
  if (!role || !NIGHT_ACTIVE_ROLES.includes(role.role)) {
    return <p className="text-center text-sm text-paper-dim">Grad spava…</p>;
  }

  const submit = (targetId: string) => {
    setSelected(targetId);
    socket.emit("night:action", { targetId }, (res) => {
      if (res.ok) {
        setSent(true);
        setError(null);
      } else {
        setSent(false);
        setError(res.error ?? "Nešto je pošlo naopako.");
      }
    });
  };

  return (
    <section className="flex flex-col gap-3">
      <p className="text-center text-sm text-paper">{NIGHT_PROMPT[role.role]}</p>
      <PlayerPicker players={alivePlayers} selected={selected} onSelect={submit} />
      {sent && (
        <p className="text-center text-xs text-brass">
          Izbor poslat — možeš ga promeniti do isteka vremena.
        </p>
      )}
      {error && <p className="text-center text-xs text-seal-bright">{error}</p>}
    </section>
  );
}

function DiscussionPanel({ room, myId }: { room: PublicRoomState; myId: string }) {
  const silenced = room.silencedPlayerId;
  const amSilenced = silenced === myId;
  const silencedName = room.players.find((p) => p.id === silenced)?.name;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-center text-sm text-paper-dim">
        {amSilenced
          ? "Ćutiš danas — ne učestvuješ u diskusiji."
          : silenced
            ? `${silencedName ?? "Neko"} je ućutkan/a danas.`
            : "Diskutujte naglas (kamere i mikrofoni stižu u kasnijoj fazi)."}
      </p>
      {room.phase === "MINI_DISCUSSION" && room.runoff && (
        <p className="text-center text-xs text-brass">
          Reglasavanje samo između:{" "}
          {room.runoff.candidateIds
            .map((id) => room.players.find((p) => p.id === id)?.name ?? "?")
            .join(", ")}
        </p>
      )}
    </div>
  );
}

function VotingPanel({
  room,
  me,
  alivePlayers,
  myId,
}: {
  room: PublicRoomState;
  me: PublicPlayer | undefined;
  alivePlayers: PublicPlayer[];
  myId: string;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [skipSelected, setSkipSelected] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!me?.alive) {
    return <p className="text-center text-sm text-paper-dim">Mrtvi ne glasaju — posmatraš.</p>;
  }

  if (room.runoff?.excludedPlayerIds.includes(myId)) {
    return (
      <p className="text-center text-sm text-paper-dim">
        Izjednačen/a si — ovog kruga ne glasaš, samo čekaš ishod.
      </p>
    );
  }

  const candidateIds = room.runoff?.candidateIds ?? null;
  const votable = alivePlayers.filter(
    (p) => p.id !== myId && (candidateIds === null || candidateIds.includes(p.id)),
  );

  const submit = (targetId: string | null) => {
    setSelected(targetId);
    setSkipSelected(targetId === null);
    socket.emit("vote:cast", { targetId }, (res) => {
      if (res.ok) {
        setSent(true);
        setError(null);
      } else {
        setSent(false);
        setError(res.error ?? "Nešto je pošlo naopako.");
      }
    });
  };

  return (
    <section className="flex flex-col gap-3">
      <p className="text-center text-sm text-paper">Za koga glasaš?</p>
      <PlayerPicker players={votable} selected={selected} onSelect={submit} />
      <button
        onClick={() => submit(null)}
        className={`w-full rounded border px-4 py-3 text-center transition-colors ${
          skipSelected
            ? "border-brass bg-brass/20 text-paper"
            : "border-smoke-700 bg-smoke-900 text-paper-dim hover:border-brass/50"
        }`}
      >
        Preskoči (niko ne ispada)
      </button>
      {sent && (
        <p className="text-center text-xs text-brass">
          Glas poslat — možeš ga promeniti do isteka vremena.
        </p>
      )}
      {error && <p className="text-center text-xs text-seal-bright">{error}</p>}
    </section>
  );
}

function Roster({ room, myId }: { room: PublicRoomState; myId: string }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-xs font-medium uppercase tracking-widest text-paper-dim">Za stolom</h2>
      <ul className="divide-y divide-smoke-800 rounded border border-smoke-800 bg-smoke-900">
        {room.players.map((p) => (
          <li key={p.id} className="flex items-center gap-3 px-4 py-3">
            <span
              aria-hidden
              className={`h-2 w-2 rounded-full ${p.connected ? "bg-brass" : "bg-smoke-700"}`}
            />
            <span className={p.alive ? "text-paper" : "text-paper-dim line-through"}>
              {p.name}
              {p.id === myId && <span className="text-paper-dim"> (ti)</span>}
            </span>
            {!p.alive && (
              <span className="ml-auto font-mono text-[0.6rem] uppercase tracking-widest text-seal-bright">
                Mrtav/a
              </span>
            )}
            {p.alive && p.id === room.silencedPlayerId && (
              <span className="ml-auto font-mono text-[0.6rem] uppercase tracking-widest text-brass">
                Ućutkan/a
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
