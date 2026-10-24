// Run in an isolated browser. The shelf scenario changes only its local shelf.
const check = (value, message) => { if (!value) throw new Error(message); };
export async function testEditorOnRight() {
  const toggle = document.querySelector('#modeToggleButton');
  if (!document.querySelector('#editorPanel').classList.contains('open')) toggle.click();
  await new Promise(resolve => setTimeout(resolve, 220));
  const editor = document.querySelector('.editor-panel');
  const rect = editor.getBoundingClientRect();
  check(getComputedStyle(editor).pointerEvents !== 'none', 'Editor must be open');
  check(Math.abs(document.documentElement.clientWidth - rect.right) <= 20, 'Editor must be anchored to the right');
  check(rect.left >= 0, 'Editor must fit the viewport');
  toggle.click();
  return { passed: true, scenario: 'editor-on-right', width: innerWidth };
}
export function testShelfChangesWithoutEditor() {
  check(!document.querySelector('#editorPanel').classList.contains('open'), 'Start in play mode');
  const slots = () => [...document.querySelectorAll('[data-bar-slot]')];
  const before = slots().map(e => e.dataset.ingredientId);
  const first = before.findIndex(Boolean);
  check(first >= 0, 'Need one filled slot');
  const recipeBefore = [...document.querySelectorAll('.cocktail-slot')].map(e => e.textContent).join('|');
  const clear = document.querySelector(`[data-bar-clear="${first}"]`);
  check(clear, 'Clear must be available without Editor');
  clear.click();
  check(!slots()[first].dataset.ingredientId, 'Clear empties only the shelf slot');
  check([...document.querySelectorAll('.cocktail-slot')].map(e => e.textContent).join('|') === recipeBefore, 'Clearing shelf does not modify the recipe');
  slots()[first].click();
  const duplicate = before.find((id, index) => id && index !== first);
  if (duplicate) check(document.querySelector(`[data-bar-choice="${duplicate}"]`).disabled, 'Other shelf assignments remain unique');
  const replacement = [...document.querySelectorAll('[data-bar-choice]')].find(e => !e.disabled && e.dataset.barChoice !== before[first]);
  check(replacement, 'Another bar additive must be selectable');
  const chosen = replacement.dataset.barChoice;
  replacement.click();
  check(slots()[first].dataset.ingredientId === chosen, 'Replacement is assigned without Editor');
  check(!document.querySelector('#editorPanel').classList.contains('open'), 'Changes never enter Editor mode');
  return { passed: true, scenario: 'shelf-change-play-mode', slot: first, chosen };
}
