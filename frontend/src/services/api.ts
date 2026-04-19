import axios from "axios";

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/$/, "");
}

/** Убираем хвост `/api`, чтобы пути вроде `/categories` не превращались в `/api/categories` (404). */
function normalizeApiRoot(url: string): string {
  const trimmed = normalizeBaseUrl(url);
  if (trimmed.endsWith("/api")) {
    return trimmed.slice(0, -4);
  }
  return trimmed;
}

const envUrl =
  typeof import.meta.env.VITE_API_URL === "string"
    ? import.meta.env.VITE_API_URL.trim()
    : "";

/** База API: `VITE_API_URL` из .env или прод-хост Render. */
export const API_BASE_URL =
  envUrl !== "" ? normalizeApiRoot(envUrl) : "https://bars-shop.onrender.com";

/**
 * Абсолютный URL эндпоинта (axios с baseURL игнорирует свой baseURL для absolute URL).
 * Используй для путей, которые должны гарантированно попасть на бэкенд.
 */
export function apiAbsoluteUrl(path: string): string {
  const base = normalizeBaseUrl(API_BASE_URL);
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

export const api = axios.create({
  baseURL: API_BASE_URL,
});
