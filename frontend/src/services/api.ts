import axios from "axios";

/** База API (и для axios, и для fetch вроде /send-order). */
export const API_BASE_URL = "https://bars-shop.onrender.com";

export const api = axios.create({
  baseURL: API_BASE_URL,
});