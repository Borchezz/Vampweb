import { TASK_KIND_OPTIONS } from "./task-contract.js";
import { getTaskDifficultyOptions } from "./task-difficulty-settings.js";
import { ACTIVITY_KIND_OPTIONS } from "./activity-contract.js";
import { FATIGUE_MAX, FATIGUE_MIN, getAgentFatigue } from "./agent-parameters.js";
import { formatZonePointsForEditor } from "./map-utils.js";
import { BAR_SETTING_METADATA } from "./bar-settings.js";

export const PATH_TYPE_OPTIONS = [
  { value: "border", label: "Граница" },
  { value: "bridge", label: "Мост" },
  { value: "ferry", label: "Паром" },
];

const PATH_TYPE_LABELS = Object.fromEntries(PATH_TYPE_OPTIONS.map(({ value, label }) => [value, label]));

export function getPathTypeLabel(type) {
  return PATH_TYPE_LABELS[type] || String(type || "");
}

export function isPathTollEnabled(path) {
  return Boolean(path?.toll && typeof path.toll === "object" && !Array.isArray(path.toll) && Object.keys(path.toll).length);
}

export function getPathTollResource(path) {
  const resource = Object.keys(path?.toll || {}).find((key) => Number(path.toll[key]) > 0);
  return resource || "money";
}

export function getPathTollAmount(path) {
  const amount = Number(path?.toll?.[getPathTollResource(path)]);
  return Number.isFinite(amount) && amount > 0 ? amount : 1;
}

export function createPathToll(resource, amount = 1) {
  const normalizedAmount = Math.max(1, Math.trunc(Number(amount)) || 1);
  return resource ? { [resource]: normalizedAmount } : {};
}

function asOptions(items) {
  return items.map((item) => ({ value: item.id, label: item.name }));
}

function resourceOptions(resourceDefs = {}) {
  return Object.entries(resourceDefs)
    .filter(([value]) => value !== "debt")
    .map(([value, resource]) => ({ value, label: resource.label || value }));
}

export function getAgentCreateFieldMetadata({ locations = [] } = {}) {
  return [
    { field: "id", label: "ID", control: "text", required: true },
    { field: "name", label: "Имя", control: "text", required: true },
    { field: "role", label: "Роль", control: "text", required: true },
    { field: "locationId", label: "Стартовая локация", control: "select", options: asOptions(locations) },
  ];
}

export function getAgentEditorFieldMetadata({ locations = [] } = {}) {
  return [
    { field: "name", label: "Имя", control: "text" },
    { field: "role", label: "Роль", control: "text" },
    { field: "portrait", label: "Портрет", control: "text" },
    { field: "color", label: "Цвет", control: "color" },
    { field: "maxEnergy", label: "Макс. энергия", control: "number" },
    { field: "energy", label: "Стартовая энергия", control: "number" },
    { field: "baseRecovery", label: "База восстановления", control: "number" },
    { field: "fatigue", label: "Усталость", control: "number", min: FATIGUE_MIN, max: FATIGUE_MAX, step: 1, getValue: getAgentFatigue },
    { field: "sympathy", label: "Симпатия", control: "number" },
    { field: "overtimeMax", label: "Переработка", control: "number" },
    { field: "locationId", label: "Текущая локация", control: "select", options: asOptions(locations) },
    { field: "startLocationId", label: "Стартовая локация", control: "select", options: asOptions(locations) },
  ];
}

export const traitCreateFieldMetadata = [
  { field: "id", label: "ID", control: "text", required: true },
  { field: "name", label: "Название", control: "text", required: true },
];

export const traitEditorFieldMetadata = [
  { field: "name", label: "Название", control: "text" },
  { field: "description", label: "Описание", control: "textarea" },
];

export const upgradeCreateFieldMetadata = [
  { field: "id", label: "ID", control: "text", required: true },
  { field: "name", label: "Название", control: "text", required: true },
];

export const upgradeEditorFieldMetadata = [
  { field: "id", label: "Stable ID", control: "readonly" },
  { field: "name", label: "Название", control: "text" },
  { field: "description", label: "Описание", control: "textarea" },
];

export const eventCreateFieldMetadata = [
  { field: "id", label: "ID", control: "text", required: true },
  { field: "name", label: "Название", control: "text", required: true },
];

export const eventEditorFieldMetadata = [
  { field: "id", label: "Stable ID", control: "readonly" },
  { field: "name", label: "Название", control: "text" },
  { field: "description", label: "Описание", control: "textarea" },
];

export const statusCreateFieldMetadata = [
  { field: "id", label: "ID", control: "text", required: true },
  { field: "name", label: "Название", control: "text", required: true },
];

