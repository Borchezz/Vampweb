import { mapViewport } from "./state.js";
import { dom } from "./dom.js";

export function mapViewPoint(point) {
  return {
    x: mapViewport.x + (point.x * mapViewport.width) / 100,
    y: mapViewport.y + (point.y * mapViewport.height) / 100,
  };
}

export function formatMapNumber(value) {
  return Number(value.toFixed(2));
}

export function clampMapPercent(value) {
  return Math.max(0, Math.min(100, value));
}

export function mapViewPointString(point) {
  const mapped = mapViewPoint(point);
  return `${formatMapNumber(mapped.x)},${formatMapNumber(mapped.y)}`;
}

export function mapSourcePoint(point) {
  return {
    x: ((point.x - mapViewport.x) * 100) / mapViewport.width,
    y: ((point.y - mapViewport.y) * 100) / mapViewport.height,
  };
}

export function getMapCanvasRect() {
  return dom.cityMap.querySelector(".map-canvas")?.getBoundingClientRect() || dom.cityMap.getBoundingClientRect();
}

export function getMapPointFromClient(clientX, clientY) {
  const rect = getMapCanvasRect();
  const viewPoint = {
    x: clampMapPercent(((clientX - rect.left) / rect.width) * 100),
    y: clampMapPercent(((clientY - rect.top) / rect.height) * 100),
  };
  const sourcePoint = mapSourcePoint(viewPoint);
  return {
    x: clampMapPercent(sourcePoint.x),
    y: clampMapPercent(sourcePoint.y),
  };
}

export function parseZonePoints(points) {
  const source = String(points).trim();
  if (!source) return [];
  return source
    .split(/\s+/)
    .map((point) => {
      const [x, y] = point.split(",").map(Number);
      return { x: Number.isFinite(x) ? x : 0, y: Number.isFinite(y) ? y : 0 };
    });
}

export function parseZonePointsForEditor(points) {
  const lines = String(points)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 3) throw new Error("Зона должна содержать минимум три точки границы.");

  const coordinate = "(?:\\d+(?:\\.\\d+)?|\\.\\d+)";
  const pointPattern = new RegExp(`^(?:\\d+(?:\\.\\s*|\\)\\s*))?(${coordinate})\\s*,\\s*(${coordinate})$`);
  return lines.map((line, index) => {
    const match = line.match(pointPattern);
    if (!match) throw new Error(`Точка ${index + 1}: укажите координаты в формате «${index + 1}. X, Y».`);
    const x = Number(match[1]);
    const y = Number(match[2]);
    if (x < 0 || x > 100 || y < 0 || y > 100) throw new Error(`Точка ${index + 1}: координаты должны быть числами от 0 до 100.`);
    return { x, y };
  });
}

function isPointOnSegment(point, a, b) {
  const cross = (point.y - a.y) * (b.x - a.x) - (point.x - a.x) * (b.y - a.y);
  if (Math.abs(cross) > 0.000001) return false;

  const dot = (point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y);
  if (dot < -0.000001) return false;

  const squaredLength = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  return dot <= squaredLength + 0.000001;
}

export function isPointInPolygon(point, polygon) {
  if (!point || polygon.length < 3) return false;
  if (polygon.some((start, index) => isPointOnSegment(point, start, polygon[(index + 1) % polygon.length]))) return true;

  let inside = false;
  polygon.forEach((start, index) => {
    const end = polygon[(index + 1) % polygon.length];
    const intersects =
      (start.y > point.y) !== (end.y > point.y) &&
      point.x < ((end.x - start.x) * (point.y - start.y)) / (end.y - start.y) + start.x;
    if (intersects) inside = !inside;
  });
  return inside;
}

