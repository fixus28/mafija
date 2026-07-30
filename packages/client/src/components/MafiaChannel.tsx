import { useEffect, useState } from "react";
import {
  LiveKitRoom,
  ParticipantTile,
  RoomAudioRenderer,
  TrackToggle,
  useTracks,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { Track } from "livekit-client";
import { socket } from "../socket";

/**
 * Privatan nocni kanal mafije i dame — zasebna LiveKit soba (server je
 * jedini koji izdaje token za nju, samo njima dvoma). Kamera i mikrofon,
 * pa vide i cuju jedno drugo dok biraju metu. Montira se samo dok traje
 * NIGHT za MAFIA/ACCOMPLICE — konekcija se sama zatvara kad komponenta
 * nestane iz stabla (kraj noci).
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
      video
      audio
      className="overflow-hidden rounded border border-seal/40 bg-smoke-900"
    >
      <p className="px-4 py-2 text-center text-xs text-seal-bright">
        Privatni kanal — samo ti i partner vidite/čujete ovo.
      </p>
      <MafiaVideoGrid />
      <RoomAudioRenderer />
      <div className="flex justify-center gap-3 py-3">
        <TrackToggle
          source={Track.Source.Camera}
          className="rounded border border-smoke-700 bg-smoke-900 px-4 py-2 text-sm text-paper hover:border-brass/50"
        >
          Kamera
        </TrackToggle>
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

/** Samo dvoje ucesnika — jedan red je dovoljan, ali koristimo istu 2-kolonsku logiku. */
function MafiaVideoGrid() {
  const tracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: true }], {
    onlySubscribed: false,
  });
  return (
    <div className="grid grid-cols-2 gap-2 px-4 pb-2">
      {tracks.map((trackRef) => (
        <div
          key={trackRef.participant.identity}
          className="aspect-square overflow-hidden rounded border border-smoke-700"
        >
          <ParticipantTile trackRef={trackRef} />
        </div>
      ))}
    </div>
  );
}
