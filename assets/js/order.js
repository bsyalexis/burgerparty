/**
 * Parcours de commande — machine à étapes minimaliste.
 * Aucune dépendance : tout tient dans ce fichier + api.js.
 */

import { COOKING, STATUS, ADDON_GROUPS } from "./config.js";
import {
  initPress,
  tap,
  enterStep,
  captureRect,
  openProduct,
  ticketIn,
  litFlames,
  burst,
} from "./motion.js";
import {
  loadMenu,
  createOrder,
  updateOrder,
  getOrder,
  deleteOrder,
} from "./api.js";

const LS_ORDER = "bp:orderId";
const LS_NAME = "bp:name";
const POLL_MS = 8000;

/** L'étape « avec ça ? » saute d'elle-même s'il n'y a rien à proposer. */
let STEPS = ["welcome", "burger", "custom", "extras", "recap"];

const state = {
  step: "welcome",
  menu: null,
  name: "",
  burger: null,
  removed: new Set(),
  cooking: null,
  addons: new Set(),
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
  customVisual: $("custom-visual"),
  ingredientBlock: $("ingredient-block"),
  ingredientList: $("ingredient-list"),
  extraBlock: $("extra-block"),
  extraList: $("extra-list"),
  sauceBlock: $("sauce-block"),
  sauceList: $("sauce-list"),
  cookingBlock: $("cooking-block"),
  cookingList: $("cooking-list"),
  sideBlock: $("side-block"),
  sideList: $("side-list"),
  drinkBlock: $("drink-block"),
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

const addonBySlug = (slug) => state.menu.addons.find((a) => a.slug === slug);

/** Une option sans `burger_slugs` vaut pour tous les burgers. */
const appliesTo = (addon, burger) =>
  !addon.burger_slugs?.length || addon.burger_slugs.includes(burger?.slug);

const addonsIn = (category, burger = null) =>
  state.menu.addons.filter(
    (a) => a.category === category && (!burger || appliesTo(a, burger)),
  );
const burgerBySlug = (slug) => state.menu.burgers.find((b) => b.slug === slug);

/* ------------------------------------------------------------- Navigation */

function show(step) {
  const from = STEPS.indexOf(state.step);
  const to = STEPS.indexOf(step);
  state.step = step;

  for (const name of ["welcome", "burger", "custom", "extras", "recap", "ticket", "closed"]) {
    $(`step-${name}`).classList.toggle("hidden", name !== step);
  }

  // On ne « recule » que dans le parcours lui-même
  const dir = to >= 0 && from > to ? "back" : "forward";
  enterStep($(`step-${step}`), dir);

  const index = to;
  const isFlow = index >= 0;

  el.progress.style.width = isFlow
    ? `${((index + 1) / STEPS.length) * 100}%`
    : "100%";
  el.counter.textContent =
    isFlow && index > 0 ? `${index}/${STEPS.length - 1}` : "";
  el.back.classList.toggle("hidden", !isFlow || index === 0);
  el.dock.classList.toggle("hidden", step === "closed");

  window.scrollTo({ top: 0, behavior: "instant" });
  renderDock();
}

function goBack() {
  const index = STEPS.indexOf(state.step);
  if (index > 0) show(STEPS[index - 1]);
}

/** Prépare et affiche l'étape qui suit celle en cours. */
function goNext() {
  const next = STEPS[STEPS.indexOf(state.step) + 1];

  // La vignette du burger choisi va s'envoler de sa carte vers la fiche
  // produit. Il faut relever sa position tant que la carte est à l'écran.
  const from =
    next === "custom"
      ? captureRect(
          el.burgerList.querySelector(
            `[data-slug="${state.burger.slug}"] .card__visual`,
          ),
        )
      : null;

  if (next === "custom") renderCustom();
  if (next === "extras") renderSidesAndDrinks();
  if (next === "recap") renderRecap();

  show(next);

  if (from) openProduct(from, el.customVisual);
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
      el.cta.textContent = state.order ? "Mettre à jour" : "Valider ma commande";
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

/** Photo du burger, ou son emoji en secours. Partagé carte / fiche produit. */
function visualOf(burger) {
  return burger.image_url
    ? `<img class="card__photo" src="${esc(burger.image_url)}" alt=""
            loading="lazy" decoding="async" data-emoji="${esc(burger.emoji)}" />`
    : esc(burger.emoji);
}

function renderBurgers() {
  el.burgerList.innerHTML = state.menu.burgers
    .map(
      (b) => `
      <button class="card" type="button" role="radio" data-slug="${esc(b.slug)}"
              aria-pressed="${state.burger?.slug === b.slug}">
        <span class="card__visual" aria-hidden="true">${visualOf(b)}</span>
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

/** Une pastille d'option : supplément, sauce, accompagnement ou boisson. */
function addonChip(addon, withPlus = false) {
  return `
    <button class="chip chip--pick" type="button" data-addon="${esc(addon.slug)}"
            aria-pressed="${state.addons.has(addon.slug)}">
      ${withPlus ? '<span class="chip__plus" aria-hidden="true">+</span>' : ""}
      <span aria-hidden="true">${esc(addon.emoji)}</span> ${esc(addon.name)}
    </button>`;
}

/** Remplit un bloc et le masque s'il n'y a rien à montrer. */
function fillBlock(block, list, addons, withPlus = false) {
  block.classList.toggle("hidden", addons.length === 0);
  // Le « + » ne vaut que pour ce qui s'ajoute vraiment : « En smash » change
  // la forme du steak, il n'en rajoute pas un.
  list.innerHTML = addons
    .map((a) => addonChip(a, withPlus && Number(a.counts_qty ?? 1) > 0))
    .join("");
}

function renderCustom() {
  const burger = state.burger;
  el.customTitle.textContent = burger.name;
  el.customVisual.innerHTML = visualOf(burger);

  el.ingredientBlock.classList.toggle("hidden", !burger.ingredients.length);
  el.ingredientList.innerHTML = burger.ingredients
    .map(
      (ing) => `
      <button class="chip chip--ing" type="button" data-ing="${esc(ing)}"
              aria-pressed="${state.removed.has(ing)}">
        ${esc(ing)}
      </button>`,
    )
    .join("");

  fillBlock(el.extraBlock, el.extraList, addonsIn("extra", burger), true);
  fillBlock(el.sauceBlock, el.sauceList, addonsIn("sauce", burger));

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

function renderSidesAndDrinks() {
  fillBlock(el.sideBlock, el.sideList, addonsIn("side"));
  fillBlock(el.drinkBlock, el.drinkList, addonsIn("drink"));
}

/** Lignes partagées entre le récap et le ticket. */
function summaryRows(source) {
  const row = (label, value) =>
    `<div class="row"><span class="row__label">${label}</span><span class="row__value">${value}</span></div>`;

  const rows = [
    row("Pour", esc(source.name)),
    row("Burger", `${esc(source.burger.emoji)} ${esc(source.burger.name)}`),
  ];

  if (source.cooking) rows.push(row("Cuisson", esc(COOKING[source.cooking])));

  if (source.removed.length) {
    rows.push(
      row(
        "Sans",
        `<span style="color: var(--c-danger)">${source.removed.map(esc).join(", ")}</span>`,
      ),
    );
  }

  const picked = source.addons.filter(Boolean);
  for (const [category, label] of Object.entries(ADDON_GROUPS)) {
    const group = picked.filter((a) => a.category === category);
    if (group.length) rows.push(row(label, group.map((a) => esc(a.name)).join(", ")));
  }

  if (source.note) rows.push(row("Note", `<em>${esc(source.note)}</em>`));

  return rows.join("");
}

function renderRecap() {
  el.recap.innerHTML = summaryRows({
    name: state.name,
    burger: state.burger,
    cooking: state.cooking,
    removed: [...state.removed],
    addons: [...state.addons].map(addonBySlug),
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
    addons: order.addon_slugs.map(addonBySlug),
    note: order.note,
  });

  ticketIn($("ticket-frame"), el.ticketNum, el.ticketStatus);
}

/* ------------------------------------------------------- Chargement commande */

function hydrateFrom(order) {
  state.order = order;
  state.name = order.guest_name;
  state.burger = burgerBySlug(order.burger_slug) ?? null;
  state.removed = new Set(order.removed);
  state.cooking = order.cooking;
  state.addons = new Set(order.addon_slugs);
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
    addon_slugs: [...state.addons],
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
    burst();
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
  state.addons = new Set();
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

// Photo manquante ou cassée : on retombe sur l'emoji. Les erreurs de
// chargement ne remontent pas, d'où l'écoute en phase de capture.
el.burgerList.addEventListener(
  "error",
  (e) => {
    const img = e.target;
    if (img.tagName !== "IMG") return;
    img.parentElement.textContent = img.dataset.emoji;
  },
  true,
);

el.burgerList.addEventListener("click", (e) => {
  const card = e.target.closest("[data-slug]");
  if (!card) return;
  const next = burgerBySlug(card.dataset.slug);
  if (state.burger?.slug !== next.slug) {
    state.burger = next;
    state.removed = new Set();
    state.cooking = null;

    // Une option réservée à un autre burger ne doit pas rester cochée
    for (const slug of state.addons) {
      const addon = addonBySlug(slug);
      if (addon && !appliesTo(addon, next)) state.addons.delete(slug);
    }
  }
  // On bascule l'état sur place plutôt que de tout reconstruire : sinon
  // les cartes rejouent leur entrée en cascade à chaque sélection.
  for (const c of el.burgerList.children) {
    c.setAttribute("aria-pressed", c.dataset.slug === next.slug);
  }
  tap(card);
  renderDock();
  buzz();
});

el.ingredientList.addEventListener("click", (e) => {
  const chip = e.target.closest("[data-ing]");
  if (!chip) return;
  const ing = chip.dataset.ing;
  state.removed.has(ing) ? state.removed.delete(ing) : state.removed.add(ing);
  chip.setAttribute("aria-pressed", state.removed.has(ing));
  tap(chip);
  buzz();
});

el.cookingList.addEventListener("click", (e) => {
  const chip = e.target.closest("[data-cooking]");
  if (!chip) return;
  state.cooking = chip.dataset.cooking;
  for (const c of el.cookingList.children) {
    c.setAttribute("aria-pressed", c.dataset.cooking === state.cooking);
  }
  tap(chip);
  renderDock();
  buzz();
});

for (const list of [el.extraList, el.sauceList, el.sideList, el.drinkList]) {
  list.addEventListener("click", (e) => {
    const chip = e.target.closest("[data-addon]");
    if (!chip) return;
    const slug = chip.dataset.addon;
    state.addons.has(slug) ? state.addons.delete(slug) : state.addons.add(slug);
    chip.setAttribute("aria-pressed", state.addons.has(slug));
    tap(chip);
    buzz();
  });
}

el.cta.addEventListener("click", () => {
  if (state.step === "welcome") {
    state.name = el.guestName.value.trim();
    if (!state.name) return;
    localStorage.setItem(LS_NAME, state.name);
    goNext();
  } else if (state.step === "recap") {
    submit();
  } else if (state.step === "ticket") {
    renderBurgers();
    show("burger");
  } else {
    goNext();
  }
});

el.ctaSecondary.addEventListener("click", () => {
  if (state.step === "ticket") cancel();
});

/* ------------------------------------------------------------ Démarrage */

async function init() {
  initPress();
  litFlames($("flames"));

  try {
    state.menu = await loadMenu();
  } catch (error) {
    console.error(error);
    el.burgerList.innerHTML = "";
    toast("Menu indisponible. Recharge la page.", true);
    return;
  }

  // Rien à proposer en accompagnement ni en boisson ? On retire l'étape.
  const hasWithThat = state.menu.addons.some(
    (a) => a.category === "side" || a.category === "drink",
  );
  if (!hasWithThat) STEPS = STEPS.filter((s) => s !== "extras");

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