export function clampPointToPolygon(point, polygon, fallback = null) {
  const source = {
    x: clampMapPercent(Number(point?.x) || 0),
    y: clampMapPercent(Number(point?.y) || 0),
  };
  if (polygon.length < 3 || isPointInPolygon(source, polygon)) return source;

  let closest = null;
  let closestDistance = Infinity;
  polygon.forEach((start, index) => {
    const candidate = closestPointOnSegment(source, start, polygon[(index + 1) % polygon.length]);
    const distance = (source.x - candidate.x) ** 2 + (source.y - candidate.y) ** 2;
    if (distance < closestDistance) {
      closest = candidate;
      closestDistance = distance;
    }
  });

  const centroid = fallback && isPointInPolygon(fallback, polygon) ? fallback : getPolygonCentroid(polygon);
  const nudged = {
    x: clampMapPercent(closest.x + (centroid.x - closest.x) * 0.02),
    y: clampMapPercent(closest.y + (centroid.y - closest.y) * 0.02),
  };
  return isPointInPolygon(nudged, polygon) ? nudged : closest;
}

export function clampZoneLabelPosition(zone, position = zone?.labelPosition || zone?.center) {
  const polygon = parseZonePoints(zone?.points || "");
  const fallback = zone?.center || getPolygonCentroid(polygon);
  return clampPointToPolygon(position || fallback, polygon, fallback);
}

export function formatZonePoints(points) {
  return points.map((point) => `${formatMapNumber(clampMapPercent(point.x))},${formatMapNumber(clampMapPercent(point.y))}`).join(" ");
}

export function formatZonePointsForEditor(points) {
  return parseZonePoints(points)
    .map((point, index) => `${index + 1}. ${formatMapNumber(point.x)}, ${formatMapNumber(point.y)}`)
    .join("\n");
}

export function moveMapPoint(point, delta) {
  return {
    x: clampMapPercent((point?.x || 0) + delta.x),
    y: clampMapPercent((point?.y || 0) + delta.y),
  };
}

export function mapViewPolygon(points) {
  return String(points)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((point) => {
      const [x, y] = point.split(",").map(Number);
      return mapViewPointString({ x, y });
    })
    .join(" ");
}

function distanceSquared(a, b) {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
}

function closestPointOnSegment(point, start, end) {
  const length = distanceSquared(start, end);
  if (length <= 0.000001) return { ...start };
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * (end.x - start.x) + (point.y - start.y) * (end.y - start.y)) / length));
  return {
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t,
  };
}

function cross(a, b) {
  return a.x * b.y - a.y * b.x;
}

function subtract(a, b) {
  return {
    x: a.x - b.x,
    y: a.y - b.y,
  };
}

function segmentIntersection(start, end, edgeStart, edgeEnd) {
  const segmentVector = subtract(end, start);
  const edgeVector = subtract(edgeEnd, edgeStart);
  const denominator = cross(segmentVector, edgeVector);
  if (Math.abs(denominator) <= 0.000001) return null;

  const offset = subtract(edgeStart, start);
  const t = cross(offset, edgeVector) / denominator;
  const u = cross(offset, segmentVector) / denominator;
  if (t < -0.000001 || t > 1.000001 || u < -0.000001 || u > 1.000001) return null;

  return {
    point: {
      x: start.x + segmentVector.x * t,
      y: start.y + segmentVector.y * t,
    },
    t,
  };
}

export function getPolygonCentroid(points) {
  if (!points.length) return { x: 50, y: 50 };

  let twiceArea = 0;
  let x = 0;
  let y = 0;

  points.forEach((point, index) => {
    const next = points[(index + 1) % points.length];
    const factor = point.x * next.y - next.x * point.y;
    twiceArea += factor;
    x += (point.x + next.x) * factor;
    y += (point.y + next.y) * factor;
  });

  if (Math.abs(twiceArea) <= 0.000001) {
    return points.reduce(
      (total, point) => ({
        x: total.x + point.x / points.length,
        y: total.y + point.y / points.length,
      }),
      { x: 0, y: 0 }
    );
  }

  return {
    x: x / (3 * twiceArea),
    y: y / (3 * twiceArea),
  };
}

export function getZoneCenterPoint(zone) {
  if (zone?.center && Number.isFinite(zone.center.x) && Number.isFinite(zone.center.y)) return zone.center;
  return getPolygonCentroid(parseZonePoints(zone?.points || ""));
}

