import { runtime, state } from "./state.js";
import { dom } from "./dom.js";

export function renderLog() {
  dom.eventLog.innerHTML = state.log
    .slice(0, 10)
    .map((entry) => `<li>${entry}</li>`)
    .join("");
}

export function addLog(message) {
  state.log.unshift(message);
}

export function showToast(message) {
  const previous = document.querySelector(".toast");
  if (previous) previous.remove();

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.append(toast);

  window.setTimeout(() => {
    toast.remove();
  }, 2600);
}

export function showSaveToast(provider, changes) {
  const previous = document.querySelector(".toast");
  if (previous) previous.remove();

  const toast = document.createElement("div");
  toast.className = "toast save-toast";

  const title = document.createElement("strong");
  title.textContent = `Сохранено: ${provider}`;
  toast.append(title);

  const list = document.createElement("ul");
  list.className = "toast-list";
  changes.forEach((change) => {
    const item = document.createElement("li");
    item.textContent = change;
    list.append(item);
  });
  toast.append(list);

  document.body.append(toast);
  window.setTimeout(() => {
    toast.remove();
  }, 4200);
}

export function setSaveButtonState(stateName) {
  if (!dom.saveEditorButton) return;
  window.clearTimeout(runtime.saveButtonResetTimer);
  dom.saveEditorButton.classList.toggle("saving", stateName === "saving");
  dom.saveEditorButton.classList.toggle("saved", stateName === "saved");
  dom.saveEditorButton.classList.toggle("save-error", stateName === "error");
  dom.saveEditorButton.disabled = stateName === "saving";

  if (stateName === "saving") dom.saveEditorButton.textContent = "Сохраняю...";
  else if (stateName === "saved") dom.saveEditorButton.textContent = "Сохранено";
  else if (stateName === "error") dom.saveEditorButton.textContent = "Ошибка";
  else dom.saveEditorButton.textContent = "Сохранить";

  if (stateName === "saved" || stateName === "error") {
    runtime.saveButtonResetTimer = window.setTimeout(() => setSaveButtonState("idle"), 1800);
  }
}

export function setPublishButtonState(stateName) {
  if (!dom.publishEditorButton) return;
  window.clearTimeout(runtime.publishButtonResetTimer);
  dom.publishEditorButton.classList.toggle("saving", stateName === "publishing");
  dom.publishEditorButton.classList.toggle("saved", stateName === "published");
  dom.publishEditorButton.classList.toggle("save-error", stateName === "error");
  dom.publishEditorButton.disabled = stateName === "publishing";

  if (stateName === "publishing") dom.publishEditorButton.textContent = "Публикую...";
  else if (stateName === "published") dom.publishEditorButton.textContent = "Опубликовано";
  else if (stateName === "error") dom.publishEditorButton.textContent = "Ошибка";
  else dom.publishEditorButton.textContent = "Опубликовать";

  if (stateName === "published" || stateName === "error") {
    runtime.publishButtonResetTimer = window.setTimeout(() => setPublishButtonState("idle"), 1800);
  }
}
