/**
 * Toute la motion de l'app passe par ici.
 *
 * GSAP pilote les `transform` ; le CSS ne garde que les couleurs, les ombres
 * et les états. Les deux ne doivent jamais animer la même propriété sur le
 * même élément, sinon le style en ligne posé par GSAP gagne en silence.
 *
 * Si GSAP ne se charge pas, chaque fonction devient un no-op : l'app reste
 * utilisable, simplement sans animation.
 */

const gsap = window.gsap;
const OK = Boolean(gsap);

const still = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const skip = () => !OK || still();

if (OK) {
  // Pas de sur-rendu sur les petits écrans
  gsap.ticker.lagSmoothing(500, 33);
}

/* ------------------------------------------------- Micro-interactions -- */

const PRESSABLE = ".btn, .chip, .card, .tab, .iconbtn";

/**
 * Enfoncement au doigt. Délégué sur le document : les cartes et les
 * pastilles sont recréées à chaque rendu, un écouteur par élément serait à
 * refaire sans arrêt.
 */
export function initPress() {
  if (skip()) return;

  let held = null;

  const release = () => {
    if (!held) return;
    gsap.to(held, {
      scale: 1,
      duration: 0.55,
      ease: "elastic.out(1, 0.5)",
      overwrite: "auto",
    });
    held = null;
  };

  document.addEventListener(
    "pointerdown",
    (e) => {
      const target = e.target.closest(PRESSABLE);
      if (!target || target.disabled) return;
      held = target;
      gsap.to(target, {
        scale: 0.955,
        duration: 0.14,
        ease: "power2.out",
        overwrite: "auto",
      });
    },
    { passive: true },
  );

  document.addEventListener("pointerup", release, { passive: true });
  document.addEventListener("pointercancel", release, { passive: true });
}

/** Rebond de confirmation : « c'est bien celui-là que tu as choisi ». */
export function tap(node) {
  if (skip() || !node) return;
  gsap.fromTo(
    node,
    { scale: 0.97 },
    { scale: 1, duration: 0.6, ease: "elastic.out(1, 0.42)", overwrite: "auto" },
  );
}

/* --------------------------------------------------------- Étapes -- */

/**
 * Entrée d'une étape : le bloc glisse dans le sens de la navigation, puis
 * ses sections montent en cascade.
 */
export function enterStep(stepEl, dir = "forward") {
  if (skip() || !stepEl) return;

  const way = dir === "back" ? -1 : 1;
  const blocks = stepEl.querySelectorAll(".stack-lg > *");
  const cards = stepEl.querySelectorAll(".card");

  gsap.killTweensOf([stepEl, ...blocks, ...cards]);

  const tl = gsap.timeline();

  tl.fromTo(
    stepEl,
    { x: 30 * way, autoAlpha: 0 },
    { x: 0, autoAlpha: 1, duration: 0.42, ease: "power3.out", clearProps: "all" },
  );

  if (blocks.length) {
    tl.fromTo(
      blocks,
      { y: 16, autoAlpha: 0 },
      {
        y: 0,
        autoAlpha: 1,
        duration: 0.45,
        stagger: 0.07,
        ease: "power3.out",
        clearProps: "all",
      },
      "-=0.3",
    );
  }

  if (cards.length) {
    tl.fromTo(
      cards,
      { y: 22, autoAlpha: 0, rotate: -1.5 },
      {
        y: 0,
        autoAlpha: 1,
        rotate: 0,
        duration: 0.5,
        stagger: 0.08,
        ease: "back.out(1.4)",
        clearProps: "all",
      },
      "-=0.34",
    );
  }

  return tl;
}

/* ------------------------------------------------- Fiche produit -- */

/** À appeler AVANT de masquer l'étape d'origine : après, le rect est nul. */
export function captureRect(node) {
  const rect = node?.getBoundingClientRect();
  return rect?.width ? rect : null;
}

/**
 * La vignette du burger choisi s'envole depuis sa carte jusqu'en tête de la
 * fiche produit. C'est un FLIP à la main : on repart de l'ancienne position
 * et on laisse GSAP revenir à la nouvelle.
 */
export function openProduct(fromRect, toNode) {
  if (skip() || !fromRect || !toNode) return;

  const to = toNode.getBoundingClientRect();
  if (!to.width) return;

  gsap.fromTo(
    toNode,
    {
      x: fromRect.left - to.left,
      y: fromRect.top - to.top,
      scale: fromRect.width / to.width,
      transformOrigin: "top left",
    },
    {
      x: 0,
      y: 0,
      scale: 1,
      duration: 0.55,
      ease: "power3.inOut",
      clearProps: "all",
    },
  );
}

/* ------------------------------------------------------------ Ticket -- */

/** Le ticket s'imprime, le numéro et le statut se tamponnent dessus. */
export function ticketIn(ticket, number, badge) {
  if (skip()) return;

  gsap
    .timeline()
    .fromTo(
      ticket,
      { y: 26, autoAlpha: 0, scale: 0.96 },
      { y: 0, autoAlpha: 1, scale: 1, duration: 0.5, ease: "power3.out" },
    )
    .fromTo(
      [number, badge],
      { scale: 2.3, autoAlpha: 0, rotate: -12 },
      {
        scale: 1,
        autoAlpha: 1,
        rotate: 0,
        duration: 0.45,
        stagger: 0.14,
        ease: "back.out(2.2)",
        clearProps: "all",
      },
      "-=0.18",
    );
}

/* ------------------------------------------------- Flammes du titre -- */

/** Allumage des flammes à l'arrivée sur la page. */
export function litFlames(flames) {
  if (skip() || !flames) return;
  gsap.from(flames.children, {
    scale: 0,
    autoAlpha: 0,
    duration: 0.55,
    stagger: 0.09,
    ease: "back.out(2.6)",
  });
}

/* -------------------------------------------------------- Validation -- */

const STICKERS = ["🍔", "🔥", "🧀", "🍟", "🥓", "🧅"];

/** Gerbe d'autocollants à la validation — purement décoratif. */
export function burst() {
  if (skip()) return;

  const layer = document.createElement("div");
  layer.className = "burst";
  layer.setAttribute("aria-hidden", "true");

  const nodes = STICKERS.concat(STICKERS).map((emoji) => {
    const sticker = document.createElement("span");
    sticker.textContent = emoji;
    layer.append(sticker);
    return sticker;
  });

  document.body.append(layer);

  gsap.set(nodes, {
    x: () => gsap.utils.random(-0.42, 0.42) * innerWidth,
    y: 0,
    scale: 0,
  });

  gsap
    .timeline({ onComplete: () => layer.remove() })
    .to(nodes, {
      scale: () => gsap.utils.random(0.85, 1.4),
      duration: 0.22,
      stagger: 0.025,
      ease: "back.out(2)",
    })
    .to(
      nodes,
      {
        y: () => -gsap.utils.random(0.42, 0.72) * innerHeight,
        rotate: () => gsap.utils.random(-380, 380),
        duration: 1.1,
        stagger: 0.025,
        ease: "power2.out",
      },
      0,
    )
    .to(nodes, { autoAlpha: 0, duration: 0.35, stagger: 0.025 }, 0.75);
}
