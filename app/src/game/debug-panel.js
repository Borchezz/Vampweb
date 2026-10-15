const controllers = new Map();
let activeControllerId = "";

function getPanel() {
  return document.querySelector("#debugPanel");
}

function getContent() {
  return document.querySelector("#debugPanelContent");
}

function renderDebugPanel() {
  const content = getContent();
  if (!content) return;
  const controllerList = [...controllers.values()];
  if (!controllerList.some((controller) => controller.id === activeControllerId)) {
    activeControllerId = controllerList[0]?.id || "";
  }
  const activeController = controllers.get(activeControllerId);
  content.innerHTML = controllerList.length
    ? `
      <div class="debug-panel-tabs" role="tablist" aria-label="Разделы чит-панели">
        ${controllerList
          .map(
            (controller) =>
              `<button class="debug-panel-tab ${controller.id === activeControllerId ? "active" : ""}" type="button" data-debug-tab="${controller.id}">${controller.label}</button>`
          )
          .join("")}
      </div>
      <div class="debug-panel-content">${activeController?.render() || ""}</div>
    `
    : '<p class="debug-panel-note">Для этой фазы нет доступных чит-команд.</p>';
}

export function registerDebugPanelController(controller) {
  controllers.set(controller.id, controller);
  renderDebugPanel();
}

export function initializeDebugPanel() {
  const toggle = document.querySelector("#debugToggleButton");
  const panel = getPanel();
  const content = getContent();
  if (!toggle || !panel || !content || panel.dataset.debugPanelBound) return;
  panel.dataset.debugPanelBound = "true";

  toggle.addEventListener("click", () => {
    const isOpen = !panel.classList.contains("open");
    panel.classList.toggle("open", isOpen);
    panel.setAttribute("aria-hidden", String(!isOpen));
    panel.inert = !isOpen;
    toggle.setAttribute("aria-expanded", String(isOpen));
    if (isOpen) renderDebugPanel();
  });

  content.addEventListener("click", (event) => {
    const closeButton = event.target.closest("[data-debug-close]");
    if (closeButton) {
      panel.classList.remove("open");
      panel.setAttribute("aria-hidden", "true");
      panel.inert = true;
      toggle.setAttribute("aria-expanded", "false");
      return;
    }
    const tab = event.target.closest("[data-debug-tab]");
    if (tab) {
      activeControllerId = tab.dataset.debugTab;
      renderDebugPanel();
      return;
    }
    const action = event.target.closest("[data-debug-action]");
    if (!action) return;
    const controller = controllers.get(action.dataset.debugController || activeControllerId);
    if (!controller?.handleAction?.(action, content)) return;
    renderDebugPanel();
  });
}

export function refreshDebugPanel() {
  if (getPanel()?.classList.contains("open")) renderDebugPanel();
}
