import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveNight, type NightActions } from "./night";
import type { Role } from "@mafija/shared";

const roles = new Map<string, Role>([
  ["mafia", "MAFIA"],
  ["dama", "ACCOMPLICE"],
  ["lekar", "DOCTOR"],
  ["policajac", "DETECTIVE"],
  ["gradjanin", "CIVILIAN"],
]);

function actions(overrides: Partial<NightActions>): NightActions {
  return {
    mafiaTarget: null,
    accompliceTarget: null,
    doctorTarget: null,
    detectiveTarget: null,
    ...overrides,
  };
}

test("mafija ubija kad lekar ne pogodi", () => {
  const result = resolveNight(roles, actions({ mafiaTarget: "gradjanin", doctorTarget: "lekar" }));
  assert.equal(result.killed, "gradjanin");
  assert.equal(result.savedByDoctor, false);
});

test("lekar spasava metu mafije", () => {
  const result = resolveNight(roles, actions({ mafiaTarget: "gradjanin", doctorTarget: "gradjanin" }));
  assert.equal(result.killed, null);
  assert.equal(result.savedByDoctor, true);
});

test("mafija ne bira nikog: niko ne umire", () => {
  const result = resolveNight(roles, actions({ doctorTarget: "gradjanin" }));
  assert.equal(result.killed, null);
  assert.equal(result.savedByDoctor, false);
});

test("policajac otkriva pravu mafiju", () => {
  const result = resolveNight(roles, actions({ detectiveTarget: "mafia" }));
  assert.deepEqual(result.detectiveResult, { target: "mafia", isMafia: true });
});

test("policajac NE otkriva damu — uvek 'nije mafija'", () => {
  const result = resolveNight(roles, actions({ detectiveTarget: "dama" }));
  assert.deepEqual(result.detectiveResult, { target: "dama", isMafia: false });
});

test("policajac proverava gradjanina: nije mafija", () => {
  const result = resolveNight(roles, actions({ detectiveTarget: "gradjanin" }));
  assert.deepEqual(result.detectiveResult, { target: "gradjanin", isMafia: false });
});

test("bez detektivske akcije nema rezultata", () => {
  const result = resolveNight(roles, actions({}));
  assert.equal(result.detectiveResult, null);
});

test("dama utisava metu za sledecu diskusiju", () => {
  const result = resolveNight(roles, actions({ accompliceTarget: "gradjanin" }));
  assert.equal(result.silenced, "gradjanin");
});

test("bez akcije dame niko nije utisan", () => {
  const result = resolveNight(roles, actions({}));
  assert.equal(result.silenced, null);
});
