/**
 * Cita naratorovu poruku naglas preko ugradjenog Web Speech API-ja (bez
 * novih zavisnosti). Sam "lang" na utterance-u ne garantuje da ce browser
 * izabrati odgovarajuci glas — zato eksplicitno trazimo srpski glas, ako
 * ga OS ima instaliran (bez njega, TTS pokusava da cita srpski tekst
 * engleskim glasom, sto zvuci najgore).
 */

let cachedVoices: SpeechSynthesisVoice[] = [];

function loadVoices(): SpeechSynthesisVoice[] {
  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) cachedVoices = voices;
  return cachedVoices;
}

if (typeof window !== "undefined" && window.speechSynthesis) {
  // Chrome/Edge ucitavaju glasove asinhrono - lista je prazna dok se ovaj event ne desi.
  window.speechSynthesis.onvoiceschanged = loadVoices;
  loadVoices();
}

function findSerbianVoice(): SpeechSynthesisVoice | null {
  const voices = cachedVoices.length > 0 ? cachedVoices : loadVoices();
  const exact = voices.find((v) => v.lang.toLowerCase() === "sr-rs");
  if (exact) return exact;
  const prefixed = voices.find((v) => v.lang.toLowerCase().startsWith("sr"));
  return prefixed ?? null;
}

/** Vraca se tek kad izgovor stvarno zavrsi — bitno za red cekanja u narratorAudio.ts. */
export function speakNarratorMessage(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      resolve();
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "sr-RS";
    const voice = findSerbianVoice();
    if (voice) utterance.voice = voice;
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    window.speechSynthesis.speak(utterance);
  });
}
