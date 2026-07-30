import { useEffect, useState } from "react";
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
import VideoRoom from "./VideoRoom";
import MafiaChannel from "./MafiaChannel";

interface Props {
  room: PublicRoomState;
  myId: string;
  role: RolePayload | null;
  detectiveResults: DetectiveResultPayload[];
  narratorMessage: string | null;
  onLeave: () => void;
}

const NIGHT_LIKE_PHASES = new Set<GamePhase>(["NIGHT", "DAWN"]);

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

export default function Game({ room, myId, role, detectiveResults, narratorMessage, onLeave }: Props) {
  const seconds = useCountdown(room.phaseEndsAt);

  // Grad spava — tamnija pozadina dok traje noc/zora (vraceno kad Game ode iz stabla).
  useEffect(() => {
    document.body.classList.toggle("is-night", NIGHT_LIKE_PHASES.has(room.phase));
    return () => {
      document.body.classList.remove("is-night");
    };
  }, [room.phase]);

  // Izbor mete (noc) i glasa (dan) — ovde, jer isti klik u <VideoRoom> galeriji
  // treba i da posalje akciju servisu i da prikaze "poslato"/gresku ispod.
  const [nightSelected, setNightSelected] = useState<string | null>(null);
  const [nightSent, setNightSent] = useState(false);
  const [nightError, setNightError] = useState<string | null>(null);
  const [voteSelected, setVoteSelected] = useState<string | null>(null);
  const [voteSkipSelected, setVoteSkipSelected] = useState(false);
  const [voteSent, setVoteSent] = useState(false);
  const [voteError, setVoteError] = useState<string | null>(null);

  // Nova faza — stari izbor/status vise nije relevantan.
  useEffect(() => {
    setNightSelected(null);
    setNightSent(false);
    setNightError(null);
    setVoteSelected(null);
    setVoteSkipSelected(false);
    setVoteSent(false);
    setVoteError(null);
  }, [room.phase]);

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

  const submitNightTarget = (targetId: string) => {
    setNightSelected(targetId);
    socket.emit("night:action", { targetId }, (res) => {
      if (res.ok) {
        setNightSent(true);
        setNightError(null);
      } else {
        setNightSent(false);
        setNightError(res.error ?? "Nešto je pošlo naopako.");
      }
    });
  };

  const submitVoteTarget = (targetId: string | null) => {
    setVoteSelected(targetId);
    setVoteSkipSelected(targetId === null);
    socket.emit("vote:cast", { targetId }, (res) => {
      if (res.ok) {
        setVoteSent(true);
        setVoteError(null);
      } else {
        setVoteSent(false);
        setVoteError(res.error ?? "Nešto je pošlo naopako.");
      }
    });
  };

  const nightActive =
    room.phase === "NIGHT" && !!me?.alive && !!role && NIGHT_ACTIVE_ROLES.includes(role.role);
  const votingActive =
    room.phase === "VOTING" && !!me?.alive && !room.runoff?.excludedPlayerIds.includes(myId);

  let picker: { players: PublicPlayer[]; selected: string | null; onSelect: (id: string) => void } | undefined;
  let pickerPrompt: string | null = null;
  if (nightActive && role) {
    picker = { players: alivePlayers, selected: nightSelected, onSelect: submitNightTarget };
    pickerPrompt = NIGHT_PROMPT[role.role] ?? null;
  } else if (votingActive) {
    const candidateIds = room.runoff?.candidateIds ?? null;
    const votable = alivePlayers.filter(
      (p) => p.id !== myId && (candidateIds === null || candidateIds.includes(p.id)),
    );
    picker = {
      players: votable,
      selected: voteSkipSelected ? null : voteSelected,
      onSelect: submitVoteTarget,
    };
    pickerPrompt = "Za koga glasaš?";
  }

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

      {role && <RoleReminder role={role} />}

      {pickerPrompt && <p className="text-center text-sm text-paper">{pickerPrompt}</p>}

      <VideoRoom room={room} myId={myId} picker={picker} />

      {role &&
        (role.role === "MAFIA" || role.role === "ACCOMPLICE") &&
        role.partner &&
        room.phase === "NIGHT" && <MafiaChannel />}

      {narratorMessage && (
        <section className="rounded border border-smoke-800 bg-smoke-900 px-4 py-3">
          <p className="text-sm text-paper">{narratorMessage}</p>
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

      <PhaseStatusPanel
        room={room}
        myId={myId}
        me={me}
        nightActive={nightActive}
        nightSent={nightSent}
        nightError={nightError}
        voteSkipSelected={voteSkipSelected}
        voteSent={voteSent}
        voteError={voteError}
        onVoteSkip={() => submitVoteTarget(null)}
      />
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

/**
 * Tekst ispod video/foto galerije — sama galerija (i klik na nju) je sad u
 * <VideoRoom>, ovde ostaje samo status/povratna informacija po fazi, da se
 * izbor mete/glasa ne prikazuje dva puta na ekranu.
 */
function PhaseStatusPanel({
  room,
  myId,
  me,
  nightActive,
  nightSent,
  nightError,
  voteSkipSelected,
  voteSent,
  voteError,
  onVoteSkip,
}: {
  room: PublicRoomState;
  myId: string;
  me: PublicPlayer | undefined;
  nightActive: boolean;
  nightSent: boolean;
  nightError: string | null;
  voteSkipSelected: boolean;
  voteSent: boolean;
  voteError: string | null;
  onVoteSkip: () => void;
}) {
  if (room.phase === "NIGHT") {
    if (!me?.alive) {
      return <p className="text-center text-sm text-paper-dim">Grad spava… Ti posmatraš.</p>;
    }
    if (!nightActive) {
      return <p className="text-center text-sm text-paper-dim">Grad spava…</p>;
    }
    return (
      <div className="flex flex-col gap-1">
        {nightSent && (
          <p className="text-center text-xs text-brass">
            Izbor poslat — možeš ga promeniti do isteka vremena.
          </p>
        )}
        {nightError && <p className="text-center text-xs text-seal-bright">{nightError}</p>}
      </div>
    );
  }

  if (room.phase === "DAY_DISCUSSION" || room.phase === "MINI_DISCUSSION") {
    return <DiscussionPanel room={room} myId={myId} />;
  }

  if (room.phase === "VOTING") {
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
    return (
      <section className="flex flex-col gap-3">
        <button
          onClick={onVoteSkip}
          className={`w-full rounded border px-4 py-3 text-center transition-colors ${
            voteSkipSelected
              ? "border-brass bg-brass/20 text-paper"
              : "border-smoke-700 bg-smoke-900 text-paper-dim hover:border-brass/50"
          }`}
        >
          Preskoči (niko ne ispada)
        </button>
        {voteSent && (
          <p className="text-center text-xs text-brass">
            Glas poslat — možeš ga promeniti do isteka vremena.
          </p>
        )}
        {voteError && <p className="text-center text-xs text-seal-bright">{voteError}</p>}
      </section>
    );
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
