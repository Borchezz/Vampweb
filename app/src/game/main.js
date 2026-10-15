import { bootstrapDaytime } from "./daytime/runtime.js";
import { bootstrapNighttime } from "./nighttime/runtime.js";
import { createPhaseAdapter } from "./phase-adapter.js";
import { getPhaseMode, isDaytimeEnabled, isNighttimeEnabled } from "./phase-mode.js";
import { initializeDebugPanel } from "./debug-panel.js";
import { applyGameTabTitle } from "./tab-title.js";

async function bootstrapApplication() {
  applyGameTabTitle();
  const mode = getPhaseMode();
  const adapter = createPhaseAdapter();
  document.body.dataset.phaseMode = mode;
  initializeDebugPanel();

  if (isDaytimeEnabled(mode)) {
    await bootstrapDaytime({ adapter });
  }
  if (isNighttimeEnabled(mode)) {
    bootstrapNighttime({ adapter, mode });
  }

  document.body.dataset.appReady = "true";
}

void bootstrapApplication();
