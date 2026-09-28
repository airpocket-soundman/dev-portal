const USER = "airpocket-soundman";
const CACHE_KEY = `dev-portal:repos:${USER}`;
const CACHE_TTL = 60 * 60 * 1000; // 1h

const $ = (id) => document.getElementById(id);
const state = { repos: [], lang: null, letter: null, topic: null };

// ---------- data ----------

async function fetchRepos() {
  const all = [];
  for (let page = 1; page <= 10; page++) {
    const res = await fetch(
      `https://api.github.com/users/${USER}/repos?per_page=100&page=${page}&type=owner`,
      { headers: { Accept: "application/vnd.github+json" } }
    );
    if (!res.ok) throw new Error(`GitHub API ${res.status} ${res.statusText}`);
    const batch = await res.json();
    all.push(...batch);
    if (batch.length < 100) break;
  }
  return all.map((r) => ({
    name: r.name,
    description: r.description || "",
    url: r.html_url,
    homepage: r.homepage || "",
    pages: r.has_pages ? pagesUrl(r.name) : "",
    language: r.language || "",
    topics: r.topics || [],
    stars: r.stargazers_count,
    fork: r.fork,
    archived: r.archived,
    pushed: r.pushed_at,
    created: r.created_at,
  }));
}

function pagesUrl(name) {
  return name.toLowerCase() === `${USER}.github.io`.toLowerCase()
    ? `https://${USER}.github.io/`
    : `https://${USER}.github.io/${name}/`;
}

function readCache() {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY));
    if (c && Date.now() - c.at < CACHE_TTL) return c.repos;
  } catch {}
  return null;
}

function writeCache(repos) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), repos }));
  } catch {}
}

async function load(force = false) {
  $("status").textContent = "読み込み中…";
  let repos = force ? null : readCache();
  if (!repos) {
    try {
      repos = await fetchRepos();
      writeCache(repos);
    } catch (e) {
      $("status").textContent = `取得に失敗しました: ${e.message}（API のレート制限の可能性があります。しばらく待って再取得してください）`;
      return;
    }
  }
  state.repos = repos;
  render();
}

// ---------- filtering ----------

const firstLetter = (name) => {
  const c = name[0].toUpperCase();
  return /[A-Z]/.test(c) ? c : "#";
};

function baseFiltered() {
  const q = $("q").value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return state.repos.filter((r) => {
    if ($("pagesOnly").checked && !r.pages) return false;
    if ($("hideForks").checked && r.fork) return false;
    if ($("hideArchived").checked && r.archived) return false;
    if (state.topic && !r.topics.includes(state.topic)) return false;
    if (q.length) {
      const hay = [r.name, r.description, r.language, ...r.topics].join(" ").toLowerCase();
      if (!q.every((w) => hay.includes(w))) return false;
    }
    return true;
  });
}

function sortRepos(list) {
  const key = $("sort").value;
  const cmp = {
    pushed: (a, b) => b.pushed.localeCompare(a.pushed),
    created: (a, b) => b.created.localeCompare(a.created),
    stars: (a, b) => b.stars - a.stars || a.name.localeCompare(b.name),
    name: (a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }),
  }[key];
  return list.sort(cmp);
}

// ---------- render ----------

function render() {
  const base = baseFiltered();

  // 言語インデックス（頭文字フィルタ適用後の件数）
  const byLetter = base.filter((r) => !state.letter || firstLetter(r.name) === state.letter);
  const langCount = countBy(byLetter, (r) => r.language || "(なし)");
  renderChips($("langIndex"), langCount, state.lang, (v) => (state.lang = v), true);

  // 頭文字インデックス（言語フィルタ適用後の件数）
  const byLang = base.filter((r) => !state.lang || (r.language || "(なし)") === state.lang);
  const letterCount = countBy(byLang, (r) => firstLetter(r.name));
  const letters = ["#", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"].map((l) => [l, letterCount.get(l) || 0]);
  renderChips($("letterIndex"), new Map(letters), state.letter, (v) => (state.letter = v), false);

  const list = sortRepos(
    base.filter(
      (r) =>
        (!state.lang || (r.language || "(なし)") === state.lang) &&
        (!state.letter || firstLetter(r.name) === state.letter)
    )
  );

  const pagesCount = list.filter((r) => r.pages).length;
  const filters = [state.lang, state.letter && `頭文字:${state.letter}`, state.topic && `#${state.topic}`]
    .filter(Boolean)
    .join(" / ");
  $("status").textContent =
    `${list.length} / ${state.repos.length} リポジトリ（うち Pages あり ${pagesCount}）` +
    (filters ? ` ・ 絞り込み: ${filters}` : "");

  $("list").replaceChildren(...list.map(card));
}

function countBy(list, fn) {
  const m = new Map();
  for (const r of list) m.set(fn(r), (m.get(fn(r)) || 0) + 1);
  return m;
}

function renderChips(el, counts, current, set, sortByCount) {
  let entries = [...counts];
  if (sortByCount) entries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  if (current && !counts.has(current)) entries.unshift([current, 0]);
  el.replaceChildren(
    chip("すべて", null, !current, () => set(null)),
    ...entries.map(([k, n]) => {
      const b = chip(k, n, current === k, () => set(current === k ? null : k));
      if (!n && current !== k) b.disabled = true;
      return b;
    })
  );
}

function chip(label, count, on, onClick) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "chip" + (on ? " on" : "");
  b.textContent = label;
  if (count != null) {
    const s = document.createElement("small");
    s.textContent = count;
    b.append(s);
  }
  b.addEventListener("click", () => {
    onClick();
    render();
  });
  return b;
}

function card(r) {
  const li = el("li", "card");

  const h = el("h2");
  h.append(link(r.pages || r.url, r.name));
  li.append(h);

  if (r.description) li.append(el("p", "", r.description));

  const meta = el("div", "meta");
  if (r.language) meta.append(el("span", "badge", r.language));
  if (r.fork) meta.append(el("span", "badge", "fork"));
  if (r.archived) meta.append(el("span", "badge", "archived"));
  if (r.stars) meta.append(el("span", "", `★ ${r.stars}`));
  meta.append(el("span", "", `更新 ${r.pushed.slice(0, 10)}`));
  li.append(meta);

  if (r.topics.length) {
    const t = el("div", "topics");
    for (const topic of r.topics) {
      t.append(chip(`#${topic}`, null, state.topic === topic, () => {
        state.topic = state.topic === topic ? null : topic;
      }));
    }
    li.append(t);
  }

  const links = el("div", "links");
  if (r.pages) links.append(link(r.pages, "▶ Pages", "pages"));
  links.append(link(r.url, "GitHub"));
  if (r.homepage && r.homepage.replace(/\/$/, "") !== r.pages.replace(/\/$/, "")) {
    links.append(link(r.homepage, "Homepage"));
  }
  li.append(links);
  return li;
}

function el(tag, cls = "", text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function link(href, text, cls = "") {
  const a = el("a", cls, text);
  a.href = href;
  a.target = "_blank";
  a.rel = "noopener";
  return a;
}

// ---------- events ----------

for (const id of ["q", "pagesOnly", "hideForks", "hideArchived", "sort"]) {
  $(id).addEventListener(id === "q" ? "input" : "change", render);
}
$("reload").addEventListener("click", (e) => {
  e.preventDefault();
  load(true);
});

load();
