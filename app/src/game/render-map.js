import { editorState, runtime, state } from "./state.js";
import { locations, paths, zones } from "./data.js";
import { dom } from "./dom.js";
import { canSpendAgentEnergy, escapeAttribute, formatResourceObject, getAgentRoute, getLocation, getMoveCost, getSelectedAgent, getSelectedLocation, getVisibleLocations, getZone } from "./rules.js";
import { isPathEnabled } from "./path-runtime.js";
import { clampZoneLabelPosition, formatMapNumber, getPathBend, getPathEndpoints, isPathBendEnabled, mapViewPoint, mapViewPolygon, parseZonePoints } from "./map-utils.js";

function cssUrl(value) {
  return `url("${String(value || "").replace(/["\\\n\r]/g, "\\$&")}")`;
}

function getActiveProfileMapBackground() {
  const activeProfileId = runtime.editorProfiles?.activeProfileId;
  const activeProfile = runtime.editorProfiles?.profiles?.find((profile) => profile.id === activeProfileId);
  const src = activeProfile?.mapBackground?.src;
  return typeof src === "string" && src.trim() ? activeProfile.mapBackground : null;
}

export function renderMap() {
  const selectedAgent = getSelectedAgent();
  const selectedLocation = getSelectedLocation();
  const pathEditing = runtime.appMode === "edit" && runtime.pathEndpointEditMode && editorState.tab === "paths";
  const weekendActive = Boolean(state.weekend?.active) && runtime.appMode !== "edit";
  const mapBackground = getActiveProfileMapBackground();
  const mapBackgroundStyle = mapBackground ? ` style="--map-background-image: ${escapeAttribute(cssUrl(mapBackground.src))};"` : "";
  const landscapeMarkup = renderLandscapeLayer();
  const pathMarkup = renderPathLayer();
  const routeMarkup = renderRouteLayer(selectedAgent);

  const zoneMarkup = zones
    .map((zone) => {
      const labelPosition = clampZoneLabelPosition(zone, zone.labelPosition || zone.center);
      const center = mapViewPoint(labelPosition);
      const isEditing = runtime.appMode === "edit" && editorState.tab === "zones" && !pathEditing && editorState.zoneId === zone.id;
      const isLabelDraggable = runtime.appMode === "edit" && !pathEditing && runtime.zoneLabelDragZoneId === zone.id;
      return `
        <div class="zone-label ${isEditing ? "editing" : ""} ${isLabelDraggable ? "label-draggable" : ""}"
          data-zone-id="${escapeAttribute(zone.id)}"
          ${isLabelDraggable ? 'data-map-editable="zone-label"' : ""}
          style="
          --zone-x: ${formatMapNumber(center.x)};
          --zone-y: ${formatMapNumber(center.y)};
          --zone-line: ${zone.color};
          --zone-bg: ${zone.color}38;">
          <h3>${zone.name}</h3>
        </div>
      `;
    })
    .join("");

  const renderedLocations = runtime.appMode === "edit" ? locations : getVisibleLocations();
  const locationMarkup = renderedLocations
    .map((location) => {
      const position = mapViewPoint(location.position);
      const isSelected =
        (runtime.appMode === "edit" && editorState.locationId === location.id) ||
        (state.locationPanelOpen && location.id === selectedLocation.id);
      const cost = getMoveCost(selectedAgent, location);
      const reachable = cost && canSpendAgentEnergy(selectedAgent, cost.energy, cost.toll);
      const costLabel = cost ? formatMoveCost(cost) : "нет пути";
      return `
        <button class="location ${isSelected ? "selected" : ""} ${reachable ? "reachable" : ""}"
          type="button"
          data-location-id="${location.id}"
          ${weekendActive ? "disabled" : ""}
          ${runtime.appMode === "edit" ? 'data-map-editable="location"' : ""}
          style="
            --loc-x: ${formatMapNumber(position.x)};
            --loc-y: ${formatMapNumber(position.y)};
            --accent: ${location.accent};">
          <span class="symbol">${location.symbol}</span>
          <span>
            <strong>${location.name}</strong>
            <span>${cost && cost.energy === 0 ? "текущая" : costLabel}</span>
          </span>
        </button>
      `;
    })
    .join("");

  const tokenMarkup = state.agents
    .map((agent, index) => {
      const location = getLocation(agent.locationId);
      const position = mapViewPoint(location.position);
      const isSelected = agent.id === selectedAgent.id;
      return `
        <span class="agent-token ${isSelected ? "selected" : ""}"
          title="${agent.name}: ${location.name}"
          style="
            --token-x: ${formatMapNumber(position.x)};
            --token-y: ${formatMapNumber(position.y)};
            --token-offset-x: ${20 + index * 13}px;
            --token-offset-y: ${24 + index * 5}px;
            --portrait: ${agent.color};">
          ${agent.portrait}
        </span>
      `;
    })
    .join("");

  dom.cityMap.innerHTML = `
    <div class="map-canvas"${mapBackgroundStyle}>
      ${landscapeMarkup}
      ${pathMarkup}
      ${routeMarkup}
      ${zoneMarkup}
      ${locationMarkup}
      ${tokenMarkup}
    </div>
  `;
}

