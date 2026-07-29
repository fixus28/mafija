import { useEffect, useState } from "react";
import { LiveKitRoom, RoomAudioRenderer, TrackToggle } from "@livekit/components-react";
import "@livekit/components-styles";
import { Track } from "livekit-client";
import { socket } from "../socket";

/**
 * Privatan nocni audio kanal mafije i dame — zasebna LiveKit soba (server
 * je jedini koji izdaje token za nju, samo njima dvoma). Montira se samo
 * dok traje NIGHT za MAFIA/ACCOMPLICE — konekcija se sama zatvara kad
 * komponenta nestane iz stabla (kraj noci).
 */
export default function MafiaChannel() {
  const [token, setToken] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    socket.emit("livekit:mafiaToken", (res) => {
      if (cancelled) return;
      if (res.ok && res.token && res.url) {
        setToken(res.token);
        setUrl(res.url);
      } else {
        setError(res.error ?? "nepoznata greska");
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <p data-testid="mafia-channel-error">{error}</p>;
  if (!token || !url) return null;

  return (
    <LiveKitRoom
      token={token}
      serverUrl={url}
      connect
      audio
      className="rounded border border-seal/40 bg-smoke-900 px-4 py-3"
    >
      <p className="text-center text-xs text-seal-bright">
        Privatni kanal — samo ti i partner čujete ovo.
      </p>
      <RoomAudioRenderer />
      <div className="mt-2 flex justify-center">
        <TrackToggle
          source={Track.Source.Microphone}
          className="rounded border border-smoke-700 bg-smoke-900 px-4 py-2 text-sm text-paper hover:border-brass/50"
        >
          Mikrofon
        </TrackToggle>
      </div>
    </LiveKitRoom>
  );
}
