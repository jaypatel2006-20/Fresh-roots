import {Routes,Route,Navigate,Outlet,NavLink,Link,useNavigate} from 'react-router-dom';import {useState} from 'react';import {useApp} from './store.jsx';import {localities} from './data/mock.js';
import {Home,Products,ProductDetails,Vendors,VendorPage} from './pages/Shop.jsx';import {Login,Register} from './pages/Auth.jsx';import {Cart,Checkout,OrderSuccess,Orders,OrderTracking,Profile} from './pages/Buy.jsx';
import {VDash,VProducts,VOrders,VInventory,VStore} from './pages/Vendor.jsx';import {ADash,AUsers,AVendors,AProducts,AOrders,AComplaints} from './pages/Admin.jsx';
const Guard=({role})=>{const {s}=useApp();if(!s.authReady)return <main className="wrap"><div className="card center">Restoring your session…</div></main>;if(!s.user)return <Navigate to="/login" replace/>;if(s.user.role!==role)return <div className="card center wrap"><h2>Unauthorized Access</h2><p>Your account cannot open this page.</p><Link className="btn" to="/">Go home</Link></div>;return <Outlet/>};
function Customer(){const {s,set,t,logout}=useApp();const nav=useNavigate();const [o,O]=useState(false);const n=s.cart.reduce((a,c)=>a+c.qty,0);const [q,Q]=useState('');
 return <><header className="nav"><Link to="/" className="logo">LocalKart<small>Fresh. Local. Trusted.</small></Link>
 <button className="btn ghost menu" aria-label="Menu" onClick={()=>O(!o)}>Menu</button>
 <div className={'navc '+(o?'open':'')} onClick={()=>O(false)}>
 <select aria-label="Locality" value={s.locality} onChange={e=>set('locality',e.target.value)}><option>All</option>{localities.map(l=><option key={l}>{l}</option>)}</select>
 <form onSubmit={e=>{e.preventDefault();nav('/products?q='+q)}} role="search"><input aria-label="Search" placeholder="Search products" value={q} onChange={e=>Q(e.target.value)}/></form>
 <NavLink to="/products">Products</NavLink><NavLink to="/vendors">Vendors</NavLink>
 {s.user?.role==='customer'&&<><NavLink to="/orders">Orders</NavLink><NavLink to="/profile">Profile</NavLink></>}
 {s.user?.role==='vendor'&&<NavLink to="/vendor/dashboard">Dashboard</NavLink>}{s.user?.role==='admin'&&<NavLink to="/admin/dashboard">Dashboard</NavLink>}
 <NavLink to="/cart">Cart ({n})</NavLink>
 {s.user?<button className="btn ghost" onClick={()=>{logout();t('Logged out');nav('/')}}>Logout</button>:<><Link className="btn ghost" to="/login">Login</Link><Link className="btn" to="/register">Register</Link></>}
 </div></header><main className="wrap"><Outlet/></main>
 <footer className="foot"><b>LocalKart</b> - Fresh. Local. Trusted. Connecting local vendors with nearby customers.</footer></>}
function Side({links,title}){const {t,s,logout}=useApp();const nav=useNavigate();const [o,O]=useState(false);
 return <div className="shell"><aside className={'side '+(o?'open':'')} onClick={()=>O(false)}><div className="logo">LocalKart<small>{title}</small></div>
 {links.map(([to,l])=><NavLink key={to} to={to}>{l}</NavLink>)}<button className="btn ghost" onClick={()=>{logout();t('Logged out');nav('/login')}}>Logout</button></aside>
 <section className="dash"><button className="btn ghost menu" onClick={()=>O(!o)}>Menu</button><p className="muted">Signed in as {s.user?.name}</p><Outlet/></section></div>}
const VL=[['/vendor/dashboard','Dashboard'],['/vendor/products','Products'],['/vendor/orders','Orders'],['/vendor/inventory','Inventory'],['/vendor/store','Store Profile']];
const AL=[['/admin/dashboard','Dashboard'],['/admin/users','Users'],['/admin/vendors','Vendor Verification'],['/admin/products','Products'],['/admin/orders','Orders'],['/admin/complaints','Complaints']];
export default function App(){return <Routes>
 <Route element={<Customer/>}><Route path="/" element={<Home/>}/><Route path="/login" element={<Login/>}/><Route path="/register" element={<Register/>}/>
 <Route path="/products" element={<Products/>}/><Route path="/products/:id" element={<ProductDetails/>}/><Route path="/vendors" element={<Vendors/>}/><Route path="/vendors/:id" element={<VendorPage/>}/>
 <Route element={<Guard role="customer"/>}><Route path="/cart" element={<Cart/>}/><Route path="/checkout" element={<Checkout/>}/><Route path="/order-success" element={<OrderSuccess/>}/><Route path="/orders" element={<Orders/>}/><Route path="/orders/:id" element={<OrderTracking/>}/><Route path="/profile" element={<Profile/>}/></Route></Route>
 <Route element={<Guard role="vendor"/>}><Route element={<Side links={VL} title="Vendor"/>}><Route path="/vendor/dashboard" element={<VDash/>}/><Route path="/vendor/products" element={<VProducts/>}/><Route path="/vendor/orders" element={<VOrders/>}/><Route path="/vendor/inventory" element={<VInventory/>}/><Route path="/vendor/store" element={<VStore/>}/></Route></Route>
 <Route element={<Guard role="admin"/>}><Route element={<Side links={AL} title="Admin"/>}><Route path="/admin/dashboard" element={<ADash/>}/><Route path="/admin/users" element={<AUsers/>}/><Route path="/admin/vendors" element={<AVendors/>}/><Route path="/admin/products" element={<AProducts/>}/><Route path="/admin/orders" element={<AOrders/>}/><Route path="/admin/complaints" element={<AComplaints/>}/></Route></Route>
 <Route path="*" element={<Navigate to="/"/>}/></Routes>}