export function renderRouteLayer(agent) {
  const routeLocations = getAgentRoute(agent)
    .map((locationId) => getLocation(locationId))
    .filter(Boolean);
  const origin = getLocation(agent.locationId);
  const points = [origin, ...routeLocations].filter(Boolean).map((location) => ({
    location,
    point: mapViewPoint(location.position),
  }));

  if (points.length < 2) return "";

  const segments = points
    .slice(1)
    .map((target, index) => {
      const source = points[index];
      const nextClass = index === 0 ? "next" : "";
      return `
        <line class="route-line-outline ${nextClass}"
          x1="${formatMapNumber(source.point.x)}"
          y1="${formatMapNumber(source.point.y)}"
          x2="${formatMapNumber(target.point.x)}"
          y2="${formatMapNumber(target.point.y)}"
          aria-hidden="true"></line>
        <line class="route-line ${nextClass}"
          x1="${formatMapNumber(source.point.x)}"
          y1="${formatMapNumber(source.point.y)}"
          x2="${formatMapNumber(target.point.x)}"
          y2="${formatMapNumber(target.point.y)}">
          <title>${escapeAttribute(source.location.name)} -> ${escapeAttribute(target.location.name)}</title>
        </line>
      `;
    })
    .join("");

  const nodes = points
    .slice(1)
    .map(({ location, point }, index) => `
      <circle class="route-node ${index === 0 ? "next" : ""}"
        cx="${formatMapNumber(point.x)}"
        cy="${formatMapNumber(point.y)}"
        r="${index === 0 ? "1.12" : "0.82"}">
        <title>${escapeAttribute(location.name)}</title>
      </circle>
    `)
    .join("");

  return `<svg class="route-layer" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${segments}${nodes}</svg>`;
}

export function renderLandscapeLayer() {
  const pathEditing = runtime.appMode === "edit" && runtime.pathEndpointEditMode && editorState.tab === "paths";
  const zonePolygons = zones
    .map((zone) => `
      <polygon class="zone-shape ${runtime.appMode === "edit" && editorState.tab === "zones" && !pathEditing && editorState.zoneId === zone.id ? "editing" : ""}"
        data-zone-id="${escapeAttribute(zone.id)}"
        points="${mapViewPolygon(zone.points)}"
        style="--zone-line: ${zone.color}; --zone-bg: ${zone.color}38">
        <title>${zone.name}</title>
      </polygon>
    `)
    .join("");
  const selectedZone = runtime.appMode === "edit" && editorState.tab === "zones" && !pathEditing ? zones.find((zone) => zone.id === editorState.zoneId) : null;
  const vertexMarkup = selectedZone
    ? parseZonePoints(selectedZone.points)
        .map((point, index) => {
          const mapped = mapViewPoint(point);
          return `
            <circle class="zone-vertex"
              data-zone-id="${escapeAttribute(selectedZone.id)}"
              data-point-index="${index}"
              cx="${formatMapNumber(mapped.x)}"
              cy="${formatMapNumber(mapped.y)}"
              r="1.05">
              <title>Точка ${index + 1}: ${selectedZone.name}</title>
            </circle>
          `;
        })
        .join("")
    : "";

  return `
    <svg class="landscape-layer" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      ${zonePolygons}
      ${vertexMarkup}
    </svg>
  `;
}

