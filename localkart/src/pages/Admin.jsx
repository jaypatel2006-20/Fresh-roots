import { useEffect, useState } from 'react';
import { useApp } from '../store.jsx';
import { Badge, Confirm, Empty, m } from '../ui.jsx';
import { Bars } from './Vendor.jsx';
import { api, asProduct, asVendor } from '../api/api.js';

function useAdminResource(path, query = '') {
  const [data, setData] = useState(null); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const load = async () => {
    setLoading(true); setError('');
    try { setData(await api(`${path}${query ? `?${query}` : ''}`)); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [path, query]);
  return { data, setData, loading, error, refresh: load };
}

const Stat = ({ label, value }) => <div className="card"><p className="muted small">{label}</p><h2>{value}</h2></div>;
const Table = ({ headings, children }) => <div className="tw"><table><thead><tr>{headings.map((heading) => <th key={heading}>{heading}</th>)}</tr></thead><tbody>{children}</tbody></table></div>;
const dateText = (value) => value ? new Date(value).toLocaleDateString() : '—';

export function ADash() {
  const result = useAdminResource('/admin/dashboard'); const data = result.data; const stats = data?.stats;
  return <><h1>Dashboard</h1>{result.loading ? <p className="muted">Loading dashboard…</p> : result.error ? <p className="err" role="alert">{result.error}</p> : stats && <>
    <div className="grid sm"><Stat label="Total users" value={stats.totalUsers}/><Stat label="Total vendors" value={stats.totalVendors}/><Stat label="Verified vendors" value={stats.verifiedVendors}/><Stat label="Pending verification" value={stats.pendingVendors}/><Stat label="Total products" value={stats.totalProducts}/><Stat label="Pending approval" value={stats.pendingProducts}/><Stat label="Total orders" value={stats.totalOrders}/><Stat label="Active orders" value={stats.activeOrders}/><Stat label="Unresolved complaints" value={stats.unresolvedComplaints}/><Stat label="Delivered revenue" value={m(stats.totalRevenue)}/></div>
    <div className="grid"><div className="card"><h3>User growth (by month joined)</h3>{data.userGrowth.length ? <Bars data={data.userGrowth.map((item) => [item.month, item.count])}/> : <p className="muted">No user records yet.</p>}</div><div className="card"><h3>Order statistics</h3>{data.ordersByStatus.length ? <Bars data={data.ordersByStatus.map((item) => [item.status, item.count])}/> : <p className="muted">No order records yet.</p>}</div><div className="card"><h3>Vendor verification</h3>{data.vendorsByStatus.length ? <Bars data={data.vendorsByStatus.map((item) => [item.status, item.count])}/> : <p className="muted">No vendor records yet.</p>}</div></div>
  </>}</>;
}

export function AUsers() {
  const { s, t } = useApp(); const [filters, setFilters] = useState({ q: '', role: 'customer', status: '' }); const [pending, setPending] = useState(null); const [error, setError] = useState('');
  const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value)).toString();
  const result = useAdminResource('/admin/users', query); const users = result.data?.users || [];
  const updateFilter = (key) => (event) => setFilters((current) => ({ ...current, [key]: event.target.value }));
  const changeStatus = async () => {
    setError('');
    try {
      const status = pending.status === 'Active' ? 'Suspended' : 'Active';
      await api(`/admin/users/${pending.id}/status`, { method: 'PATCH', body: { status } });
      await result.refresh();
      t(`User ${status.toLowerCase()}.`);
    } catch (err) { setError(err.message); }
    finally { setPending(null); }
  };
  return <><h1>Users</h1><div className="card filters"><input aria-label="Search users" placeholder="Search name or email" value={filters.q} onChange={updateFilter('q')}/><select aria-label="Role" value={filters.role} onChange={updateFilter('role')}><option value="">All roles</option><option value="customer">Customer</option><option value="vendor">Vendor</option><option value="admin">Admin</option></select><select aria-label="Status" value={filters.status} onChange={updateFilter('status')}><option value="">All statuses</option><option value="Active">Active</option><option value="Suspended">Suspended</option></select></div>
    {error && <p className="err" role="alert">{error}</p>}{result.loading ? <p className="muted">Loading users…</p> : result.error ? <p className="err" role="alert">{result.error}</p> : users.length ? <Table headings={['ID', 'Name', 'Email', 'Locality', 'Role', 'Joined', 'Orders', 'Status', 'Actions']}>{users.map((user) => <tr key={user.id}><td>{user.id.slice(-6)}</td><td>{user.name}</td><td>{user.email}</td><td>{user.locality || '—'}</td><td>{user.role}</td><td>{dateText(user.joined)}</td><td>{user.orderCount ?? 0}</td><td><Badge s={user.status}/></td><td><button className="btn ghost" onClick={() => t(`${user.name}: ${user.orderCount || 0} orders, phone ${user.phone || 'not provided'}`)}>Details</button><button className="btn ghost" disabled={user.id === s.user?.id} onClick={() => setPending(user)}>{user.status === 'Active' ? 'Suspend' : 'Activate'}</button></td></tr>)}</Table> : <Empty t="No matching users"/>}
    {pending && <Confirm msg={`${pending.status === 'Active' ? 'Suspend' : 'Activate'} ${pending.name}?`} onClose={() => setPending(null)} onYes={changeStatus}/>}
  </>;
}

