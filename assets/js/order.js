/**
 * Parcours de commande — machine à étapes minimaliste.
 * Aucune dépendance : tout tient dans ce fichier + api.js.
 */

import { COOKING, STATUS } from "./config.js";
import {
  loadMenu,
  createOrder,
  updateOrder,
  getOrder,
  deleteOrder,
} from "./api.js";

const STEPS = ["welcome", "burger", "custom", "extras", "recap"];
const LS_ORDER = "bp:orderId";
const LS_NAME = "bp:name";
const POLL_MS = 8000;

const state = {
  step: "welcome",
  menu: null,
  name: "",
  burger: null,
  removed: new Set(),
  cooking: null,
  sides: new Set(),
  note: "",
  order: null, // commande déjà enregistrée → on est en édition
};

const $ = (id) => document.getElementById(id);
const el = {
  back: $("back"),
  progress: $("progress"),
  counter: $("step-counter"),
  partyName: $("party-name"),
  welcomeMessage: $("welcome-message"),
  guestName: $("guest-name"),
  burgerList: $("burger-list"),
  customTitle: $("custom-title"),
  ingredientList: $("ingredient-list"),
  cookingBlock: $("cooking-block"),
  cookingList: $("cooking-list"),
  sideList: $("side-list"),
  drinkList: $("drink-list"),
  recap: $("recap"),
  note: $("note"),
  ticketNum: $("ticket-num"),
  ticketName: $("ticket-name"),
  ticketStatus: $("ticket-status"),
  ticketDetail: $("ticket-detail"),
  closedMessage: $("closed-message"),
  dock: $("dock"),
  cta: $("cta"),
  ctaSecondary: $("cta-secondary"),
  dockHint: $("dock-hint"),
  toast: $("toast"),
};

/* ------------------------------------------------------------- Utilitaires */

const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c],
  );

