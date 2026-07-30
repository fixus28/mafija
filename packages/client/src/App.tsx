import { useEffect, useState } from "react";
import type {
  DetectiveResultPayload,
  NarratorMessagePayload,
  PublicRoomState,
  RolePayload,
} from "@mafija/shared";
import { getSessionId, socket } from "./socket";
import { enqueueNarratorAudio } from "./narratorAudio";
import Home from "./components/Home";
import Lobby from "./components/Lobby";
import Game from "./components/Game";

export default function App() {
  const [room, setRoom] = useState<PublicRoomState | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [role, setRole] = useState<RolePayload | null>(null);
  const [detectiveResults, setDetectiveResults] = useState<DetectiveResultPayload[]>([]);
  const [narratorMessage, setNarratorMessage] = useState<string | null>(null);

  useEffect(() => {
    const onState = (state: PublicRoomState) => setRoom(state);

    const onClosed = (reason: string) => {
      sessionStorage.removeItem("mafija:roomCode");
      setRoom(null);
      setMyId(null);
      setRole(null);
      setDetectiveResults([]);
      setNarratorMessage(null);
      setNotice(reason);
    };

    const onRole = (payload: RolePayload) => setRole(payload);
    const onDetectiveResult = (payload: DetectiveResultPayload) =>
      setDetectiveResults((prev) => [payload, ...prev]);
    const onNarratorMessage = (payload: NarratorMessagePayload) => {
      setNarratorMessage(payload.text);
      enqueueNarratorAudio(payload);
    };

    /**
     * Poziva se pri svakom (re)konektu socketa. Ako smo pre pada bili
     * u sobi, tiho se vracamo na svoje mesto — server nas po sessionId-ju
     * prepoznaje kao istog igraca.
     */
    const onConnect = () => {
      const code = sessionStorage.getItem("mafija:roomCode");
      const name = localStorage.getItem("mafija:playerName");
      if (!code || !name) return;
      socket.emit(
        "room:join",
        { code, name, sessionId: getSessionId() },
        (res) => {
          if (res.ok && res.playerId) {
            setMyId(res.playerId);
          } else {
            sessionStorage.removeItem("mafija:roomCode");
            setRoom(null);
            if (res.error) setNotice(res.error);
          }
        },
      );
    };

    socket.on("room:state", onState);
    socket.on("room:closed", onClosed);
    socket.on("connect", onConnect);
    socket.on("game:role", onRole);
    socket.on("game:detectiveResult", onDetectiveResult);
    socket.on("narrator:message", onNarratorMessage);
    // Socket ume da se poveze PRE nego sto React zakaci listener —
    // u tom slucaju "connect" nikad ne stize, pa rejoin pokrecemo rucno.
    if (socket.connected) onConnect();
    return () => {
      socket.off("room:state", onState);
      socket.off("room:closed", onClosed);
      socket.off("connect", onConnect);
      socket.off("game:role", onRole);
      socket.off("game:detectiveResult", onDetectiveResult);
      socket.off("narrator:message", onNarratorMessage);
    };
  }, []);

  const enterRoom = (code: string, playerId: string) => {
    sessionStorage.setItem("mafija:roomCode", code);
    setMyId(playerId);
    setNotice(null);
  };

  const exitRoom = () => {
    socket.emit("room:leave", () => undefined);
    sessionStorage.removeItem("mafija:roomCode");
    setRoom(null);
    setMyId(null);
    setRole(null);
    setDetectiveResults([]);
    setNarratorMessage(null);
  };

  if (room && myId) {
    if (room.phase === "LOBBY") {
      return <Lobby room={room} myId={myId} onLeave={exitRoom} />;
    }
    return (
      <Game
        room={room}
        myId={myId}
        role={role}
        detectiveResults={detectiveResults}
        narratorMessage={narratorMessage}
        onLeave={exitRoom}
      />
    );
  }
  return <Home notice={notice} onEntered={enterRoom} />;
}
