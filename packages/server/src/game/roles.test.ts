import assert from "node:assert/strict";
import { test } from "node:test";
import { assignRoles } from "./roles";

function countRoles(roles: Map<string, string>) {
  const counts: Record<string, number> = {};
  for (const role of roles.values()) counts[role] = (counts[role] ?? 0) + 1;
  return counts;
}

test("4 igraca: nema damu, po jedan mafija/lekar/policajac, ostalo gradjani", () => {
  const players = ["p1", "p2", "p3", "p4"];
  const roles = assignRoles(players);
  assert.equal(roles.size, 4);
  assert.deepEqual(countRoles(roles), { MAFIA: 1, DOCTOR: 1, DETECTIVE: 1, CIVILIAN: 1 });
});

test("6 igraca: i dalje nema damu (granica ispod 7)", () => {
  const players = ["p1", "p2", "p3", "p4", "p5", "p6"];
  const roles = assignRoles(players);
  assert.deepEqual(countRoles(roles), { MAFIA: 1, DOCTOR: 1, DETECTIVE: 1, CIVILIAN: 3 });
});

test("7 igraca: dama se ukljucuje", () => {
  const players = ["p1", "p2", "p3", "p4", "p5", "p6", "p7"];
  const roles = assignRoles(players);
  assert.deepEqual(countRoles(roles), {
    MAFIA: 1,
    ACCOMPLICE: 1,
    DOCTOR: 1,
    DETECTIVE: 1,
    CIVILIAN: 3,
  });
});

test("svaki igrac dobija tacno jednu ulogu", () => {
  const players = ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"];
  const roles = assignRoles(players);
  for (const id of players) assert.ok(roles.has(id));
});

test("baca gresku ispod minimuma igraca", () => {
  assert.throws(() => assignRoles(["p1", "p2"]));
});
