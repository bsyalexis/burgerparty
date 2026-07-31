/**
 * Ouverture de la page invité.
 *
 * On tape « Ce soir / c'est », puis un rouleau de machine à sous défile entre
 * raclette, tacos, BBQ et burgers avant de retomber sur burgers. Les flammes
 * s'allument, le reste de l'écran apparaît.
 *
 * Ça ne joue qu'une fois par session : personne n'a envie de revoir
 * l'animation à chaque fois qu'il rouvre le lien. Un toucher passe l'intro.
 */

const LINE_1 = "Ce soir";
const LINE_2 = "c'est";
const CHAR_MS = 62;
const ROLL_MS = 1350;
const LS_SEEN = "bp:intro";

/** Le rouleau finit toujours sur le dernier mot. */
const REEL = [
  "raclette",
  "tacos",
  "bbq",
  "burgers",
  "raclette",
  "tacos",
  "bbq",
  "burgers",
];

const $ = (id) => document.getElementById(id);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function typeInto(node, text) {
  node.classList.add("typing");
  for (let i = 1; i <= text.length; i++) {
    node.textContent = text.slice(0, i);
    await wait(CHAR_MS);
  }
  node.classList.remove("typing");
}

/** État final : titre complet, flammes allumées, page révélée. */
export function settleIntro() {
  $("type-1").textContent = LINE_1;
  $("type-2").textContent = LINE_2;
  $("type-1").classList.remove("typing");
  $("type-2").classList.remove("typing");
  $("reel").classList.add("hidden");
  $("hero-word").classList.remove("hidden", "is-rolling");
  $("flames").classList.add("flames--lit");
  for (const node of document.querySelectorAll(".reveal")) {
    node.classList.add("reveal--in");
  }
}

export async function playIntro() {
  const skip =
    sessionStorage.getItem(LS_SEEN) === "1" ||
    matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (skip) {
    settleIntro();
    return;
  }

  sessionStorage.setItem(LS_SEEN, "1");

  // Un toucher n'importe où coupe court à l'animation.
  let skipped = false;
  const cutShort = () => {
    skipped = true;
  };
  document.addEventListener("pointerdown", cutShort, { once: true });

  await typeInto($("type-1"), LINE_1);
  if (skipped) return finish(cutShort);
  await wait(140);

  await typeInto($("type-2"), LINE_2);
  if (skipped) return finish(cutShort);
  await wait(160);

  await roll();
  finish(cutShort);
}

function finish(cutShort) {
  document.removeEventListener("pointerdown", cutShort);
  settleIntro();
}

/** Le rouleau : on empile les mots et on translate jusqu'au dernier. */
function roll() {
  const word = $("hero-word");
  const reel = $("reel");
  const track = $("reel-track");

  track.innerHTML = REEL.map((w) => `<span>${w}</span>`).join("");

  // Le mot final prend sa place tout de suite, invisible : c'est lui qui
  // fixe la mise en page pendant que le rouleau défile par-dessus.
  word.classList.remove("hidden");
  word.classList.add("is-rolling");
  reel.classList.remove("hidden");

  // Largeur figée sur le mot le plus long, sinon chaque mot serait rogné.
  reel.style.width = `${track.scrollWidth}px`;

  const step = reel.getBoundingClientRect().height;
  const end = -(REEL.length - 1) * step;

  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      track.style.transition = `transform ${ROLL_MS}ms cubic-bezier(0.13, 0.78, 0.2, 1)`;
      track.style.transform = `translate3d(0, ${end}px, 0)`;
      // transitionend peut ne jamais arriver si l'onglet passe en arrière-plan
      setTimeout(resolve, ROLL_MS + 60);
    });
  });
}
