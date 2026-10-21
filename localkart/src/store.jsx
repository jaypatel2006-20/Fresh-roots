import { createContext, useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { P, V, U, O, R, C } from './data/mock.js';
const Ctx = createContext();
export const useApp = () => useContext(Ctx);
const load = (k, d) => {
  try {
    const v = JSON.parse(localStorage.getItem(k));
    return v ?? d;
  } catch {
    return d;
  }
};
const K = {
  user: null,
  cart: [],
  products: P,
  vendors: V,
  orders: O,
  users: U,
  reviews: R,
  complaints: C,
  locality: 'All',
};
export function Provider({ children }) {
  const [s, S] = useState(() =>
    Object.fromEntries(Object.entries(K).map(([k, d]) => [k, load(k, d)]))
  );
  const [toast, T] = useState('');
  const set = (k, v) =>
    S((p) => {
      const n = { ...p, [k]: typeof v === 'function' ? v(p[k]) : v };
      localStorage.setItem(k, JSON.stringify(n[k]));
      return n;
    });
  const t = (m) => {
    T(m);
    setTimeout(() => T(''), 2500);
  };
  return (
    <Ctx.Provider value={{ s, set, t }}>
      {children}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </Ctx.Provider>
  );
}
export const useCart = () => {
  const { s, set, t } = useApp();
  const nav = useNavigate();
  return (p, q = 1, go) => {
    if (!s.user) {
      nav('/login');
      return;
    }
    if (s.user.role !== 'customer') {
      t('Only customers can shop');
      return;
    }
    const ex = s.cart.find((c) => c.id === p.id),
      n = (ex ? ex.qty : 0) + q;
    if (n > p.stock) {
      t('Only ' + p.stock + ' in stock');
      return;
    }
    set(
      'cart',
      ex
        ? s.cart.map((c) => (c.id === p.id ? { ...c, qty: n } : c))
        : [...s.cart, { id: p.id, qty: q }]
    );
    t('Product added to cart');
    if (go) nav('/cart');
  };
};
