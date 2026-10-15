import http from "node:http";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { DEFAULT_EDITOR_PROFILE_ID, DEFAULT_EDITOR_PROFILE_NAME, EDITOR_CONFIG_COLLECTIONS, EDITOR_CONFIG_DIR_PATH, EDITOR_CONFIG_MANIFEST_FILE, EDITOR_PROFILE_DIR, EDITOR_PROFILE_INDEX_FILE, createEditorProfileIndex, composeEditorConfig, getEditorConfigFileEntries, normalizeEditorProfileId, normalizeEditorProfileIndex } from "./src/game/editor-config-format.js";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const execFileAsync = promisify(execFile);
const publishedConfigDir = process.env.EDITOR_PUBLISHED_CONFIG_DIR
  ? path.resolve(process.env.EDITOR_PUBLISHED_CONFIG_DIR)
  : path.join(rootDir, EDITOR_CONFIG_DIR_PATH);
const repositoryPublishedConfigDir = path.join(rootDir, EDITOR_CONFIG_DIR_PATH);
const workspaceConfigDir = process.env.EDITOR_CONFIG_DIR
  ? path.resolve(process.env.EDITOR_CONFIG_DIR)
  : path.join(os.homedir(), ".bloodbar-agent-prototype", "editor-workspace");
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "127.0.0.1";
const requestBodyLimitBytes = 24 * 1024 * 1024;
const gitCommandTimeoutMs = Number(process.env.GIT_COMMAND_TIMEOUT_MS || 20_000);
const publishedGitPaths = [
  path.relative(rootDir, path.join(repositoryPublishedConfigDir, EDITOR_PROFILE_INDEX_FILE)),
  path.relative(rootDir, path.join(repositoryPublishedConfigDir, EDITOR_PROFILE_DIR)),
];
let publishInProgress = false;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

function send(res, status, body, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function sendJson(res, status, body) {
  send(res, status, JSON.stringify(body), "application/json; charset=utf-8");
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > requestBodyLimitBytes) throw new Error("Request body is too large.");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function readJsonFile(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw || "{}");
}

async function readSplitEditorConfigFromDir(configDir) {
  try {
    await readJsonFile(path.join(configDir, EDITOR_CONFIG_MANIFEST_FILE));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }

  const parts = {};
  await Promise.all(
    EDITOR_CONFIG_COLLECTIONS.map(async (collection) => {
      try {
        parts[collection.key] = await readJsonFile(path.join(configDir, collection.file));
      } catch (error) {
        if (error.code === "ENOENT") {
          parts[collection.key] = collection.fallback;
          return;
        }
        throw error;
      }
    })
  );
  return composeEditorConfig(parts);
}

async function writeSplitEditorConfig(config, configDir) {
  await fs.mkdir(configDir, { recursive: true });
  await Promise.all(
    getEditorConfigFileEntries(config).map((entry) =>
      fs.writeFile(path.join(configDir, entry.file), `${JSON.stringify(entry.content, null, 2)}\n`, "utf8")
    )
  );
}

function getProfileDir(configDir, profileId) {
  return path.join(configDir, EDITOR_PROFILE_DIR, normalizeEditorProfileId(profileId));
}

