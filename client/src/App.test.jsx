import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from './App.jsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
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
});
