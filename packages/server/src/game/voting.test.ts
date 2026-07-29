import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveVote, applyElimination } from "./voting";
import type { Role } from "@mafija/shared";

test("jasna vecina bira zrtvu", () => {
  const votes = new Map<string, string | null>([
    ["a", "c"],
    ["b", "c"],
    ["c", "a"],
  ]);
  const result = resolveVote(votes, ["a", "b", "c"], ["a", "b", "c"]);
  assert.deepEqual(result, { status: "eliminated", targetId: "c" });
});

test("nereseno izmedju dva igraca vraca oba kao kandidate za reglasavanje", () => {
  const votes = new Map<string, string | null>([
    ["a", "b"],
    ["b", "a"],
  ]);
  const result = resolveVote(votes, ["a", "b"], ["a", "b"]);
  assert.deepEqual(result, { status: "tie", candidates: ["a", "b"] });
});

test("bez glasova niko ne ispada", () => {
  const result = resolveVote(new Map(), ["a", "b"], ["a", "b"]);
  assert.deepEqual(result, { status: "skipped" });
});

test("glas na igraca van liste kandidata se ne racuna", () => {
  const votes = new Map<string, string | null>([
    ["a", "mrtav"],
    ["b", "c"],
    ["c", "c"],
  ]);
  const result = resolveVote(votes, ["a", "b", "c"], ["a", "b", "c"]);
  assert.deepEqual(result, { status: "eliminated", targetId: "c" });
});

test("glas glasaca koji nije medju eligibleVoters se ne racuna", () => {
  const votes = new Map<string, string | null>([
    ["a", "c"], // "a" je izjednacen kandidat, iskljucen iz ovog kruga
    ["b", "c"],
  ]);
  const result = resolveVote(votes, ["b"], ["c"]);
  assert.deepEqual(result, { status: "eliminated", targetId: "c" });
});

test("preskoci pobedjuje sa strogom vecinom: niko ne ispada", () => {
  const votes = new Map<string, string | null>([
    ["a", null],
    ["b", null],
    ["c", "a"],
  ]);
  const result = resolveVote(votes, ["a", "b", "c"], ["a", "b", "c"]);
  assert.deepEqual(result, { status: "skipped" });
});

test("nereseno preskoci-vs-jedan igrac: niko ne ispada (grad je oprezan)", () => {
  const votes = new Map<string, string | null>([
    ["a", null],
    ["b", "c"],
  ]);
  const result = resolveVote(votes, ["a", "b"], ["a", "b", "c"]);
  assert.deepEqual(result, { status: "skipped" });
});

test("nereseno izmedju tri igraca (preskoci takodje izjednacen) vraca sva tri kao kandidate", () => {
  const votes = new Map<string, string | null>([
    ["a", "b"],
    ["b", "c"],
    ["c", "a"],
    ["d", null],
  ]);
  const result = resolveVote(votes, ["a", "b", "c", "d"], ["a", "b", "c"]);
  assert.deepEqual(result, { status: "tie", candidates: ["a", "b", "c"] });
});

test("izbacena MAFIA: dama postaje nova mafija", () => {
  const roles = new Map<string, Role>([
    ["mafia", "MAFIA"],
    ["dama", "ACCOMPLICE"],
  ]);
  const outcome = applyElimination(roles, "mafia");
  assert.equal(outcome.accompliceConverted, true);
  assert.equal(outcome.roles.get("dama"), "MAFIA");
});

test("izbacena ACCOMPLICE: mafija ostaje ista, nista se ne menja", () => {
  const roles = new Map<string, Role>([
    ["mafia", "MAFIA"],
    ["dama", "ACCOMPLICE"],
  ]);
  const outcome = applyElimination(roles, "dama");
  assert.equal(outcome.accompliceConverted, false);
  assert.equal(outcome.roles.get("mafia"), "MAFIA");
  assert.equal(outcome.roles.get("dama"), "ACCOMPLICE");
});

test("izbacen gradjanin: nema promene uloga", () => {
  const roles = new Map<string, Role>([
    ["mafia", "MAFIA"],
    ["civ", "CIVILIAN"],
  ]);
  const outcome = applyElimination(roles, "civ");
  assert.equal(outcome.accompliceConverted, false);
  assert.deepEqual(outcome.roles, roles);
});

test("izbacena MAFIA bez dame u igri (mali broj igraca): nema konverzije", () => {
  const roles = new Map<string, Role>([
    ["mafia", "MAFIA"],
    ["civ", "CIVILIAN"],
  ]);
  const outcome = applyElimination(roles, "mafia");
  assert.equal(outcome.accompliceConverted, false);
});

test("nereseno glasanje (null): uloge netaknute", () => {
  const roles = new Map<string, Role>([["mafia", "MAFIA"]]);
  const outcome = applyElimination(roles, null);
  assert.deepEqual(outcome.roles, roles);
});