export function AVendors() {
  const { t } = useApp(); const [status, setStatus] = useState(''); const [pending, setPending] = useState(null); const [error, setError] = useState('');
  const query = status ? `status=${encodeURIComponent(status)}` : ''; const result = useAdminResource('/admin/vendors', query); const vendors = (result.data?.vendors || []).map(asVendor);
  const changeStatus = async () => {
    setError('');
    try {
      const next = pending.nextStatus;
      await api(`/admin/vendors/${pending.vendor.id}/status`, { method: 'PATCH', body: { status: next } });
      await result.refresh();
      t(`Vendor ${next.toLowerCase()}.`);
    } catch (err) { setError(err.message); }
    finally { setPending(null); }
  };
  return <><h1>Vendor verification</h1><div className="card filters"><select aria-label="Vendor status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option><option>Pending</option><option>Verified</option><option>Rejected</option></select></div>
    {error && <p className="err" role="alert">{error}</p>}{result.loading ? <p className="muted">Loading vendors…</p> : result.error ? <p className="err" role="alert">{result.error}</p> : vendors.length ? <Table headings={['Business', 'Owner', 'Locality', 'Category', 'Submitted', 'Status', 'Actions']}>{vendors.map((vendor) => <tr key={vendor.id}><td>{vendor.name}</td><td>{vendor.owner?.name || vendor.owner?.email || '—'}</td><td>{vendor.locality}</td><td>{vendor.cat}</td><td>{dateText(vendor.submitted)}</td><td><Badge s={vendor.status}/></td><td className="row"><button className="btn ghost" onClick={() => t(`${vendor.name}: ${vendor.address || vendor.locality}, ${vendor.phone || 'no phone'}`)}>Details</button>{vendor.status === 'Pending' && <><button className="btn" onClick={() => setPending({ vendor, nextStatus: 'Verified' })}>Approve</button><button className="btn ghost" onClick={() => setPending({ vendor, nextStatus: 'Rejected' })}>Reject</button></>}</td></tr>)}</Table> : <Empty t="No vendors match this status"/>}
    {pending && <Confirm msg={`Mark ${pending.vendor.name} as ${pending.nextStatus}?`} onClose={() => setPending(null)} onYes={changeStatus}/>}
  </>;
}

export function AProducts() {
  const { t } = useApp(); const [filters, setFilters] = useState({ approved: '', active: '', vendorId: '' }); const [deleting, setDeleting] = useState(null); const [error, setError] = useState('');
  const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value)).toString();
  const result = useAdminResource('/admin/products', query); const products = (result.data?.products || []).map(asProduct);
  const vendors = [...new Map(products.filter((product) => product.vendor).map((product) => [product.vendor.id, product.vendor])).values()];
  const setFilter = (key) => (event) => setFilters((current) => ({ ...current, [key]: event.target.value }));
  const updateProduct = async (product, endpoint, body, message) => {
    setError('');
    try {
      await api(`/admin/products/${product.id}/${endpoint}`, { method: 'PATCH', body });
      await result.refresh();
      t(message);
    } catch (err) { setError(err.message); }
  };
  const removeProduct = async () => {
    setError('');
    try { await api(`/admin/products/${deleting.id}`, { method: 'DELETE' }); await result.refresh(); t('Product removed.'); }
    catch (err) { setError(err.message); }
    finally { setDeleting(null); }
  };
  return <><h1>Products</h1><div className="card filters"><select aria-label="Approval" value={filters.approved} onChange={setFilter('approved')}><option value="">All approval states</option><option value="false">Pending approval</option><option value="true">Approved</option></select><select aria-label="Availability" value={filters.active} onChange={setFilter('active')}><option value="">All availability</option><option value="true">Active</option><option value="false">Disabled</option></select><select aria-label="Vendor" value={filters.vendorId} onChange={setFilter('vendorId')}><option value="">All vendors</option>{vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}</select></div>
    {error && <p className="err" role="alert">{error}</p>}{result.loading ? <p className="muted">Loading products…</p> : result.error ? <p className="err" role="alert">{result.error}</p> : products.length ? <Table headings={['Product', 'Vendor', 'Category', 'Price', 'Stock', 'Approval', 'Availability', 'Actions']}>{products.map((product) => <tr key={product.id}><td>{product.name}</td><td>{product.vendor?.name || '—'}</td><td>{product.category}</td><td>{m(product.price)}</td><td>{product.stock}</td><td><Badge s={product.approved ? 'Approved' : 'Pending'}/></td><td><Badge s={product.active ? 'Active' : 'Disabled'}/></td><td className="row"><button className="btn" onClick={() => updateProduct(product, 'approval', { approved: !product.approved }, product.approved ? 'Product approval revoked.' : 'Product approved.')}>{product.approved ? 'Reject' : 'Approve'}</button><button className="btn ghost" onClick={() => updateProduct(product, 'availability', { active: !product.active }, product.active ? 'Product disabled.' : 'Product enabled.')}>{product.active ? 'Disable' : 'Enable'}</button><button className="btn ghost" onClick={() => setDeleting(product)}>Remove</button></td></tr>)}</Table> : <Empty t="No products match these filters"/>}
    {deleting && <Confirm msg={`Remove ${deleting.name}?`} onClose={() => setDeleting(null)} onYes={removeProduct}/>}
  </>;
}

