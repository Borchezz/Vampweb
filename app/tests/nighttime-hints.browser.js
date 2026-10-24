export async function testCocktailHints() {
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  const panel = document.querySelector('.cocktail-hints-panel');
  check(panel, 'Hints panel must exist');
  const build = document.querySelector('.nighttime-prepare').closest('section');
  check(panel.getBoundingClientRect().width <= panel.parentElement.getBoundingClientRect().width + 1, 'Hints must fit their grid column without covering Components');
  check(panel.previousElementSibling === build, 'Hints must be directly below Cocktail in the same column');
  check(panel.getBoundingClientRect().top >= build.getBoundingClientRect().bottom, 'Hints must be visually below Cocktail');
  check(panel.querySelector('h2').textContent === 'Подсказки', 'Expected Russian hints heading');
  const { getBloodCompatibilityRows } = await import('../src/game/nighttime/cocktail-rules.js');
  const cells = [...panel.querySelectorAll('td[data-plasma-tag]')];
  check(cells.length === 16, 'Expected all sixteen compatibility combinations');
  for (const row of getBloodCompatibilityRows()) for (const entry of row.erythrocytes) {
    const cell = panel.querySelector(`td[data-plasma-tag="${row.plasmaTagId}"][data-erythrocyte-tag="${entry.tagId}"]`);
    check(cell?.dataset.compatible === String(entry.compatible), 'UI compatibility must match gameplay');
    check(cell?.textContent === (entry.compatible ? '✓' : '×'), 'Compatibility needs a visible symbol');
    check(cell?.getAttribute('aria-label') === (entry.compatible ? 'Без гемолиза' : 'Гемолиз'), 'Compatibility must not rely on color');
  }
  for (const id of ['thick', 'liquid', 'layered', 'mixed', 'cold', 'warm']) {
    check(panel.querySelector(`[data-hint-tag="${id}"]`)?.textContent.length > 20, `Missing rule: ${id}`);
  }
  check(panel.scrollWidth <= panel.clientWidth + 1, 'Hints must not overflow horizontally');
  return { passed: true, compatibilityCells: cells.length, tagRules: panel.querySelectorAll('[data-hint-tag]').length, viewportWidth: innerWidth };
}
