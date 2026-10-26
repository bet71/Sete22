import { storage } from "@/src/utils/storage";

export const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL as string;
export const API = `${BACKEND_URL}/api`;
export const TOKEN_KEY = "auth_token";

export type Category =
  | "carros" | "telefones" | "moveis" | "eletrodomesticos" | "roupas"
  | "acessorios" | "casas" | "terrenos" | "aluguel" | "outros";

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
  { key: "eletrodomesticos", label: "Eletrodomésticos", icon: "tv-outline" },
  { key: "roupas", label: "Roupas", icon: "shirt-outline" },
  { key: "acessorios", label: "Acessórios", icon: "watch-outline" },
  { key: "casas", label: "Casas à venda", icon: "home-outline" },
  { key: "terrenos", label: "Terrenos", icon: "map-outline" },
  { key: "aluguel", label: "Aluguel", icon: "key-outline" },
  { key: "outros", label: "Outros", icon: "ellipsis-horizontal-circle-outline" },
];

export const categoryLabel = (c: string) => CATEGORIES.find((x) => x.key === c)?.label ?? c;

export type Service =
  | "eletricista" | "gesso" | "mecanico" | "encanador" | "pedreiro"
  | "pintor" | "diarista" | "marceneiro" | "tecnico" | "outros";

export const SERVICES: { key: Service; label: string; icon: string }[] = [
  { key: "eletricista", label: "Eletricista", icon: "flash-outline" },
  { key: "gesso", label: "Gesso", icon: "layers-outline" },
  { key: "mecanico", label: "Mecânico", icon: "construct-outline" },
  { key: "encanador", label: "Encanador", icon: "water-outline" },
  { key: "pedreiro", label: "Pedreiro", icon: "hammer-outline" },
  { key: "pintor", label: "Pintor", icon: "color-palette-outline" },
  { key: "diarista", label: "Diarista", icon: "sparkles-outline" },
  { key: "marceneiro", label: "Marceneiro", icon: "cube-outline" },
  { key: "tecnico", label: "Técnico", icon: "laptop-outline" },
  { key: "outros", label: "Outros", icon: "ellipsis-horizontal-circle-outline" },
];

export const serviceLabel = (s: string) => SERVICES.find((x) => x.key === s)?.label ?? s;

export type Partner = {
  id: string;
  business_name: string;
  service: Service;
  description: string;
  city: string;
  state: string;
  whatsapp: string;
  photo?: string | null;
  owner_id: string;
  owner_name: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  updated_at: string;
};

export function whatsappServiceUrl(phone: string, name: string) {
  let digits = phone.replace(/\D/g, "");
  if (digits.length <= 11) digits = "55" + digits;
  const text = encodeURIComponent(`Olá, ${name}! Encontrei seu serviço no MercadoLocal e gostaria de um orçamento.`);
  return `https://wa.me/${digits}?text=${text}`;
}

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
