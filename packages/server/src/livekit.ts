import { AccessToken, RoomServiceClient, TrackSource } from "livekit-server-sdk";
import type { VideoPermission } from "@mafija/shared";

/**
 * Podrazumevane vrednosti odgovaraju "livekit-server --dev" rezimu za
 * lokalni razvoj (nema Docker-a, samo pokrenut .exe). U produkciji se sve
 * troje postavlja preko environment promenljivih (jaki, tajni kljucevi).
 */
const LIVEKIT_URL = process.env.LIVEKIT_URL ?? "ws://localhost:7880";
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY ?? "devkey";
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET ?? "secret";

/** RoomServiceClient (REST) gadja http(s), signal konekcija klijenta gadja ws(s) — isti host, druga sema. */
const roomService = new RoomServiceClient(
  LIVEKIT_URL.replace(/^ws/, "http"),
  LIVEKIT_API_KEY,
  LIVEKIT_API_SECRET,
);

export function getLiveKitUrl(): string {
  return LIVEKIT_URL;
}

function grantForPermission(permission: VideoPermission) {
  const sources: TrackSource[] = [];
  if (permission.camera) sources.push(TrackSource.CAMERA);
  if (permission.microphone) sources.push(TrackSource.MICROPHONE);
  return {
    canSubscribe: true,
    canPublish: sources.length > 0,
    canPublishData: true,
    canPublishSources: sources,
  };
}

/**
 * Pravi kratkotrajni token za ulazak u glavnu LiveKit sobu partije (naziv
 * = kod sobe). Pocetna prava za objavljivanje odgovaraju TRENUTNOM stanju
 * partije (faza/zivost/utisanost) — ne "uvek sve dozvoljeno" — jer se token
 * moze traziti bilo kad usred partije (npr. refresh stranice).
 */
export async function createLiveKitToken(
  roomCode: string,
  identity: string,
  name: string,
  permission: VideoPermission,
): Promise<string> {
  const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity,
    name,
    ttl: "6h", // partija moze potrajati; ionako se prava posle diktiraju uzivo preko updateParticipant
  });
  token.addGrant({ roomJoin: true, room: roomCode, ...grantForPermission(permission) });
  return token.toJwt();
}

/**
 * Uzivo menja da li igrac sme da objavljuje kameru/mikrofon u glavnoj sobi
 * — bez prekidanja konekcije. Ovo je STVARNA prepreka (server je
 * autoritativan): i posten klijent sam gasi svoje trake na promenu faze,
 * ali ovo sprecava izmenjenog klijenta da ih drzi upaljenim mimo pravila.
 */
export async function setMainRoomPublishPermission(
  roomCode: string,
  identity: string,
  permission: VideoPermission,
): Promise<void> {
  try {
    await roomService.updateParticipant(roomCode, identity, {
      permission: grantForPermission(permission),
    });
  } catch {
    // Igrac verovatno jos nije (ili vise nije) povezan na LiveKit — nije greska igre.
  }
}

/** Naziv privatne LiveKit sobe za nocni audio kanal mafije i dame. */
export function mafiaChannelRoomName(roomCode: string): string {
  return `${roomCode}:mafija`;
}

/**
 * Token za privatni nocni kanal — zasebna LiveKit soba, pa civil nikad ne
 * moze da se poveze na nju (nema potpisan token za taj naziv sobe), bez
 * obzira sta klijent radi. To je stvarna granica privatnosti kanala.
 * Mafija i dama vide I cuju jedno drugo (kamera + mikrofon).
 */
export async function createMafiaChannelToken(
  roomCode: string,
  identity: string,
  name: string,
): Promise<string> {
  const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity,
    name,
    ttl: "10m", // trazi se iznova svake noci
  });
  token.addGrant({
    roomJoin: true,
    room: mafiaChannelRoomName(roomCode),
    canSubscribe: true,
    canPublish: true,
    canPublishSources: [TrackSource.CAMERA, TrackSource.MICROPHONE],
    canPublishData: false,
  });
  return token.toJwt();
}
