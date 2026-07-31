/**
 * Écran cuisine — liste des commandes en direct + récap agrégé.
 *
 * Le SDK Supabase (temps réel) n'est chargé qu'ici, à la demande, et
 * seulement une fois le code saisi. La page invité, elle, reste sans
 * dépendance. Un polling tourne en permanence en filet de sécurité.
 */

import {
  SUPABASE_URL,
  SUPABASE_KEY,
  KITCHEN_CODE,
  COOKING,
  STATUS,
  ADDON_GROUPS,
} from "./config.js";
import { loadMenu, listOrders, updateOrder, deleteOrder, setSettings } from "./api.js";

const NEXT_STATUS = {
  nouvelle: { to: "en_cuisine", label: "Lancer" },
  en_cuisine: { to: "prete", label: "Prête" },
  prete: { to: "servie", label: "Servie" },
  servie: { to: "prete", label: "Rouvrir" },
};
const PREV_STATUS = { en_cuisine: "nouvelle", prete: "en_cuisine", servie: "prete" };
const ACTIVE = ["nouvelle", "en_cuisine", "prete"];
const POLL_MS = 15000;
const LS_GATE = "bp:kitchen";

const $ = (id) => document.getElementById(id);
const el = {
  gate: $("gate"),
  gateBtn: $("gate-btn"),
  code: $("code"),
  console: $("console"),
  live: $("live"),
  statTotal: $("stat-total"),
  statTodo: $("stat-todo"),
  statServed: $("stat-served"),
  tabOrders: $("tab-orders"),
  tabTally: $("tab-tally"),
  viewOrders: $("view-orders"),
  viewTally: $("view-tally"),
  filterServed: $("filter-served"),
  toggleOpen: $("toggle-open"),
  orders: $("orders"),
  tallyBurgers: $("tally-burgers"),
  tallyCooking: $("tally-cooking"),
  tallyRemoved: $("tally-removed"),
  tallyAddons: $("tally-addons"),
  toast: $("toast"),
};

const state = {
  menu: null,
  orders: [],
  hideServed: true,
  ordersOpen: true,
  knownIds: new Set(),
};

/* ------------------------------------------------------------- Utilitaires */

const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );

let toastTimer;
function toast(message, isError = false) {
  el.toast.textContent = message;
  el.toast.classList.toggle("toast--error", isError);
  el.toast.classList.add("toast--show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.remove("toast--show"), 2600);
}

/** Petit « ding » de passe-plat, sans fichier audio. */
function ding() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.09);
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.36);
    setTimeout(() => ctx.close(), 600);
  } catch {
    /* pas de son : tant pis */
  }
}

const nameOf = (list, slug) => list.find((x) => x.slug === slug)?.name ?? slug;

/* ----------------------------------------------------------------- Rendu */

function orderCard(order) {
  const burger = state.menu.burgers.find((b) => b.slug === order.burger_slug);
  const next = NEXT_STATUS[order.status];
  const addons = order.addon_slugs
    .map((s) => state.menu.addons.find((x) => x.slug === s))
    .filter(Boolean);

  const tags = [
    order.cooking
      ? `<span class="tag tag--cook">${esc(COOKING[order.cooking])}</span>`
      : "",
    ...order.removed.map((r) => `<span class="tag tag--out">${esc(r)}</span>`),
    // Les suppléments sautent aux yeux en vert : c'est ce qu'on ajoute
    ...addons.map(
      (a) =>
        `<span class="tag${a.category === "extra" ? " tag--add" : ""}">${
          a.category === "extra" ? "+ " : ""
        }${esc(a.emoji)} ${esc(a.name)}</span>`,
    ),
  ].join("");

  return `
    <article class="order" data-status="${esc(order.status)}" data-id="${esc(order.id)}">
      <div class="order__head">
        <span class="order__ticket">#${String(order.ticket).padStart(2, "0")}</span>
        <span class="order__name">${esc(order.guest_name)}</span>
        <span class="badge badge--${esc(order.status)}">${esc(STATUS[order.status])}</span>
      </div>

      <p class="order__burger">
        ${esc(burger?.emoji ?? "🍔")} ${esc(burger?.name ?? order.burger_slug)}
      </p>

      ${tags ? `<div class="order__meta">${tags}</div>` : ""}
      ${order.note ? `<p class="order__note">« ${esc(order.note)} »</p>` : ""}

      <div class="order__actions">
        ${
          PREV_STATUS[order.status]
            ? `<button class="btn btn--ghost btn--sm" data-act="prev" style="flex: 0 0 3rem" aria-label="Revenir en arrière">←</button>`
            : ""
        }
        <button class="btn btn--primary btn--sm" data-act="next">${esc(next.label)}</button>
        <button class="btn btn--danger btn--sm" data-act="del" style="flex: 0 0 3rem" aria-label="Supprimer la commande">✕</button>
      </div>
    </article>`;
}

