import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import MenuWidget from '../component';
import type { WidgetInstance } from '../../../src/types';

const widget: WidgetInstance = {
  id: 'menu-widget',
  type: 'menu',
  position: { x: 0, y: 0, width: 4, height: 2 },
  config: {
    menuSlug: 'primary',
    orientation: 'horizontal',
    variant: 'links',
    alignment: 'left',
    showIcons: false,
    showDescriptions: false,
  },
};

const mockPublicMenu = {
  menu: {
    id: '1',
    name: 'Primary',
    slug: 'primary',
    items: [
      {
        id: 'item-1',
        label: 'Home',
        url: '/',
        is_external: false,
        open_in_new_tab: false,
      },
    ],
  },
};

const mockAdminMenus = {
  menus: [
    { id: '1', name: 'Primary', slug: 'primary' },
    { id: '2', name: 'Secondary', slug: 'secondary' },
  ],
};

const originalFetch = globalThis.fetch;

const mockFetch = () => {
  const mockedFetch = jest.fn().mockImplementation((url: string | URL) => {
    if (typeof url === 'string' && url.includes('/api/public-menus')) {
      return Promise.resolve({
        ok: true,
        json: async () => mockPublicMenu,
      });
    }
    return Promise.resolve({
      ok: true,
      json: async () => mockAdminMenus,
    });
  });
  globalThis.fetch = mockedFetch as any;
  return mockedFetch;
};

describe('comp_menuWidget', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    (globalThis as typeof globalThis & { fetch?: typeof originalFetch }).fetch = originalFetch;
  });

  it('renders menu items fetched from API in view mode', async () => {
    const fetch = mockFetch();
    render(<MenuWidget widget={widget} editMode={false} />);

    await waitFor(() => expect(screen.getByText('Home')).toBeInTheDocument());
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/public-menus/primary'),
      expect.any(Object)
    );
  });

  it('surfaces admin menu options in edit mode and emits config updates', async () => {
    mockFetch();
    const onChange = jest.fn();

    render(<MenuWidget widget={widget} editMode onChange={onChange} />);

    const select = await screen.findByLabelText(/Menu/i);
    await userEvent.selectOptions(select, 'secondary');

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ menuSlug: 'secondary' }));
  });
});
