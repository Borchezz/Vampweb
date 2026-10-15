import { setActiveEditorProfileMapBackground } from "./persistence.js";
import { render } from "./render-core.js";
import { showToast } from "./actions.js";

const MAP_BACKGROUND_MAX_BYTES = 15 * 1024 * 1024;

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result || "")));
    reader.addEventListener("error", () => reject(reader.error || new Error("Не удалось прочитать файл.")));
    reader.readAsDataURL(file);
  });
}

function formatMegabytes(bytes) {
  return `${Math.round((bytes / 1024 / 1024) * 10) / 10} МБ`;
}

export async function handleMapBackgroundFileChange(input) {
  const file = input.files?.[0];
  if (!file) return;

  try {
    if (!file.type.startsWith("image/")) throw new Error("Выберите файл изображения.");
    if (file.size > MAP_BACKGROUND_MAX_BYTES) {
      throw new Error(`Карта слишком большая. Максимум: ${formatMegabytes(MAP_BACKGROUND_MAX_BYTES)}.`);
    }

    const src = await readFileAsDataUrl(file);
    if (!src.startsWith("data:image/")) throw new Error("Файл не похож на изображение.");

    setActiveEditorProfileMapBackground({
      name: file.name || "Пользовательская карта",
      src,
    });
    showToast("Карта профиля обновлена.");
    render();
  } catch (error) {
    showToast(error.message || "Не удалось загрузить карту.");
  } finally {
    input.value = "";
  }
}

export function handleMapBackgroundAction(button) {
  if (button.dataset.mapBackgroundAction !== "reset") return;
  setActiveEditorProfileMapBackground(null);
  showToast("Карта профиля сброшена.");
  render();
}
