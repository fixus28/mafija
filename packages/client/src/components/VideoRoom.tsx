import { useEffect, useState } from "react";
import {
  LiveKitRoom,
  ParticipantTile,
  RoomAudioRenderer,
  TrackToggle,
  useRoomContext,
  useTracks,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { Track } from "livekit-client";
import { computeVideoPermission, type PublicRoomState } from "@mafija/shared";
import { socket } from "../socket";
import PhotoGrid from "./PhotoGrid";

interface Props {
  room: PublicRoomState;
  myId: string;
}

const DISCUSSING_PHASES = new Set(["DAY_DISCUSSION", "MINI_DISCUSSION"]);

/**
 * Kamera/mikrofon soba preko LiveKit-a — konekcija ostaje otvorena kroz
 * celu partiju, samo se prava za objavljivanje menjaju uzivo po fazi.
 * Tokom diskusije prikazuje pravi (uzivo) video svih igraca na jednoj
 * strani (fiksno 2 reda, bez listanja); van diskusije prikazuje njihove
 * pocetne selfie fotografije na istom mestu (mrtvi precrtani crvenim X).
 */
export default function VideoRoom({ room, myId }: Props) {
  const [token, setToken] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    socket.emit("livekit:token", (res) => {
      if (res.ok && res.token && res.url) {
        setToken(res.token);
        setUrl(res.url);
      } else {
        setError(res.error ?? "Ne mogu da se povežem na video.");
      }
    });
  }, []);

  const me = room.players.find((p) => p.id === myId);
  const permission = computeVideoPermission({
    phase: room.phase,
    alive: me?.alive ?? false,
    silenced: room.silencedPlayerId === myId,
  });
  const discussing = DISCUSSING_PHASES.has(room.phase);

  if (error) {
    return <p className="text-center text-sm text-seal-bright">{error}</p>;
  }
  if (!token || !url) {
    return <p className="text-center text-sm text-paper-dim">Povezivanje na video…</p>;
  }

  return (
    <LiveKitRoom
      token={token}
      serverUrl={url}
      connect
      video={permission.camera}
      audio={permission.microphone}
      data-lk-theme="default"
      className="overflow-hidden rounded border border-smoke-800"
    >
      <VideoPermissionSync camera={permission.camera} microphone={permission.microphone} />
      <RoomAudioRenderer />
      <div className="p-2">
        {discussing ? (
          <LiveVideoGrid />
        ) : (
          <PhotoGrid players={room.players} myId={myId} showDead />
        )}
      </div>
      {discussing && (
        <div className="flex justify-center gap-3 bg-smoke-900 py-3">
          {/* TrackToggle ne prosledjuje HTML "disabled" na dugme (proveril: outerHTML ga nema),
              pa "nedozvoljeno" stanje simuliramo sami preko stila — server ionako brani
              objavu ako dozvola nije data, ovo je samo vizuelni signal. */}
          <TrackToggle
            source={Track.Source.Camera}
            style={permission.camera ? undefined : { pointerEvents: "none" }}
            className={`rounded border px-4 py-2 text-sm transition-colors ${
              permission.camera
                ? "border-smoke-700 bg-smoke-900 text-paper hover:border-brass/50"
                : "cursor-not-allowed border-smoke-800 bg-smoke-900 text-paper-dim opacity-40"
            }`}
          >
            Kamera
          </TrackToggle>
          <TrackToggle
            source={Track.Source.Microphone}
            style={permission.microphone ? undefined : { pointerEvents: "none" }}
            className={`rounded border px-4 py-2 text-sm transition-colors ${
              permission.microphone
                ? "border-smoke-700 bg-smoke-900 text-paper hover:border-brass/50"
                : "cursor-not-allowed border-smoke-800 bg-smoke-900 text-paper-dim opacity-40"
            }`}
          >
            Mikrofon
          </TrackToggle>
        </div>
      )}
    </LiveKitRoom>
  );
}

/**
 * Sam prop na <LiveKitRoom> pokrece pocetno stanje samo pri prvoj konekciji
 * (LiveKit to interno slusa preko "SignalConnected", koji se desi jednom).
 * Da bi se trake uzivo gasile/palile kad faza partije prodje bez ponovnog
 * povezivanja, moramo sami da pozovemo setCameraEnabled/setMicrophoneEnabled
 * svaki put kad se dozvola promeni.
 */
function VideoPermissionSync({ camera, microphone }: { camera: boolean; microphone: boolean }) {
  const room = useRoomContext();

  useEffect(() => {
    room.localParticipant.setCameraEnabled(camera).catch(() => {});
  }, [room, camera]);

  useEffect(() => {
    room.localParticipant.setMicrophoneEnabled(microphone).catch(() => {});
  }, [room, microphone]);

  return null;
}

/** Uzivo video svih ucesnika — fiksno 2 reda, kolone zavise od broja ljudi. */
function LiveVideoGrid() {
  const tracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: true }], {
    onlySubscribed: false,
  });
  const columns = Math.max(1, Math.ceil(tracks.length / 2));
  return (
    <div
      className="grid gap-2"
      style={{
        gridTemplateRows: "repeat(2, 1fr)",
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gridAutoFlow: "column",
      }}
    >
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
