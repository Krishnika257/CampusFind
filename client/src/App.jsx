import React, { useEffect, useState } from 'react';

const API = 'http://localhost:4000/api';
const emptyItem = { title: '', description: '', category: 'Other', location: '', type: 'lost' };

function CampusFindMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path d="M24 5.5c-8.1 0-14.7 6.5-14.7 14.5 0 10.2 14.7 22.4 14.7 22.4S38.7 30.2 38.7 20C38.7 12 32.1 5.5 24 5.5Z" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinejoin="round" />
      <circle cx="24" cy="19.5" r="6.1" fill="none" stroke="currentColor" strokeWidth="3.2" />
      <path d="m32.9 28.5 8.2 8.2" fill="none" stroke="#ffe36a" strokeWidth="4.2" strokeLinecap="round" />
      <path d="m10 8 1.2 3.1L14.3 12l-3.1 1.1L10 16.2l-1.1-3.1L5.8 12l3.1-.9L10 8Z" fill="#ffe36a" />
    </svg>
  );
}

export default function App() {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('campusfind-user') || 'null'));
  const [token, setToken] = useState(() => localStorage.getItem('campusfind-token') || '');
  const [mode, setMode] = useState('login');
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
  const [itemForm, setItemForm] = useState(emptyItem);
  const [theme, setTheme] = useState(() => localStorage.getItem('campusfind-theme') || 'light');
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('all');
  const [searchFields, setSearchFields] = useState({ q: '', category: '', location: '', from: '', to: '' });
  const [message, setMessage] = useState('');

  async function loadItems() {
    try {
      const params = new URLSearchParams();
      if (filter !== 'all') params.set('type', filter);
      Object.entries(searchFields).forEach(([key, value]) => { if (value.trim()) params.set(key, value.trim()); });
      const query = params.size ? `?${params.toString()}` : '';
      const response = await fetch(`${API}/items${query}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not load listings.');
      setItems(data.items);
    } catch (error) { setMessage(error.message); }
  }

  useEffect(() => {
    const timer = setTimeout(loadItems, 250);
    return () => clearTimeout(timer);
  }, [filter, searchFields]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('campusfind-theme', theme);
  }, [theme]);

  async function submitAuth(event) {
    event.preventDefault(); setMessage('');
    try {
      const response = await fetch(`${API}/auth/${mode}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(authForm) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not sign in.');
      localStorage.setItem('campusfind-token', data.token); localStorage.setItem('campusfind-user', JSON.stringify(data.user));
      setToken(data.token); setUser(data.user); setAuthForm({ name: '', email: '', password: '' }); setMessage('You’re signed in.');
    } catch (error) { setMessage(error.message); }
  }

  async function submitItem(event) {
    event.preventDefault(); setMessage('');
    try {
      const response = await fetch(`${API}/items`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(itemForm) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not post this item.');
      setItemForm(emptyItem); setMessage('Your listing is posted.'); await loadItems();
    } catch (error) { setMessage(error.message); }
  }

  function signOut() {
    localStorage.removeItem('campusfind-token'); localStorage.removeItem('campusfind-user'); setToken(''); setUser(null); setMessage('You’ve signed out.');
  }

  return (
    <main className="page-shell">
      <div className="dashboard-frame">
        <aside className="nav-rail" aria-label="CampusFind navigation">
          <a className="rail-logo" href="/" aria-label="CampusFind home"><CampusFindMark /></a>
          <div className="rail-links"><a className="rail-link active" href="#board" aria-label="Campus board">⌂</a><a className="rail-link" href="#post" aria-label="Post an item">＋</a><a className="rail-link" href="#updates" aria-label="Updates">◷</a></div>
          <div className="rail-bottom"><span className="rail-avatar">{user?.name?.[0]?.toUpperCase() || 'G'}</span><button className="rail-link rail-exit" onClick={user ? signOut : () => { setMode('login'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} aria-label={user ? 'Sign out' : 'Sign in'}>{user ? '↗' : '→'}</button></div>
        </aside>
        <div className="dashboard-content">
          <header className="topbar">
            <a className="brand" href="/" aria-label="CampusFind home"><span className="brand-mark"><CampusFindMark /></span><span>Campus<span className="brand-accent">Find</span></span></a>
            <div className="account-area"><span className="campus-chip"><span className="campus-dot" /> JIIT · NOIDA CAMPUS</span><button className="theme-toggle" type="button" aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}><span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span></button>{user ? <><span className="welcome">Hi, {user.name}</span><button className="text-button" onClick={signOut}>Sign out</button></> : <span className="campus-label">Welcome to your campus board</span>}</div>
          </header>

          <section className="hero compact-hero" aria-labelledby="hero-title">
            <div><p className="eyebrow">YOUR CAMPUS COMMUNITY</p><h1 id="hero-title">Good things <span>find their way back.</span></h1><p className="intro">Lost something between classes? Found something on campus? Let’s reconnect it with its person.</p></div>
            <div className="hero-art" aria-hidden="true"><span className="art-spark">✦</span><div className="art-tile tile-yellow">⌕</div><div className="art-tile tile-pink">↗</div><div className="art-tile tile-blue">✳</div><div className="art-loop" /></div>
          </section>
          {message && <p className="notice" role="status">{message}</p>}

          <div className="content-grid" id="board">
            <section className="panel post-panel" id="post">
              <div className="panel-heading"><div><p className="eyebrow">QUICK ACTION</p><h2>{user ? 'Post an item' : mode === 'login' ? 'Welcome back' : 'Create your account'}</h2></div><span className="panel-icon">✎</span></div>
              {!user ? <>
                <form className="form-stack" onSubmit={submitAuth}>
                  {mode === 'register' && <label>Your name<input required maxLength="80" autoComplete="name" value={authForm.name} onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })} /></label>}
                  <label>College email<input required type="email" autoComplete="email" value={authForm.email} onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })} /></label>
                  <label>Password<input required type="password" minLength="8" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={authForm.password} onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })} /><small>At least 8 characters</small></label>
                  <button className="button button-primary full-button" type="submit">{mode === 'login' ? 'Sign in' : 'Create account'} <span aria-hidden="true">→</span></button>
                </form>
                <p className="switch-mode">{mode === 'login' ? 'New to CampusFind?' : 'Already have an account?'} <button className="text-button" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'Create an account' : 'Sign in'}</button></p>
              </> : <form className="form-stack" onSubmit={submitItem}>
                <div className="type-toggle" aria-label="Listing type">{['lost', 'found'].map((type) => <button key={type} type="button" className={itemForm.type === type ? 'selected' : ''} onClick={() => setItemForm({ ...itemForm, type })}>I {type} something</button>)}</div>
                <label>Item name<input required maxLength="100" placeholder="e.g. Blue water bottle" value={itemForm.title} onChange={(e) => setItemForm({ ...itemForm, title: e.target.value })} /></label>
                <label>Category<select value={itemForm.category} onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}>{['Electronics', 'Books', 'Clothing', 'Accessories', 'Other'].map((category) => <option key={category}>{category}</option>)}</select></label>
                <label>Location<input required maxLength="120" placeholder="e.g. Library, second floor" value={itemForm.location} onChange={(e) => setItemForm({ ...itemForm, location: e.target.value })} /></label>
                <label>Description<textarea required maxLength="1000" rows="3" placeholder="Add details that may help identify the item" value={itemForm.description} onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })} /></label>
                <button className="button button-primary full-button" type="submit">Post listing <span aria-hidden="true">→</span></button>
              </form>}
            </section>

            <section className="panel listings-panel" id="updates">
              <div className="panel-heading"><div><p className="eyebrow">HAPPENING AROUND JIIT</p><h2>Campus board</h2></div><select className="filter-select" aria-label="Filter listings" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">All items</option><option value="lost">Lost</option><option value="found">Found</option></select></div>
              <div className="search-toolbar">
                <label className="search-box"><span aria-hidden="true">⌕</span><input aria-label="Search items" placeholder="Search items or details" value={searchFields.q} onChange={(e) => setSearchFields({ ...searchFields, q: e.target.value })} /></label>
                <select className="filter-select" aria-label="Filter by category" value={searchFields.category} onChange={(e) => setSearchFields({ ...searchFields, category: e.target.value })}><option value="">All categories</option>{['Electronics', 'Books', 'Clothing', 'Accessories', 'Other'].map((category) => <option key={category}>{category}</option>)}</select>
                <input className="location-filter" aria-label="Filter by location" placeholder="Campus location" value={searchFields.location} onChange={(e) => setSearchFields({ ...searchFields, location: e.target.value })} />
                <label className="date-filter"><span>From</span><input aria-label="From date" type="date" value={searchFields.from} onChange={(e) => setSearchFields({ ...searchFields, from: e.target.value })} /></label>
                <label className="date-filter"><span>To</span><input aria-label="To date" type="date" value={searchFields.to} onChange={(e) => setSearchFields({ ...searchFields, to: e.target.value })} /></label>
                {(Object.values(searchFields).some(Boolean) || filter !== 'all') && <button className="clear-filters" onClick={() => { setSearchFields({ q: '', category: '', location: '', from: '', to: '' }); setFilter('all'); }}>Clear filters</button>}
              </div>
              <div className="board-summary"><span className="summary-bubble">✦</span><span>{items.length ? `${items.length} matching campus ${items.length === 1 ? 'listing' : 'listings'}` : 'Your community board is ready'}</span><span className="summary-arrow">↗</span></div>
              <div className="listing-list">{items.length ? items.map((item) => <article className="listing-card" key={item._id}><div className={`listing-type ${item.type}`}>{item.type === 'lost' ? 'Looking for' : 'Found on campus'}</div><h3>{item.title}</h3><p>{item.description}</p><div className="listing-meta"><span>◈ &nbsp;{item.category}</span><span>⌖ &nbsp;{item.location}</span></div><small>Shared by {item.owner?.name || 'Campus member'}</small></article>) : <div className="empty-state"><span aria-hidden="true">⌕</span><h3>{Object.values(searchFields).some(Boolean) || filter !== 'all' ? 'No matching listings' : 'It starts with our community'}</h3><p>{Object.values(searchFields).some(Boolean) || filter !== 'all' ? 'Try changing or clearing a few filters.' : 'Lost or found something? Add the first post and help it find its way home.'}</p></div>}</div>
            </section>
          </div>
          <footer>Made with care for the JIIT campus community <span aria-hidden="true">♥</span></footer>
        </div>
      </div>
    </main>
  );
}
