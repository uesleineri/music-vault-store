import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface CartItem {
  type: 'multitrack' | 'bundle';
  id: string;
  name: string;
  subtitle: string | null;
  price: number;
  cover_url: string | null;
}

interface CartContextValue {
  items: CartItem[];
  addItem: (item: CartItem) => boolean;
  removeItem: (type: CartItem['type'], id: string) => void;
  clear: () => void;
  totalPrice: number;
  count: number;
}

const STORAGE_KEY = 'gospel-vs-cart';

const CartContext = createContext<CartContextValue | null>(null);

function loadFromStorage(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(loadFromStorage);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  // Each digital item only makes sense once per cart - returns false (no-op)
  // if it's already there, so callers can tell the user it was a duplicate.
  const addItem = (item: CartItem): boolean => {
    let added = true;
    setItems((prev) => {
      if (prev.some((existing) => existing.type === item.type && existing.id === item.id)) {
        added = false;
        return prev;
      }
      return [...prev, item];
    });
    return added;
  };

  const removeItem = (type: CartItem['type'], id: string) => {
    setItems((prev) => prev.filter((item) => !(item.type === type && item.id === id)));
  };

  const clear = () => setItems([]);

  const totalPrice = items.reduce((sum, item) => sum + item.price, 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, clear, totalPrice, count: items.length }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within a CartProvider');
  return context;
}
