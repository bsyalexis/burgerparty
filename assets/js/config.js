/**
 * Configuration publique.
 *
 * La clé ci-dessous est la clé « publishable » de Supabase : elle est faite
 * pour vivre dans le navigateur. Les droits réels sont définis par les
 * politiques RLS côté base (voir README.md).
 */

export const SUPABASE_URL = "https://eqbvfhhxrovsscldcgfh.supabase.co";
export const SUPABASE_KEY = "sb_publishable_gOyoD9t7x9vW6Tcbe8YyDQ_Wwr4bdSK";

/** Code d'entrée de l'écran cuisine. Garde-fou anti-clic, pas un vrai secret. */
export const KITCHEN_CODE = "1808";

/** Libellés des cuissons, partagés entre la commande et la cuisine. */
export const COOKING = {
  saignant: "Saignant",
  a_point: "À point",
  bien_cuit: "Bien cuit",
};

/** Les quatre familles d'options, dans l'ordre où on les présente. */
export const ADDON_GROUPS = {
  extra: "Suppléments",
  sauce: "Sauces",
  side: "Accompagnements",
  drink: "Boissons",
};

/** Libellés des statuts de commande. */
export const STATUS = {
  nouvelle: "Nouvelle",
  en_cuisine: "En cuisine",
  prete: "Prête",
  servie: "Servie",
};
