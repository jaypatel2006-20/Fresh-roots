import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../store.jsx';
import { categories } from '../data/mock.js';
import { Badge, Modal, Confirm, Empty, Loading, m } from '../ui.jsx';
import { api, asOrder, asProduct } from '../api/api.js';

function useVendorData() {
  const { s } = useApp(); const [products, setProducts] = useState([]); const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const refresh = async () => {
    setLoading(true); setError('');
    try {
      const [productResult, orderResult] = await Promise.all([api('/products/mine'), api('/orders/vendor-orders')]);
      setProducts((productResult.products || []).map(asProduct));
      setOrders((orderResult.orders || []).map(asOrder));
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { refresh(); }, [s.user?.id]);
  return { products, orders, setProducts, setOrders, loading, error, refresh };
}

const Stat = ({ label, value, className = '' }) => <div className={`card ${className}`}><p className="muted small">{label}</p><h2>{value}</h2></div>;
export const Bars = ({ data, className = '' }) => { const max = Math.max(1, ...data.map((item) => item[1])); return <div className={`bars ${className}`} role="img" aria-label="Bar chart">{data.map(([label, value]) => <div key={label} data-zero={value === 0}><i style={{ height: `${value / max * 100}%` }}/><span>{label}</span><b>{value}</b></div>)}</div>; };

function VendorLoad({ data }) { return data.loading ? <Loading label="Loading your vendor data…"/> : data.error ? <p className="err" role="alert">{data.error}</p> : null; }

export function VDash() {
  const data = useVendorData(); const { products, orders } = data;
  const delivered = orders.filter((order) => order.status === 'Delivered'); const low = products.filter((product) => product.stock <= product.min);
  const top = products.map((product) => [product.name, orders.reduce((sum, order) => sum + order.items.filter((item) => String(item.pid) === product.id).reduce((qty, item) => qty + item.qty, 0), 0)]).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const byDate = {}; delivered.forEach((order) => { const date = new Date(order.date).toLocaleDateString(); byDate[date] = (byDate[date] || 0) + order.total; });
  return <><h1>Dashboard</h1><VendorLoad data={data}/>{!data.loading && !data.error && <div className="vendor-dashboard">
    <div className="vendor-stats"><Stat className="vendor-stat" label="Total sales" value={m(delivered.reduce((sum, order) => sum + order.total, 0))}/><Stat className="vendor-stat" label="Orders" value={orders.length}/><Stat className="vendor-stat" label="Products" value={products.length}/><Stat className="vendor-stat" label="Pending orders" value={orders.filter((order) => order.status === 'Placed').length}/><Stat className="vendor-stat" label="Low stock" value={low.length}/></div>
    <div className="vendor-charts"><section className="card vendor-panel"><h3>Sales over time</h3>{Object.keys(byDate).length ? <Bars className="vendor-sales-chart" data={Object.entries(byDate)}/> : <p className="vendor-chart-empty muted">No delivered orders yet.</p>}</section><section className="card vendor-panel vendor-status-panel"><h3>Orders by status</h3><Bars className="vendor-status-chart" data={['Placed', 'Confirmed', 'Preparing', 'Out for Delivery', 'Delivered'].map((status) => [status, orders.filter((order) => order.status === status).length])}/></section></div>
    <div className="vendor-lists"><section className="card vendor-panel"><h3>Top-selling products</h3><div className="vendor-list">{top.length ? top.map(([name, qty]) => <div className="vendor-list-row" key={name}><span>{name}</span><b>{qty} sold</b></div>) : <p className="vendor-list-empty muted">No product sales yet.</p>}</div></section><section className="card vendor-panel"><h3>Low-stock alerts</h3><div className="vendor-list">{low.length ? low.map((product) => <div className="vendor-list-row" key={product.id}><span>{product.name}</span><Badge s={`${product.stock} left`}/></div>) : <p className="vendor-list-empty muted">All stocked.</p>}</div></section></div>
    <section className="card vendor-panel vendor-recent"><h3>Recent orders</h3>{orders.slice(0, 5).length ? <div className="vendor-order-list">{orders.slice(0, 5).map((order) => <div className="vendor-order-row" key={order.id}><span className="vendor-order-id" title={order.id}>{order.id}</span><b>{m(order.total)}</b><Badge s={order.status}/></div>)}</div> : <p className="vendor-list-empty muted">No orders yet.</p>}</section>
  </div>}</>;
}

export function VProducts() {
  const data = useVendorData(); const { products, setProducts, refresh } = data; const { t } = useApp();
  const [editing, setEditing] = useState(null); const [deleting, setDeleting] = useState(null); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const updateField = (key) => (event) => setEditing((current) => ({ ...current, [key]: event.target.type === 'number' ? Number(event.target.value) : event.target.value }));
  const save = async (event) => {
    event.preventDefault(); setError(''); setBusy(true);
    const body = { name: editing.name, category: editing.category, desc: editing.desc, price: Number(editing.price), unit: editing.unit, stock: Number(editing.stock), min: Number(editing.min), ...(editing.id ? { active: editing.active } : {}) };
    try {
      const result = editing.id
        ? await api(`/products/${editing.id}`, { method: 'PUT', body })
        : await api('/products', { method: 'POST', body });
      const product = asProduct(result.product);
      setProducts((current) => editing.id ? current.map((item) => item.id === product.id ? product : item) : [product, ...current]);
      t(editing.id ? 'Product updated.' : 'Product submitted for approval.'); setEditing(null);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  const toggle = async (product) => {
    try { const { product: updated } = await api(`/products/${product.id}`, { method: 'PUT', body: { active: !product.active } }); setProducts((items) => items.map((item) => item.id === product.id ? asProduct(updated) : item)); }
    catch (err) { setError(err.message); }
  };
  const remove = async () => {
    try { await api(`/products/${deleting.id}`, { method: 'DELETE' }); setProducts((items) => items.filter((item) => item.id !== deleting.id)); t('Product deleted.'); }
    catch (err) { setError(err.message); }
    finally { setDeleting(null); }
  };
  return <><div className="row between"><h1>Products</h1><button className="btn" onClick={() => setEditing({ name: '', category: categories[0], desc: '', price: 1, unit: 'kg', stock: 0, min: 10, active: true })}>Add product</button></div>
    <VendorLoad data={data}/>{error && <p className="err" role="alert">{error}</p>}{!data.loading && !data.error && (products.length ? <div className="tw"><table><thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th><th>Actions</th></tr></thead><tbody>{products.map((product) => <tr key={product.id}><td>{product.name}</td><td>{product.category}</td><td>{m(product.price)}/{product.unit}</td><td>{product.stock}</td><td><Badge s={!product.approved ? 'Pending' : product.active ? 'Active' : 'Disabled'}/></td><td className="row"><button className="btn ghost" onClick={() => setEditing({ ...product })}>Edit</button><button className="btn ghost" onClick={() => toggle(product)}>{product.active ? 'Disable' : 'Enable'}</button><button className="btn ghost" onClick={() => setDeleting(product)}>Delete</button></td></tr>)}</tbody></table></div> : <Empty t="No products yet">Add a product to submit it for approval.</Empty>)}
    {editing && <Modal title={editing.id ? 'Edit product' : 'Add product'} onClose={() => setEditing(null)}><form className="form" onSubmit={save}><label>Name<input required value={editing.name} onChange={updateField('name')}/></label><label>Category<select value={editing.category} onChange={updateField('category')}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label><label>Description<textarea value={editing.desc || ''} onChange={updateField('desc')}/></label><label>Price<input type="number" min="0.01" step="0.01" required value={editing.price} onChange={updateField('price')}/></label><label>Unit<input required value={editing.unit} onChange={updateField('unit')}/></label><label>Stock<input type="number" min="0" required value={editing.stock} onChange={updateField('stock')}/></label><label>Minimum stock<input type="number" min="0" value={editing.min} onChange={updateField('min')}/></label>{editing.id && <label className="chk"><input type="checkbox" checked={editing.active} onChange={(event) => setEditing({ ...editing, active: event.target.checked })}/> Available</label>}<button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save product'}</button></form></Modal>}
    {deleting && <Confirm msg={`Delete ${deleting.name}?`} onClose={() => setDeleting(null)} onYes={remove}/>}
  </>;
}

const nextStatus = { Placed: 'Confirmed', Confirmed: 'Preparing', Preparing: 'Out for Delivery', 'Out for Delivery': 'Delivered' };
export function VOrders() {
  const data = useVendorData(); const { orders, setOrders } = data; const [error, setError] = useState('');
  const advance = async (order, status) => {
    setError('');
    try { const { order: updated } = await api(`/orders/${order.id}/status`, { method: 'PATCH', body: { status } }); setOrders((current) => current.map((item) => item.id === order.id ? asOrder(updated) : item)); }
    catch (err) { setError(err.message); }
  };
  return <><h1>Orders</h1><VendorLoad data={data}/>{error && <p className="err" role="alert">{error}</p>}{!data.loading && !data.error && (orders.length ? <div className="tw"><table><thead><tr><th>Order</th><th>Customer</th><th>Products</th><th>Amount</th><th>Date</th><th>Status</th><th>Actions</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td>{order.id}</td><td>{order.customerId?.name || 'Customer'}</td><td>{order.items.map((item) => `${item.name} × ${item.qty}`).join(', ')}</td><td>{m(order.total)}</td><td>{new Date(order.date).toLocaleDateString()}</td><td><Badge s={order.status}/></td><td>{nextStatus[order.status] && <button className="btn" onClick={() => advance(order, nextStatus[order.status])}>{order.status === 'Placed' ? 'Accept' : `Mark ${nextStatus[order.status]}`}</button>}</td></tr>)}</tbody></table></div> : <Empty t="No orders yet"/>)}
  </>;
}

export function VInventory() {
  const data = useVendorData(); const { products, setProducts } = data; const [stock, setStock] = useState({}); const [error, setError] = useState(''); const [saved, setSaved] = useState('');
  const save = async (product) => {
    setError(''); setSaved('');
    try { const { product: updated } = await api(`/products/${product.id}`, { method: 'PUT', body: { stock: Number(stock[product.id] ?? product.stock) } }); setProducts((items) => items.map((item) => item.id === product.id ? asProduct(updated) : item)); setSaved(`${product.name} stock saved.`); }
    catch (err) { setError(err.message); }
  };
  return <><h1>Inventory</h1><VendorLoad data={data}/>{error && <p className="err" role="alert">{error}</p>}{saved && <p role="status">{saved}</p>}{!data.loading && !data.error && (products.length ? <div className="tw"><table><thead><tr><th>Product</th><th>Current stock</th><th>Minimum</th><th>Status</th><th>Update</th></tr></thead><tbody>{products.map((product) => { const current = Number(stock[product.id] ?? product.stock); return <tr key={product.id}><td>{product.name}</td><td><input aria-label={`Stock for ${product.name}`} type="number" min="0" value={current} onChange={(event) => setStock((items) => ({ ...items, [product.id]: event.target.value }))}/></td><td>{product.min}</td><td><Badge s={current === 0 ? 'Out of Stock' : current <= product.min ? 'Low Stock' : 'In Stock'}/></td><td><button className="btn ghost" onClick={() => save(product)}>Save</button></td></tr>; })}</tbody></table></div> : <Empty t="No inventory yet"/>)}
  </>;
}

export function VStore() {
  const { s } = useApp();
  const vendorId = s.user?.vendorId;
  const [vendor, setVendor] = useState(null);
  const [loading, setLoading] = useState(Boolean(vendorId));
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    if (!vendorId) {
      setVendor(null);
      setLoading(false);
      return () => { active = false; };
    }

    setLoading(true);
    setError('');
    api(`/vendors/${encodeURIComponent(vendorId)}`)
      .then(({ vendor: profile }) => { if (active) setVendor(profile); })
      .catch((err) => {
        if (!active) return;
        if (err.status !== 404) setError(err.message);
        setVendor(null);
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [vendorId]);

  return <><h1>Store profile</h1><section className="card">
    <div className="row between"><h3>Store information</h3>{vendor?.status && <Badge s={vendor.status}/>}</div>
    {error && <p className="err" role="alert">{error}</p>}
    {loading ? <Loading label="Loading store information…"/> : vendor ? <>
      <p><b>Store name:</b> {vendor.name}</p>
      {vendor.cat && <p><b>Category:</b> {vendor.cat}</p>}
      {vendor.locality && <p><b>Locality:</b> {vendor.locality}</p>}
      {vendor.address && <p><b>Address:</b> {vendor.address}</p>}
      {vendor.phone && <p><b>Contact number:</b> {vendor.phone}</p>}
    </> : <p className="muted">Public store details are not available yet.</p>}
    <div className="row"><Link className="btn ghost" to="/vendor/products">Manage products</Link><Link className="btn ghost" to="/vendor/orders">View orders</Link></div>
  </section></>;
}
