import test from "node:test";
import assert from "node:assert/strict";
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: () => null, setItem: () => {} } });
globalThis.window = new EventTarget();
const { evaluateClientSatisfaction } = await import("../src/game/nighttime/client-satisfaction.js");

test("satisfaction uses temporary wishes, skips suppressed preferences and includes additive adjustment", () => {
  const profile = { preferences: [{ tagId: "potential", attitude: 1, degree: 1 }, { tagId: "bloodAB", attitude: -2 }] };
  const cocktail = { tags: [{ id: "potential", degree: 4 }, { id: "bloodAB", degree: 1 }], effectiveProfile: { preferences: [{ tagId: "potential", attitude: 1, degree: 4 }, { tagId: "bloodAB", attitude: -2, suppressed: true }] }, satisfactionModifier: -1 };
  const before = JSON.stringify(profile);
  const result = evaluateClientSatisfaction(cocktail, profile);
  assert.equal(result.preferences[0].score, 2);
  assert.equal(result.preferences[1].score, 0);
  assert.equal(result.preferences[1].suppressed, true);
  assert.equal(result.satisfactionModifier, -1);
  assert.equal(result.score, 1);
  assert.equal(JSON.stringify(profile), before);
});

test("saved client wishes preserve degrees above three for likes and dislikes", async () => {
  const { setClients, getClients } = await import("../src/game/nighttime/client-preferences.js");
  setClients([{ id: "levels", name: "Уровни", preferences: [{ tagId: "sour", attitude: -1, degree: 5 }, { tagId: "healing", attitude: 2, degree: 7 }] }]);
  assert.equal(getClients()[0].preferences[0].degree, 5);
  assert.equal(getClients()[0].preferences[1].degree, 7);
  const { renderClientEditor } = await import("../src/game/nighttime/client-editor.js");
  const html = renderClientEditor("levels");
  assert.match(html, /type="number"[^>]*value="5"[^>]*data-client-degree="sour"/);
  assert.match(html, /type="number"[^>]*value="7"[^>]*data-client-degree="healing"/);
});

test("suppressed drink tags count as absent for satisfaction", () => {
  const result = evaluateClientSatisfaction({ tags: [{ id: "healing", degree: 0, suppressed: true }] }, { preferences: [{ tagId: "healing", attitude: 1, degree: 1 }] });
  assert.equal(result.preferences[0].present, false);
  assert.equal(result.score, -2);
});
