import { TAG_DEFINITIONS } from "./cocktail-data.js";
import { getBloodCompatibilityRows } from "./cocktail-rules.js";

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

export function createHintsPanel() {
  const panel = node("section", "cocktail-panel cocktail-hints-panel");
  panel.setAttribute("aria-label", "Подсказки");
  panel.append(node("h2", "", "Подсказки"));
  panel.append(node("h3", "hint-subheading", "Типы тегов"));
  const categories = node("dl", "hint-tag-rules");
  for (const [category, label, description] of [
    ["flavor", "Вкус · зелёный", "Солёное, сладкое, кислое и горькое."],
    ["benefit", "Свойства · розовый", "Бодрящее, целебное и потенциал. В тегах напитка эта группа называется «Польза»."],
    ["blood-group", "Группа крови · жёлтый", "I (O), II (A), III (B), IV (AB). Совместимость зависит от того, плазма это или эритроциты."],
    ["composition", "Состав · оранжевый", "Густое, жидкое и гемолиз."],
    ["serving", "Подача · голубой", "Слоистый, смешанный, холодный и тёплый."],
  ]) {
    const item = node("div", "hint-tag-rule");
    item.dataset.hintCategory = category;
    const term = node("dt");
    term.append(node("span", `cocktail-tag tag-${category}`, label));
    item.append(term, node("dd", "", description));
    categories.append(item);
  }
  panel.append(categories,
    node("p", "hint-note", "Барные добавки стандартного каталога меняют только вкус. Медицинские добавки в основном работают со свойствами, пожеланиями и удовлетворением клиента; некоторые также меняют вкус, состав или учёт групп крови."));
  const combinations = node("section", "hint-combinations");
  combinations.dataset.hintCombinations = "";
  combinations.append(node("h3", "hint-subheading", "Что можно положить в коктейль"),
    node("p", "hint-note", "Для напитка нужен хотя бы один основной компонент: плазма или эритроциты. Для них есть два больших слота: можно взять одну плазму, одни эритроциты, две плазмы, два компонента эритроцитов либо плазму + эритроциты. Три плазмы или три любых больших компонента не помещаются."),
    node("p", "hint-note", "Плёнка необязательна: для неё есть один отдельный слот. Она не занимает большой слот. К любой допустимой основе можно добавить одну плёнку или обойтись без неё."),
    node("p", "hint-note", "Ещё есть два общих слота добавок: максимум одна барная и одна медицинская либо две медицинские. Любой слот можно оставить пустым. Одна и та же добавка не может занимать оба слота."));
  panel.append(combinations);
  const table = node("table", "blood-compatibility-table");
  table.append(node("caption", "", "Совместимость групп крови"));
  const head = node("thead");
  const header = node("tr");
  const corner = node("th", "", "Плазма ↓");
  corner.scope = "col";
  header.append(corner);
  const rows = getBloodCompatibilityRows();
  for (const entry of rows[0].erythrocytes) {
    const cell = node("th", "", TAG_DEFINITIONS[entry.tagId].label);
    cell.scope = "col";
    cell.title = `Эритроциты ${TAG_DEFINITIONS[entry.tagId].label}`;
    header.append(cell);
  }
  head.append(header);
  const body = node("tbody");
  for (const row of rows) {
    const line = node("tr");
    const label = node("th", "", TAG_DEFINITIONS[row.plasmaTagId].label);
    label.scope = "row";
    line.append(label);
    for (const entry of row.erythrocytes) {
      const cell = node("td", entry.compatible ? "blood-compatible" : "blood-incompatible", entry.compatible ? "✓" : "×");
      cell.dataset.plasmaTag = row.plasmaTagId;
      cell.dataset.erythrocyteTag = entry.tagId;
      cell.dataset.compatible = String(entry.compatible);
      cell.title = entry.compatible ? "Без гемолиза" : "Гемолиз";
      cell.setAttribute("aria-label", cell.title);
      line.append(cell);
    }
    body.append(line);
  }
  table.append(head, body);
  panel.append(node("p", "hint-note", "Строки — плазма, столбцы — эритроциты."), table);
  const legend = node("p", "hint-legend");
  legend.append(node("span", "blood-compatible", "✓ Без гемолиза"), node("span", "blood-incompatible", "× Гемолиз"));
  panel.append(legend,
    node("p", "hint-note", "Несовместимая пара даёт «Гемолиз 1», после «Перемешать» — «Гемолиз 2». Две плазмы или два компонента эритроцитов гемолиза не вызывают. «Расщепитель» убирает гемолиз и группы крови из напитка."),
    node("h3", "hint-subheading", "Как получить теги"));
  const list = node("dl", "hint-tag-rules");
  const rules = [
    ["thick", "Эритроцитов больше, чем плазмы: например, один большой компонент эритроцитов без плазмы."],
    ["liquid", "Плазмы больше, чем эритроцитов: например, один большой компонент плазмы без эритроцитов."],
    ["layered", "Не менее двух ингредиентов в коктейле без перемешивания. Плёнка и добавки тоже считаются."],
    ["mixed", "Не менее двух ингредиентов и кнопка «Перемешать». Заменяет «Слоистый»."],
    ["cold", "Кнопка «Добавить льда». Заменяет «Тёплый»."],
    ["warm", "Кнопка «Подогреть». Заменяет «Холодный»."],
  ];
  for (const [id, description] of rules) {
    const rule = node("div", "hint-tag-rule");
    rule.dataset.hintTag = id;
    const title = node("dt");
    title.append(node("span", `cocktail-tag tag-${TAG_DEFINITIONS[id].category}`, TAG_DEFINITIONS[id].label));
    rule.append(title, node("dd", "", description));
    list.append(rule);
  }
  panel.append(list, node("p", "hint-note", "При равном количестве плазмы и эритроцитов базовое правило не даёт ни «Густое», ни «Жидкое». Плёнка и добавки в этом сравнении не считаются. Особые эффекты могут менять результат: EPO принудительно даёт «Густое». Для действий с напитком нужен хотя бы один большой компонент."));
  return panel;
}
