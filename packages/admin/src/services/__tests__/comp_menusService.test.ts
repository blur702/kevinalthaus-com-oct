import api from '../../lib/api';
import {
  listMenus,
  getMenu,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
} from '../menusService';

jest.mock('../../lib/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn().mockResolvedValue({ data: {} }),
    post: jest.fn().mockResolvedValue({ data: {} }),
    put: jest.fn().mockResolvedValue({ data: {} }),
    delete: jest.fn().mockResolvedValue({}),
  },
}));

const mockedApi = api as jest.Mocked<typeof api>;

describe('comp_menusService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('listMenus forwards includeItems flag', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { menus: [] } });
    await listMenus(false);

    expect(mockedApi.get).toHaveBeenCalledWith('/menus', {
      params: { includeItems: false },
    });
  });

  it('getMenu encodes id and returns response body', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { id: 'menu-1' } });
    const data = await getMenu('menu id');

    expect(mockedApi.get).toHaveBeenCalledWith('/menus/menu%20id', {
      params: { includeItems: true },
    });
    expect(data).toEqual({ id: 'menu-1' });
  });

  it('create/update/delete menu items call expected endpoints', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { item: { id: 'child' } } });
    const created = await createMenuItem('menu/one', {
      parent_id: null,
      label: 'Child',
      url: '/child',
    });

    expect(mockedApi.post).toHaveBeenCalledWith(
      '/menus/menu%2Fone/items',
      expect.objectContaining({ label: 'Child' })
    );
    expect(created).toEqual({ item: { id: 'child' } });

    await updateMenuItem('menu/one', 'node/id', { label: 'Updated' });
    expect(mockedApi.put).toHaveBeenCalledWith(
      '/menus/menu%2Fone/items/node%2Fid',
      expect.objectContaining({ label: 'Updated' })
    );

    await deleteMenuItem('menu/one', 'node/id');
    expect(mockedApi.delete).toHaveBeenCalledWith('/menus/menu%2Fone/items/node%2Fid');
  });
});
