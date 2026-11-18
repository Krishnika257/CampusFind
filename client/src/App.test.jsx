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
});
