"use strict";

// ── State ─────────────────────────────────────────────────────────────────────
let FOODS = [];
let nextId = 0;
const rowIds = [];
const selected = {};
const timers = {};

// ── Units ─────────────────────────────────────────────────────────────────────
const UNITS = [
  { value: "g", label: "g", toG: (v) => v },
  { value: "kg", label: "kg", toG: (v) => v * 1000 },
  { value: "ml", label: "ml", toG: (v) => v },
  { value: "cup", label: "cup", toG: (v) => v * 240 },
  { value: "tbsp", label: "tbsp", toG: (v) => v * 15 },
  { value: "tsp", label: "tsp", toG: (v) => v * 5 },
];

const UNIT_OPTIONS = UNITS.map(
  (u) => `<option value="${u.value}">${u.label}</option>`,
).join("");

function toGrams(amount, unitVal) {
  const v = parseFloat(amount) || 0;
  const u = UNITS.find((u) => u.value === unitVal);
  return u ? u.toG(v) : v;
}

// ── Food loading ──────────────────────────────────────────────────────────────
function parseRaw(raw) {
  const arr = Array.isArray(raw) ? raw : raw.foods || raw.ingredients || [];
  return arr.map((f) => ({
    name: String(f.name || ""),
    category: String(f.category || ""),
    calories: parseFloat(f.calories_per_100g ?? f.calories ?? 0),
    protein: parseFloat(f.protein_per_100g ?? f.protein ?? 0),
    carbs: parseFloat(f.carbs_per_100g ?? f.carbs ?? 0),
    fat: parseFloat(f.fat_per_100g ?? f.fat ?? 0),
  }));
}

function applyFoods(arr) {
  FOODS = arr;
  document.getElementById("food-count").textContent =
    "● " + FOODS.length + " foods loaded";
  document.getElementById("load-banner").style.display = "none";
  document.getElementById("err").style.display = "none";
}

async function tryAutoLoad() {
  try {
    const r = await fetch("./foods.json");
    if (!r.ok) throw new Error("HTTP " + r.status);
    applyFoods(parseRaw(await r.json()));
  } catch {
    document.getElementById("load-banner").style.display = "flex";
    document.getElementById("food-count").textContent = "● No data";
  }
}

document.getElementById("file-picker").addEventListener("change", function () {
  const file = this.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const foods = parseRaw(JSON.parse(ev.target.result));
      if (!foods.length) throw new Error("No foods found");
      applyFoods(foods);
    } catch (err) {
      showErr("Could not load file: " + err.message);
    }
  };
  reader.readAsText(file);
});

// ── Search ────────────────────────────────────────────────────────────────────
function searchFoods(q) {
  const lq = q.toLowerCase();
  const starts = FOODS.filter((f) => f.name.toLowerCase().startsWith(lq));
  const contains = FOODS.filter(
    (f) =>
      !f.name.toLowerCase().startsWith(lq) && f.name.toLowerCase().includes(lq),
  );
  return [...starts, ...contains].slice(0, 10);
}

// ── Rows ──────────────────────────────────────────────────────────────────────
function addRow() {
  const id = nextId++;
  rowIds.push(id);
  selected[id] = null;

  const group = document.createElement("div");
  group.className = "row-group";
  group.id = "rg" + id;
  group.innerHTML = `
    <div class="food-row">
      <div class="iw">
        <input type="text" id="fi${id}" placeholder="Search food…" autocomplete="off" />
        <div class="dd" id="dd${id}"></div>
      </div>
      <input type="number" id="am${id}" min="0.1" step="any" value="100" />
      <select id="un${id}">${UNIT_OPTIONS}</select>
      <button class="del-btn" id="db${id}" aria-label="Remove">×</button>
    </div>
    <div class="sel" id="sl${id}"></div>
  `;
  document.getElementById("food-list").appendChild(group);

  document
    .getElementById("fi" + id)
    .addEventListener("input", () => onInput(id));
  document.getElementById("fi" + id).addEventListener("focus", () => {
    const dd = document.getElementById("dd" + id);
    if (dd.childElementCount) dd.classList.add("open");
  });
  document
    .getElementById("fi" + id)
    .addEventListener("keydown", (ev) => onKey(ev, id));
  document
    .getElementById("db" + id)
    .addEventListener("click", () => removeRow(id));
}

function removeRow(id) {
  document.getElementById("rg" + id)?.remove();
  const i = rowIds.indexOf(id);
  if (i !== -1) rowIds.splice(i, 1);
  delete selected[id];
}

function resetAll() {
  document.getElementById("food-list").innerHTML = "";
  rowIds.length = 0;
  nextId = 0;
  Object.keys(selected).forEach((k) => delete selected[k]);
  document.getElementById("results").style.display = "none";
  document.getElementById("err").style.display = "none";
  document.getElementById("warn").style.display = "none";
  addRow();
}

