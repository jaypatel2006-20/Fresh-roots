import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../store.jsx';
import { localities, categories } from '../data/mock.js';
import { api } from '../api/api.js';

const home = { customer: '/products', vendor: '/vendor/dashboard', admin: '/' };

export function Login() {
  const { login, t } = useApp();
  const nav = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const submit = async (event) => {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      const result = await api('/auth/login', { method: 'POST', body: form });
      login(result.user, result.token, remember);
      t(`Welcome back, ${result.user.name}.`);
      const returnTo = location.state?.from;
      const returnPath = returnTo?.pathname?.startsWith('/') && !returnTo.pathname.startsWith('//')
        ? `${returnTo.pathname}${returnTo.search || ''}${returnTo.hash || ''}`
        : home[result.user.role] || '/';
      nav(returnPath, { replace: true });
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  return <form className="card form" onSubmit={submit}><h2>Login</h2>{error && <p className="err" role="alert">{error}</p>}
    <label>Email<input type="email" required value={form.email} onChange={update('email')}/></label>
    <label>Password<input type="password" required value={form.password} onChange={update('password')}/></label>
    <label className="chk"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)}/> Remember me</label><button className="btn" disabled={busy}>{busy ? 'Logging in…' : 'Login'}</button>
    <p>New here? <Link to="/register">Create an account</Link></p>
  </form>;
}

export function Register() {
  const { t } = useApp();
  const nav = useNavigate();
  const [form, setForm] = useState({ role: 'customer', locality: 'Sion', cat: categories[0], name: '', email: '', phone: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const submit = async (event) => {
    event.preventDefault(); setError('');
    if (form.password.length < 8) return setError('Password must contain at least 8 characters.');
    if (form.password !== form.confirm) return setError('Passwords do not match.');
    if (!form.terms) return setError('Please accept the terms.');
    setBusy(true);
    const body = {
      name: form.name, email: form.email, phone: form.phone, locality: form.locality,
      password: form.password, role: form.role,
      ...(form.role === 'vendor' ? { biz: form.biz, cat: form.cat, desc: form.desc, addr: form.addr } : {}),
    };
    try {
      await api('/auth/register', { method: 'POST', body });
      t('Registration successful. Please log in.');
      nav('/login');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  return <form className="card form" onSubmit={submit}><h2>Create account</h2>{error && <p className="err" role="alert">{error}</p>}
    <label>Account type<select value={form.role} onChange={update('role')}><option value="customer">Customer</option><option value="vendor">Vendor</option></select></label>
    <label>Name<input required value={form.name} onChange={update('name')}/></label><label>Email<input type="email" required value={form.email} onChange={update('email')}/></label><label>Phone<input required pattern="[0-9]{10}" title="10 digit number" value={form.phone} onChange={update('phone')}/></label>
    <label>Locality<select value={form.locality} onChange={update('locality')}>{localities.map((locality) => <option key={locality}>{locality}</option>)}</select></label>
    {form.role === 'vendor' && <><label>Business name<input required value={form.biz || ''} onChange={update('biz')}/></label><label>Business description<textarea value={form.desc || ''} onChange={update('desc')}/></label><label>Business address<input value={form.addr || ''} onChange={update('addr')}/></label><label>Product category<select value={form.cat} onChange={update('cat')}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label></>}
    <label>Password<input type="password" required value={form.password} onChange={update('password')}/></label><label>Confirm password<input type="password" required value={form.confirm} onChange={update('confirm')}/></label>
    <label className="chk"><input type="checkbox" checked={Boolean(form.terms)} onChange={(event) => setForm((current) => ({ ...current, terms: event.target.checked }))}/> I accept the terms</label><button className="btn" disabled={busy}>{busy ? 'Creating account…' : 'Register'}</button>
  </form>;
}