export function renderPathLayer() {
  const selectedZoneId = runtime.appMode === "edit" && editorState.tab === "zones" ? editorState.zoneId : "";
  const lines = paths
    .map((path) => {
      const zoneA = getZone(path.a);
      const zoneB = getZone(path.b);
      const endpoints = getPathEndpoints(path, zoneA, zoneB);
      const from = mapViewPoint(endpoints.from);
      const to = mapViewPoint(endpoints.to);
      const disabled = !isPathEnabled(path);
      const selected = runtime.appMode === "edit" && editorState.tab === "paths" && editorState.pathId === path.id;
      const linkedToSelectedZone = selectedZoneId && (path.a === selectedZoneId || path.b === selectedZoneId);
      const bendEnabled = isPathBendEnabled(path);
      const bend = bendEnabled ? mapViewPoint(getPathBend(path, endpoints)) : null;
      const pathShape = bend
        ? `M ${formatMapNumber(from.x)} ${formatMapNumber(from.y)} Q ${formatMapNumber(bend.x)} ${formatMapNumber(bend.y)} ${formatMapNumber(to.x)} ${formatMapNumber(to.y)}`
        : `M ${formatMapNumber(from.x)} ${formatMapNumber(from.y)} L ${formatMapNumber(to.x)} ${formatMapNumber(to.y)}`;
      const hitLine =
        runtime.appMode === "edit"
          ? `
        <path class="path-hit"
          data-path-id="${escapeAttribute(path.id)}"
          d="${pathShape}">
          <title>${path.name}</title>
        </path>
      `
          : "";
      const style = path.color ? `--path-color: ${path.color};` : "";
      return `
        ${hitLine}
        <path class="path-outline ${path.type} ${disabled ? "disabled" : ""} ${selected ? "selected" : ""} ${linkedToSelectedZone ? "zone-linked" : ""}"
          style="${style}"
          d="${pathShape}"
          aria-hidden="true"></path>
        <path class="path-line ${path.type} ${disabled ? "disabled" : ""} ${selected ? "selected" : ""} ${linkedToSelectedZone ? "zone-linked" : ""}"
          data-path-id="${escapeAttribute(path.id)}"
          style="${style}"
          d="${pathShape}">
          <title>${path.name}${disabled ? " - отключён" : ""}</title>
        </path>
      `;
    })
    .join("");
  const handles = renderPathEndpointHandles();
  const editingClass = runtime.appMode === "edit" && runtime.pathEndpointEditMode ? "editing" : "";
  const editableClass = runtime.appMode === "edit" ? "editable" : "";
  return `<svg class="path-layer ${editableClass} ${editingClass}" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${lines}${handles}</svg>`;
}

export function renderPathEndpointHandles() {
  if (runtime.appMode !== "edit" || !runtime.pathEndpointEditMode || editorState.tab !== "paths") return "";
  const path = paths.find((item) => item.id === editorState.pathId);
  if (!path) return "";

  const zoneA = getZone(path.a);
  const zoneB = getZone(path.b);
  const endpoints = getPathEndpoints(path, zoneA, zoneB);
  const bendPoint = getPathBend(path, endpoints);
  return [
    { key: "from", label: "Начало пути", point: endpoints.from },
    isPathBendEnabled(path) ? { key: "bend", label: "Изгиб пути", point: bendPoint } : null,
    { key: "to", label: "Конец пути", point: endpoints.to },
  ]
    .filter(Boolean)
    .map(({ key, label, point }) => {
      const mapped = mapViewPoint(point);
      const endpointAttribute = key === "bend" ? "" : `data-path-endpoint="${key}"`;
      return `
        <circle class="${key === "bend" ? "path-bend" : "path-endpoint"} path-control-${key}"
          data-path-id="${escapeAttribute(path.id)}"
          ${endpointAttribute}
          cx="${formatMapNumber(mapped.x)}"
          cy="${formatMapNumber(mapped.y)}"
          r="${key === "bend" ? "0.95" : "1.1"}">
          <title>${label}: ${path.name}</title>
        </circle>
      `;
    })
    .join("");
}

export function formatMoveCost(cost) {
  const toll = formatResourceObject(cost.toll, false);
  return toll === "без ресурсов" ? `${cost.energy} эн.` : `${cost.energy} эн. + ${toll}`;
}
