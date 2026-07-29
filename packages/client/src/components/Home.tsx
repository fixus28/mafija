import { useState } from "react";
import { NAME_MAX_LENGTH, ROOM_CODE_LENGTH } from "@mafija/shared";
import { getSessionId, socket } from "../socket";

interface Props {
  notice: string | null;
  onEntered: (code: string, playerId: string) => void;
}

export default function Home({ notice, onEntered }: Props) {
  const [name, setName] = useState(
    () => localStorage.getItem("mafija:playerName") ?? "",
  );
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const rememberName = () => {
    localStorage.setItem("mafija:playerName", name.trim());
  };

  const createRoom = () => {
    setError(null);
    setBusy(true);
    rememberName();
    socket.emit("room:create", { name, sessionId: getSessionId() }, (res) => {
      setBusy(false);
      if (res.ok && res.roomCode && res.playerId) {
        onEntered(res.roomCode, res.playerId);
      } else {
        setError(res.error ?? "Nešto je pošlo naopako. Pokušaj ponovo.");
      }
    });
  };

  const joinRoom = () => {
    setError(null);
    setBusy(true);
    rememberName();
    socket.emit(
      "room:join",
      { name, code: code.trim().toUpperCase(), sessionId: getSessionId() },
      (res) => {
        setBusy(false);
        if (res.ok && res.roomCode && res.playerId) {
          onEntered(res.roomCode, res.playerId);
        } else {
          setError(res.error ?? "Nešto je pošlo naopako. Pokušaj ponovo.");
        }
      },
    );
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-10 px-6 py-12">
      <header className="text-center">
        <p className="font-mono text-xs uppercase tracking-[0.45em] text-brass">
          Grad spava
        </p>
        <h1 className="mt-3 font-display text-7xl font-black tracking-tight text-paper">
          Mafija
        </h1>
        <p className="mt-3 text-sm text-paper-dim">
          Društvena igra uživo — kamere, glasanje i narator koji ne spava.
        </p>
      </header>

      {notice && (
        <p className="rounded border border-smoke-700 bg-smoke-900 px-4 py-3 text-sm text-paper-dim">
          {notice}
        </p>
      )}

      <section className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-widest text-paper-dim">
            Tvoje ime
          </span>
          <input
            value={name}
            maxLength={NAME_MAX_LENGTH}
            onChange={(e) => setName(e.target.value)}
            placeholder="npr. Ćofi"
            className="rounded border border-smoke-700 bg-smoke-900 px-4 py-3 text-paper placeholder:text-smoke-700"
          />
        </label>

        <button
          onClick={createRoom}
          disabled={busy || name.trim().length < 2}
          className="rounded bg-seal px-4 py-3 font-semibold text-paper transition-colors hover:bg-seal-bright disabled:cursor-not-allowed disabled:opacity-40"
        >
          Napravi sobu
        </button>

        <div className="flex items-center gap-3 text-xs uppercase tracking-widest text-smoke-700">
          <span className="h-px flex-1 bg-smoke-800" />
          ili
          <span className="h-px flex-1 bg-smoke-800" />
        </div>

        <div className="flex gap-3">
          <input
            value={code}
            maxLength={ROOM_CODE_LENGTH}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && code && joinRoom()}
            placeholder="KOD"
            className="w-36 rounded border border-smoke-700 bg-smoke-900 px-4 py-3 text-center font-mono text-lg tracking-[0.3em] text-brass placeholder:text-smoke-700"
          />
          <button
            onClick={joinRoom}
            disabled={busy || name.trim().length < 2 || code.trim().length < ROOM_CODE_LENGTH}
            className="flex-1 rounded border border-brass/40 px-4 py-3 font-semibold text-brass transition-colors hover:border-brass hover:bg-smoke-900 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Uđi u sobu
          </button>
        </div>

        {error && <p className="text-sm text-seal-bright">{error}</p>}
      </section>
    </main>
  );
}
