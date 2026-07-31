import type { NarratorMessagePayload, NarratorSoundId } from "@mafija/shared";
import { speakNarratorMessage } from "./tts";

/**
 * Snimljene naratorove fraze — fajlovi zive u public/narrator/ (Vite ih
 * servira direktno sa korena sajta). Ime igraca se NIKAD ne izgovara u
 * snimku, samo se prikazuje tekstom u logu — snimak pokriva samo fiksni
 * deo recenice.
 */
const SOUND_FILES: Record<NarratorSoundId, string> = {
  night_victim: "/narrator/night-victim.mp3",
  night_saved: "/narrator/night-saved.mp3",
  night_calm: "/narrator/night-calm.mp3",
  vote_eliminated: "/narrator/vote-eliminated.mp3",
  vote_skipped: "/narrator/vote-skipped.mp3",
  vote_tie: "/narrator/vote-tie.mp3",
  town_wins: "/narrator/town-wins.mp3",
  mafia_wins: "/narrator/mafia-wins.mp3",
};

/** Ambijentalni "grad spava"/"grad se budi" snimci — prate promenu dan/noc teme. */
const AMBIENCE_FILES: Record<"day" | "night", string> = {
  day: "/narrator/day.mp3",
  night: "/narrator/night.mp3",
};

/**
 * Pokusava da pusti fajl i ceka da se ZAISTA zavrsi (ne samo da pocne) —
 * bitno je da sledeca stvar u redu (vidi enqueueNarratorAudio/enqueueAmbience)
 * ne pusti preko ove. Vraca true ako je pustanje uspelo, false ako fajl
 * (jos) ne postoji ili je pustanje odbijeno.
 */
function playFile(src: string): Promise<boolean> {
  return new Promise((resolve) => {
    const audio = new Audio(src);
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };
    audio.addEventListener("ended", () => finish(true));
    audio.addEventListener("error", () => finish(false));
    audio.play().catch(() => finish(false));
  });
}

/**
 * Naratorove poruke (i ambijentalni prelazi) mogu da stignu jedna za drugom
 * u istom trenu (npr. "grad je presudio X" pa odmah "mafija je pobedila" —
 * obe posledica istog glasanja). Ako bismo ih pustili odmah, zvuk bi se
 * preklopio i druga bi ispala "nemušta". Zato se sve pusta kroz jedan red —
 * sledeca ceka da prethodna STVARNO zavrsi (snimak do kraja ili TTS do kraja).
 */
let queue: Promise<void> = Promise.resolve();

export function enqueueNarratorAudio(payload: NarratorMessagePayload): void {
  queue = queue.then(async () => {
    if (payload.sound) {
      const played = await playFile(SOUND_FILES[payload.sound]);
      if (played) return;
    }
    // Ako snimljena fraza (jos) ne postoji na disku ili je pustanje odbijeno, padamo na TTS.
    await speakNarratorMessage(payload.text);
  });
}

/** "Grad spava"/"grad se budi" — prati promenu is-night teme, bez TTS fallbacka (nema teksta). */
export function enqueueAmbience(kind: "day" | "night"): void {
  queue = queue.then(() => playFile(AMBIENCE_FILES[kind]).then(() => undefined));
}
