/**
 * Mini client PostgREST — quelques lignes de `fetch`, zéro dépendance.
 * Le SDK Supabase complet n'est chargé que sur l'écran cuisine, pour le
 * temps réel : la page des invités reste ultra légère.
 */

import { SUPABASE_URL, SUPABASE_KEY } from "./config.js";

const REST = `${SUPABASE_URL}/rest/v1`;

const baseHeaders = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
};

async function request(path, { method = "GET", body, prefer } = {}) {
  const headers = { ...baseHeaders };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (prefer) headers.Prefer = prefer;

  const res = await fetch(`${REST}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} ${detail}`.trim());
  }

  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

/** Menu + réglages en une seule salve de requêtes parallèles. */
export async function loadMenu() {
  const [burgers, addons, settings] = await Promise.all([
    request("/burgers?select=*&available=eq.true&order=sort_order.asc"),
    request("/addons?select=*&available=eq.true&order=sort_order.asc"),
    request("/settings?select=*&id=eq.1"),
  ]);
  return { burgers, addons, settings: settings[0] ?? {} };
}

export async function createOrder(order) {
  const rows = await request("/orders", {
    method: "POST",
    body: order,
    prefer: "return=representation",
  });
  return rows[0];
}

export async function updateOrder(id, patch) {
  const rows = await request(`/orders?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: patch,
    prefer: "return=representation",
  });
  return rows[0];
}

export async function getOrder(id) {
  const rows = await request(
    `/orders?select=*&id=eq.${encodeURIComponent(id)}`,
  );
  return rows[0] ?? null;
}

export async function deleteOrder(id) {
  await request(`/orders?id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function listOrders() {
  return request("/orders?select=*&order=created_at.asc");
}

export async function setSettings(patch) {
  const rows = await request("/settings?id=eq.1", {
    method: "PATCH",
    body: patch,
    prefer: "return=representation",
  });
  return rows[0];
}
