import { editorState, runtime } from "./state.js";
import { locations, paths, zones } from "./data.js";
import { saveEditorDraft } from "./persistence.js";
import { recordEditorChange } from "./rules.js";
import { clampZoneLabelPosition, formatZonePoints, getMapPointFromClient, moveMapPoint, parseZonePoints, setPathBend, snapPathEndpoint } from "./map-utils.js";
import { renderMap, renderMode } from "./render-core.js";
import { renderEditor } from "./editor-render.js";
import { deepClone } from "./utils.js";

function getPathZones(path) {
  return {
    zoneA: zones.find((zone) => zone.id === path.a),
    zoneB: zones.find((zone) => zone.id === path.b),
  };
}

function snapPathsForZone(zoneId) {
  paths.forEach((path) => {
    const { zoneA, zoneB } = getPathZones(path);
    if (path.a === zoneId && path.from) snapPathEndpoint(path, "from", path.from, zoneA, zoneB);
    if (path.b === zoneId && path.to) snapPathEndpoint(path, "to", path.to, zoneA, zoneB);
  });
}

export function startMapDrag(event) {
  if (runtime.appMode !== "edit") return;
  const pathEditing = runtime.pathEndpointEditMode && editorState.tab === "paths";
  const pathEndpoint = event.target.closest(".path-endpoint[data-path-id]");
  const pathBend = event.target.closest(".path-bend[data-path-id]");
  const pathLine = event.target.closest(".path-line[data-path-id], .path-hit[data-path-id]");
  const locationButton = event.target.closest("[data-location-id]");
  const zoneLabel = pathEditing ? null : event.target.closest(".zone-label[data-zone-id]");
  const vertex = pathEditing ? null : event.target.closest(".zone-vertex");
  const zoneShape = event.target.closest(".zone-shape[data-zone-id]");
  const startPoint = getMapPointFromClient(event.clientX, event.clientY);

  if (pathEndpoint) {
    const path = paths.find((item) => item.id === pathEndpoint.dataset.pathId);
    if (!path) return;
    editorState.tab = "paths";
    editorState.pathId = path.id;
    editorState.entityViews.paths = "edit";
    runtime.pathEndpointEditMode = true;
    runtime.activeMapDrag = {
      type: "path-endpoint",
      id: path.id,
      endpoint: pathEndpoint.dataset.pathEndpoint,
      startPoint,
      moved: false,
    };
  } else if (pathBend) {
    const path = paths.find((item) => item.id === pathBend.dataset.pathId);
    if (!path) return;
    editorState.tab = "paths";
    editorState.pathId = path.id;
    editorState.entityViews.paths = "edit";
    runtime.pathEndpointEditMode = true;
    runtime.activeMapDrag = {
      type: "path-bend",
      id: path.id,
      startPoint,
      moved: false,
    };
  } else if (pathLine) {
    const path = paths.find((item) => item.id === pathLine.dataset.pathId);
    if (!path) return;
    editorState.tab = "paths";
    editorState.pathId = path.id;
    editorState.entityViews.paths = "edit";
    runtime.pathEndpointEditMode = true;
    event.preventDefault();
    renderMode();
    renderEditor();
    renderMap();
    return;
  } else if (locationButton) {
    const location = locations.find((item) => item.id === locationButton.dataset.locationId);
    if (!location) return;
    editorState.tab = "locations";
    editorState.locationId = location.id;
    editorState.taskLocationId = location.id;
    editorState.taskId = "";
    editorState.entityViews.locations = "location";
    runtime.pathEndpointEditMode = false;
    runtime.zoneLabelDragZoneId = "";
    runtime.activeMapDrag = {
      type: "location",
      id: location.id,
      startPoint,
      originalPosition: deepClone(location.position),
      moved: false,
    };
  } else if (zoneLabel && runtime.zoneLabelDragZoneId === zoneLabel.dataset.zoneId) {
    const zone = zones.find((item) => item.id === zoneLabel.dataset.zoneId);
    if (!zone) return;
    editorState.tab = "zones";
    editorState.zoneId = zone.id;
    editorState.entityViews.zones = "edit";
    runtime.pathEndpointEditMode = false;
    runtime.activeMapDrag = {
      type: "zone-label",
      id: zone.id,
      startPoint,
      originalLabelPosition: deepClone(clampZoneLabelPosition(zone, zone.labelPosition || zone.center)),
      moved: false,
    };
  } else if (vertex) {
    const zone = zones.find((item) => item.id === vertex.dataset.zoneId);
    if (!zone) return;
    editorState.tab = "zones";
    editorState.zoneId = zone.id;
    editorState.entityViews.zones = "edit";
    if (runtime.zoneLabelDragZoneId && runtime.zoneLabelDragZoneId !== zone.id) runtime.zoneLabelDragZoneId = "";
    runtime.pathEndpointEditMode = false;
    runtime.activeMapDrag = {
      type: "zone-vertex",
      id: zone.id,
      pointIndex: Number(vertex.dataset.pointIndex),
      startPoint,
      originalPoints: parseZonePoints(zone.points),
      moved: false,
    };
  } else if (zoneShape) {
    const zone = zones.find((item) => item.id === zoneShape.dataset.zoneId);
    if (!zone) return;
    editorState.tab = "zones";
    editorState.zoneId = zone.id;
    editorState.entityViews.zones = "edit";
    if (runtime.zoneLabelDragZoneId && runtime.zoneLabelDragZoneId !== zone.id) runtime.zoneLabelDragZoneId = "";
    runtime.pathEndpointEditMode = false;
    runtime.activeMapDrag = {
      type: "zone",
      id: zone.id,
      startPoint,
      originalPoints: parseZonePoints(zone.points),
      originalCenter: deepClone(zone.center || { x: 50, y: 50 }),
      originalLabelPosition: deepClone(zone.labelPosition || zone.center || { x: 50, y: 50 }),
      moved: false,
    };
  } else {
    return;
  }

  event.preventDefault();
  renderMode();
  renderEditor();
  renderMap();
}

