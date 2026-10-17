import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { useApp, useCart } from '../store.jsx';
import { Badge, Empty, Img, m } from '../ui.jsx';
import { api, asOrder } from '../api/api.js';
import { getProduct } from '../api/market.js';

function useCartLines(cart) {
  const key = cart.map((item) => `${item.id || item.pid}:${item.qty}`).join('|');
  const [lines, setLines] = useState([]); const [loading, setLoading] = useState(Boolean(key)); const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    if (!cart.length) { setLines([]); setLoading(false); setError(''); return () => { live = false; }; }
    setLoading(true); setError('');
    Promise.all(cart.map(async (item) => {
      const id = String(item.id || item.pid);
      try { return { item, product: await getProduct(id) }; }
      catch (err) { return { item, id, error: err.message }; }
    })).then((result) => { if (live) setLines(result); })
      .catch((err) => { if (live) setError(err.message); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [key]);
  return { lines, loading, error };
}

function OrderSummary({ subtotal, deliveryFee = 0, children }) {
  return <aside className="card"><h3>Order summary</h3><p>Subtotal: {m(subtotal)}</p>{deliveryFee > 0 && <p>Same-day delivery: {m(deliveryFee)}</p>}<p><b>Estimated total: {m(subtotal + deliveryFee)}</b></p><p className="muted small">Final amount is calculated by the backend when you place the order.</p>{children}</aside>;
}

function lineSubtotal(lines) {
  return lines.reduce((sum, line) => sum + (line.product ? line.product.price * line.item.qty : 0), 0);
}

export function Cart() {
  const { s, set, t } = useApp(); const result = useCartLines(s.cart); const lines = result.lines;
  const change = (line, amount) => {
    if (!line.product && amount > 0) return;
    const id = String(line.item.id || line.item.pid);
    const nextQty = line.item.qty + amount;
    if (line.product && nextQty > line.product.stock) return t(`Only ${line.product.stock} in stock.`);
    set('cart', nextQty <= 0 ? s.cart.filter((entry) => String(entry.id || entry.pid) !== id) : s.cart.map((entry) => String(entry.id || entry.pid) === id ? { ...entry, qty: nextQty } : entry));
  };
  if (result.loading) return <div className="card center">Loading your cart…</div>;
  if (result.error) return <p className="err" role="alert">{result.error}</p>;
  if (!s.cart.length) return <Empty t="Your cart is empty"><Link className="btn" to="/products">Continue Shopping</Link></Empty>;
  return <><h1>Cart</h1>{lines.some((line) => line.error) && <p className="err" role="alert">Some cart products are no longer available. Remove them to continue.</p>}
    <div className="split"><div>{lines.map((line) => {
      const id = String(line.item.id || line.item.pid); const p = line.product;
      return <div className="card item" key={id}>{p ? <><Img n={p.name}/><div><b>{p.name}</b><p className="muted small">{p.vendor?.name || 'Local vendor'}</p><p>{m(p.price)}/{p.unit}</p></div><div className="row"><button className="btn ghost" aria-label="Decrease" onClick={() => change(line, -1)}>-</button>{line.item.qty}<button className="btn ghost" aria-label="Increase" disabled={line.item.qty >= p.stock} onClick={() => change(line, 1)}>+</button></div><b>{m(p.price * line.item.qty)}</b></> : <div><b>Unavailable product</b><p className="muted small">{line.error}</p></div>}
        <button className="btn ghost" onClick={() => set('cart', s.cart.filter((entry) => String(entry.id || entry.pid) !== id))}>Remove</button></div>;
    })}<Link to="/products">Continue Shopping</Link></div>
      <OrderSummary subtotal={lineSubtotal(lines)}><Link className="btn" to="/checkout" aria-disabled={lines.some((line) => !line.product)}>Proceed to Checkout</Link></OrderSummary></div></>;
}

export function Checkout() {
  const { s, set } = useApp(); const nav = useNavigate(); const result = useCartLines(s.cart);
  const [address, setAddress] = useState(() => localStorage.getItem(`localkart-address-${s.user?.id}`) || '');
  const [delivery, setDelivery] = useState('Standard'); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const lines = result.lines; const subtotal = lineSubtotal(lines);
  const vendors = useMemo(() => new Set(lines.filter((line) => line.product).map((line) => line.product.vendorId)).size, [lines]);
  const totalPreview = subtotal + (delivery === 'Same-day' ? 25 * vendors : 0);
  const place = async (event) => {
    event.preventDefault(); setError('');
    if (!address.trim()) return setError('Enter a delivery address.');
    if (lines.some((line) => !line.product)) return setError('Remove unavailable products before checkout.');
    setBusy(true);
    try {
      const response = await api('/orders', { method: 'POST', body: {
        items: lines.map(({ item }) => ({ pid: String(item.id || item.pid), qty: item.qty })),
        deliveryAddress: address.trim(), deliveryMethod: delivery,
      } });
      set('cart', []);
      localStorage.setItem(`localkart-address-${s.user.id}`, address.trim());
      nav('/order-success', { state: { orders: response.orders || [] } });
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  if (result.loading) return <div className="card center">Loading checkout…</div>;
  if (!s.cart.length) return <Empty t="Nothing to checkout"><Link className="btn" to="/products">Browse products</Link></Empty>;
  return <><h1>Checkout</h1>{result.error && <p className="err" role="alert">{result.error}</p>}{error && <p className="err" role="alert">{error}</p>}
    <form className="split" onSubmit={place}><div><div className="card form"><h3>Delivery address</h3><label>Address<textarea required value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Enter your delivery address"/></label></div>
      <div className="card form"><h3>Delivery option</h3>{['Standard', 'Same-day'].map((method) => <label className="chk" key={method}><input type="radio" name="delivery" checked={delivery === method} onChange={() => setDelivery(method)}/>{method} {method === 'Same-day' && `(+${m(25)} per vendor)`}</label>)}</div>
      <div className="card form"><h3>Payment method</h3><label className="chk"><input type="radio" checked readOnly/>Cash on Delivery</label><p className="muted small">Online payment is not available.</p></div>
      <div className="card"><h3>Items</h3>{lines.map(({ item, product, error: lineError }) => <p key={String(item.id || item.pid)}>{product ? `${product.name} × ${item.qty}` : `Unavailable item: ${lineError}`}</p>)}</div></div>
      <OrderSummary subtotal={subtotal} deliveryFee={totalPreview - subtotal}><button className="btn" disabled={busy || !address.trim() || lines.some((line) => !line.product)}>{busy ? 'Placing order…' : 'Place Order'}</button></OrderSummary></form></>;
}

export function OrderSuccess() {
  const { state } = useLocation(); const orders = (state?.orders || []).map(asOrder);
  if (!orders.length) return <Empty t="Order confirmation is no longer available"><Link className="btn" to="/orders">View your orders</Link></Empty>;
  return <div className="card center"><h1>Order placed successfully</h1>{orders.map((order) => <div key={order.id}><h3>Order {order.id}</h3><p>{order.items.map((item) => `${item.name} × ${item.qty}`).join(', ')}</p><p>Vendor: {order.vendorId?.name || 'Local vendor'} - Total {m(order.total)}</p><p>Deliver to: {order.address}</p><p>Delivery: {order.delivery}</p><Badge s={order.status}/><p><Link className="btn" to={`/orders/${order.id}`}>View Order</Link></p></div>)}<Link to="/products">Continue Shopping</Link></div>;
}

export function Orders() {
  const { set } = useApp(); const [tab, setTab] = useState('All'); const [orders, setOrders] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const load = () => { setLoading(true); api('/orders/my-orders').then(({ orders: data = [] }) => setOrders(data.map(asOrder))).catch((err) => setError(err.message)).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);
  const filtered = orders.filter((order) => tab === 'All' || (tab === 'Active' ? !['Delivered', 'Cancelled'].includes(order.status) : order.status === tab));
  const reorder = async (order) => {
    const cart = [];
    for (const item of order.items) {
      try { const product = await getProduct(item.pid); if (product.stock > 0) cart.push({ id: product.id, qty: Math.min(item.qty, product.stock) }); }
      catch { /* Product may no longer be available for sale. */ }
    }
    set('cart', cart);
  };
  return <><h1>My orders</h1>{error && <p className="err" role="alert">{error}</p>}<div className="row">{['All', 'Active', 'Delivered', 'Cancelled'].map((status) => <button key={status} className={`btn ${tab === status ? '' : 'ghost'}`} onClick={() => setTab(status)}>{status}</button>)}</div>
    {loading ? <p className="muted">Loading orders…</p> : filtered.length ? filtered.map((order) => <div className="card" key={order.id}><b>{order.id}</b> <Badge s={order.status}/><p className="small muted">{new Date(order.date).toLocaleDateString()} - {order.vendorId?.name || 'Local vendor'}</p><p>{order.items.map((item) => `${item.name} × ${item.qty}`).join(', ')} - <b>{m(order.total)}</b></p><div className="row"><Link className="btn" to={`/orders/${order.id}`}>View / Track</Link><button className="btn ghost" onClick={() => reorder(order)}>Reorder</button></div></div>) : !error && <Empty t="No orders here"><Link className="btn" to="/products">Start shopping</Link></Empty>}</>;
}

export function OrderTracking() {
  const { id } = useParams(); const [order, setOrder] = useState(null); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  useEffect(() => { let live = true; api(`/orders/${encodeURIComponent(id)}`).then(({ order: data }) => { if (live) setOrder(asOrder(data)); }).catch((err) => { if (live) setError(err.message); }).finally(() => { if (live) setLoading(false); }); return () => { live = false; }; }, [id]);
  if (loading) return <div className="card center">Loading order…</div>;
  if (error) return <Empty t={error}><Link to="/orders">My orders</Link></Empty>;
  return <><h1>Order {order.id}</h1><ol className="steps">{['Placed', 'Confirmed', 'Preparing', 'Out for Delivery', 'Delivered'].map((status) => <li key={status} className={['Placed', 'Confirmed', 'Preparing', 'Out for Delivery', 'Delivered'].indexOf(order.status) >= ['Placed', 'Confirmed', 'Preparing', 'Out for Delivery', 'Delivered'].indexOf(status) ? 'done' : ''} aria-current={order.status === status}>{status}</li>)}</ol>
    <div className="card"><p>Vendor: {order.vendorId?.name || 'Local vendor'}</p>{order.items.map((item) => <p key={item.pid}>{item.name} × {item.qty} - {m(item.price * item.qty)}</p>)}<p><b>Total {m(order.total)}</b> - {order.pay}</p><p>Address: {order.address}</p><p>Delivery: {order.delivery}</p><p>Status: <Badge s={order.status}/></p><p className="muted small">Placed {new Date(order.date).toLocaleString()}</p></div></>;
}

export function Profile() {
  const { s } = useApp(); const { user } = s;
  return <><h1>Profile</h1><div className="card"><p><b>Name:</b> {user.name}</p><p><b>Email:</b> {user.email}</p><p><b>Role:</b> {user.role}</p>{user.vendorId && <p><b>Vendor profile:</b> {user.vendorId}</p>}<p className="muted small">Profile changes are not supported by the current backend API.</p></div></>;
}
