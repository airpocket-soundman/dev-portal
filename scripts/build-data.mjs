// リポジトリ一覧 + GitHub Pages + ProtoPedia 作品の対応表を data/repos.json に書き出す。
// GitHub Actions から定期実行する。ローカルでは `GITHUB_TOKEN=$(gh auth token) node scripts/build-data.mjs`。
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const USER = "airpocket-soundman";
const PROTOPEDIA_USER_ID = 2091;
const dataDir = resolve(dirname(fileURLToPath(import.meta.url)), "../data");
const outputPath = resolve(dataDir, "repos.json");
const manualLinksPath = resolve(dataDir, "protopedia-links.json");
const token = process.env.GITHUB_TOKEN;

async function gh(path) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub API ${path}: ${res.status} ${res.statusText}`);
  return res.json();
}

// ---------- GitHub ----------

async function fetchRepos() {
  const all = [];
  for (let page = 1; ; page++) {
    const batch = await gh(`/users/${USER}/repos?per_page=100&page=${page}&type=owner`);
    all.push(...batch);
    if (batch.length < 100) break;
  }
  // dev-portal 自身はデータコミットのたびに pushed_at が変わり差分が出続けるので除外
  return all.filter((r) => !r.private && r.name !== "dev-portal");
}

function pagesUrl(name) {
  return name.toLowerCase() === `${USER}.github.io`
    ? `https://${USER}.github.io/`
    : `https://${USER}.github.io/${name}/`;
}

async function fetchReadme(name) {
  const res = await fetch(`https://api.github.com/repos/${USER}/${name}/readme`, {
    headers: {
      Accept: "application/vnd.github.raw+json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  return res.ok ? res.text() : "";
}

// ---------- ProtoPedia ----------

async function fetchPrototypes() {
  const all = [];
  for (let skip = 0; ; skip += 30) {
    const res = await fetch(
      `https://protopedia.net/api/myPrototypes?userId=${PROTOPEDIA_USER_ID}&skip=${skip}&sortType=1`
    );
    if (!res.ok) throw new Error(`ProtoPedia API: ${res.status} ${res.statusText}`);
    const rows = (await res.json()).results ?? [];
    all.push(...rows);
    if (rows.length < 30) break;
  }
  return all;
}

// 作品本文中の github.com/<USER>/<repo> と <USER>.github.io/<repo> を拾う
function reposMentioned(text, repoNames) {
  const found = new Set();
  const lower = new Map(repoNames.map((n) => [n.toLowerCase(), n]));
  const re = new RegExp(
    `(?:github\\.com/${USER}/|${USER}\\.github\\.io/)([A-Za-z0-9._-]+)`,
    "gi"
  );
  for (const m of text.matchAll(re)) {
    const name = lower.get(m[1].replace(/\.git$/, "").toLowerCase());
    if (name) found.add(name);
  }
  return found;
}

// ---------- main ----------

const [repos, prototypes] = await Promise.all([fetchRepos(), fetchPrototypes()]);
const names = repos.map((r) => r.name);
const links = new Map(names.map((n) => [n, new Map()])); // repo -> (id -> {id, title, url})

const ppEntry = (p) => ({
  id: p.id,
  title: p.prototypeNm,
  url: `https://protopedia.net/prototype/${p.id}`,
});
const ppById = new Map(prototypes.map((p) => [p.id, p]));

// 1) ProtoPedia 作品 → リポジトリ
for (const p of prototypes) {
  for (const name of reposMentioned(JSON.stringify(p), names)) {
    links.get(name).set(p.id, ppEntry(p));
  }
}

// 2) リポジトリ README → ProtoPedia 作品（自分の作品のみ）
const readmes = await Promise.all(repos.map((r) => fetchReadme(r.name)));
repos.forEach((r, i) => {
  for (const m of readmes[i].matchAll(/protopedia\.net\/prototype\/(\d+)/g)) {
    const p = ppById.get(Number(m[1]));
    if (p) links.get(r.name).set(p.id, ppEntry(p));
  }
});

// 3) 手動指定 data/protopedia-links.json
const manual = JSON.parse(await readFile(manualLinksPath, "utf8").catch(() => "{}"));
for (const [name, ids] of Object.entries(manual)) {
  if (!links.has(name) || !Array.isArray(ids)) continue;
  for (const id of ids) {
    const p = ppById.get(Number(id));
    if (p) links.get(name).set(p.id, ppEntry(p));
  }
}

const out = repos.map((r) => ({
  name: r.name,
  description: r.description || "",
  url: r.html_url,
  homepage: r.homepage || "",
  pages: r.has_pages ? pagesUrl(r.name) : "",
  protopedia: [...links.get(r.name).values()],
  language: r.language || "",
  topics: r.topics || [],
  stars: r.stargazers_count,
  fork: r.fork,
  archived: r.archived,
  pushed: r.pushed_at,
  created: r.created_at,
}));

const linkedIds = new Set(out.flatMap((r) => r.protopedia.map((p) => p.id)));
const unlinked = prototypes.filter((p) => !linkedIds.has(p.id)).map(ppEntry);

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(
  outputPath,
  JSON.stringify({ generatedAt: new Date().toISOString(), repos: out, unlinkedPrototypes: unlinked }, null, 1) + "\n"
);
console.log(
  `repos=${out.length} pages=${out.filter((r) => r.pages).length} ` +
    `protopedia=${prototypes.length} linkedRepos=${out.filter((r) => r.protopedia.length).length} unlinked=${unlinked.length}`
);