export function AOrders() {
  const [filters, setFilters] = useState({ status: '', vendor: '', customer: '', date: '' }); const result = useAdminResource('/admin/orders'); const orders = result.data?.orders || [];
  const setFilter = (key) => (event) => setFilters((current) => ({ ...current, [key]: event.target.value }));
  const vendors = [...new Map(orders.filter((order) => order.vendorId).map((order) => [order.vendorId._id, order.vendorId])).values()];
  const customers = [...new Map(orders.filter((order) => order.customerId).map((order) => [order.customerId._id, order.customerId])).values()];
  const filtered = orders.filter((order) => (!filters.status || order.status === filters.status) && (!filters.vendor || order.vendorId?._id === filters.vendor) && (!filters.customer || order.customerId?._id === filters.customer) && (!filters.date || new Date(order.date).toISOString().slice(0, 10) === filters.date));
  return <><h1>Orders</h1><div className="card filters"><input aria-label="Date" type="date" value={filters.date} onChange={setFilter('date')}/><select aria-label="Vendor" value={filters.vendor} onChange={setFilter('vendor')}><option value="">All vendors</option>{vendors.map((vendor) => <option key={vendor._id} value={vendor._id}>{vendor.name}</option>)}</select><select aria-label="Customer" value={filters.customer} onChange={setFilter('customer')}><option value="">All customers</option>{customers.map((customer) => <option key={customer._id} value={customer._id}>{customer.name}</option>)}</select><select aria-label="Status" value={filters.status} onChange={setFilter('status')}><option value="">All statuses</option>{['Placed', 'Confirmed', 'Preparing', 'Out for Delivery', 'Delivered', 'Cancelled'].map((status) => <option key={status}>{status}</option>)}</select></div>
    {result.loading ? <p className="muted">Loading orders…</p> : result.error ? <p className="err" role="alert">{result.error}</p> : filtered.length ? <Table headings={['Order', 'Customer', 'Vendor', 'Items', 'Amount', 'Date', 'Status']}>{filtered.map((order) => <tr key={order._id}><td>{String(order._id).slice(-6)}</td><td>{order.customerId?.name || '—'}</td><td>{order.vendorId?.name || '—'}</td><td>{order.items.map((item) => `${item.name} × ${item.qty}`).join(', ')}</td><td>{m(order.total)}</td><td>{dateText(order.date)}</td><td><Badge s={order.status}/></td></tr>)}</Table> : <Empty t="No matching orders"/>}
  </>;
}

export function AComplaints() {
  const { t } = useApp(); const [status, setStatus] = useState(''); const [error, setError] = useState('');
  const query = status ? `status=${encodeURIComponent(status)}` : ''; const result = useAdminResource('/admin/complaints', query); const complaints = result.data?.complaints || [];
  const changeStatus = async (complaint, nextStatus) => {
    setError('');
    try {
      const { complaint: updated } = await api(`/admin/complaints/${complaint._id}/status`, { method: 'PATCH', body: { status: nextStatus } });
      result.setData((current) => ({ ...current, complaints: status ? current.complaints.filter((item) => item._id !== updated._id) : current.complaints.map((item) => item._id === updated._id ? updated : item) }));
      t(`Complaint marked ${nextStatus.toLowerCase()}.`);
    } catch (err) { setError(err.message); }
  };
  return <><h1>Complaints</h1><div className="card filters"><select aria-label="Complaint status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All complaints</option><option>Pending</option><option>Resolved</option></select></div>
    {error && <p className="err" role="alert">{error}</p>}{result.loading ? <p className="muted">Loading complaints…</p> : result.error ? <p className="err" role="alert">{result.error}</p> : complaints.length ? <Table headings={['ID', 'User', 'Vendor', 'Issue', 'Date', 'Priority', 'Status', 'Actions']}>{complaints.map((complaint) => <tr key={complaint._id}><td>{String(complaint._id).slice(-6)}</td><td>{complaint.uid?.name || '—'}</td><td>{complaint.vendorId?.name || '—'}</td><td>{complaint.issue}</td><td>{dateText(complaint.date)}</td><td><Badge s={complaint.priority}/></td><td><Badge s={complaint.status}/></td><td className="row">{complaint.status === 'Pending' ? <button className="btn" onClick={() => changeStatus(complaint, 'Resolved')}>Resolve</button> : <button className="btn ghost" onClick={() => changeStatus(complaint, 'Pending')}>Mark pending</button>}</td></tr>)}</Table> : <Empty t="No complaints found"/>}
  </>;
}
