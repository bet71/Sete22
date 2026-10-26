import { storage } from "@/src/utils/storage";

export const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL as string;
export const API = `${BACKEND_URL}/api`;
export const TOKEN_KEY = "auth_token";

export type Category = "carros" | "telefones" | "moveis" | "acessorios";

export type User = {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  city: string;
  state: string;
  whatsapp: string;
  created_at: string;
  listings_count?: number;
};

export type Listing = {
  id: string;
  title: string;
  description: string;
  price: number;
  condition: "novo" | "usado";
  category: Category;
  city: string;
  state: string;
  delivers: boolean;
  whatsapp: string;
  photos: string[];
  owner_id: string;
  owner_name: string;
  created_at: string;
};

export const CATEGORIES: { key: Category; label: string; icon: string }[] = [
  { key: "carros", label: "Carros", icon: "car-sport-outline" },
  { key: "telefones", label: "Telefones", icon: "phone-portrait-outline" },
  { key: "moveis", label: "Móveis", icon: "bed-outline" },
  { key: "acessorios", label: "Acessórios", icon: "watch-outline" },
];

export const categoryLabel = (c: string) => CATEGORIES.find((x) => x.key === c)?.label ?? c;

export const fileUrl = (path: string) => `${API}/files/${path}`;

export const formatPrice = (v: number) =>
  "R$ " + v.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".");

export function whatsappUrl(phone: string, title: string) {
  let digits = phone.replace(/\D/g, "");
  if (digits.length <= 11) digits = "55" + digits;
  const text = encodeURIComponent(`Olá! Vi seu anúncio "${title}" no MercadoLocal e tenho interesse.`);
  return `https://wa.me/${digits}?text=${text}`;
}

export async function getToken() {
  return (await storage.secureGet(TOKEN_KEY, "")) || "";
}

export async function apiFetch<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(init.headers as any) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { ...init, headers });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const d = data?.detail;
    throw new Error(typeof d === "string" ? d : Array.isArray(d) ? "Verifique os campos preenchidos" : "Erro na requisição");
  }
  return data as T;
}
