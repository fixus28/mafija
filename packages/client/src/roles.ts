import type { Role } from "@mafija/shared";

export const ROLE_LABEL: Record<Role, string> = {
  MAFIA: "Mafija",
  ACCOMPLICE: "Dama",
  DOCTOR: "Lekar",
  DETECTIVE: "Policajac",
  CIVILIAN: "Građanin",
};

export const ROLE_DESCRIPTION: Record<Role, string> = {
  MAFIA: "Noću biraš žrtvu. Znaš ko je dama — radite zajedno.",
  ACCOMPLICE: "Noću biraš koga ućutkuješ za sledeću diskusiju. Znaš ko je mafija.",
  DOCTOR: "Noću biraš koga lečiš. Pogodak spašava metu mafije.",
  DETECTIVE: "Noću proveravaš jednog igrača — saznaješ da li je mafija.",
  CIVILIAN: "Nemaš noćnu moć. Prati diskusiju i glasaj pažljivo.",
};

/** Uloge koje noću biraju metu — ostale (CIVILIAN) samo čekaju. */
export const NIGHT_ACTIVE_ROLES: Role[] = ["MAFIA", "ACCOMPLICE", "DOCTOR", "DETECTIVE"];

export const NIGHT_PROMPT: Partial<Record<Role, string>> = {
  MAFIA: "Koga ubijaš večeras?",
  ACCOMPLICE: "Koga ućutkuješ za sutrašnju diskusiju?",
  DOCTOR: "Koga lečiš večeras?",
  DETECTIVE: "Koga proveravaš?",
};