export function getNearestPointOnZoneBoundary(zone, point) {
  const points = parseZonePoints(zone?.points || "");
  if (!points.length) return { ...point };

  let closest = null;
  let closestDistance = Infinity;
  points.forEach((start, index) => {
    const end = points[(index + 1) % points.length];
    const candidate = closestPointOnSegment(point, start, end);
    const candidateDistance = distanceSquared(point, candidate);
    if (candidateDistance < closestDistance) {
      closest = candidate;
      closestDistance = candidateDistance;
    }
  });

  return closest || { ...point };
}

export function getZoneBoundaryPointToward(zone, targetPoint) {
  const points = parseZonePoints(zone?.points || "");
  if (!points.length) return getZoneCenterPoint(zone);

  const center = getZoneCenterPoint(zone);
  if (distanceSquared(center, targetPoint) <= 0.000001) return getNearestPointOnZoneBoundary(zone, center);

  const intersections = points
    .map((start, index) => segmentIntersection(center, targetPoint, start, points[(index + 1) % points.length]))
    .filter(Boolean)
    .filter((intersection) => intersection.t > 0.000001)
    .sort((a, b) => a.t - b.t);

  return intersections[0]?.point || getNearestPointOnZoneBoundary(zone, targetPoint);
}

export function getDefaultPathEndpoints(zoneA, zoneB) {
  const centerA = getZoneCenterPoint(zoneA);
  const centerB = getZoneCenterPoint(zoneB);
  return {
    from: getZoneBoundaryPointToward(zoneA, centerB),
    to: getZoneBoundaryPointToward(zoneB, centerA),
  };
}

function normalizePoint(point, fallback) {
  return {
    x: Number.isFinite(point?.x) ? point.x : fallback.x,
    y: Number.isFinite(point?.y) ? point.y : fallback.y,
  };
}

export function getPathEndpoints(path, zoneA, zoneB) {
  const defaults = getDefaultPathEndpoints(zoneA, zoneB);
  return {
    from: path?.from ? getNearestPointOnZoneBoundary(zoneA, normalizePoint(path.from, defaults.from)) : defaults.from,
    to: path?.to ? getNearestPointOnZoneBoundary(zoneB, normalizePoint(path.to, defaults.to)) : defaults.to,
  };
}

export function getPathMidpoint(endpoints) {
  return {
    x: (endpoints.from.x + endpoints.to.x) / 2,
    y: (endpoints.from.y + endpoints.to.y) / 2,
  };
}

export function isPathBendEnabled(path) {
  return Boolean(path?.bendEnabled);
}

export function getPathBend(path, endpoints) {
  return normalizePoint(path?.bend, getPathMidpoint(endpoints));
}

export function resetPathEndpoints(path, zoneA, zoneB) {
  const endpoints = getDefaultPathEndpoints(zoneA, zoneB);
  path.from = {
    x: formatMapNumber(endpoints.from.x),
    y: formatMapNumber(endpoints.from.y),
  };
  path.to = {
    x: formatMapNumber(endpoints.to.x),
    y: formatMapNumber(endpoints.to.y),
  };
}

export function resetPathBend(path, endpoints) {
  const bend = getPathMidpoint(endpoints);
  path.bend = {
    x: formatMapNumber(bend.x),
    y: formatMapNumber(bend.y),
  };
}

export function snapPathEndpoint(path, endpoint, point, zoneA, zoneB) {
  const defaults = getDefaultPathEndpoints(zoneA, zoneB);
  const zone = endpoint === "from" ? zoneA : zoneB;
  const fallback = endpoint === "from" ? defaults.from : defaults.to;
  const snapped = getNearestPointOnZoneBoundary(zone, normalizePoint(point, fallback));
  path[endpoint] = {
    x: formatMapNumber(snapped.x),
    y: formatMapNumber(snapped.y),
  };
}

export function setPathBend(path, point) {
  path.bendEnabled = true;
  path.bend = {
    x: formatMapNumber(clampMapPercent(point?.x || 0)),
    y: formatMapNumber(clampMapPercent(point?.y || 0)),
  };
}
