import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useApp, useCart } from '../store.jsx';
import { categories } from '../data/mock.js';
import { Badge, Img, Empty, Loading, m } from '../ui.jsx';
import { getProducts, getProduct, getVendors, getVendor } from '../api/market.js';

function useRequest(load, deps) {
  const [data, setData] = useState(null); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  useEffect(() => {
    let live = true; setLoading(true); setError('');
    load().then((value) => { if (live) setData(value); }).catch((err) => { if (live) setError(err.message); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, deps);
  return { data, loading, error };
}

export function ProductCard({ p }) {
  const add = useCart(); const vendor = p.vendor;
  return <article className="card pc"><Link to={`/products/${p.id}`}><Img n={p.name}/><h3>{p.name}</h3></Link><p className="muted small">{vendor?.name || 'Local vendor'}{vendor?.locality ? ` - ${vendor.locality}` : ''}</p>
    <p><b>{m(p.price)}</b>/{p.unit} <span className="muted">★ {p.rating}</span></p><p>{p.stock > 0 ? <Badge s={p.active && p.approved ? 'Active' : 'Unavailable'}/> : <Badge s="Out of Stock"/>} <span className="small muted">{p.stock > 0 ? `${p.stock} in stock` : 'Out of stock'}</span></p>
    <button className="btn" disabled={p.stock < 1 || !p.active || !p.approved} onClick={() => add(p)}>Add to Cart</button></article>;
}

export const VendorCard = ({ v }) => <article className="card"><Img n={v.name}/><h3>{v.name} {v.status === 'Verified' && <Badge s="Verified"/>}</h3><p className="muted small">★ {v.rating} - {v.locality}{v.dist ? ` - ${v.dist} km` : ''}</p><p className="small">{v.cat}{v.radius ? ` - Delivery within ${v.radius} km` : ''}</p><Link className="btn" to={`/vendors/${v.id}`}>View Store</Link></article>;

export function Home() {
  const { s } = useApp();
  const vendors = useRequest(() => getVendors(s.locality !== 'All' ? { locality: s.locality } : {}), [s.locality]);
  const products = useRequest(() => getProducts({ ...(s.locality !== 'All' ? { locality: s.locality } : {}) }), [s.locality]);
  return <><section className="hero"><h1>Fresh products from vendors near you.</h1><p>Discover trusted local sellers, shop fresh products, and get them delivered to your doorstep.</p><div className="row"><Link className="btn" to="/products">Explore Products</Link><Link className="btn ghost" to="/register">Become a Vendor</Link></div></section>
    <h2>Popular categories</h2><div className="grid sm">{categories.map((category) => <Link key={category} className="card center" to={`/products?cat=${encodeURIComponent(category)}`}>{category}</Link>)}</div>
    <h2>Featured local vendors</h2>{vendors.error ? <p className="err" role="alert">{vendors.error}</p> : vendors.loading ? <Loading label="Loading vendors…"/> : vendors.data.length ? <div className="grid">{vendors.data.slice(0, 3).map((v) => <VendorCard key={v.id} v={v}/>)}</div> : <Empty t="No verified vendors yet"/>}
    <h2>Popular products</h2>{products.error ? <p className="err" role="alert">{products.error}</p> : products.loading ? <Loading label="Loading products…"/> : products.data.length ? <div className="grid">{products.data.slice(0, 4).map((p) => <ProductCard key={p.id} p={p}/>)}</div> : <Empty t="No products available yet"/>}
    <h2>How it works</h2><div className="grid sm"><div className="card"><h3>1. Pick your locality</h3><p>See vendors close to you.</p></div><div className="card"><h3>2. Add to cart</h3><p>Shop products from verified sellers.</p></div><div className="card"><h3>3. Track delivery</h3><p>Follow your order status.</p></div></div>
    <h2>Why choose FreshRoots</h2><div className="grid sm"><div className="card">Verified vendors only</div><div className="card">Fresh, local produce</div><div className="card">Simple order tracking</div></div>
    <h2>What customers say</h2><div className="grid">{s.reviews.slice(0, 3).map((review) => <div className="card" key={review.id}><p>"{review.text}"</p><p className="muted small">{review.name} - ★ {review.rating}</p></div>)}</div></>;
}

export function Products() {
  const { s } = useApp(); const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState({ q: searchParams.get('q') || '', category: searchParams.get('cat') || '', vendorId: '', maxPrice: 1000, minRating: 0, inStock: false, sort: '' });
  useEffect(() => setFilters((current) => ({ ...current, q: searchParams.get('q') || '', category: searchParams.get('cat') || '' })), [searchParams]);
  const [search, setSearch] = useState(filters.q);
  useEffect(() => { const timer = window.setTimeout(() => setSearch(filters.q), 300); return () => window.clearTimeout(timer); }, [filters.q]);
  const update = (key) => (event) => setFilters((current) => ({ ...current, [key]: event.target.type === 'checkbox' ? event.target.checked : event.target.type === 'range' || key === 'minRating' ? Number(event.target.value) : event.target.value }));
  const query = { ...filters, q: search, ...(s.locality !== 'All' ? { locality: s.locality } : {}) };
  const list = useRequest(() => getProducts(query), [search, filters.category, filters.vendorId, filters.maxPrice, filters.minRating, filters.inStock, filters.sort, s.locality]);
  const vendors = useRequest(() => getVendors(s.locality !== 'All' ? { locality: s.locality } : {}), [s.locality]);
  return <><h1>Products {s.locality !== 'All' && <small className="muted">in {s.locality}</small>}</h1><div className="card filters">
    <input aria-label="Search" placeholder="Search" value={filters.q} onChange={update('q')}/><select aria-label="Category" value={filters.category} onChange={update('category')}><option value="">All categories</option>{categories.map((category) => <option key={category}>{category}</option>)}</select>
    <select aria-label="Vendor" value={filters.vendorId} onChange={update('vendorId')}><option value="">All vendors</option>{(vendors.data || []).map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}</select>
    <label>Max price {m(filters.maxPrice)}<input type="range" min="30" max="1000" value={filters.maxPrice} onChange={update('maxPrice')}/></label><select aria-label="Rating" value={filters.minRating} onChange={update('minRating')}><option value="0">Any rating</option><option value="4">4+ stars</option><option value="4.5">4.5+ stars</option></select>
    <label className="chk"><input type="checkbox" checked={filters.inStock} onChange={update('inStock')}/> In stock</label><select aria-label="Sort" value={filters.sort} onChange={(event) => { const next = event.target.value; setFilters((current) => ({ ...current, sort: next })); }}><option value="">Sort by</option><option value="pa">Price low to high</option><option value="pd">Price high to low</option><option value="r">Rating</option></select></div>
    {list.loading ? <Loading label="Loading products…"/> : list.error ? <p className="err" role="alert">{list.error}</p> : list.data.length ? <div className="grid">{list.data.map((product) => <ProductCard key={product.id} p={product}/>)}</div> : <Empty t="No products found">Try changing filters or locality.</Empty>}
    </>;
}

export function ProductDetails() {
  const { id } = useParams(); const nav = useNavigate(); const add = useCart(); const { s } = useApp();
  const [quantity, setQuantity] = useState(1);
  const product = useRequest(() => getProduct(id), [id]);
  const p = product.data;
  const related = useRequest(() => p ? getProducts({ category: p.category, ...(s.locality !== 'All' ? { locality: s.locality } : {}) }) : Promise.resolve([]), [p?.id, p?.category, s.locality]);
  const relatedProducts = related.data?.filter((item) => item.id !== p?.id).slice(0, 4) || [];
  if (product.loading) return <Loading label="Loading product…"/>;
  if (product.error) return <Empty t={product.error}><Link to="/products">Back to products</Link></Empty>;
  const vendor = p.vendor;
  return <><section className="product-detail-layout">
    <ProductVisual key={p.id} product={p}/>
    <div className="product-detail-info">
      <h1>{p.name}</h1>
      <div className="product-price-rating"><p><b>{m(p.price)}</b><span> / {p.unit}</span></p><p className="muted">Rating: {p.rating}</p></div>
      <p className="product-vendor">Sold by <Link to={`/vendors/${vendor?.id}`}>{vendor?.name || 'Local vendor'}</Link>{vendor?.locality ? <span className="muted">, {vendor.locality}</span> : null}</p>
      <p className={`product-stock ${p.stock > 0 ? 'in-stock' : 'out-of-stock'}`}>{p.stock > 0 ? `${p.stock} in stock` : 'Out of stock'}</p>
      <div className="product-purchase">
        <label className="product-quantity">Quantity<input type="number" min="1" max={p.stock} value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))}/></label>
        <div className="product-actions"><button className="btn" disabled={!p.stock} onClick={() => add(p, quantity)}>Add to Cart</button><button className="btn ghost" disabled={!p.stock} onClick={() => add(p, quantity, () => nav('/cart'))}>Buy Now</button></div>
      </div>
      <div className="product-description"><h3>Description</h3><p>{p.desc}</p><p className="muted small">Category: {p.category}</p></div>
    </div>
  </section>
    {related.loading ? <><h2>Related products</h2><Loading label="Loading related products…"/></> : related.error ? <><h2>Related products</h2><p className="err" role="alert">{related.error}</p></> : relatedProducts.length > 0 && <><h2>Related products</h2><div className="grid">{relatedProducts.map((item) => <ProductCard key={item.id} p={item}/>)}</div></>}</>;
}