// ── Autocomplete ──────────────────────────────────────────────────────────────
function onInput(id) {
  selected[id] = null;
  const sl = document.getElementById("sl" + id);
  sl.classList.remove("on");
  sl.innerHTML = "";
  clearTimeout(timers[id]);
  const val = document.getElementById("fi" + id).value.trim();
  if (val.length < 2) {
    document.getElementById("dd" + id).classList.remove("open");
    return;
  }
  timers[id] = setTimeout(() => renderDd(id, val), 160);
}

function renderDd(id, query) {
  const dd = document.getElementById("dd" + id);
  const results = searchFoods(query);
  dd._res = results;
  dd._hi = -1;
  dd.innerHTML = "";

  if (!results.length) {
    dd.innerHTML = `<div class="dd-msg">No results for "${esc(query)}"</div>`;
    dd.classList.add("open");
    return;
  }

  results.forEach((food) => {
    const item = document.createElement("div");
    item.className = "dd-item";
    item.innerHTML = `
      <span class="dd-name">${esc(food.name)}<span class="dd-cat">${esc(food.category)}</span></span>
      <span class="dd-meta">per 100g — <b>${Math.round(food.calories)} kcal</b> · P <b>${food.protein.toFixed(1)}g</b> · C <b>${food.carbs.toFixed(1)}g</b> · F <b>${food.fat.toFixed(1)}g</b></span>
    `;
    item.addEventListener("mousedown", (ev) => ev.preventDefault());
    item.addEventListener("click", () => pickFood(id, food));
    dd.appendChild(item);
  });

  dd.classList.add("open");
}

function onKey(ev, id) {
  const dd = document.getElementById("dd" + id);
  if (!dd._res || !dd._res.length) return;
  const items = dd.querySelectorAll(".dd-item");

  if (ev.key === "ArrowDown") {
    ev.preventDefault();
    dd._hi = Math.min((dd._hi ?? -1) + 1, items.length - 1);
  } else if (ev.key === "ArrowUp") {
    ev.preventDefault();
    dd._hi = Math.max((dd._hi ?? 0) - 1, 0);
  } else if (ev.key === "Enter") {
    ev.preventDefault();
    if (dd._hi >= 0 && dd._res[dd._hi]) pickFood(id, dd._res[dd._hi]);
    return;
  } else if (ev.key === "Escape") {
    dd.classList.remove("open");
    return;
  } else return;

  items.forEach((el, i) => el.classList.toggle("hi", i === dd._hi));
}

function pickFood(id, food) {
  selected[id] = food;
  document.getElementById("fi" + id).value = food.name;
  document.getElementById("dd" + id).classList.remove("open");
  document.getElementById("am" + id).value = "100";
  document.getElementById("un" + id).value = "g";
  renderSelected(id, food);
}

function renderSelected(id, food) {
  const el = document.getElementById("sl" + id);
  el.innerHTML = `
    <span class="sel-name">${esc(food.name)} <span class="sel-cat">${esc(food.category)}</span></span>
    <span class="sel-info">${Math.round(food.calories)} kcal · P ${food.protein.toFixed(1)}g · C ${food.carbs.toFixed(1)}g · F ${food.fat.toFixed(1)}g <span style="opacity:.5">/ 100g</span></span>
    <button class="sel-x" id="sx${id}" aria-label="Clear">×</button>
  `;
  el.classList.add("on");
  document.getElementById("sx" + id).addEventListener("click", () => {
    selected[id] = null;
    el.classList.remove("on");
    el.innerHTML = "";
    const fi = document.getElementById("fi" + id);
    fi.value = "";
    fi.focus();
  });
}

