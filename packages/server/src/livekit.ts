import { AccessToken } from "livekit-server-sdk";

/**
 * Podrazumevane vrednosti odgovaraju "livekit-server --dev" rezimu za
 * lokalni razvoj (nema Docker-a, samo pokrenut .exe). U produkciji se sve
 * troje postavlja preko environment promenljivih (jaki, tajni kljucevi).
 */
const LIVEKIT_URL = process.env.LIVEKIT_URL ?? "ws://localhost:7880";
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY ?? "devkey";
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET ?? "secret";

export function getLiveKitUrl(): string {
  return LIVEKIT_URL;
}

/**
 * Pravi kratkotrajni token za ulazak u LiveKit sobu ciji je naziv kod sobe
 * partije — svaki igrac dobija svoj, vezan za njegov javni identitet.
 */
export async function createLiveKitToken(
  roomCode: string,
  identity: string,
  name: string,
): Promise<string> {
  const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity,
    name,
    ttl: "6h", // partija moze potrajati; token se ionako trazi iznova pri svakom ulasku
  });
  token.addGrant({
    roomJoin: true,
    room: roomCode,
    canPublish: true,
    canSubscribe: true,
  });
  return token.toJwt();
}