let toastTimer;
function toast(message, isError = false) {
  el.toast.textContent = message;
  el.toast.classList.toggle("toast--error", isError);
  el.toast.classList.add("toast--show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.remove("toast--show"), 2600);
}

function buzz(ms = 8) {
  if (navigator.vibrate) navigator.vibrate(ms);
}

const sideBySlug = (slug) => state.menu.sides.find((s) => s.slug === slug);
const burgerBySlug = (slug) => state.menu.burgers.find((b) => b.slug === slug);

/* ------------------------------------------------------------- Navigation */

function show(step) {
  state.step = step;
  for (const name of [...STEPS, "ticket", "closed"]) {
    $(`step-${name}`).classList.toggle("hidden", name !== step);
  }

  const index = STEPS.indexOf(step);
  const isFlow = index >= 0;

  el.progress.style.width = isFlow
    ? `${((index + 1) / STEPS.length) * 100}%`
    : "100%";
  el.counter.textContent = isFlow && index > 0 ? `${index}/${STEPS.length - 1}` : "";
  el.back.classList.toggle("hidden", !isFlow || index === 0);
  el.dock.classList.toggle("hidden", step === "closed");

  window.scrollTo({ top: 0, behavior: "instant" });
  renderDock();
}

function goBack() {
  const index = STEPS.indexOf(state.step);
  if (index > 0) show(STEPS[index - 1]);
}

/* ------------------------------------------------------------ Barre d'action */

function renderDock() {
  el.ctaSecondary.classList.add("hidden");
  el.dockHint.classList.add("hidden");
  el.cta.className = "btn btn--primary btn--block";
  el.cta.disabled = false;

  switch (state.step) {
    case "welcome":
      el.cta.textContent = "Je commande";
      el.cta.disabled = !el.guestName.value.trim();
      break;

    case "burger":
      el.cta.textContent = "Continuer";
      el.cta.disabled = !state.burger;
      break;

    case "custom":
      el.cta.textContent = "Continuer";
      el.cta.disabled = state.burger?.needs_cooking && !state.cooking;
      if (el.cta.disabled) {
        el.dockHint.textContent = "Choisis une cuisson pour continuer";
        el.dockHint.classList.remove("hidden");
      }
      break;

    case "extras":
      el.cta.textContent = "Voir ma commande";
      break;

    case "recap":
      el.cta.textContent = state.order
        ? "Mettre à jour ma commande"
        : "Valider ma commande";
      break;

    case "ticket":
      el.cta.className = "btn btn--ghost btn--block";
      el.cta.textContent = "Modifier ma commande";
      el.ctaSecondary.textContent = "Annuler ma commande";
      el.ctaSecondary.classList.remove("hidden");
      break;
  }

  // La barre du bas change de hauteur selon l'étape : on réserve la place
  // exacte sous le contenu pour que rien ne passe dessous.
  requestAnimationFrame(() => {
    document.documentElement.style.setProperty(
      "--dock-h",
      `${el.dock.offsetHeight}px`,
    );
  });
}

/* --------------------------------------------------------------- Rendu menu */

function renderBurgers() {
  el.burgerList.innerHTML = state.menu.burgers
    .map(
      (b) => `
      <button class="card" type="button" role="radio" data-slug="${esc(b.slug)}"
              aria-pressed="${state.burger?.slug === b.slug}">
        <span class="card__emoji" aria-hidden="true">${esc(b.emoji)}</span>
        <span class="card__body">
          <span class="card__name">${esc(b.name)}</span>
          ${b.tagline ? `<span class="card__tagline">${esc(b.tagline)}</span>` : ""}
          <span class="card__ings">${b.ingredients.map(esc).join(" · ")}</span>
        </span>
        <span class="card__check" aria-hidden="true">✓</span>
      </button>`,
    )
    .join("");
}

function renderCustom() {
  const burger = state.burger;
  el.customTitle.textContent = burger.name;

  el.ingredientList.innerHTML = burger.ingredients
    .map(
      (ing) => `
      <button class="chip chip--ing" type="button" data-ing="${esc(ing)}"
              aria-pressed="${state.removed.has(ing)}">
        ${esc(ing)}
      </button>`,
    )
    .join("");

  el.cookingBlock.classList.toggle("hidden", !burger.needs_cooking);
  if (burger.needs_cooking) {
    el.cookingList.innerHTML = Object.entries(COOKING)
      .map(
        ([key, label]) => `
        <button class="chip" type="button" data-cooking="${key}"
                aria-pressed="${state.cooking === key}">
          ${esc(label)}
        </button>`,
      )
      .join("");
  }
}

function renderExtras() {
  const chip = (s) => `
    <button class="chip chip--pick" type="button" data-side="${esc(s.slug)}"
            aria-pressed="${state.sides.has(s.slug)}">
      <span aria-hidden="true">${esc(s.emoji)}</span> ${esc(s.name)}
    </button>`;

  el.sideList.innerHTML = state.menu.sides
    .filter((s) => s.category === "side")
    .map(chip)
    .join("");
  el.drinkList.innerHTML = state.menu.sides
    .filter((s) => s.category === "drink")
    .map(chip)
    .join("");
}

/** Lignes partagées entre le récap et le ticket. */
function summaryRows(source) {
  const burger = source.burger;
  const removed = source.removed;
  const sides = source.sides.filter(Boolean);

  const row = (label, value) =>
    `<div class="row"><span class="row__label">${label}</span><span class="row__value">${value}</span></div>`;

  const rows = [
    row("Pour", esc(source.name)),
    row("Burger", `${esc(burger.emoji)} ${esc(burger.name)}`),
  ];

  if (source.cooking) rows.push(row("Cuisson", esc(COOKING[source.cooking])));

  if (removed.length) {
    rows.push(
      row(
        "Sans",
        `<span style="color: var(--c-danger)">${removed.map(esc).join(", ")}</span>`,
      ),
    );
  }

  const food = sides.filter((s) => s.category === "side");
  const drinks = sides.filter((s) => s.category === "drink");
  if (food.length) rows.push(row("Accompagnements", food.map((s) => esc(s.name)).join(", ")));
  if (drinks.length) rows.push(row("Boissons", drinks.map((s) => esc(s.name)).join(", ")));
  if (source.note) rows.push(row("Note", `<em>${esc(source.note)}</em>`));

  return rows.join("");
}

function renderRecap() {
  el.recap.innerHTML = summaryRows({
    name: state.name,
    burger: state.burger,
    cooking: state.cooking,
    removed: [...state.removed],
    sides: [...state.sides].map(sideBySlug),
    note: el.note.value.trim(),
  });
}

function renderTicket() {
  const order = state.order;
  el.ticketNum.textContent = `#${String(order.ticket).padStart(2, "0")}`;
  el.ticketName.textContent = order.guest_name;
  el.ticketStatus.textContent = STATUS[order.status] ?? order.status;
  el.ticketStatus.className = `badge badge--${order.status}`;

  el.ticketDetail.innerHTML = summaryRows({
    name: order.guest_name,
    burger: burgerBySlug(order.burger_slug) ?? {
      name: order.burger_slug,
      emoji: "🍔",
    },
    cooking: order.cooking,
    removed: order.removed,
    sides: order.side_slugs.map(sideBySlug),
    note: order.note,
  });
}

/* ------------------------------------------------------- Chargement commande */

function hydrateFrom(order) {
  state.order = order;
  state.name = order.guest_name;
  state.burger = burgerBySlug(order.burger_slug) ?? null;
  state.removed = new Set(order.removed);
  state.cooking = order.cooking;
  state.sides = new Set(order.side_slugs);
  el.note.value = order.note ?? "";
  el.guestName.value = order.guest_name;
}

/* ------------------------------------------------------------ Enregistrement */

async function submit() {
  const payload = {
    guest_name: state.name,
    burger_slug: state.burger.slug,
    cooking: state.burger.needs_cooking ? state.cooking : null,
    removed: [...state.removed],
    side_slugs: [...state.sides],
    note: el.note.value.trim() || null,
  };

  el.cta.disabled = true;
  el.cta.textContent = "Envoi…";

  try {
    state.order = state.order
      ? await updateOrder(state.order.id, payload)
      : await createOrder(payload);

    localStorage.setItem(LS_ORDER, state.order.id);
    localStorage.setItem(LS_NAME, state.name);

    renderTicket();
    show("ticket");
    buzz(20);
    toast("Commande envoyée en cuisine 🔥");
  } catch (error) {
    console.error(error);
    toast("Envoi impossible. Réessaie.", true);
  } finally {
    renderDock();
  }
}

async function cancel() {
  if (!confirm("Annuler ta commande ? Elle disparaît de la cuisine.")) return;
  try {
    await deleteOrder(state.order.id);
  } catch (error) {
    console.error(error);
    toast("Annulation impossible.", true);
    return;
  }
  localStorage.removeItem(LS_ORDER);
  state.order = null;
  state.burger = null;
  state.removed = new Set();
  state.cooking = null;
  state.sides = new Set();
  el.note.value = "";
  renderBurgers();
  show("welcome");
  toast("Commande annulée.");
}

/* ------------------------------------------------ Suivi du statut en direct */

let pollTimer;
function startPolling() {
  clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    if (state.step !== "ticket" || !state.order || document.hidden) return;
    try {
      const fresh = await getOrder(state.order.id);
      if (!fresh) return; // supprimée depuis la cuisine : on laisse le ticket
      if (fresh.status !== state.order.status) buzz(30);
      state.order = fresh;
      renderTicket();
    } catch {
      /* réseau capricieux en soirée : on retentera au prochain tick */
    }
  }, POLL_MS);
}