function renderOrders() {
  // Actives d'abord, dans l'ordre d'arrivée ; les servies glissent en bas.
  const sorted = [...state.orders].sort((a, b) => {
    const aDone = a.status === "servie";
    const bDone = b.status === "servie";
    if (aDone !== bDone) return aDone ? 1 : -1;
    return a.ticket - b.ticket;
  });

  const visible = state.hideServed
    ? sorted.filter((o) => o.status !== "servie")
    : sorted;

  el.orders.innerHTML = visible.length
    ? visible.map(orderCard).join("")
    : `<p class="empty">Aucune commande pour l'instant.<br />Partage le lien à tes invités 🍔</p>`;
}

function tallyRows(counts) {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return `<p class="empty" style="padding: var(--sp-4)">—</p>`;
  return entries
    .map(
      ([label, count]) => `
      <div class="tally__row">
        <span class="tally__name">${esc(label)}</span>
        <span class="tally__count">${count}</span>
      </div>`,
    )
    .join("");
}

function renderTally() {
  // On ne compte que ce qui reste à faire : c'est ça qui sert au passe.
  const todo = state.orders.filter((o) => ACTIVE.includes(o.status));
  const burgers = {};
  const cooking = {};
  const removed = {};
  const byCategory = {}; // { extra: { Cheddar: 3 }, sauce: {…}, … }

  for (const order of todo) {
    const name = nameOf(state.menu.burgers, order.burger_slug);
    burgers[name] = (burgers[name] ?? 0) + 1;

    if (order.cooking) {
      const label = COOKING[order.cooking];
      cooking[label] = (cooking[label] ?? 0) + 1;
    }

    for (const ing of order.removed) removed[ing] = (removed[ing] ?? 0) + 1;

    for (const slug of order.addon_slugs) {
      const addon = state.menu.addons.find((a) => a.slug === slug);
      if (!addon) continue;
      const bucket = (byCategory[addon.category] ??= {});
      bucket[addon.name] = (bucket[addon.name] ?? 0) + 1;
    }
  }

  el.tallyBurgers.innerHTML = tallyRows(burgers);
  el.tallyCooking.innerHTML = tallyRows(cooking);
  el.tallyRemoved.innerHTML = tallyRows(removed);

  // Un bloc par famille d'options, uniquement si quelqu'un en a pris
  el.tallyAddons.innerHTML = Object.entries(ADDON_GROUPS)
    .filter(([category]) => Object.keys(byCategory[category] ?? {}).length)
    .map(
      ([category, label]) => `
      <div class="stack">
        <p class="section-label">${esc(label)}</p>
        <div class="tally">${tallyRows(byCategory[category])}</div>
      </div>`,
    )
    .join("");
}

function renderStats() {
  el.statTotal.textContent = state.orders.length;
  el.statTodo.textContent = state.orders.filter((o) =>
    ACTIVE.includes(o.status),
  ).length;
  el.statServed.textContent = state.orders.filter(
    (o) => o.status === "servie",
  ).length;
}

function renderAll() {
  renderStats();
  renderOrders();
  renderTally();
}

/* ------------------------------------------------------------ Données */

async function refresh({ announce = true } = {}) {
  let orders;
  try {
    orders = await listOrders();
  } catch (error) {
    console.error(error);
    return;
  }

  const fresh = orders.filter((o) => !state.knownIds.has(o.id));
  state.orders = orders;
  state.knownIds = new Set(orders.map((o) => o.id));

  if (announce && fresh.length) {
    ding();
    toast(
      fresh.length === 1
        ? `Nouvelle commande : ${fresh[0].guest_name}`
        : `${fresh.length} nouvelles commandes`,
    );
  }

  renderAll();
}

