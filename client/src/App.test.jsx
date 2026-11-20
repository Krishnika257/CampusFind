import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from './App.jsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  vi.unstubAllGlobals();
});

describe('CampusFind board', () => {
  it('renders the campus board and an empty state', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [] }) }));
    render(<App />);

    expect(screen.getByRole('heading', { name: /Good things find their way back/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Search items' })).toBeInTheDocument();
    expect(await screen.findByText('It starts with our community')).toBeInTheDocument();
  });

  it('sends keyword and category filters to the API', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [] }) });
    vi.stubGlobal('fetch', fetchMock);
    render(<App />);

    fireEvent.change(screen.getByRole('textbox', { name: 'Search items' }), { target: { value: 'blue bottle' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Filter by category' }), { target: { value: 'Electronics' } });

    await waitFor(() => {
      const urls = fetchMock.mock.calls.map(([url]) => String(url));
      expect(urls.some((url) => url.includes('q=blue+bottle') && url.includes('category=Electronics'))).toBe(true);
    });
  });

  it('clears all search filters when requested', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [] }) }));
    render(<App />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Search items' }), { target: { value: 'wallet' } });
    const clear = await screen.findByRole('button', { name: 'Clear filters' });
    fireEvent.click(clear);
    expect(screen.getByRole('textbox', { name: 'Search items' })).toHaveValue('');
    expect(screen.getByRole('combobox', { name: 'Filter by category' })).toHaveValue('');
  });

  it('paginates campus listings and returns to the first page when filters change', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url) => {
      const parsed = new URL(String(url), 'http://localhost');
      if (parsed.pathname.endsWith('/items')) {
        const page = Number(parsed.searchParams.get('page'));
        const title = page === 2 ? 'Listing on page two' : 'Listing on page one';
        return { ok: true, json: async () => ({ items: [{ _id: `item-${page}`, title, description: 'Campus item description', type: 'lost', category: 'Other', location: 'Library', owner: { name: 'Riley' } }], pagination: { page, limit: 12, total: 13, pages: 2 } }) };
      }
      return { ok: true, json: async () => ({ items: [] }) };
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Listing on page one' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next listings' }));
    expect(await screen.findByRole('heading', { name: 'Listing on page two' })).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: 'Filter by category' }), { target: { value: 'Electronics' } });
    expect(await screen.findByRole('heading', { name: 'Listing on page one' })).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('page=1&limit=12&category=Electronics')));
  });

  it('shows the signed-in user’s open and returned listings in My Listings', async () => {
    localStorage.setItem('campusfind-user', JSON.stringify({ id: 'owner-1', name: 'Riley', role: 'student' }));
    localStorage.setItem('campusfind-token', 'student-token');
    const ownedListings = [
      { _id: 'open-item', title: 'Blue keys', description: 'Lost near the library', category: 'Accessories', location: 'Library', type: 'lost', status: 'open', owner: { _id: 'owner-1', name: 'Riley' } },
      { _id: 'returned-item', title: 'Returned wallet', description: 'Found at the cafe', category: 'Accessories', location: 'Cafe', type: 'found', status: 'claimed', owner: { _id: 'owner-1', name: 'Riley' } },
    ];
    const fetchMock = vi.fn().mockImplementation(async (url) => {
      const parsed = new URL(String(url), 'http://localhost');
      if (parsed.pathname.endsWith('/my/items')) return { ok: true, json: async () => ({ items: ownedListings, pagination: { page: 1, limit: 12, total: 2, pages: 1 } }) };
      if (parsed.pathname.endsWith('/items/returned-item/matches')) return { ok: true, json: async () => ({ matches: [] }) };
      if (parsed.pathname.endsWith('/items/returned-item')) return { ok: true, json: async () => ({ item: ownedListings[1] }) };
      if (parsed.pathname.endsWith('/items')) return { ok: true, json: async () => ({ items: [], pagination: { page: 1, limit: 12, total: 0, pages: 0 } }) };
      if (parsed.pathname.endsWith('/notifications')) return { ok: true, json: async () => ({ notifications: [], unreadCount: 0 }) };
      return { ok: true, json: async () => ({ conversations: [] }) };
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'My listings' }));
    expect(await screen.findByRole('heading', { name: 'My listings' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Blue keys' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Returned wallet' })).toBeInTheDocument();
    expect(screen.getByText('Returned', { selector: '.my-listing-status' })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: /View details and manage/ })[1]);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit listing' })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/my/items?page=1&limit=12'), expect.objectContaining({ headers: { Authorization: 'Bearer student-token' } }));
  });

  it('lets a student track claim decisions and staff notes in My Claims', async () => {
    localStorage.setItem('campusfind-user', JSON.stringify({ id: 'claimant-1', name: 'Riley', role: 'student' }));
    localStorage.setItem('campusfind-token', 'student-token');
    const claimHistory = [
      { _id: 'claim-pending', status: 'pending', proof: 'There is a small scratch beneath the handle.', item: { _id: 'found-pending', title: 'Green umbrella', type: 'found', location: 'Cafe' } },
      { _id: 'claim-rejected', status: 'rejected', proof: 'A unique mark is inside the cover.', adminNotes: 'Please provide another identifying detail.', item: { _id: 'found-rejected', title: 'Blue notebook', type: 'found', location: 'Library' } },
    ];
    const fetchMock = vi.fn().mockImplementation(async (url) => {
      const parsed = new URL(String(url), 'http://localhost');
      if (parsed.pathname.endsWith('/my/claims')) return { ok: true, json: async () => ({ claims: claimHistory, pagination: { page: 1, limit: 12, total: 2, pages: 1 } }) };
      if (parsed.pathname.endsWith('/items')) return { ok: true, json: async () => ({ items: [], pagination: { page: 1, limit: 12, total: 0, pages: 0 } }) };
      if (parsed.pathname.endsWith('/notifications')) return { ok: true, json: async () => ({ notifications: [], unreadCount: 0 }) };
      return { ok: true, json: async () => ({ conversations: [] }) };
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'My claims' }));
    expect(await screen.findByRole('heading', { name: 'My claims' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Green umbrella' })).toBeInTheDocument();
    expect(screen.getByText('Pending review')).toBeInTheDocument();
    expect(screen.getByText('Not approved')).toBeInTheDocument();
    expect(screen.getByText('Please provide another identifying detail.')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/my/claims?page=1&limit=12'), expect.objectContaining({ headers: { Authorization: 'Bearer student-token' } }));
  });

  it('toggles dark mode and remembers the selected theme', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [] }) }));
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Switch to dark mode' }));
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(localStorage.getItem('campusfind-theme')).toBe('dark');
    expect(screen.getByRole('button', { name: 'Switch to light mode' })).toBeInTheDocument();
  });

  it('restores a saved dark theme on startup', async () => {
    localStorage.setItem('campusfind-theme', 'dark');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [] }) }));
    render(<App />);

    await waitFor(() => expect(document.documentElement).toHaveAttribute('data-theme', 'dark'));
    expect(screen.getByRole('button', { name: 'Switch to light mode' })).toBeInTheDocument();
  });

  it('shows item details to visitors without owner controls', async () => {
    const listedItem = { _id: 'item-1', title: 'Blue bottle', description: 'Left in the library', category: 'Other', location: 'Library', type: 'lost', owner: { _id: 'owner-1', name: 'Riley' } };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [listedItem], item: listedItem }) }));
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: /View details/i }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByRole('heading', { name: 'Blue bottle' })).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Edit listing' })).not.toBeInTheDocument();
  });

  it('shows ranked match suggestions in listing details', async () => {
    const listedItem = { _id: 'lost-1', title: 'Blue phone', description: 'Cracked case', category: 'Electronics', location: 'Library', type: 'lost', owner: { _id: 'owner-1', name: 'Riley' } };
    const suggestedItem = { _id: 'found-1', title: 'Phone with blue case', description: 'Cracked blue case', category: 'Electronics', location: 'Library entrance', type: 'found', status: 'open', owner: { _id: 'owner-2', name: 'Ari' } };
    const match = { item: suggestedItem, score: 84, reasons: ['Same category', 'Similar campus location'] };
    const fetchMock = vi.fn().mockImplementation(async (url) => {
      if (String(url).endsWith('/matches')) return { ok: true, json: async () => ({ matches: [match] }) };
      if (String(url).endsWith('/lost-1')) return { ok: true, json: async () => ({ item: listedItem }) };
      if (String(url).endsWith('/found-1')) return { ok: true, json: async () => ({ item: suggestedItem }) };
      return { ok: true, json: async () => ({ items: [listedItem] }) };
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: /View details/i }));

    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByRole('heading', { name: 'Possible matches' })).toBeInTheDocument();
    expect(await within(dialog).findByText('Phone with blue case')).toBeInTheDocument();
    expect(within(dialog).getByText('84%')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'View listing: Phone with blue case' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Phone with blue case' })).toBeInTheDocument();
  });

  it('lets a signed-in student start a private chat and send a message', async () => {
    localStorage.setItem('campusfind-user', JSON.stringify({ id: 'student-1', name: 'Riley', role: 'student' }));
    localStorage.setItem('campusfind-token', 'student-token');
    const item = { _id: 'item-1', title: 'Blue bottle', description: 'Found near the library', category: 'Other', location: 'Library', type: 'found', status: 'open', owner: { _id: 'owner-1', name: 'Ari' } };
    const conversation = { _id: 'conversation-1', item: { title: item.title }, participants: [{ _id: 'student-1', name: 'Riley' }, { _id: 'owner-1', name: 'Ari' }] };
    const fetchMock = vi.fn().mockImplementation(async (url, options = {}) => {
      const path = String(url);
      if (path.endsWith('/items/item-1/conversations')) return { ok: true, json: async () => ({ conversation }) };
      if (path.endsWith('/conversations/conversation-1/messages') && options.method === 'POST') return { ok: true, json: async () => ({ message: { _id: 'message-1', sender: 'student-1', text: JSON.parse(options.body).text } }) };
      if (path.endsWith('/conversations/conversation-1/messages')) return { ok: true, json: async () => ({ messages: [] }) };
      if (path.endsWith('/conversations')) return { ok: true, json: async () => ({ conversations: [conversation] }) };
      if (path.endsWith('/item-1')) return { ok: true, json: async () => ({ item }) };
      return { ok: true, json: async () => ({ items: [item], matches: [] }) };
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: /View details/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Message poster' }));

    const composer = await screen.findByRole('textbox', { name: 'Write a message' });
    const dialog = within(composer.closest('[role="dialog"]'));
    fireEvent.change(composer, { target: { value: 'I think this could be my bottle.' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Send' }));
    expect(await dialog.findByText('I think this could be my bottle.')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/conversations/conversation-1/messages'), expect.objectContaining({ method: 'POST' }));
  });

  it('shows match notifications and marks them read when opened', async () => {
    localStorage.setItem('campusfind-user', JSON.stringify({ id: 'student-1', name: 'Riley', role: 'student' }));
    localStorage.setItem('campusfind-token', 'student-token');
    const notification = { _id: 'notice-1', type: 'match', title: 'Possible item match', message: 'A found listing may match your item.', isRead: false };
    const fetchMock = vi.fn().mockImplementation(async (url, options = {}) => {
      if (String(url).endsWith('/notifications/notice-1/read')) return { ok: true, json: async () => ({ notification: { ...notification, isRead: true } }) };
      if (String(url).endsWith('/notifications')) return { ok: true, json: async () => ({ notifications: [notification], unreadCount: 1 }) };
      return { ok: true, json: async () => ({ items: [] }) };
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<App />);

    const toggle = await screen.findByRole('button', { name: 'Notifications, 1 unread' });
    fireEvent.click(toggle);
    const popover = await screen.findByRole('region', { name: 'Notifications' });
    fireEvent.click(within(popover).getByRole('button', { name: /Possible item match/ }));

    expect(await screen.findByRole('button', { name: 'Notifications, 0 unread' })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/notifications/notice-1/read'), expect.objectContaining({ method: 'PATCH' }));
  });

  it('opens a private conversation from a new-message notification', async () => {
    localStorage.setItem('campusfind-user', JSON.stringify({ id: 'student-1', name: 'Riley', role: 'student' }));
    localStorage.setItem('campusfind-token', 'student-token');
    const notification = { _id: 'notice-message-1', type: 'message', title: 'New private message', message: 'A message arrived.', conversation: 'conversation-1', isRead: false };
    const conversation = { _id: 'conversation-1', item: { title: 'Blue bottle' }, participants: [{ _id: 'student-1', name: 'Riley' }, { _id: 'owner-1', name: 'Ari' }] };
    const fetchMock = vi.fn().mockImplementation(async (url) => {
      const path = String(url);
      if (path.endsWith('/notifications/notice-message-1/read')) return { ok: true, json: async () => ({ notification: { ...notification, isRead: true } }) };
      if (path.endsWith('/notifications')) return { ok: true, json: async () => ({ notifications: [notification], unreadCount: 1 }) };
      if (path.endsWith('/conversations/conversation-1/messages')) return { ok: true, json: async () => ({ messages: [] }) };
      if (path.endsWith('/conversations')) return { ok: true, json: async () => ({ conversations: [conversation] }) };
      return { ok: true, json: async () => ({ items: [] }) };
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }));
    const popover = await screen.findByRole('region', { name: 'Notifications' });
    fireEvent.click(within(popover).getByRole('button', { name: /New private message/ }));

    expect(await screen.findByRole('textbox', { name: 'Write a message' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Blue bottle' })).toBeInTheDocument();
  });

  it('opens paginated notification history and filters unread alerts', async () => {
    localStorage.setItem('campusfind-user', JSON.stringify({ id: 'student-1', name: 'Riley', role: 'student' }));
    localStorage.setItem('campusfind-token', 'student-token');
    const latest = { _id: 'notice-new', type: 'match', title: 'Latest match', message: 'A likely match was found.', isRead: false };
    const read = { _id: 'notice-read', type: 'claim-approved', title: 'Claim approved', message: 'Your claim was approved.', isRead: true };
    const fetchMock = vi.fn().mockImplementation(async (url) => {
      const parsed = new URL(String(url), 'http://localhost');
      if (parsed.pathname.endsWith('/notifications') && parsed.searchParams.has('page')) {
        const page = Number(parsed.searchParams.get('page'));
        if (parsed.searchParams.get('unread') === 'true') return { ok: true, json: async () => ({ notifications: [latest], unreadCount: 1, pagination: { page: 1, pages: 1, total: 1, limit: 20 } }) };
        if (page === 2) return { ok: true, json: async () => ({ notifications: [{ _id: 'notice-old', title: 'Older notification', message: 'An older update.', type: 'message', isRead: true }], unreadCount: 1, pagination: { page: 2, pages: 2, total: 21, limit: 20 } }) };
        return { ok: true, json: async () => ({ notifications: [latest, read], unreadCount: 1, pagination: { page: 1, pages: 2, total: 21, limit: 20 } }) };
      }
      if (parsed.pathname.endsWith('/notifications')) return { ok: true, json: async () => ({ notifications: [latest, read], unreadCount: 1 }) };
      return { ok: true, json: async () => ({ items: [] }) };
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }));
    const popover = await screen.findByRole('region', { name: 'Notifications' });
    fireEvent.click(within(popover).getByRole('button', { name: /View notification history/ }));
    expect(await screen.findByRole('heading', { name: 'Notification history' })).toBeInTheDocument();
    expect(await screen.findByText('Latest match')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('Older notification')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Unread/ }));
    expect(await screen.findByText('Latest match')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('unread=true'), expect.any(Object));
  });

  it('lets the listing owner edit details', async () => {
    localStorage.setItem('campusfind-user', JSON.stringify({ id: 'owner-1', name: 'Riley' }));
    localStorage.setItem('campusfind-token', 'test-token');
    const listedItem = { _id: 'item-1', title: 'Blue bottle', description: 'Left in the library', category: 'Other', location: 'Library', type: 'lost', owner: { _id: 'owner-1', name: 'Riley' } };
    const fetchMock = vi.fn().mockImplementation(async (url, options = {}) => {
      if (String(url).endsWith('/item-1') && options.method === 'PATCH') {
        const body = JSON.parse(options.body);
        return { ok: true, json: async () => ({ item: { ...listedItem, ...body } }) };
      }
      return { ok: true, json: async () => ({ items: [listedItem], item: listedItem }) };
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: /View details/i }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Edit listing' }));
    fireEvent.change(within(dialog).getByLabelText('Item name'), { target: { value: 'Blue bottle edited' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    expect(await within(dialog).findByRole('heading', { name: 'Blue bottle edited' })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/items/item-1'), expect.objectContaining({ method: 'PATCH' }));
  });

  it('lets a signed-in student submit proof for a found item', async () => {
    localStorage.setItem('campusfind-user', JSON.stringify({ id: 'claimant-1', name: 'Riley', role: 'student' }));
    localStorage.setItem('campusfind-token', 'student-token');
    const item = { _id: 'item-1', title: 'Green umbrella', description: 'Found by the cafe', category: 'Other', location: 'Cafe', type: 'found', status: 'open', owner: { _id: 'owner-1', name: 'Ari' } };
    const fetchMock = vi.fn().mockImplementation(async (url, options = {}) => {
      if (String(url).endsWith('/claims') && options.method === 'POST') return { ok: true, json: async () => ({ claim: { status: 'pending' } }) };
      if (String(url).endsWith('/item-1')) return { ok: true, json: async () => ({ item }) };
      return { ok: true, json: async () => ({ items: [item] }) };
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: /View details/i }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /submit a claim/i }));
    fireEvent.change(within(dialog).getByPlaceholderText('Describe a detail only the owner would know'), { target: { value: 'A small tear is inside the left pocket.' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send claim' }));

    expect(await screen.findByText(/sent to campus staff for review/i)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/items/item-1/claims'), expect.objectContaining({ method: 'POST' }));
  });

  it('shows pending claims to admins and lets them approve one', async () => {
    localStorage.setItem('campusfind-user', JSON.stringify({ id: 'admin-1', name: 'Campus Security', role: 'admin' }));
    localStorage.setItem('campusfind-token', 'admin-token');
    const claim = { _id: 'claim-1', item: { title: 'Green umbrella', location: 'Cafe' }, claimant: { name: 'Riley' }, proof: 'A small tear is inside the left pocket.' };
    let reviewed = false;
    const fetchMock = vi.fn().mockImplementation(async (url, options = {}) => {
      if (String(url).endsWith('/admin/claims/claim-1') && options.method === 'PATCH') { reviewed = true; return { ok: true, json: async () => ({ claim: { ...claim, status: 'approved' } }) }; }
      if (String(url).endsWith('/admin/claims')) return { ok: true, json: async () => ({ claims: reviewed ? [] : [claim] }) };
      if (String(url).endsWith('/admin/stats')) return { ok: true, json: async () => ({ stats: { totalItems: 8, openLost: 3, openFound: 2, returnedItems: 3, pendingClaims: 1, totalUsers: 6, approvedClaims: 3, rejectedClaims: 1, claimApprovalRate: 75 } }) };
      return { ok: true, json: async () => ({ items: [] }) };
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<App />);

    expect(await screen.findByText('Pending ownership claims')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Admin dashboard' })).toBeInTheDocument();
    expect(screen.getByText('Campus members')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(await screen.findByText('A small tear is inside the left pocket.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Staff note for Green umbrella'), { target: { value: 'Please share one more identifying detail.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Approve & mark returned' }));
    expect(await screen.findByText('All caught up')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/admin/claims/claim-1'), expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ status: 'approved', adminNotes: 'Please share one more identifying detail.' }) }));
  });
});