export const statusEditorFieldMetadata = [
  { field: "id", label: "Stable ID", control: "readonly" },
  { field: "name", label: "Название", control: "text" },
  { field: "duration", label: "Длительность (дни)", control: "number", min: 1 },
  { field: "maxStacks", label: "Макс. стаков", control: "number", min: 1 },
  { field: "description", label: "Описание", control: "textarea" },
];

export const activityCreateFieldMetadata = [
  { field: "id", label: "ID", control: "text", required: true },
  { field: "name", label: "Название", control: "text", required: true },
  { field: "kind", label: "Тип", control: "select", options: ACTIVITY_KIND_OPTIONS },
];

export function getActivityEditorFieldMetadata() {
  return [
    { field: "id", label: "Stable ID", control: "readonly" },
    { field: "name", label: "Название", control: "text" },
    { field: "kind", label: "Тип", control: "select", options: ACTIVITY_KIND_OPTIONS },
    { field: "description", label: "Описание до участия", control: "textarea" },
    { field: "resultDescription", label: "Описание результата", control: "textarea" },
  ];
}


export const zoneCreateFieldMetadata = [
  { field: "id", label: "ID", control: "text", required: true },
  { field: "name", label: "Название", control: "text", required: true },
  { field: "code", label: "Код", control: "text", required: true },
];

export const zoneEditorFieldMetadata = [
  { field: "name", label: "Название", control: "text" },
  { field: "code", label: "Код", control: "text" },
  { field: "color", label: "Цвет", control: "color" },
  { field: "center.x", label: "Центр X", control: "number", getValue: (zone) => zone.center.x },
  { field: "center.y", label: "Центр Y", control: "number", getValue: (zone) => zone.center.y },
  { field: "labelPosition.x", label: "Подпись X", control: "number", getValue: (zone) => (zone.labelPosition || zone.center).x },
  { field: "labelPosition.y", label: "Подпись Y", control: "number", getValue: (zone) => (zone.labelPosition || zone.center).y },
  { field: "points", label: "Точки границы: №. X, Y на каждой строке", control: "textarea", getValue: (zone) => formatZonePointsForEditor(zone.points) },
];

export function getPathCreateFieldMetadata({ zones = [] } = {}) {
  return [
    { field: "type", label: "Тип", control: "select", options: PATH_TYPE_OPTIONS },
    { field: "a", label: "Зона A", control: "select", options: asOptions(zones) },
    { field: "b", label: "Зона B", control: "select", options: asOptions(zones) },
  ];
}

export function getPathGameplayEditorFieldMetadata({ resourceDefs = {} } = {}) {
  return [
    { field: "energy", label: "Стоимость энергии", control: "number", min: 1, step: 1 },
    { field: "enabled", label: "Включён в начале игры", control: "checkbox", fallback: true },
    { field: "tollEnabled", label: "Дополнительная оплата", control: "checkbox", getValue: isPathTollEnabled },
    {
      field: "tollResource",
      label: "Ресурс",
      control: "select",
      options: resourceOptions(resourceDefs),
      getValue: getPathTollResource,
      when: isPathTollEnabled,
    },
    {
      field: "tollAmount",
      label: "Количество",
      control: "number",
      min: 1,
      step: 1,
      getValue: getPathTollAmount,
      when: isPathTollEnabled,
    },
  ];
}

export function getPathEditorFieldMetadata({ zones = [], endpoints, bend, bendEnabled } = {}) {
  return [
    { field: "name", label: "Название", control: "text" },
    { field: "type", label: "Тип", control: "select", options: PATH_TYPE_OPTIONS },
    { field: "a", label: "Зона A", control: "select", options: asOptions(zones) },
    { field: "b", label: "Зона B", control: "select", options: asOptions(zones) },
    { field: "color", label: "Цвет линии", control: "color", fallback: "#dfb257" },
    { field: "from.x", label: "Начало X", control: "number", getValue: () => endpoints.from.x },
    { field: "from.y", label: "Начало Y", control: "number", getValue: () => endpoints.from.y },
    { field: "bendEnabled", label: "Изгиб", control: "checkbox", getValue: () => bendEnabled },
    { field: "bend.x", label: "Изгиб X", control: "number", getValue: () => bend.x, when: () => bendEnabled },
    { field: "bend.y", label: "Изгиб Y", control: "number", getValue: () => bend.y, when: () => bendEnabled },
    { field: "to.x", label: "Конец X", control: "number", getValue: () => endpoints.to.x },
    { field: "to.y", label: "Конец Y", control: "number", getValue: () => endpoints.to.y },
  ];
}

export function getLocationCreateFieldMetadata({ zones = [] } = {}) {
  return [
    { field: "id", label: "ID", control: "text", required: true },
    { field: "name", label: "Название", control: "text", required: true },
    { field: "symbol", label: "Иконка", control: "text", required: true },
    { field: "zoneId", label: "Зона", control: "select", options: asOptions(zones) },
  ];
}