async function setStatus(id, status) {
  const order = state.orders.find((o) => o.id === id);
  if (!order) return;
  const previous = order.status;
  order.status = status; // optimiste : le passe ne doit jamais attendre
  renderAll();

  try {
    await updateOrder(id, { status });
  } catch (error) {
    console.error(error);
    order.status = previous;
    renderAll();
    toast("Mise à jour impossible.", true);
  }
}

/* --------------------------------------------------------- Temps réel */

async function connectRealtime() {
  try {
    const { createClient } = await import(
      "https://esm.sh/@supabase/supabase-js@2"
    );
    const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

    sb.channel("cuisine")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => refresh(),
      )
      .subscribe((status) => {
        const on = status === "SUBSCRIBED";
        el.live.dataset.live = on ? "on" : "off";
        el.live.textContent = on ? "en direct" : "reconnexion…";
      });
  } catch (error) {
    console.error("Temps réel indisponible, on reste en polling.", error);
    el.live.textContent = "actualisation auto";
  }
}

/* -------------------------------------------------------------- Évènements */

el.orders.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-act]");
  if (!btn) return;
  const id = btn.closest(".order").dataset.id;
  const order = state.orders.find((o) => o.id === id);
  if (!order) return;

  if (btn.dataset.act === "next") setStatus(id, NEXT_STATUS[order.status].to);
  if (btn.dataset.act === "prev") setStatus(id, PREV_STATUS[order.status]);
  if (btn.dataset.act === "del") {
    if (!confirm(`Supprimer la commande de ${order.guest_name} ?`)) return;
    try {
      await deleteOrder(id);
      state.orders = state.orders.filter((o) => o.id !== id);
      state.knownIds.delete(id);
      renderAll();
    } catch (error) {
      console.error(error);
      toast("Suppression impossible.", true);
    }
  }
});

el.filterServed.addEventListener("click", () => {
  state.hideServed = !state.hideServed;
  el.filterServed.setAttribute("aria-pressed", state.hideServed);
  renderOrders();
});

el.toggleOpen.addEventListener("click", async () => {
  const next = !state.ordersOpen;
  try {
    await setSettings({ orders_open: next });
  } catch (error) {
    console.error(error);
    toast("Impossible de changer l'état des commandes.", true);
    return;
  }
  state.ordersOpen = next;
  renderOpenToggle();
  toast(next ? "Commandes rouvertes" : "Commandes fermées");
});

function renderOpenToggle() {
  el.toggleOpen.setAttribute("aria-pressed", state.ordersOpen);
  el.toggleOpen.textContent = state.ordersOpen
    ? "Commandes ouvertes"
    : "Commandes fermées";
}

function selectTab(which) {
  const isOrders = which === "orders";
  el.tabOrders.setAttribute("aria-selected", isOrders);
  el.tabTally.setAttribute("aria-selected", !isOrders);
  el.viewOrders.classList.toggle("hidden", !isOrders);
  el.viewTally.classList.toggle("hidden", isOrders);
}

el.tabOrders.addEventListener("click", () => selectTab("orders"));
el.tabTally.addEventListener("click", () => selectTab("tally"));

/* --------------------------------------------------------------- Accès */

function unlock() {
  if (el.code.value.trim() !== KITCHEN_CODE) {
    toast("Code incorrect.", true);
    el.code.value = "";
    return;
  }
  sessionStorage.setItem(LS_GATE, "1");
  start();
}

el.gateBtn.addEventListener("click", unlock);
el.code.addEventListener("keydown", (e) => {
  if (e.key === "Enter") unlock();
});

/* ------------------------------------------------------------ Démarrage */

async function start() {
  el.gate.classList.add("hidden");
  el.console.classList.remove("hidden");

  try {
    state.menu = await loadMenu();
  } catch (error) {
    console.error(error);
    toast("Menu indisponible. Recharge la page.", true);
    return;
  }

  state.ordersOpen = state.menu.settings.orders_open !== false;
  renderOpenToggle();
  el.filterServed.setAttribute("aria-pressed", state.hideServed);

  await refresh({ announce: false });
  connectRealtime();

  // Filet de sécurité si le websocket tombe (wifi de soirée…)
  setInterval(() => {
    if (!document.hidden) refresh();
  }, POLL_MS);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refresh({ announce: false });
  });
}

if (sessionStorage.getItem(LS_GATE) === "1") {
  start();
} else {
  el.code.focus();
}
