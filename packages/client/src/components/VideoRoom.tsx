import { useEffect, useState } from "react";
import {
  GridLayout,
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
 * Video/audio soba preko LiveKit-a. Za sada je uvek prisutna dok je partija
 * u toku — automatsko gasenje kamere/mikrofona van dnevne diskusije (i
 * privatni kanal mafije nocu) dolazi u sledecoj fazi.
 */
export default function VideoRoom() {
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
      video
      audio
      data-lk-theme="default"
      className="overflow-hidden rounded border border-smoke-800"
    >
      <VideoGrid />
      <RoomAudioRenderer />
      <div className="flex justify-center gap-3 bg-smoke-900 py-3">
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