export function getLocationEditorFieldMetadata({ zones = [] } = {}) {
  return [
    { field: "name", label: "Название", control: "text" },
    { field: "zoneId", label: "Зона", control: "select", options: asOptions(zones) },
    { field: "symbol", label: "Иконка", control: "text" },
    { field: "accent", label: "Цвет", control: "color" },
    { field: "position.x", label: "X", control: "number", getValue: (location) => location.position.x },
    { field: "position.y", label: "Y", control: "number", getValue: (location) => location.position.y },
    { field: "description", label: "Описание", control: "textarea" },
  ];
}

export const taskCreateFieldMetadata = [
  { field: "id", label: "ID", control: "text", required: true },
  { field: "name", label: "Название", control: "text", required: true },
  { field: "kind", label: "Тип", control: "select", options: TASK_KIND_OPTIONS },
];

export function getTaskEditorFieldMetadata({ locations = [], statDefs = {}, taskDifficultyLevels = [] } = {}) {
  return [
    { field: "name", label: "Название", control: "text" },
    {
      field: "locationId",
      label: "Локация",
      control: "select",
      options: locations.map((location) => ({ value: location.id, label: location.name })),
    },
    { field: "kind", label: "Тип", control: "select", options: TASK_KIND_OPTIONS },
    {
      field: "stat",
      label: "Стат",
      control: "select",
      options: [{ value: "", label: "нет" }, ...Object.entries(statDefs).map(([value, stat]) => ({ value, label: stat.label }))],
    },
    {
      field: "difficultyLevelId",
      label: "Сложность",
      control: "select",
      getOptions: (task) => getTaskDifficultyOptions(taskDifficultyLevels, task).options,
      getValue: (task) => getTaskDifficultyOptions(taskDifficultyLevels, task).selectedId,
    },
    { field: "maxPerDay", label: "Лимит в день", control: "number", fallback: 1 },
    { field: "description", label: "Описание", control: "textarea" },
  ];
}

export function getResourceEditorFieldMetadata(resourceDefs = {}, initialResources = {}) {
  return Object.entries(resourceDefs).map(([field, resource]) => ({
    field,
    label: resource.label,
    control: "number",
    fallback: initialResources[field] ?? 0,
  }));
}

export function getBarSettingsEditorFieldMetadata(barSettings = {}) {
  return BAR_SETTING_METADATA.map((setting) => ({
    ...setting,
    control: "number",
    fallback: barSettings[setting.field],
  }));
}

export function getCreateFieldMetadataList(scope, context = {}) {
  if (scope === "agent") return getAgentCreateFieldMetadata(context);
  if (scope === "trait") return traitCreateFieldMetadata;
  if (scope === "upgrade") return upgradeCreateFieldMetadata;
  if (scope === "event") return eventCreateFieldMetadata;
  if (scope === "status") return statusCreateFieldMetadata;
  if (scope === "activity") return activityCreateFieldMetadata;
  if (scope === "zone") return zoneCreateFieldMetadata;
  if (scope === "path") return getPathCreateFieldMetadata(context);
  if (scope === "location") return getLocationCreateFieldMetadata(context);
  if (scope === "task") return taskCreateFieldMetadata;
  return [];
}

export function getEditorFieldMetadataList(scope, context = {}) {
  if (scope === "agent") return getAgentEditorFieldMetadata(context);
  if (scope === "trait") return traitEditorFieldMetadata;
  if (scope === "upgrade") return upgradeEditorFieldMetadata;
  if (scope === "event") return eventEditorFieldMetadata;
  if (scope === "status") return statusEditorFieldMetadata;
  if (scope === "activity") return getActivityEditorFieldMetadata(context);
  if (scope === "zone") return zoneEditorFieldMetadata;
  if (scope === "path") return [...getPathEditorFieldMetadata(context), ...getPathGameplayEditorFieldMetadata(context)];
  if (scope === "location") return getLocationEditorFieldMetadata(context);
  if (scope === "task") return getTaskEditorFieldMetadata(context);
  if (scope === "resource") return getResourceEditorFieldMetadata(context.resourceDefs || {}, context.initialResources || {});
  if (scope === "bar") return getBarSettingsEditorFieldMetadata(context.barSettings || {});
  return [];
}

export function getEditorFieldMetadata(scope, field, context = {}) {
  return getEditorFieldMetadataList(scope, context).find((fieldMetadata) => fieldMetadata.field === field) || null;
}

export function getRequiredCreateFields(scope, context = {}) {
  return getCreateFieldMetadataList(scope, context)
    .filter((fieldMetadata) => fieldMetadata.required)
    .map((fieldMetadata) => fieldMetadata.field);
}

export function getCreateTrimFields(scope, context = {}) {
  return getCreateFieldMetadataList(scope, context).map((fieldMetadata) => fieldMetadata.field);
}
