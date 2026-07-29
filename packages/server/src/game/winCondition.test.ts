import assert from "node:assert/strict";
import { test } from "node:test";
import { checkWinCondition } from "./winCondition";
import type { Role } from "@mafija/shared";

test("igra se nastavlja dok mracnih ima manje od ostalih", () => {
  const roles = new Map<string, Role>([
    ["mafia", "MAFIA"],
    ["lekar", "DOCTOR"],
    ["policajac", "DETECTIVE"],
    ["gradjanin", "CIVILIAN"],
  ]);
  const result = checkWinCondition(roles, ["mafia", "lekar", "policajac", "gradjanin"]);
  assert.equal(result, null);
});

test("grad pobedjuje kad nema vise nijednog mracnog", () => {
  const roles = new Map<string, Role>([
    ["mafia", "MAFIA"],
    ["gradjanin", "CIVILIAN"],
  ]);
  const result = checkWinCondition(roles, ["gradjanin"]);
  assert.equal(result, "TOWN");
});

test("mafija pobedjuje kad joj se broj izjednaci sa ostalima", () => {
  const roles = new Map<string, Role>([
    ["mafia", "MAFIA"],
    ["gradjanin", "CIVILIAN"],
  ]);
  const result = checkWinCondition(roles, ["mafia", "gradjanin"]);
  assert.equal(result, "MAFIA");
});

test("mafija pobedjuje kad je nadmasi ostale", () => {
  const roles = new Map<string, Role>([
    ["mafia", "MAFIA"],
    ["dama", "ACCOMPLICE"],
    ["gradjanin", "CIVILIAN"],
  ]);
  const result = checkWinCondition(roles, ["mafia", "dama", "gradjanin"]);
  assert.equal(result, "MAFIA");
});

test("dama se racuna kao mracna dok je jos dama", () => {
  const roles = new Map<string, Role>([
    ["mafia", "MAFIA"],
    ["dama", "ACCOMPLICE"],
    ["gradjanin1", "CIVILIAN"],
    ["gradjanin2", "CIVILIAN"],
    ["gradjanin3", "CIVILIAN"],
  ]);
  const result = checkWinCondition(roles, [
    "mafia",
    "dama",
    "gradjanin1",
    "gradjanin2",
    "gradjanin3",
  ]);
  assert.equal(result, null);
});
