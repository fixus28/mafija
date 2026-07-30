import type { NarratorSoundId } from "@mafija/shared";

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

/**
 * Pokusava da pusti snimljenu frazu. Vraca true ako je pustanje zaista
 * zapocelo (pozivalac onda NE treba da padne na TTS) — false ako fajl
 * (jos) ne postoji ili je pustanje odbijeno (npr. browser jos nije
 * registrovao interakciju korisnika). Slusamo i "error" na elementu i
 * play() promise, jer browseri razlicito prijavljuju 404 na izvoru.
 */
export function playNarratorSound(sound: NarratorSoundId): Promise<boolean> {
  return new Promise((resolve) => {
    const audio = new Audio(SOUND_FILES[sound]);
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };
    audio.addEventListener("error", () => finish(false));
    audio
      .play()
      .then(() => finish(true))
      .catch(() => finish(false));
  });
}
