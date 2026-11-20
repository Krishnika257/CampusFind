import React, { useEffect, useState } from 'react';

const API = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace(/\/+$/, '');
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
  const [listingPagination, setListingPagination] = useState({ page: 1, pages: 0, total: 0, limit: 12 });
  const [listingPage, setListingPage] = useState(1);
  const [showMyListings, setShowMyListings] = useState(false);
  const [myListings, setMyListings] = useState([]);
  const [myListingsPagination, setMyListingsPagination] = useState({ page: 1, pages: 0, total: 0, limit: 12 });
  const [myListingsPage, setMyListingsPage] = useState(1);
  const [myListingsLoading, setMyListingsLoading] = useState(false);
  const [myListingsError, setMyListingsError] = useState('');
  const [showMyClaims, setShowMyClaims] = useState(false);
  const [myClaims, setMyClaims] = useState([]);
  const [myClaimsPagination, setMyClaimsPagination] = useState({ page: 1, pages: 0, total: 0, limit: 12 });
  const [myClaimsPage, setMyClaimsPage] = useState(1);
  const [myClaimsLoading, setMyClaimsLoading] = useState(false);
  const [myClaimsError, setMyClaimsError] = useState('');
  const [filter, setFilter] = useState('all');
  const [searchFields, setSearchFields] = useState({ q: '', category: '', location: '', from: '', to: '' });
  const [message, setMessage] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [editingItem, setEditingItem] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [claimProof, setClaimProof] = useState('');
  const [showClaimForm, setShowClaimForm] = useState(false);
  const [claims, setClaims] = useState([]);
  const [claimReviewNotes, setClaimReviewNotes] = useState({});
  const [matchedItems, setMatchedItems] = useState([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [threadMessages, setThreadMessages] = useState([]);
  const [messageDraft, setMessageDraft] = useState('');
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showNotificationHistory, setShowNotificationHistory] = useState(false);
  const [notificationHistory, setNotificationHistory] = useState([]);
  const [historyPagination, setHistoryPagination] = useState({ page: 1, pages: 0, total: 0 });
  const [historyFilter, setHistoryFilter] = useState('all');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [adminStats, setAdminStats] = useState(null);

  async function loadItems(page = listingPage) {
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '12');
      if (filter !== 'all') params.set('type', filter);
      Object.entries(searchFields).forEach(([key, value]) => { if (value.trim()) params.set(key, value.trim()); });
      const query = `?${params.toString()}`;
      const response = await fetch(`${API}/items${query}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not load listings.');
      setItems(data.items);
      setListingPagination(data.pagination || { page, pages: 1, total: data.items.length, limit: 12 });
      setListingPage(page);
    } catch (error) { setMessage(error.message); }
  }

  async function loadMyListings(page = 1) {
    setMyListingsLoading(true);
    setMyListingsError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: '12' });
      const response = await fetch(`${API}/my/items?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not load your listings.');
      setMyListings(data.items || []);
      setMyListingsPagination(data.pagination || { page, pages: 1, total: (data.items || []).length, limit: 12 });
      setMyListingsPage(page);
    } catch (error) { setMyListingsError(error.message); }
    finally { setMyListingsLoading(false); }
  }

  async function loadMyClaims(page = 1) {
    setMyClaimsLoading(true);
    setMyClaimsError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: '12' });
      const response = await fetch(`${API}/my/claims?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not load your claim history.');
      setMyClaims(data.claims || []);
      setMyClaimsPagination(data.pagination || { page, pages: 1, total: (data.claims || []).length, limit: 12 });
      setMyClaimsPage(page);
    } catch (error) { setMyClaimsError(error.message); }
    finally { setMyClaimsLoading(false); }
  }

  async function openMyListings() {
    setShowNotifications(false);
    setShowNotificationHistory(false);
    setShowMyClaims(false);
    setShowMyListings(true);
    await loadMyListings(1);
  }

  async function openMyClaims() {
    setShowNotifications(false);
    setShowNotificationHistory(false);
    setShowMyListings(false);
    setShowMyClaims(true);
    await loadMyClaims(1);
  }

  function returnToBoard() {
    setShowMyListings(false);
    setShowMyClaims(false);
    setShowNotificationHistory(false);
  }

  useEffect(() => {
    const timer = setTimeout(() => loadItems(listingPage), 250);
    return () => clearTimeout(timer);
  }, [filter, searchFields, listingPage]);

  useEffect(() => {
    if (user?.role === 'admin' && token) loadAdminClaims();
  }, [user?.role, token]);

  useEffect(() => {
    if (!user || !token) {
      setNotifications([]); setNotificationHistory([]); setNotificationUnreadCount(0); setAdminStats(null); setShowNotificationHistory(false); setShowMyListings(false); setMyListings([]); setShowMyClaims(false); setMyClaims([]);
      return undefined;
    }
    const refreshAccountData = () => {
      loadNotifications();
      if (user.role === 'admin') loadAdminStats();
    };
    refreshAccountData();
    const interval = setInterval(refreshAccountData, 30000);
    return () => clearInterval(interval);
  }, [user?.id, user?.role, token]);

  useEffect(() => {
    if (user && token) loadConversations();
    else { setConversations([]); setActiveConversation(null); setThreadMessages([]); }
  }, [user?.id, token]);

  useEffect(() => {
    if (!activeConversation || !token) return undefined;
    const conversationId = activeConversation._id || activeConversation.id;
    const refreshMessages = async () => {
      try {
        const response = await fetch(`${API}/conversations/${conversationId}/messages`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await response.json();
        if (response.ok) setThreadMessages(data.messages || []);
      } catch { /* Keep the current thread visible if a refresh is temporarily unavailable. */ }
    };
    const interval = setInterval(refreshMessages, 5000);
    return () => clearInterval(interval);
  }, [activeConversation?._id, activeConversation?.id, token]);

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
      setItemForm(emptyItem); setMessage('Your listing is posted.'); await loadItems(); await loadNotifications();
    } catch (error) { setMessage(error.message); }
  }

  async function showDetails(item) {
    setMessage('');
    setEditingItem(false);
    try {
      const response = await fetch(`${API}/items/${item._id}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not load listing details.');
      setSelectedItem(data.item);
      setMatchedItems([]);
      setMatchesLoading(true);
      fetch(`${API}/items/${item._id}/matches`)
        .then(async (matchResponse) => {
          const matchData = await matchResponse.json();
          if (!matchResponse.ok) throw new Error(matchData.message || 'Could not load match suggestions.');
          setMatchedItems(matchData.matches || []);
        })
        .catch(() => setMatchedItems([]))
        .finally(() => setMatchesLoading(false));
    } catch (error) { setMessage(error.message); }
  }

  function startEditing() {
    setEditForm({ title: selectedItem.title, description: selectedItem.description, category: selectedItem.category, location: selectedItem.location, type: selectedItem.type });
    setEditingItem(true);
  }

  async function saveItem(event) {
    event.preventDefault(); setMessage('');
    try {
      const response = await fetch(`${API}/items/${selectedItem._id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(editForm) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not update this listing.');
      setSelectedItem(data.item); setEditingItem(false); setMessage('Your listing was updated.'); await loadItems();
      if (showMyListings) await loadMyListings(myListingsPage);
    } catch (error) { setMessage(error.message); }
  }

  async function deleteItem() {
    if (!window.confirm('Delete this listing? This cannot be undone.')) return;
    setMessage('');
    try {
      const response = await fetch(`${API}/items/${selectedItem._id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Could not delete this listing.');
      }
      setSelectedItem(null); setMessage('Your listing was deleted.'); await loadItems();
      if (showMyListings) await loadMyListings(1);
    } catch (error) { setMessage(error.message); }
  }

  function isItemOwner(item) {
    const ownerId = item?.owner?._id || item?.owner?.id || item?.owner;
    return Boolean(user?.id && ownerId && String(ownerId) === String(user.id));
  }

  async function submitClaim(event) {
    event.preventDefault(); setMessage('');
    try {
      const response = await fetch(`${API}/items/${selectedItem._id}/claims`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ proof: claimProof }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not submit your claim.');
      setClaimProof(''); setShowClaimForm(false); setMessage('Your claim was sent to campus staff for review.');
    } catch (error) { setMessage(error.message); }
  }

  async function loadAdminClaims() {
    try {
      const response = await fetch(`${API}/admin/claims`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not load claims.');
      setClaims(data.claims);
    } catch (error) { setMessage(error.message); }
  }

  async function loadNotifications() {
    try {
      const response = await fetch(`${API}/notifications`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json();
      if (response.ok) {
        setNotifications(data.notifications || []);
        setNotificationUnreadCount(data.unreadCount || 0);
      }
    } catch { /* The board remains usable if notification refresh is temporarily unavailable. */ }
  }

  async function loadNotificationHistory(page = 1, filter = historyFilter) {
    setHistoryLoading(true);
    setHistoryError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (filter === 'unread') params.set('unread', 'true');
      const response = await fetch(`${API}/notifications?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not load notification history.');
      setNotificationHistory(data.notifications || []);
      setHistoryPagination(data.pagination || { page, pages: 1, total: (data.notifications || []).length });
      setNotificationUnreadCount(data.unreadCount || 0);
    } catch (error) { setHistoryError(error.message); }
    finally { setHistoryLoading(false); }
  }

  async function openNotificationHistory() {
    setShowNotifications(false);
    setShowMyListings(false);
    setShowMyClaims(false);
    setHistoryFilter('all');
    setShowNotificationHistory(true);
    await loadNotificationHistory(1, 'all');
  }

  async function loadAdminStats() {
    try {
      const response = await fetch(`${API}/admin/stats`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not load dashboard statistics.');
      setAdminStats(data.stats);
    } catch (error) { setMessage(error.message); }
  }

  async function openNotification(notification) {
    if (!notification.isRead) {
      try {
        const response = await fetch(`${API}/notifications/${notification._id || notification.id}/read`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } });
        if (response.ok) {
          setNotifications((current) => current.map((entry) => (entry._id || entry.id) === (notification._id || notification.id) ? { ...entry, isRead: true } : entry));
          setNotificationHistory((current) => current.map((entry) => (entry._id || entry.id) === (notification._id || notification.id) ? { ...entry, isRead: true } : entry));
          setNotificationUnreadCount((count) => Math.max(0, count - 1));
        }
      } catch { /* Keep the notification available if marking it read fails. */ }
    }
    setShowNotifications(false);
    setShowNotificationHistory(false);
    setShowMyListings(false);
    setShowMyClaims(false);
    if (notification.conversation) {
      const conversationId = notification.conversation._id || notification.conversation;
      const latestConversations = await loadConversations();
      const conversation = latestConversations.find((entry) => String(entry._id || entry.id) === String(conversationId));
      if (conversation) await openConversation(conversation);
      return;
    }
    if (notification.item?._id) showDetails(notification.item);
  }

  async function markAllNotificationsRead() {
    try {
      const response = await fetch(`${API}/notifications/read-all`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) return;
      setNotifications((current) => current.map((entry) => ({ ...entry, isRead: true })));
      setNotificationHistory((current) => current.map((entry) => ({ ...entry, isRead: true })));
      setNotificationUnreadCount(0);
      if (historyFilter === 'unread') await loadNotificationHistory(1, 'unread');
    } catch { /* Ignore a temporary notification service outage. */ }
  }

  async function reviewClaim(claimId, status, adminNotes = '') {
    setMessage('');
    try {
      const response = await fetch(`${API}/admin/claims/${claimId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ status, adminNotes }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not update this claim.');
      setClaimReviewNotes((current) => { const next = { ...current }; delete next[claimId]; return next; });
      setMessage(`Claim ${status}.`); await loadAdminClaims(); await loadAdminStats(); await loadItems();
    } catch (error) { setMessage(error.message); }
  }

  async function loadConversations() {
    try {
      const response = await fetch(`${API}/conversations`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not load messages.');
      setConversations(data.conversations || []);
      return data.conversations || [];
    } catch (error) { setMessage(error.message); return []; }
  }

  async function openConversation(conversation) {
    const conversationId = conversation._id || conversation.id;
    setActiveConversation(conversation);
    setMessagesLoading(true);
    try {
      const response = await fetch(`${API}/conversations/${conversationId}/messages`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not load this conversation.');
      setThreadMessages(data.messages || []);
    } catch (error) { setMessage(error.message); }
    finally { setMessagesLoading(false); }
  }

  async function startConversation(item) {
    if (!user || !token) { setMessage('Sign in to message the person who posted this item.'); return; }
    try {
      const response = await fetch(`${API}/items/${item._id}/conversations`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not start a conversation.');
      const conversationId = data.conversation._id || data.conversation.id;
      const updated = await loadConversations();
      const conversation = updated.find((entry) => String(entry._id || entry.id) === String(conversationId)) || data.conversation;
      setSelectedItem(null);
      await openConversation(conversation);
    } catch (error) { setMessage(error.message); }
  }

  async function sendMessage(event) {
    event.preventDefault();
    const text = messageDraft.trim();
    if (!text || !activeConversation) return;
    const conversationId = activeConversation._id || activeConversation.id;
    try {
      const response = await fetch(`${API}/conversations/${conversationId}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ text }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not send your message.');
      setThreadMessages((current) => [...current, data.message]);
      setMessageDraft('');
      await loadConversations();
    } catch (error) { setMessage(error.message); }
  }

  function otherParticipantName(conversation) {
    const other = conversation.participants?.find((participant) => String(participant?._id || participant?.id || participant) !== String(user?.id));
    return other?.name || 'Campus member';
  }

  function isOwnMessage(entry) {
    const senderId = entry.sender?._id || entry.sender?.id || entry.sender;
    return String(senderId) === String(user?.id);
  }

  function signOut() {
    localStorage.removeItem('campusfind-token'); localStorage.removeItem('campusfind-user'); setToken(''); setUser(null); setMessage('You’ve signed out.');
  }

  return (
    <main className="page-shell">
      <div className="dashboard-frame">
        <aside className="nav-rail" aria-label="CampusFind navigation">
          <a className="rail-logo" href="/" aria-label="CampusFind home"><CampusFindMark /></a>
          <div className="rail-links"><a className={`rail-link ${!showMyListings && !showMyClaims && !showNotificationHistory ? 'active' : ''}`} href="#board" onClick={returnToBoard} aria-label="Campus board">⌂</a><a className="rail-link" href="#post" onClick={returnToBoard} aria-label="Post an item">＋</a><a className="rail-link" href="#updates" onClick={returnToBoard} aria-label="Updates">◷</a>{user && <><button className={`rail-link ${showMyListings ? 'active' : ''}`} type="button" onClick={openMyListings} aria-label="My listings">▤</button><button className={`rail-link ${showMyClaims ? 'active' : ''}`} type="button" onClick={openMyClaims} aria-label="My claims">✓</button><a className="rail-link" href="#messages" onClick={returnToBoard} aria-label="Messages">✉</a></>}</div>
          <div className="rail-bottom"><span className="rail-avatar">{user?.name?.[0]?.toUpperCase() || 'G'}</span><button className="rail-link rail-exit" onClick={user ? signOut : () => { setMode('login'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} aria-label={user ? 'Sign out' : 'Sign in'}>{user ? '↗' : '→'}</button></div>
        </aside>
        <div className="dashboard-content">
          <header className="topbar">
            <a className="brand" href="/" aria-label="CampusFind home"><span className="brand-mark"><CampusFindMark /></span><span>Campus<span className="brand-accent">Find</span></span></a>
            <div className="account-area"><span className="campus-chip"><span className="campus-dot" /> JIIT · NOIDA CAMPUS</span>{user && <div className="notification-area"><button className="notification-toggle" type="button" aria-label={`Notifications, ${notificationUnreadCount} unread`} aria-expanded={showNotifications} onClick={() => setShowNotifications((visible) => !visible)}><span aria-hidden="true">🔔</span>{notificationUnreadCount > 0 && <i aria-hidden="true" />}</button>{showNotifications && <section className="notification-popover" aria-label="Notifications"><div className="notification-popover-heading"><strong>Notifications</strong>{notificationUnreadCount > 0 && <button type="button" onClick={markAllNotificationsRead}>Mark all read</button>}</div>{notifications.length ? notifications.slice(0, 8).map((notification) => <button className={`notification-row ${notification.isRead ? '' : 'unread'}`} type="button" key={notification._id || notification.id} onClick={() => openNotification(notification)}><span className="notification-symbol" aria-hidden="true">{notification.type === 'match' ? '⌕' : notification.type === 'message' ? '✉' : '✓'}</span><span><strong>{notification.title}</strong><small>{notification.message}</small></span></button>) : <p className="notification-empty">You’re all caught up.</p>}<button className="notification-history-link" type="button" onClick={openNotificationHistory}>View notification history <span aria-hidden="true">→</span></button></section>}</div>}<button className="theme-toggle" type="button" aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}><span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span></button>{user ? <><span className="welcome">Hi, {user.name}</span><button className="text-button" onClick={signOut}>Sign out</button></> : <span className="campus-label">Welcome to your campus board</span>}</div>
          </header>

          <section className="hero compact-hero" aria-labelledby="hero-title">
            <div><p className="eyebrow">YOUR CAMPUS COMMUNITY</p><h1 id="hero-title">Good things <span>find their way back.</span></h1><p className="intro">Lost something between classes? Found something on campus? Let’s reconnect it with its person.</p></div>
            <div className="hero-art"><img src="/lost-found-illustration-transparent.png" alt="A box holding books and an umbrella, labeled Lost & Found" /></div>
          </section>
          {message && <p className="notice" role="status">{message}</p>}

          <div className={showNotificationHistory || showMyListings || showMyClaims ? 'dashboard-main-view is-hidden' : 'dashboard-main-view'}>
          <div className="content-grid" id="board">
            <section className="panel post-panel" id="post">
              <div className="panel-heading"><div><p className="eyebrow">QUICK ACTION</p><h2>{user ? 'Post an item' : mode === 'login' ? 'Welcome back' : 'Create your account'}</h2></div><span className="panel-icon">✎</span></div>
              {!user ? <>
                <form className="form-stack" onSubmit={submitAuth}>
                  {mode === 'register' && <label>Your name<input required maxLength="80" autoComplete="name" value={authForm.name} onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })} /></label>}
                  <label>College email<input required type="email" maxLength="254" autoComplete="email" value={authForm.email} onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })} /></label>
                  <label>Password<input required type="password" minLength="8" maxLength="72" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={authForm.password} onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })} /><small>8 characters minimum; 72 bytes maximum</small></label>
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
              <div className="panel-heading"><div><p className="eyebrow">HAPPENING AROUND JIIT</p><h2>Campus board</h2></div><select className="filter-select" aria-label="Filter listings" value={filter} onChange={(e) => { setListingPage(1); setFilter(e.target.value); }}><option value="all">All items</option><option value="lost">Lost</option><option value="found">Found</option></select></div>
              <div className="search-toolbar">
                <label className="search-box"><span aria-hidden="true">⌕</span><input aria-label="Search items" placeholder="Search items or details" value={searchFields.q} onChange={(e) => { setListingPage(1); setSearchFields({ ...searchFields, q: e.target.value }); }} /></label>
                <select className="filter-select" aria-label="Filter by category" value={searchFields.category} onChange={(e) => { setListingPage(1); setSearchFields({ ...searchFields, category: e.target.value }); }}><option value="">All categories</option>{['Electronics', 'Books', 'Clothing', 'Accessories', 'Other'].map((category) => <option key={category}>{category}</option>)}</select>
                <input className="location-filter" aria-label="Filter by location" placeholder="Campus location" value={searchFields.location} onChange={(e) => { setListingPage(1); setSearchFields({ ...searchFields, location: e.target.value }); }} />
                <label className="date-filter"><span>From</span><input aria-label="From date" type="date" value={searchFields.from} onChange={(e) => { setListingPage(1); setSearchFields({ ...searchFields, from: e.target.value }); }} /></label>
                <label className="date-filter"><span>To</span><input aria-label="To date" type="date" value={searchFields.to} onChange={(e) => { setListingPage(1); setSearchFields({ ...searchFields, to: e.target.value }); }} /></label>
                {(Object.values(searchFields).some(Boolean) || filter !== 'all') && <button className="clear-filters" onClick={() => { setListingPage(1); setSearchFields({ q: '', category: '', location: '', from: '', to: '' }); setFilter('all'); }}>Clear filters</button>}
              </div>
              <div className="board-summary"><span className="summary-bubble">✦</span><span>{listingPagination.total ? `${listingPagination.total} matching campus ${listingPagination.total === 1 ? 'listing' : 'listings'}` : 'Your community board is ready'}</span><span className="summary-arrow">↗</span></div>
              <div className="listing-list">{items.length ? items.map((item) => <article className="listing-card" key={item._id}><div className={`listing-type ${item.type}`}>{item.type === 'lost' ? 'Looking for' : 'Found on campus'}</div><h3>{item.title}</h3><p>{item.description}</p><div className="listing-meta"><span>◈ &nbsp;{item.category}</span><span>⌖ &nbsp;{item.location}</span></div><div className="listing-card-footer"><small>Shared by {item.owner?.name || 'Campus member'}</small><button className="details-link" type="button" onClick={() => showDetails(item)}>View details <span aria-hidden="true">→</span></button></div></article>) : <div className="empty-state"><span aria-hidden="true">⌕</span><h3>{Object.values(searchFields).some(Boolean) || filter !== 'all' ? 'No matching listings' : 'It starts with our community'}</h3><p>{Object.values(searchFields).some(Boolean) || filter !== 'all' ? 'Try changing or clearing a few filters.' : 'Lost or found something? Add the first post and help it find its way home.'}</p></div>}</div>
              {listingPagination.pages > 1 && <nav className="listing-pagination" aria-label="Campus board pages"><button className="button button-secondary" type="button" aria-label="Previous listings" disabled={listingPage <= 1} onClick={() => setListingPage((page) => page - 1)}>Previous</button><span aria-live="polite">Page {listingPage} of {listingPagination.pages}</span><button className="button button-secondary" type="button" aria-label="Next listings" disabled={listingPage >= listingPagination.pages} onClick={() => setListingPage((page) => page + 1)}>Next</button></nav>}
            </section>
          </div>
          {user?.role === 'admin' && <section className="admin-dashboard" id="admin-dashboard">
            <div className="admin-dashboard-heading"><div><p className="eyebrow">CAMPUS OVERVIEW</p><h2>Admin dashboard</h2></div><span className="dashboard-caption">Live counts from CampusFind</span></div>
            <div className="admin-stat-grid">{[
              ['Total listings', adminStats?.totalItems, 'Across lost and found'],
              ['Open lost', adminStats?.openLost, 'Waiting to be found'],
              ['Open found', adminStats?.openFound, 'Waiting to be claimed'],
              ['Returned', adminStats?.returnedItems, 'Marked as claimed'],
              ['Pending claims', adminStats?.pendingClaims, 'Need staff review'],
              ['Campus members', adminStats?.totalUsers, 'Registered accounts'],
              ['Claim approval rate', adminStats ? `${adminStats.claimApprovalRate}%` : undefined, `${adminStats?.approvedClaims || 0} approved · ${adminStats?.rejectedClaims || 0} rejected`],
            ].map(([label, value, caption]) => <article className="admin-stat-card" key={label}><span>{label}</span><strong>{value ?? '—'}</strong><small>{caption}</small></article>)}</div>
          </section>}
          {user?.role === 'admin' && <section className="panel admin-claims" id="admin-claims">
            <div className="panel-heading"><div><p className="eyebrow">STAFF REVIEW</p><h2>Pending ownership claims</h2></div><span className="admin-count">{claims.length}</span></div>
            {claims.length ? <div className="claim-list">{claims.map((claim) => <article className="claim-card" key={claim._id}>
              <div className="claim-card-heading"><div><h3>{claim.item?.title || 'Campus item'}</h3><p>{claim.item?.location || 'Location not listed'} · Claimed by {claim.claimant?.name || 'Campus member'}</p></div><span className="pending-pill">Pending review</span></div>
              <p className="claim-proof">{claim.proof}</p>
              <label className="claim-review-note">Staff note for {claim.item?.title || 'Campus item'}<textarea aria-label={`Staff note for ${claim.item?.title || 'Campus item'}`} maxLength="500" rows="2" placeholder="Optional note visible to the claimant" value={claimReviewNotes[claim._id] || ''} onChange={(event) => setClaimReviewNotes((current) => ({ ...current, [claim._id]: event.target.value }))} /><small>{(claimReviewNotes[claim._id] || '').length}/500 characters · shown in My Claims</small></label>
              <div className="claim-review-actions"><button className="button button-secondary reject-button" type="button" onClick={() => reviewClaim(claim._id, 'rejected', claimReviewNotes[claim._id] || '')}>Reject claim</button><button className="button button-primary" type="button" onClick={() => reviewClaim(claim._id, 'approved', claimReviewNotes[claim._id] || '')}>Approve &amp; mark returned</button></div>
            </article>)}</div> : <div className="empty-state admin-empty"><span aria-hidden="true">✓</span><h3>All caught up</h3><p>New ownership claims will appear here for staff review.</p></div>}
          </section>}
          {user && <section className="panel messages-panel" id="messages">
            <div className="panel-heading"><div><p className="eyebrow">PRIVATE CAMPUS CHATS</p><h2>Your messages</h2></div><span className="panel-icon">✉</span></div>
            {conversations.length ? <div className="conversation-list">{conversations.map((conversation) => <button className="conversation-row" key={conversation._id || conversation.id} type="button" onClick={() => openConversation(conversation)}>
              <span className="conversation-avatar">{otherParticipantName(conversation)[0]?.toUpperCase() || 'C'}</span><span className="conversation-copy"><strong>{conversation.item?.title || 'Campus item'}</strong><small>Chat with {otherParticipantName(conversation)}</small><span>{conversation.lastMessage || 'Start the conversation'}</span></span><span className="conversation-arrow" aria-hidden="true">→</span>
            </button>)}</div> : <div className="empty-state messages-empty"><span aria-hidden="true">✉</span><h3>No conversations yet</h3><p>Open a listing and choose “Message poster” to privately contact its owner.</p></div>}
          </section>}
          </div>
          {showMyClaims && user && <section className="panel my-claims-page" aria-labelledby="my-claims-title">
            <button className="history-back-button" type="button" onClick={returnToBoard}>← Back to campus board</button>
            <div className="my-claims-heading"><div><p className="eyebrow">OWNERSHIP REQUESTS</p><h2 id="my-claims-title">My claims</h2><p>Track each claim and read the campus staff’s review notes.</p></div><div className="my-listings-heading-actions"><span className="my-listings-count">{myClaimsPagination.total} total</span><button className="button button-secondary" type="button" onClick={() => loadMyClaims(myClaimsPage)} disabled={myClaimsLoading}>Refresh</button></div></div>
            {myClaimsError && <p className="notice" role="alert">{myClaimsError}</p>}
            {myClaimsLoading ? <p className="history-loading">Loading your claims…</p> : myClaims.length ? <div className="my-claims-list">{myClaims.map((claim) => <article className="my-claim-card" key={claim._id || claim.id}>
              <div className="my-claim-heading"><div><p className="eyebrow">{claim.item?.type === 'lost' ? 'LOST ITEM' : 'FOUND ITEM'}</p><h3>{claim.item?.title || 'Campus item'}</h3><span>{claim.item?.location || 'Location not listed'}</span></div><span className={`claim-status-pill ${claim.status}`}>{claim.status === 'approved' ? 'Approved' : claim.status === 'rejected' ? 'Not approved' : 'Pending review'}</span></div>
              <div className="my-claim-proof"><strong>Your proof</strong><p>{claim.proof}</p></div>
              {claim.adminNotes && <div className="my-claim-notes"><strong>Staff note</strong><p>{claim.adminNotes}</p></div>}
              <div className="my-claim-footer"><small>{claim.reviewedAt ? `Reviewed ${new Date(claim.reviewedAt).toLocaleDateString()}` : claim.createdAt ? `Submitted ${new Date(claim.createdAt).toLocaleDateString()}` : 'Submitted recently'}</small>{claim.item && <button className="details-link" type="button" onClick={() => showDetails(claim.item)}>View listing <span aria-hidden="true">→</span></button>}</div>
            </article>)}</div> : <div className="empty-state my-claims-empty"><span aria-hidden="true">✓</span><h3>No claims submitted</h3><p>If you recognize something on the found items board, submit an ownership claim and track the review here.</p><button className="button button-primary" type="button" onClick={returnToBoard}>Browse found items</button></div>}
            {!myClaimsLoading && myClaimsPagination.pages > 1 && <nav className="listing-pagination" aria-label="My claims pages"><button className="button button-secondary" type="button" aria-label="Previous my claims" disabled={myClaimsPage <= 1} onClick={() => loadMyClaims(myClaimsPage - 1)}>Previous</button><span aria-live="polite">Page {myClaimsPage} of {myClaimsPagination.pages}</span><button className="button button-secondary" type="button" aria-label="Next my claims" disabled={myClaimsPage >= myClaimsPagination.pages} onClick={() => loadMyClaims(myClaimsPage + 1)}>Next</button></nav>}
          </section>}
          {showMyListings && user && <section className="panel my-listings-page" aria-labelledby="my-listings-title">
            <button className="history-back-button" type="button" onClick={returnToBoard}>← Back to campus board</button>
            <div className="my-listings-heading"><div><p className="eyebrow">YOUR CAMPUS POSTS</p><h2 id="my-listings-title">My listings</h2><p>Keep track of items you posted, including those already returned.</p></div><div className="my-listings-heading-actions"><span className="my-listings-count">{myListingsPagination.total} total</span><button className="button button-secondary" type="button" onClick={() => loadMyListings(myListingsPage)} disabled={myListingsLoading}>Refresh</button></div></div>
            {myListingsError && <p className="notice" role="alert">{myListingsError}</p>}
            {myListingsLoading ? <p className="history-loading">Loading your listings…</p> : myListings.length ? <div className="my-listings-list">{myListings.map((item) => <article className="my-listing-card" key={item._id || item.id}>
              <div className="my-listing-card-heading"><div><span className={`listing-type ${item.type}`}>{item.type === 'lost' ? 'Looking for' : 'Found on campus'}</span><h3>{item.title}</h3></div><span className={`my-listing-status ${item.status === 'claimed' ? 'returned' : 'open'}`}>{item.status === 'claimed' ? 'Returned' : 'Open'}</span></div>
              <p>{item.description}</p><div className="my-listing-meta"><span>{item.category}</span><span>{item.location}</span><span>{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'Recently posted'}</span></div>
              <div className="my-listing-footer"><small>{item.status === 'claimed' ? 'This listing was marked as returned.' : 'Visible on the campus board.'}</small><button className="details-link" type="button" onClick={() => showDetails(item)}>View details and manage <span aria-hidden="true">→</span></button></div>
            </article>)}</div> : <div className="empty-state my-listings-empty"><span aria-hidden="true">▤</span><h3>No listings yet</h3><p>Listings you post will appear here so you can manage them later.</p><button className="button button-primary" type="button" onClick={() => { returnToBoard(); window.location.hash = 'post'; }}>Post an item</button></div>}
            {!myListingsLoading && myListingsPagination.pages > 1 && <nav className="listing-pagination" aria-label="My listings pages"><button className="button button-secondary" type="button" aria-label="Previous my listings" disabled={myListingsPage <= 1} onClick={() => loadMyListings(myListingsPage - 1)}>Previous</button><span aria-live="polite">Page {myListingsPage} of {myListingsPagination.pages}</span><button className="button button-secondary" type="button" aria-label="Next my listings" disabled={myListingsPage >= myListingsPagination.pages} onClick={() => loadMyListings(myListingsPage + 1)}>Next</button></nav>}
          </section>}
          {showNotificationHistory && user && <section className="panel notification-history-page" aria-labelledby="notification-history-title">
            <button className="history-back-button" type="button" onClick={() => setShowNotificationHistory(false)}>← Back to campus board</button>
            <div className="notification-history-heading"><div><p className="eyebrow">YOUR UPDATES</p><h2 id="notification-history-title">Notification history</h2><p>All your match, claim, and message updates in one place.</p></div><button className="button button-secondary" type="button" disabled={notificationUnreadCount === 0} onClick={markAllNotificationsRead}>Mark all read</button></div>
            <div className="notification-history-toolbar"><div className="history-filter-tabs" role="group" aria-label="Filter notification history"><button type="button" className={historyFilter === 'all' ? 'selected' : ''} onClick={() => { setHistoryFilter('all'); loadNotificationHistory(1, 'all'); }}>All</button><button type="button" className={historyFilter === 'unread' ? 'selected' : ''} onClick={() => { setHistoryFilter('unread'); loadNotificationHistory(1, 'unread'); }}>Unread <span>{notificationUnreadCount}</span></button></div><small>{historyPagination.total} notification{historyPagination.total === 1 ? '' : 's'}</small></div>
            {historyError && <p className="notice" role="alert">{historyError}</p>}
            {historyLoading ? <p className="history-loading">Loading notifications…</p> : notificationHistory.length ? <div className="notification-history-list">{notificationHistory.map((notification) => <button className={`history-notification ${notification.isRead ? '' : 'unread'}`} type="button" key={notification._id || notification.id} onClick={() => openNotification(notification)}>
              <span className="history-notification-icon" aria-hidden="true">{notification.type === 'match' ? '⌕' : notification.type === 'message' ? '✉' : '✓'}</span><span className="history-notification-copy"><span className="history-notification-title"><strong>{notification.title}</strong>{!notification.isRead && <i>New</i>}</span><span>{notification.message}</span><small>{notification.createdAt ? new Date(notification.createdAt).toLocaleString() : 'Recently'}</small></span><span className="history-notification-arrow" aria-hidden="true">→</span>
            </button>)}</div> : <div className="empty-state history-empty"><span aria-hidden="true">✓</span><h3>{historyFilter === 'unread' ? 'No unread notifications' : 'No notifications yet'}</h3><p>{historyFilter === 'unread' ? 'You’re all caught up.' : 'Match, claim, and message updates will appear here.'}</p></div>}
            {historyPagination.pages > 1 && <div className="history-pagination"><button className="button button-secondary" type="button" disabled={historyLoading || historyPagination.page <= 1} onClick={() => loadNotificationHistory(historyPagination.page - 1)}>Previous</button><span>Page {historyPagination.page} of {historyPagination.pages}</span><button className="button button-secondary" type="button" disabled={historyLoading || historyPagination.page >= historyPagination.pages} onClick={() => loadNotificationHistory(historyPagination.page + 1)}>Next</button></div>}
          </section>}
          {selectedItem && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedItem(null); }}>
            <section className="item-dialog" role="dialog" aria-modal="true" aria-labelledby="item-dialog-title">
              <div className="dialog-heading"><div><span className={`listing-type ${selectedItem.type}`}>{selectedItem.type === 'lost' ? 'Looking for' : 'Found on campus'}</span><p className="dialog-kicker">CAMPUS LISTING</p></div><button className="dialog-close" type="button" aria-label="Close details" onClick={() => setSelectedItem(null)}>×</button></div>
              {editingItem ? <form className="form-stack edit-form" onSubmit={saveItem}>
                <label>Item name<input required maxLength="100" value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} /></label>
                <label>Type<select value={editForm.type} onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}><option value="lost">Lost</option><option value="found">Found</option></select></label>
                <label>Category<select value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}>{['Electronics', 'Books', 'Clothing', 'Accessories', 'Other'].map((category) => <option key={category}>{category}</option>)}</select></label>
                <label>Location<input required maxLength="120" value={editForm.location} onChange={(e) => setEditForm({ ...editForm, location: e.target.value })} /></label>
                <label>Description<textarea required maxLength="1000" rows="4" value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} /></label>
                <div className="dialog-actions"><button className="button button-secondary" type="button" onClick={() => setEditingItem(false)}>Cancel</button><button className="button button-primary" type="submit">Save changes</button></div>
              </form> : <>
                <h2 id="item-dialog-title" className="item-dialog-title">{selectedItem.title}</h2>
                <p className="item-dialog-description">{selectedItem.description}</p>
                <div className="item-detail-grid"><div><span>Category</span><strong>{selectedItem.category}</strong></div><div><span>Location</span><strong>{selectedItem.location}</strong></div><div><span>Posted by</span><strong>{selectedItem.owner?.name || 'Campus member'}</strong></div><div><span>Date posted</span><strong>{selectedItem.createdAt ? new Date(selectedItem.createdAt).toLocaleDateString() : 'Recently'}</strong></div></div>
                <section className="match-suggestions" aria-label="Possible matching listings">
                  <div className="match-heading"><h3>Possible matches</h3><span>Opposite listing type</span></div>
                  {matchesLoading ? <p className="match-empty">Looking for similar items…</p> : matchedItems.length ? <div className="match-list">{matchedItems.map(({ item, score, reasons }) => <article className="match-card" key={item._id}>
                    <div><span className={`listing-type ${item.type}`}>{item.type === 'lost' ? 'Looking for' : 'Found on campus'}</span><h4>{item.title}</h4><p>{item.category} · {item.location}</p><small>{reasons.join(' · ')}</small><button className="match-view-button" type="button" aria-label={`View listing: ${item.title}`} onClick={() => showDetails(item)}>View listing <span aria-hidden="true">→</span></button></div><span className="match-score" title="Similarity score">{score}%</span>
                  </article>)}</div> : <p className="match-empty">No close matches yet. We’ll show suggestions as similar listings are posted.</p>}
                </section>
                {user && selectedItem.type === 'found' && selectedItem.status === 'open' && !isItemOwner(selectedItem) && <div className="claim-action">
                  {showClaimForm ? <form className="form-stack" onSubmit={submitClaim}><label>Proof of ownership<textarea required minLength="20" maxLength="1000" rows="4" placeholder="Describe a detail only the owner would know" value={claimProof} onChange={(e) => setClaimProof(e.target.value)} /><small>Share specific details to help campus staff verify your claim.</small></label><div className="dialog-actions"><button className="button button-secondary" type="button" onClick={() => setShowClaimForm(false)}>Cancel</button><button className="button button-primary" type="submit">Send claim</button></div></form> : <button className="button button-primary claim-button" type="button" onClick={() => setShowClaimForm(true)}>This is mine — submit a claim</button>}
                </div>}
                {user && selectedItem.status === 'open' && !isItemOwner(selectedItem) && <button className="button button-secondary message-poster-button" type="button" onClick={() => startConversation(selectedItem)}>Message poster</button>}
                {!user && selectedItem.status === 'open' && <p className="sign-in-claim-note">Sign in to privately message the person who posted this item.</p>}
                {!user && selectedItem.type === 'found' && <p className="sign-in-claim-note">Sign in to submit an ownership claim.</p>}
                {isItemOwner(selectedItem) && <div className="dialog-actions owner-actions"><button className="button button-secondary" type="button" onClick={deleteItem}>Delete listing</button><button className="button button-primary" type="button" onClick={startEditing}>Edit listing</button></div>}
              </>}
            </section>
          </div>}
          {activeConversation && <div className="modal-backdrop message-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setActiveConversation(null); }}>
            <section className="message-dialog" role="dialog" aria-modal="true" aria-labelledby="message-dialog-title">
              <div className="dialog-heading"><div><p className="dialog-kicker">PRIVATE CONVERSATION</p><h2 id="message-dialog-title">{activeConversation.item?.title || 'Campus item'}</h2><span>Chat with {otherParticipantName(activeConversation)}</span></div><button className="dialog-close" type="button" aria-label="Close conversation" onClick={() => setActiveConversation(null)}>×</button></div>
              <div className="thread-messages" aria-live="polite">{messagesLoading ? <p className="match-empty">Loading messages…</p> : threadMessages.length ? threadMessages.map((entry) => <article className={`message-bubble ${isOwnMessage(entry) ? 'own-message' : ''}`} key={entry._id || entry.id}><p>{entry.text}</p><small>{isOwnMessage(entry) ? 'You' : entry.sender?.name || 'Campus member'} · {entry.createdAt ? new Date(entry.createdAt).toLocaleString() : 'Just now'}</small></article>) : <div className="empty-state thread-empty"><span aria-hidden="true">✉</span><h3>Start the conversation</h3><p>Keep your contact details private while arranging the return.</p></div>}</div>
              <form className="message-compose" onSubmit={sendMessage}><textarea aria-label="Write a message" required maxLength="1000" rows="2" placeholder="Write a private message…" value={messageDraft} onChange={(event) => setMessageDraft(event.target.value)} /><button className="button button-primary" type="submit" disabled={!messageDraft.trim()}>Send</button></form>
            </section>
          </div>}
          <footer>Made with care for the JIIT campus community <span aria-hidden="true">♥</span></footer>
        </div>
      </div>
    </main>
  );
}