function ProductVisual({ product }) {
  const [imageFailed, setImageFailed] = useState(false);
  const image = product.image || product.imageUrl;
  if (image && !imageFailed) {
    return <img className="product-detail-visual" src={image} alt={product.name} onError={() => setImageFailed(true)}/>;
  }
  return <div className="product-detail-visual product-visual-fallback" role="img" aria-label={`${product.name} image unavailable`}><span className="product-visual-mark" aria-hidden="true"/></div>;
}

export function Vendors() {
  const { s } = useApp(); const result = useRequest(() => getVendors(s.locality !== 'All' ? { locality: s.locality } : {}), [s.locality]);
  return <><h1>Local vendors</h1>{result.loading ? <Loading label="Loading vendors…"/> : result.error ? <p className="err" role="alert">{result.error}</p> : result.data.length ? <div className="grid">{result.data.map((vendor) => <VendorCard key={vendor.id} v={vendor}/>)}</div> : <Empty t="No verified vendors in this locality">Choose another locality.</Empty>}</>;
}

export function VendorPage() {
  const { id } = useParams(); const vendor = useRequest(() => getVendor(id), [id]);
  const products = useRequest(() => getProducts({ vendorId: id }), [id]);
  if (vendor.loading) return <Loading label="Loading vendor…"/>;
  if (vendor.error) return <Empty t={vendor.error}/>;
  const v = vendor.data;
  return <><section className="hero"><h1>{v.name} <Badge s="Verified"/></h1><p>★ {v.rating} - {v.address || v.locality}</p><p>{v.desc}</p><p>{v.radius ? `Delivery within ${v.radius} km - ` : ''}{v.hours ? `Open ${v.hours} - ` : ''}{v.cat}</p></section>
    <h2>Products</h2>{products.loading ? <Loading label="Loading products…"/> : products.error ? <p className="err" role="alert">{products.error}</p> : products.data.length ? <div className="grid">{products.data.map((product) => <ProductCard key={product.id} p={{ ...product, vendor: v }}/>)}</div> : <Empty t="No products available yet"/>}
    </>;
}
