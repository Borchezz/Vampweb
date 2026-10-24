// Run only in an isolated browser: the mixing scenario changes test settings/recipe.
export function testHintCategoriesAndSlots() {
  const check = (v, m) => { if (!v) throw new Error(m); };
  const panel = document.querySelector('.cocktail-hints-panel');
  for (const category of ['flavor', 'benefit', 'blood-group', 'composition', 'serving']) {
    check(panel.querySelector(`[data-hint-category="${category}"] .tag-${category}`), `Missing colored category ${category}`);
  }
  const combinations = panel.querySelector('[data-hint-combinations]');
  check(combinations?.textContent.includes('плазм'), 'Missing base combination explanation');
  check(combinations?.textContent.includes('плёнк'), 'Missing film limit explanation');
  check(panel.textContent.includes('Барные добавки') && panel.textContent.includes('Медицинские'), 'Explain both additive types');
  return { passed: true, scenario: 'hint-categories-and-slots' };
}

export async function testMixMinimumIngredients() {
  const check = (v, m) => { if (!v) throw new Error(m); };
  const { updateNighttimeSettings } = await import('../src/game/nighttime/settings.js');
  updateNighttimeSettings({ resourceLimited: false });
  window.dispatchEvent(new Event('nighttime-components-changed'));
  document.querySelector('.nighttime-prepare').closest('section').querySelector('.panel-heading button').click();
  const mix = () => [...document.querySelectorAll('.nighttime-preparation-controls button')].find(b => b.textContent === 'Перемешать');
  const component = (id) => document.querySelector(`.ingredient-panel [data-ingredient-id="${id}"]`);
  check(mix().disabled, 'Mix disabled for empty recipe');
  component('plasma-o').click();
  check(mix().disabled, 'Mix must be disabled for one ingredient');
  const cold = [...document.querySelectorAll('.nighttime-preparation-controls button')].find(b => b.textContent === 'Добавить льда');
  check(!cold.disabled, 'Temperature actions still work with one base');
  component('additive-tonic').click();
  check(!mix().disabled, 'An additive counts as a second ingredient');
  mix().click();
  check(document.querySelector('.tag-groups [data-tag-id="mixed"]'), 'Two ingredients can be mixed');
  check(!document.querySelector('.tag-groups [data-tag-id="layered"]'), 'Mixed replaces layered');
  document.querySelector('.cocktail-slot[data-slot-id="additive-1"] button').click();
  check(mix().disabled, 'Removing second ingredient disables Mix again');
  component('film-sour-healing').click();
  check(!mix().disabled, 'A film counts as a second ingredient');
  return { passed: true, scenario: 'mix-minimum-ingredients' };
}
