import { useEffect, useState } from "react";
import {
  GridLayout,
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

interface Props {
  room: PublicRoomState;
  myId: string;
}

/**
 * Video/audio soba preko LiveKit-a — konekcija ostaje otvorena kroz celu
 * partiju, samo se prava za objavljivanje kamere/mikrofona menjaju uzivo
 * po fazi (server je autoritativan, ovo je samo brzo lokalno ogledalo tog
 * pravila da se ne ceka mreza).
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
      <VideoGrid />
      <RoomAudioRenderer />
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

function VideoGrid() {
  const tracks = useTracks([Track.Source.Camera, Track.Source.Microphone], {
    onlySubscribed: false,
  });
  return (
    <GridLayout tracks={tracks} style={{ height: "320px" }}>
      <ParticipantTile />
    </GridLayout>
  );
}