async function readEditorProfileIndexFrom(configDir) {
  try {
    return normalizeEditorProfileIndex(await readJsonFile(path.join(configDir, EDITOR_PROFILE_INDEX_FILE)));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function readEditorProfileIndex() {
  return (
    (await readEditorProfileIndexFrom(workspaceConfigDir)) ||
    (await readEditorProfileIndexFrom(publishedConfigDir)) ||
    createEditorProfileIndex()
  );
}

async function writeEditorProfileIndex(profileIndex, configDir = workspaceConfigDir) {
  await fs.mkdir(configDir, { recursive: true });
  await fs.writeFile(
    path.join(configDir, EDITOR_PROFILE_INDEX_FILE),
    `${JSON.stringify(normalizeEditorProfileIndex(profileIndex), null, 2)}\n`,
    "utf8"
  );
}

async function readEditorProfileConfig(profileId) {
  const id = normalizeEditorProfileId(profileId);
  return (
    (await readSplitEditorConfigFromDir(getProfileDir(workspaceConfigDir, id))) ||
    (await readSplitEditorConfigFromDir(getProfileDir(publishedConfigDir, id)))
  );
}

async function removeEditorProfileConfig(profileId, configDir = workspaceConfigDir) {
  await fs.rm(getProfileDir(configDir, profileId), { recursive: true, force: true });
}

async function writeSingleProfileConfig(profileId, config, configDir = workspaceConfigDir) {
  const id = normalizeEditorProfileId(profileId);
  const profileIndex =
    (await readEditorProfileIndexFrom(configDir)) ||
    (configDir === workspaceConfigDir ? await readEditorProfileIndex() : createEditorProfileIndex());
  const hasProfile = profileIndex.profiles.some((profile) => profile.id === id);
  const profiles = hasProfile
    ? profileIndex.profiles
    : [
        ...profileIndex.profiles,
        {
          id,
          name: id === DEFAULT_EDITOR_PROFILE_ID ? DEFAULT_EDITOR_PROFILE_NAME : id,
        },
      ];
  await writeEditorProfileIndex({
    ...profileIndex,
    activeProfileId: id,
    profiles,
  }, configDir);
  await writeSplitEditorConfig(config, getProfileDir(configDir, id));
}

function usesRepositoryPublishedConfig() {
  return publishedConfigDir === repositoryPublishedConfigDir;
}

function gitError(error) {
  if (error?.killed || error?.code === "ETIMEDOUT") {
    return `Команда Git превысила лимит ${Math.round(gitCommandTimeoutMs / 1000)} с`;
  }
  const details = String(error?.stderr || error?.message || "Unknown Git error").trim();
  return details.replace(/\s+/g, " ");
}

async function runGit(args, options = {}) {
  try {
    const result = await execFileAsync("git", args, {
      cwd: rootDir,
      timeout: gitCommandTimeoutMs,
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: "0",
        GCM_INTERACTIVE: "Never",
      },
    });
    return String(result.stdout || "").trim();
  } catch (error) {
    if (options.allowFailure) return null;
    throw new Error(`Git ${args.join(" ")} failed: ${gitError(error)}`);
  }
}

async function ensurePublishedSnapshotCanBeCommitted() {
  if (!usesRepositoryPublishedConfig()) return false;

  const branch = await runGit(["branch", "--show-current"]);
  if (branch !== "main") {
    throw new Error("Автопубликация доступна только из чистой ветки main.");
  }

  await runGit(["fetch", "origin", "main"]);
  const relation = await runGit(["rev-list", "--left-right", "--count", "HEAD...origin/main"]);
  const [ahead = 0, behind = 0] = relation.split(/\s+/).map(Number);
  if (ahead || behind) {
    throw new Error("Ветка main должна совпадать с origin/main перед публикацией.");
  }

  const status = await runGit(["status", "--porcelain", "--untracked-files=all"]);
  if (status) {
    throw new Error("Рабочий каталог Git не чист. Сначала зафиксируйте или уберите другие изменения.");
  }
  return true;
}

async function commitAndPushPublishedSnapshot(profileId) {
  await runGit(["add", "-A", "--", ...publishedGitPaths]);
  const stagedPaths = await runGit(["diff", "--cached", "--name-only", "--", ...publishedGitPaths]);
  if (!stagedPaths) return null;

  await runGit(["commit", "-m", `content: publish editor profile ${profileId}`, "--", ...publishedGitPaths]);
  const commit = await runGit(["rev-parse", "--short", "HEAD"]);
  try {
    await runGit(["push", "origin", "main"]);
  } catch (error) {
    throw new Error(`Коммит ${commit} создан локально, но не был отправлен в origin/main: ${error.message || error}`);
  }
  return commit;
}

async function handleProfileApi(req, res) {
  if (req.method === "GET") {
    const profileIndex = await readEditorProfileIndex();
    send(res, 200, JSON.stringify(profileIndex), "application/json; charset=utf-8");
    return;
  }

  if (req.method === "PUT" || req.method === "POST") {
    const raw = await readBody(req);
    const parsed = JSON.parse(raw || "{}");
    await writeEditorProfileIndex(parsed, workspaceConfigDir);
    send(res, 200, JSON.stringify({ ok: true, storage: "profiles" }), "application/json; charset=utf-8");
    return;
  }

  send(res, 405, "Method not allowed");
}

async function handleConfigApi(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const profileId = normalizeEditorProfileId(url.searchParams.get("profile") || DEFAULT_EDITOR_PROFILE_ID);

  if (req.method === "GET") {
    const splitConfig = await readEditorProfileConfig(profileId);
    if (splitConfig) {
      send(res, 200, JSON.stringify(splitConfig), "application/json; charset=utf-8");
      return;
    }
    send(res, 200, "{}", "application/json; charset=utf-8");
    return;
  }

  if (req.method === "PUT" || req.method === "POST") {
    const raw = await readBody(req);
    const parsed = JSON.parse(raw || "{}");
    await writeSingleProfileConfig(profileId, parsed, workspaceConfigDir);
    send(res, 200, JSON.stringify({ ok: true, storage: "workspace", profileId }), "application/json; charset=utf-8");
    return;
  }

  if (req.method === "DELETE") {
    await removeEditorProfileConfig(profileId, workspaceConfigDir);
    send(res, 200, JSON.stringify({ ok: true, storage: "workspace", deletedProfileId: profileId }), "application/json; charset=utf-8");
    return;
  }

  send(res, 405, "Method not allowed");
}

async function handlePublishApi(req, res) {
  if (process.env.BLOODBAR_PORTABLE === "1") {
    sendJson(res, 403, { ok: false, error: "В автономной версии публикация в GitLab недоступна. Используйте «Сохранить»: профиль сохранится на этом компьютере." });
    return;
  }
  if (req.method !== "PUT" && req.method !== "POST") {
    send(res, 405, "Method not allowed");
    return;
  }

  if (publishInProgress) {
    sendJson(res, 409, {
      ok: false,
      error: "Публикация уже выполняется. Дождитесь её завершения.",
    });
    return;
  }

  publishInProgress = true;
  try {
    const raw = await readBody(req);
    const payload = JSON.parse(raw || "{}");
    const profileId = normalizeEditorProfileId(payload.profileId);
    if (!payload.config || !Array.isArray(payload.profiles)) {
      sendJson(res, 400, { ok: false, error: "Некорректные данные публикации профиля." });
      return;
    }

    const shouldCommit = await ensurePublishedSnapshotCanBeCommitted();
    await writeEditorProfileIndex(payload, publishedConfigDir);
    await writeSingleProfileConfig(profileId, payload.config, publishedConfigDir);
    await Promise.all((payload.deletedProfileIds || []).map((id) => removeEditorProfileConfig(id, publishedConfigDir)));
    const commit = shouldCommit ? await commitAndPushPublishedSnapshot(profileId) : null;
    sendJson(res, 200, { ok: true, storage: "published", profileId, ...(commit ? { commit, pushed: true } : {}) });
  } finally {
    publishInProgress = false;
  }
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const resolved = path.normalize(path.join(rootDir, pathname));

  if (!resolved.startsWith(rootDir)) {
    send(res, 403, "Forbidden");
    return;
  }

  try {
    const body = await fs.readFile(resolved);
    const contentType = mimeTypes[path.extname(resolved)] || "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": contentType,
      // The local prototype is edited and restarted frequently; stale ES modules
      // make a merged frontend fix appear absent even when the files are current.
      "Cache-Control": "no-store",
    });
    res.end(body);
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "EISDIR") {
      send(res, 404, "Not found");
      return;
    }
    throw error;
  }
}

