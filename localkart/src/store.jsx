import { createContext, useContext, useEffect, useState } from 'react';
import { R } from './data/mock.js';
import { api, clearToken, getToken, setToken } from './api/api.js';

const Ctx = createContext();
export const useApp = () => useContext(Ctx);
const read = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
};

export function Provider({ children }) {
  const [s, S] = useState(() => ({
    user: null,
    authReady: !getToken(),
    cart: read('cart', []),
    locality: read('locality', 'All'),
    products: [], vendors: [], orders: [], users: [],
    // The homepage still uses static testimonials; complaints are loaded from the admin API.
    reviews: R, complaints: [],
  }));
  const [toast, T] = useState('');

  useEffect(() => {
    let active = true;
    const savedToken = getToken();
    const onExpired = () => {
      if (!active) return;
      S((current) => ({ ...current, user: null, authReady: true }));
      T('Your session expired. Please log in again.');
    };
    window.addEventListener('localkart-session-expired', onExpired);
    if (savedToken) {
      api('/auth/me').then(({ user }) => {
        if (!active) return;
        S((current) => ({ ...current, user, authReady: true }));
      }).catch((error) => {
        if (!active) return;
        if (error.status === 401) clearToken();
        S((current) => ({ ...current, user: null, authReady: true }));
      });
    } else localStorage.removeItem('localkart-user');
    return () => { active = false; window.removeEventListener('localkart-session-expired', onExpired); };
  }, []);

  const set = (key, value) => S((previous) => {
    const nextValue = typeof value === 'function' ? value(previous[key]) : value;
    if (key === 'cart' || key === 'locality') localStorage.setItem(key, JSON.stringify(nextValue));
    return { ...previous, [key]: nextValue };
  });
  const login = (user, token) => {
    setToken(token);
    S((current) => ({ ...current, user, authReady: true }));
  };
  const logout = () => {
    clearToken();
    localStorage.removeItem('localkart-user');
    S((current) => ({ ...current, user: null, authReady: true }));
  };
  const t = (message) => { T(message); window.setTimeout(() => T(''), 3000); };

  return <Ctx.Provider value={{ s, set, t, login, logout }}>{children}{toast && <div className="toast" role="status">{toast}</div>}</Ctx.Provider>;
}

export const useCart = () => {
  const { s, set, t } = useApp();
  return (product, quantity = 1, go) => {
    if (!s.user) { t('Log in as a customer to add products to your cart.'); return; }
    if (s.user.role !== 'customer') { t('Only customers can shop.'); return; }
    const id = String(product.id || product._id);
    const existing = s.cart.find((item) => String(item.id || item.pid) === id);
    const nextQuantity = (existing?.qty || 0) + quantity;
    if (nextQuantity > product.stock) { t(`Only ${product.stock} in stock.`); return; }
    set('cart', existing
      ? s.cart.map((item) => String(item.id || item.pid) === id ? { ...item, id, qty: nextQuantity } : item)
      : [...s.cart, { id, qty: quantity }]);
    t('Product added to cart.');
    if (go) go();
  };
};
