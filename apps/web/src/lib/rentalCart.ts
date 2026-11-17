export interface RentalCartItem {
  item_id: string;
  name: string;
  daily_price: string | number;
  image_url: string;
  start_date: string;
  end_date: string;
  units: number;
  day_count: number;
}

const CART_STORAGE_KEY = 'icx_rental_cart';

export function getRentalCart(): RentalCartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveRentalCart(items: RentalCartItem[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event('icx-rental-cart-updated'));
}

export function addToRentalCart(item: RentalCartItem): RentalCartItem[] {
  const current = getRentalCart();
  const existingIdx = current.findIndex(
    (c) =>
      c.item_id === item.item_id &&
      c.start_date === item.start_date &&
      c.end_date === item.end_date
  );
  if (existingIdx >= 0 && current[existingIdx]) {
    current[existingIdx] = {
      ...current[existingIdx],
      units: current[existingIdx].units + item.units,
    };
  } else {
    current.push(item);
  }
  saveRentalCart(current);
  return current;
}

export function removeFromRentalCart(index: number): RentalCartItem[] {
  const current = getRentalCart().filter((_, i) => i !== index);
  saveRentalCart(current);
  return current;
}

export function clearRentalCart(): void {
  saveRentalCart([]);
}
