export type MerchItem = {
  id: string;
  name: string;
  type: string;
  variant: string;
  price: number;
  imageSrc: string;
  images: string[];   // all gallery images; may include imageSrc
  sizes: string[];
  available: boolean;
};

export type CartEntry = {
  item: MerchItem;
  size: string;
  quantity: number;
  nameToPrint?: string;
};

export const CART_STORAGE_KEY = "avantra.merch.cart";

export function loadCart(): CartEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCart(cart: CartEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    window.dispatchEvent(new Event("avantra-cart-update"));
  } catch {
    // ignore
  }
}

export function clearCart(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(CART_STORAGE_KEY);
    window.dispatchEvent(new Event("avantra-cart-update"));
  } catch {
    // ignore
  }
}

