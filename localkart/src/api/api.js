const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const TOKEN_KEY = 'localkart-token';

export class ApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function api(path, { method = 'GET', body, headers = {}, ...options } = {}) {
  const requestHeaders = { ...headers };
  if (body !== undefined) requestHeaders['Content-Type'] = 'application/json';
  const token = localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
  if (token) requestHeaders.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${API_URL}/api${path}`, {
      method,
      headers: requestHeaders,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      ...options,
    });
  } catch {
    throw new ApiError(`Cannot reach the FreshRoots API at ${API_URL}. Check that the backend is running.`);
  }

  let data = null;
  try { data = await response.json(); } catch { /* Some successful responses may have no JSON body. */ }
  if (!response.ok) {
    if (response.status === 401 && token) {
      localStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem('localkart-user');
      window.dispatchEvent(new Event('localkart-session-expired'));
    }
    throw new ApiError(data?.message || `Request failed (${response.status}).`, response.status);
  }
  return data;
}

export const setToken = (token, remember = true) => {
  if (remember) {
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.setItem(TOKEN_KEY, token);
  }
};
export const clearToken = () => {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
};
export const getToken = () => localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);

export function asVendor(vendor) {
  if (!vendor) return null;
  return { ...vendor, id: String(vendor._id || vendor.id), cat: vendor.cat || vendor.category };
}

export function asProduct(product) {
  const vendor = asVendor(typeof product.vendorId === 'object' ? product.vendorId : product.vendor);
  return {
    ...product,
    id: String(product._id || product.id),
    vendorId: String(vendor?.id || product.vendorId),
    vendor,
    desc: product.desc || product.description || '',
  };
}

export function asOrder(order) {
  return { ...order, id: String(order._id || order.id) };
}