/* -------------------------------------------------------------- Évènements */

el.back.addEventListener("click", goBack);

el.guestName.addEventListener("input", renderDock);
el.guestName.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && el.guestName.value.trim()) {
    el.guestName.blur();
    el.cta.click();
  }
});

el.burgerList.addEventListener("click", (e) => {
  const card = e.target.closest("[data-slug]");
  if (!card) return;
  const next = burgerBySlug(card.dataset.slug);
  if (state.burger?.slug !== next.slug) {
    state.burger = next;
    state.removed = new Set();
    state.cooking = null;
  }
  renderBurgers();
  renderDock();
  buzz();
});

el.ingredientList.addEventListener("click", (e) => {
  const chip = e.target.closest("[data-ing]");
  if (!chip) return;
  const ing = chip.dataset.ing;
  state.removed.has(ing) ? state.removed.delete(ing) : state.removed.add(ing);
  chip.setAttribute("aria-pressed", state.removed.has(ing));
  buzz();
});

el.cookingList.addEventListener("click", (e) => {
  const chip = e.target.closest("[data-cooking]");
  if (!chip) return;
  state.cooking = chip.dataset.cooking;
  for (const c of el.cookingList.children) {
    c.setAttribute("aria-pressed", c.dataset.cooking === state.cooking);
  }
  renderDock();
  buzz();
});

for (const list of [el.sideList, el.drinkList]) {
  list.addEventListener("click", (e) => {
    const chip = e.target.closest("[data-side]");
    if (!chip) return;
    const slug = chip.dataset.side;
    state.sides.has(slug) ? state.sides.delete(slug) : state.sides.add(slug);
    chip.setAttribute("aria-pressed", state.sides.has(slug));
    buzz();
  });
}

el.cta.addEventListener("click", () => {
  switch (state.step) {
    case "welcome":
      state.name = el.guestName.value.trim();
      if (!state.name) return;
      localStorage.setItem(LS_NAME, state.name);
      show("burger");
      break;

    case "burger":
      renderCustom();
      show("custom");
      break;

    case "custom":
      renderExtras();
      show("extras");
      break;

    case "extras":
      renderRecap();
      show("recap");
      break;

    case "recap":
      submit();
      break;

    case "ticket":
      renderBurgers();
      show("burger");
      break;
  }
});

el.ctaSecondary.addEventListener("click", () => {
  if (state.step === "ticket") cancel();
});

/* ------------------------------------------------------------ Démarrage */

async function init() {
  try {
    state.menu = await loadMenu();
  } catch (error) {
    console.error(error);
    el.burgerList.innerHTML = "";
    toast("Menu indisponible. Recharge la page.", true);
    return;
  }

  const { settings } = state.menu;
  if (settings.party_name) {
    el.partyName.textContent = settings.party_name;
    document.title = `${settings.party_name} — passe ta commande`;
  }
  if (settings.message) el.welcomeMessage.textContent = settings.message;

  renderBurgers();

  // Une commande déjà passée sur ce téléphone ? On rouvre son ticket.
  const savedId = localStorage.getItem(LS_ORDER);
  if (savedId) {
    try {
      const order = await getOrder(savedId);
      if (order) {
        hydrateFrom(order);
        renderTicket();
        show("ticket");
        startPolling();
        return;
      }
      localStorage.removeItem(LS_ORDER);
    } catch {
      localStorage.removeItem(LS_ORDER);
    }
  }

  if (settings.orders_open === false) {
    if (settings.message) el.closedMessage.textContent = settings.message;
    show("closed");
    return;
  }

  el.guestName.value = localStorage.getItem(LS_NAME) ?? "";
  show("welcome");
  startPolling();
}

init();