// ── Calculate ─────────────────────────────────────────────────────────────────
function calculate() {
  document.getElementById("err").style.display = "none";
  document.getElementById("warn").style.display = "none";
  document.getElementById("results").style.display = "none";

  if (!FOODS.length) {
    showErr("Please load your foods.json file first.");
    return;
  }

  const valid = [],
    skipped = [];
  rowIds.forEach((id, idx) => {
    const food = selected[id];
    if (!food) {
      skipped.push("Row " + (idx + 1));
      return;
    }
    const unit = document.getElementById("un" + id).value;
    const amt = parseFloat(document.getElementById("am" + id).value) || 0;
    const grams = toGrams(amt, unit);
    const scale = grams / 100;
    valid.push({
      name: food.name,
      category: food.category,
      amount: amt,
      unit,
      calories: +(food.calories * scale).toFixed(1),
      protein: +(food.protein * scale).toFixed(1),
      carbs: +(food.carbs * scale).toFixed(1),
      fat: +(food.fat * scale).toFixed(1),
    });
  });

  if (!valid.length) {
    showErr("Please select at least one food.");
    return;
  }

  if (skipped.length) {
    const w = document.getElementById("warn");
    w.textContent = "Skipped (no selection): " + skipped.join(", ");
    w.style.display = "block";
  }

  const t = valid.reduce(
    (a, i) => ({
      calories: a.calories + i.calories,
      protein: a.protein + i.protein,
      carbs: a.carbs + i.carbs,
      fat: a.fat + i.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );

  renderResults(valid, t);
}

// ── Render results ────────────────────────────────────────────────────────────
function renderResults(items, t) {
  const cm = t.protein * 4 + t.carbs * 4 + t.fat * 9;
  const pp = cm > 0 ? Math.round(((t.protein * 4) / cm) * 100) : 0;
  const cp = cm > 0 ? Math.round(((t.carbs * 4) / cm) * 100) : 0;
  const fp = cm > 0 ? Math.round(((t.fat * 9) / cm) * 100) : 0;

  document.getElementById("tiles").innerHTML = `
    <div class="tile kc"><div class="tl">Calories</div><div class="tv">${Math.round(t.calories)}</div><div class="tu">kcal</div></div>
    <div class="tile pr"><div class="tl">Protein</div><div class="tv">${t.protein.toFixed(1)}</div><div class="tu">grams</div></div>
    <div class="tile cb"><div class="tl">Carbs</div><div class="tv">${t.carbs.toFixed(1)}</div><div class="tu">grams</div></div>
    <div class="tile ft"><div class="tl">Fat</div><div class="tv">${t.fat.toFixed(1)}</div><div class="tu">grams</div></div>
  `;

  document.getElementById("bars").innerHTML = `
    <div class="bar-row"><span class="bar-lbl">Protein</span><div class="bar-track"><div class="bar-fill pr" data-w="${pp}" style="width:0%"></div></div><span class="bar-pct">${pp}%</span></div>
    <div class="bar-row"><span class="bar-lbl">Carbs</span><div class="bar-track"><div class="bar-fill cb" data-w="${cp}" style="width:0%"></div></div><span class="bar-pct">${cp}%</span></div>
    <div class="bar-row"><span class="bar-lbl">Fat</span><div class="bar-track"><div class="bar-fill ft" data-w="${fp}" style="width:0%"></div></div><span class="bar-pct">${fp}%</span></div>
  `;

  document.getElementById("breakdown").innerHTML = `
    <thead>
      <tr><th>Ingredient</th><th>kcal</th><th>Protein g</th><th>Carbs g</th><th>Fat g</th></tr>
    </thead>
    <tbody>
      ${items
        .map(
          (i) => `
        <tr>
          <td>
            <span class="fdot"></span>${esc(i.name)}
            <div style="font-size:11px;color:var(--muted);margin-top:1px">${i.amount} ${i.unit}</div>
          </td>
          <td>${Math.round(i.calories)}</td>
          <td>${i.protein.toFixed(1)}</td>
          <td>${i.carbs.toFixed(1)}</td>
          <td>${i.fat.toFixed(1)}</td>
        </tr>
      `,
        )
        .join("")}
    </tbody>
    <tfoot>
      <tr>
        <td>Total</td>
        <td>${Math.round(t.calories)}</td>
        <td>${t.protein.toFixed(1)}</td>
        <td>${t.carbs.toFixed(1)}</td>
        <td>${t.fat.toFixed(1)}</td>
      </tr>
    </tfoot>
  `;

  const res = document.getElementById("results");
  res.style.display = "block";
  requestAnimationFrame(() =>
    setTimeout(() => {
      document.querySelectorAll(".bar-fill[data-w]").forEach((el) => {
        el.style.width = el.dataset.w + "%";
      });
    }, 50),
  );
  res.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function showErr(msg) {
  const el = document.getElementById("err");
  el.textContent = msg;
  el.style.display = "block";
}

function esc(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Global dropdown close ─────────────────────────────────────────────────────
document.addEventListener("click", (ev) => {
  document.querySelectorAll(".dd.open").forEach((dd) => {
    if (!dd.closest(".row-group").contains(ev.target))
      dd.classList.remove("open");
  });
});

// ── Init ─────────────────────────────────────────────────────────────────────
document.getElementById("btn-add").addEventListener("click", addRow);
document.getElementById("btn-clr").addEventListener("click", resetAll);
document.getElementById("btn-calc").addEventListener("click", calculate);

tryAutoLoad().then(() => addRow());

// ── Service worker ────────────────────────────────────────────────────────────
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/nutrify/sw.js");
}