export function handleMapPointerMove(event) {
  if (!runtime.activeMapDrag) return;
  event.preventDefault();
  const currentPoint = getMapPointFromClient(event.clientX, event.clientY);
  const delta = {
    x: currentPoint.x - runtime.activeMapDrag.startPoint.x,
    y: currentPoint.y - runtime.activeMapDrag.startPoint.y,
  };
  if (Math.abs(delta.x) > 0.12 || Math.abs(delta.y) > 0.12) runtime.activeMapDrag.moved = true;

  if (runtime.activeMapDrag.type === "location") {
    const location = locations.find((item) => item.id === runtime.activeMapDrag.id);
    if (!location) return;
    location.position = moveMapPoint(runtime.activeMapDrag.originalPosition, delta);
  }

  if (runtime.activeMapDrag.type === "zone") {
    const zone = zones.find((item) => item.id === runtime.activeMapDrag.id);
    if (!zone) return;
    zone.points = formatZonePoints(runtime.activeMapDrag.originalPoints.map((point) => moveMapPoint(point, delta)));
    zone.center = moveMapPoint(runtime.activeMapDrag.originalCenter, delta);
    zone.labelPosition = clampZoneLabelPosition(zone, moveMapPoint(runtime.activeMapDrag.originalLabelPosition, delta));
    snapPathsForZone(zone.id);
  }

  if (runtime.activeMapDrag.type === "zone-vertex") {
    const zone = zones.find((item) => item.id === runtime.activeMapDrag.id);
    if (!zone) return;
    const points = runtime.activeMapDrag.originalPoints.map((point) => ({ ...point }));
    if (points[runtime.activeMapDrag.pointIndex]) {
      points[runtime.activeMapDrag.pointIndex] = moveMapPoint(points[runtime.activeMapDrag.pointIndex], delta);
      zone.points = formatZonePoints(points);
      zone.labelPosition = clampZoneLabelPosition(zone, zone.labelPosition || zone.center);
      snapPathsForZone(zone.id);
    }
  }

  if (runtime.activeMapDrag.type === "zone-label") {
    const zone = zones.find((item) => item.id === runtime.activeMapDrag.id);
    if (!zone) return;
    zone.labelPosition = clampZoneLabelPosition(zone, moveMapPoint(runtime.activeMapDrag.originalLabelPosition, delta));
  }

  if (runtime.activeMapDrag.type === "path-endpoint") {
    const path = paths.find((item) => item.id === runtime.activeMapDrag.id);
    if (!path) return;
    const { zoneA, zoneB } = getPathZones(path);
    snapPathEndpoint(path, runtime.activeMapDrag.endpoint, currentPoint, zoneA, zoneB);
  }

  if (runtime.activeMapDrag.type === "path-bend") {
    const path = paths.find((item) => item.id === runtime.activeMapDrag.id);
    if (!path) return;
    setPathBend(path, currentPoint);
  }

  renderMap();
}

export function finishMapDrag() {
  if (!runtime.activeMapDrag) return;
  const drag = runtime.activeMapDrag;
  runtime.activeMapDrag = null;

  if (drag.moved) {
    if (drag.type === "location") recordEditorChange("location", drag.id, "position");
    if (drag.type === "zone") recordEditorChange("zone", drag.id, "position");
    if (drag.type === "zone-vertex") recordEditorChange("zone", drag.id, "points");
    if (drag.type === "zone-label") recordEditorChange("zone", drag.id, "labelPosition");
    if (drag.type === "path-endpoint") recordEditorChange("path", drag.id, drag.endpoint);
    if (drag.type === "path-bend") recordEditorChange("path", drag.id, "bend");
    saveEditorDraft(true);
    runtime.suppressMapClick = true;
    window.setTimeout(() => {
      runtime.suppressMapClick = false;
    }, 140);
  }

  renderEditor();
  renderMap();
}
