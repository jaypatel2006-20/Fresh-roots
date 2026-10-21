import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../store.jsx';
import { localities, categories } from '../data/mock.js';
const home = { customer: '/products', vendor: '/vendor/dashboard', admin: '/admin/dashboard' };
export function Login() {
  const { s, set, t } = useApp();
  const nav = useNavigate();
  const [f, F] = useState({ email: '', password: '' });
  const [e, E] = useState('');
  const go = (ev) => {
    ev.preventDefault();
    const u = s.users.find((u) => u.email === f.email && u.password === f.password);
    if (!u) return E('Invalid email or password');
    if (u.status === 'Suspended') return E('This account is suspended');
    set('user', u);
    t('Welcome back, ' + u.name);
    nav(home[u.role]);
  };
  return (
    <form className="card form" onSubmit={go}>
      <h2>Login</h2>
      {e && (
        <p className="err" role="alert">
          {e}
        </p>
      )}
      <label>
        Email
        <input
          type="email"
          required
          value={f.email}
          onChange={(x) => F({ ...f, email: x.target.value })}
        />
      </label>
      <label>
        Password
        <input
          type="password"
          required
          value={f.password}
          onChange={(x) => F({ ...f, password: x.target.value })}
        />
      </label>
      <label className="chk">
        <input type="checkbox" /> Remember me
      </label>
      <button className="btn">Login</button>
      <p>
        New here? <Link to="/register">Create an account</Link>
      </p>
      <p className="muted small">
        Demo: customer@localkart.com / customer123
        <br />
        vendor@localkart.com / vendor123
        <br />
        admin@localkart.com / admin123
      </p>
    </form>
  );
}
export function Register() {
  const { s, set, t } = useApp();
  const nav = useNavigate();
  const [f, F] = useState({ role: 'customer', locality: 'Sion', cat: categories[0] });
  const [e, E] = useState('');
  const u = (k) => (x) => F({ ...f, [k]: x.target.value });
  const go = (ev) => {
    ev.preventDefault();
    if (f.password.length < 6) return E('Password must be at least 6 characters');
    if (f.password !== f.confirm) return E('Passwords do not match');
    if (s.users.some((x) => x.email === f.email)) return E('Email already registered');
    if (!f.terms) return E('Please accept the terms');
    const id = 'u' + (s.users.length + 1);
    let vendorId;
    if (f.role === 'vendor') {
      vendorId = s.vendors.length + 1;
      set('vendors', (v) => [
        ...v,
        {
          id: vendorId,
          name: f.biz,
          locality: f.locality,
          cat: f.cat,
          rating: 0,
          dist: 2,
          status: 'Pending',
          desc: f.desc || '',
          phone: f.phone,
          address: f.addr || f.locality,
          radius: 5,
          hours: '9 AM - 7 PM',
          submitted: new Date().toISOString().slice(0, 10),
        },
      ]);
    }
    set('users', (x) => [
      ...x,
      {
        id,
        name: f.name,
        email: f.email,
        password: f.password,
        role: f.role,
        vendorId,
        phone: f.phone,
        locality: f.locality,
        status: 'Active',
        joined: new Date().toISOString().slice(0, 10),
        addresses: [],
      },
    ]);
    t('Registration successful. Please login');
    nav('/login');
  };
  return (
    <form className="card form" onSubmit={go}>
      <h2>Create account</h2>
      {e && (
        <p className="err" role="alert">
          {e}
        </p>
      )}
      <label>
        Account type
        <select value={f.role} onChange={u('role')}>
          <option value="customer">Customer</option>
          <option value="vendor">Vendor</option>
        </select>
      </label>
      <label>
        Name
        <input required onChange={u('name')} />
      </label>
      <label>
        Email
        <input type="email" required onChange={u('email')} />
      </label>
      <label>
        Phone
        <input required pattern="[0-9]{10}" title="10 digit number" onChange={u('phone')} />
      </label>
      <label>
        Locality
        <select value={f.locality} onChange={u('locality')}>
          {localities.map((l) => (
            <option key={l}>{l}</option>
          ))}
        </select>
      </label>
      {f.role === 'vendor' && (
        <>
          <label>
            Business name
            <input required onChange={u('biz')} />
          </label>
          <label>
            Business description
            <textarea onChange={u('desc')} />
          </label>
          <label>
            Business address
            <input onChange={u('addr')} />
          </label>
          <label>
            Product category
            <select onChange={u('cat')}>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Verification document
            <input type="file" />
          </label>
        </>
      )}
      <label>
        Password
        <input type="password" required onChange={u('password')} />
      </label>
      <label>
        Confirm password
        <input type="password" required onChange={u('confirm')} />
      </label>
      <label className="chk">
        <input type="checkbox" onChange={(x) => F({ ...f, terms: x.target.checked })} /> I accept
        the terms
      </label>
      <button className="btn">Register</button>
    </form>
  );
}
