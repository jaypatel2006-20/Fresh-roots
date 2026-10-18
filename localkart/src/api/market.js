import { api, asProduct, asVendor } from './api.js';

export async function getProducts(filters = {}) {
  const params = new URLSearchParams();
  const names = { q: 'q', category: 'category', vendorId: 'vendorId', maxPrice: 'maxPrice', minRating: 'minRating', inStock: 'inStock', locality: 'locality', sort: 'sort' };
  const sortValues = { pa: 'priceAsc', pd: 'priceDesc', r: 'ratingDesc' };
  Object.entries(names).forEach(([key, queryName]) => {
    const value = filters[key];
    if (value !== undefined && value !== '' && value !== false && value !== null) {
      const normalized = key === 'sort' ? (sortValues[value] || value) : value;
      params.set(queryName, normalized === true ? 'true' : String(normalized));
    }
  });
  const suffix = params.size ? `?${params}` : '';
  const { products = [] } = await api(`/products${suffix}`);
  return products.map(asProduct);
}

export async function getProduct(id) {
  const { product } = await api(`/products/${encodeURIComponent(id)}`);
  return asProduct(product);
}

export async function getVendors(filters = {}) {
  const params = new URLSearchParams();
  ['q', 'category', 'locality'].forEach((key) => {
    if (filters[key]) params.set(key, filters[key]);
  });
  const suffix = params.size ? `?${params}` : '';
  const { vendors = [] } = await api(`/vendors${suffix}`);
  return vendors.map(asVendor);
}

export async function getVendor(id) {
  const { vendor } = await api(`/vendors/${encodeURIComponent(id)}`);
  return asVendor(vendor);
}
