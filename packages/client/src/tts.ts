/** Cita naratorovu poruku naglas preko ugradjenog Web Speech API-ja (bez novih zavisnosti). */
export function speakNarratorMessage(text: string): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "sr-RS";
  window.speechSynthesis.speak(utterance);
}
