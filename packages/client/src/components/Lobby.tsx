import { useState } from "react";
import type { PublicRoomState } from "@mafija/shared";
import { socket } from "../socket";

interface Props {
  room: PublicRoomState;
  myId: string;
  onLeave: () => void;
}

export default function Lobby({ room, myId, onLeave }: Props) {
  const [copied, setCopied] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const me = room.players.find((p) => p.id === myId);
  const connectedCount = room.players.filter((p) => p.connected).length;
  const canStart = connectedCount >= room.minPlayers;

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(room.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard nije dostupan (npr. http sa telefona) — kod je ionako vidljiv.
    }
  };

  const startGame = () => {
    setStartError(null);
    socket.emit("game:start", (res) => {
      if (!res.ok && res.error) setStartError(res.error);
    });
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-8 px-6 py-10">
      <header className="flex items-baseline justify-between">
        <h1 className="font-display text-3xl font-black text-paper">Mafija</h1>
        <button
          onClick={onLeave}
          className="text-sm text-paper-dim underline-offset-4 transition-colors hover:text-paper hover:underline"
        >
          Napusti sobu
        </button>
      </header>

      {/* Pečat: kod sobe. Klik kopira. */}
      <button
        onClick={copyCode}
        title="Kopiraj kod"
        className="group mx-auto -rotate-1 rounded border-2 border-brass/70 px-8 py-5 transition-transform hover:rotate-0"
      >
        <span className="block text-center font-mono text-[0.6rem] uppercase tracking-[0.5em] text-brass/70">
          {copied ? "Kopirano" : "Kod sobe"}
        </span>
        <span className="mt-1 block font-mono text-4xl font-semibold tracking-[0.35em] text-brass">
          {room.code}
        </span>
      </button>
      <p className="-mt-4 text-center text-xs text-paper-dim">
        Podeli kod — ekipa ulazi na istoj adresi.
      </p>

      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xs font-medium uppercase tracking-widest text-paper-dim">
            Za stolom
          </h2>
          <span className="font-mono text-sm text-paper-dim">
            {room.players.length}/{room.maxPlayers}
          </span>
        </div>
        <ul className="divide-y divide-smoke-800 rounded border border-smoke-800 bg-smoke-900">
          {room.players.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-4 py-3">
              <span
                aria-hidden
                className={`h-2 w-2 rounded-full ${p.connected ? "bg-brass" : "bg-smoke-700"}`}
              />
              <span className={p.connected ? "text-paper" : "text-paper-dim line-through"}>
                {p.name}
                {p.id === myId && <span className="text-paper-dim"> (ti)</span>}
              </span>
              {p.isHost && (
                <span className="ml-auto rounded border border-seal/50 px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-widest text-seal-bright">
                  Domaćin
                </span>
              )}
              {!p.connected && (
                <span className="ml-auto text-xs text-paper-dim">veza pukla…</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <footer className="mt-auto flex flex-col gap-3">
        {me?.isHost ? (
          <>
            <button
              onClick={startGame}
              disabled={!canStart}
              className="rounded bg-seal px-4 py-3 font-semibold text-paper transition-colors hover:bg-seal-bright disabled:cursor-not-allowed disabled:opacity-40"
            >
              Pokreni partiju
            </button>
            {!canStart && (
              <p className="text-center text-xs text-paper-dim">
                Potrebno je bar {room.minPlayers} povezanih igrača (sad:{" "}
                {connectedCount}).
              </p>
            )}
            {startError && (
              <p className="text-center text-sm text-brass">{startError}</p>
            )}
          </>
        ) : (
          <p className="text-center text-sm text-paper-dim">
            Čeka se da domaćin pokrene partiju…
          </p>
        )}
      </footer>
    </main>
  );
}