const server = http.createServer(async (req, res) => {
  try {
    if (process.env.BLOODBAR_PORTABLE === "1") {
      const expectedHost = `127.0.0.1:${server.address().port}`;
      if (req.headers.host !== expectedHost || (req.headers.origin && req.headers.origin !== `http://${expectedHost}`)) {
        sendJson(res, 403, { ok: false, error: "Forbidden origin" });
        return;
      }
    }
    if (req.url.startsWith("/api/editor-profiles")) {
      await handleProfileApi(req, res);
      return;
    }
    if (req.url.startsWith("/api/editor-publish")) {
      await handlePublishApi(req, res);
      return;
    }
    if (req.url.startsWith("/api/editor-config")) {
      await handleConfigApi(req, res);
      return;
    }
    await serveStatic(req, res);
  } catch (error) {
    console.error(error);
    if (req.url.startsWith("/api/")) {
      sendJson(res, 500, {
        ok: false,
        error: error instanceof Error ? error.message : "Внутренняя ошибка сервера.",
      });
      return;
    }
    send(res, 500, "Internal server error");
  }
});

export default server;

if (process.env.BLOODBAR_PORTABLE !== "1") {
  server.listen(port, host, () => {
    console.log(`Vampire bar prototype: http://${host}:${port}`);
  });
}
