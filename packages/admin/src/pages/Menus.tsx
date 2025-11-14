import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  MenuItem,
  Select,
  SelectChangeEvent,
  Snackbar,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
  Paper,
} from '@mui/material';
import { TreeView, TreeItem } from '@mui/x-tree-view';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Refresh as RefreshIcon,
  Link as LinkIcon,
  MenuOpen as MenuIcon,
} from '@mui/icons-material';
import type {
  Menu as MenuType,
  MenuItem as MenuItemType,
  MenuLocation,
  CreateMenuRequest,
  UpdateMenuRequest,
  CreateMenuItemRequest,
  UpdateMenuItemRequest,
} from '../types/menu';
import {
  listMenus,
  createMenu,
  updateMenu,
  deleteMenu,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
} from '../services/menusService';

type SnackbarState = {
  open: boolean;
  message: string;
  severity: 'success' | 'error' | 'info' | 'warning';
};

interface MenuDialogProps {
  open: boolean;
  menu?: MenuType;
  onClose: () => void;
  onSubmit: (values: CreateMenuRequest | UpdateMenuRequest, menuId?: string) => Promise<void>;
  loading?: boolean;
}

const defaultMenuForm: CreateMenuRequest = {
  name: '',
  slug: '',
  description: '',
  location: 'custom',
  is_active: true,
};

const MenuDialog: React.FC<MenuDialogProps> = ({ open, menu, onClose, onSubmit, loading }) => {
  const [form, setForm] = useState<CreateMenuRequest>(defaultMenuForm);

  useEffect(() => {
    if (menu) {
      setForm({
        name: menu.name,
        slug: menu.slug,
        description: menu.description ?? '',
        location: menu.location,
        is_active: menu.is_active,
      });
    } else {
      setForm(defaultMenuForm);
    }
  }, [menu]);

  const handleChange = (field: keyof CreateMenuRequest) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | SelectChangeEvent<MenuLocation>
  ) => {
    const value = event.target.value;
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleToggle = (field: keyof CreateMenuRequest) => (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setForm((prev) => ({
      ...prev,
      [field]: event.target.checked,
    }));
  };

  const slugHelper = 'Optional. Leave blank to generate from name.';

  const handleSubmit = async (): Promise<void> => {
    await onSubmit(form, menu?.id);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{menu ? 'Edit Menu' : 'Create Menu'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Name"
            value={form.name}
            onChange={handleChange('name')}
            required
            fullWidth
          />
          <TextField
            label="Slug"
            value={form.slug ?? ''}
            onChange={handleChange('slug')}
            helperText={slugHelper}
            fullWidth
          />
          <FormControl fullWidth>
            <InputLabel id="menu-location-label">Location</InputLabel>
            <Select
              labelId="menu-location-label"
              label="Location"
              value={form.location || 'custom'}
              disabled={menu?.location === 'header' || menu?.location === 'footer'}
              onChange={handleChange('location') as unknown as (
                event: SelectChangeEvent<MenuLocation>
              ) => void}
            >
              <MenuItem value="header">Header</MenuItem>
              <MenuItem value="footer">Footer</MenuItem>
              <MenuItem value="custom">Custom</MenuItem>
            </Select>
          </FormControl>
          <TextField
            label="Description"
            value={form.description ?? ''}
            onChange={handleChange('description')}
            multiline
            minRows={2}
            fullWidth
          />
          <FormControlLabel
            control={
              <Switch
                checked={Boolean(form.is_active)}
                onChange={handleToggle('is_active')}
                color="primary"
              />
            }
            label="Menu is active"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained" disabled={loading || !form.name.trim()}>
            {menu ? 'Save Changes' : 'Create Menu'}
          </Button>
      </DialogActions>
    </Dialog>
  );
};

interface MenuItemDialogProps {
  open: boolean;
  menu: MenuType | null;
  item?: MenuItemType;
  onClose: () => void;
  onSubmit: (
    menuId: string,
    values: CreateMenuItemRequest | UpdateMenuItemRequest,
    itemId?: string
  ) => Promise<void>;
}

const defaultItemForm: CreateMenuItemRequest = {
  label: '',
  url: '',
  parent_id: null,
  is_external: false,
  open_in_new_tab: false,
  order_index: 0,
  is_active: true,
};

const MenuItemDialog: React.FC<MenuItemDialogProps> = ({ open, menu, item, onClose, onSubmit }) => {
  const [form, setForm] = useState<CreateMenuItemRequest>(defaultItemForm);

  useEffect(() => {
    if (item) {
      setForm({
        label: item.label,
        url: item.url,
        parent_id: item.parent_id ?? null,
        is_external: item.is_external,
        open_in_new_tab: item.open_in_new_tab,
        icon: item.icon ?? '',
        rel: item.rel ?? '',
        order_index: item.order_index,
        is_active: item.is_active,
      });
    } else {
      // Service guarantees menu.items is always an array
      const items = menu?.items || [];
      const max = items.reduce((max, current) => Math.max(max, current.order_index), -1);
      setForm({
        ...defaultItemForm,
        order_index: max + 1,
      });
    }
  }, [item, menu]);

  const flattenItems = useCallback((nodes: MenuItemType[], depth = 0): Array<{ id: string; label: string }> => {
    return nodes.flatMap((node) => {
      const formattedLabel = `${'— '.repeat(depth)}${node.label}`;
      // Service guarantees node.children is always an array
      const childResults = node.children.length > 0 ? flattenItems(node.children, depth + 1) : [];
      return [{ id: node.id, label: formattedLabel }, ...childResults];
    });
  }, []);

  const parentOptions = useMemo(() => {
    if (!menu) {return [];}
    // Service guarantees menu.items is always an array
    return flattenItems(menu.items);
  }, [menu, flattenItems]);

  const handleChange = (field: keyof CreateMenuItemRequest) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | SelectChangeEvent<string>
  ) => {
    const value = event.target.value;
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleNumberChange = (field: keyof CreateMenuItemRequest) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = Number(event.target.value);
    setForm((prev) => ({
      ...prev,
      [field]: Number.isNaN(value) ? 0 : value,
    }));
  };

  const handleToggle = (field: keyof CreateMenuItemRequest) => (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setForm((prev) => ({
      ...prev,
      [field]: event.target.checked,
    }));
  };

  const handleSubmit = async (): Promise<void> => {
    if (!menu) {return;}
    await onSubmit(menu.id, form, item?.id);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{item ? 'Edit Menu Item' : 'Add Menu Item'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Label"
            value={form.label}
            onChange={handleChange('label')}
            required
            fullWidth
          />
          <TextField
            label="URL"
            value={form.url}
            onChange={handleChange('url')}
            required
            fullWidth
          />
          <FormControl fullWidth>
            <InputLabel id="parent-item-label">Parent Item</InputLabel>
            <Select
              labelId="parent-item-label"
              label="Parent Item"
              value={form.parent_id ?? ''}
              onChange={(event) => {
                const val = event.target.value;
                setForm((prev) => ({
                  ...prev,
                  parent_id: val ? val : null,
                }));
              }}
            >
              <MenuItem value="">(Top level)</MenuItem>
              {parentOptions
                .filter((option) => option.id !== item?.id)
                .map((option) => (
                  <MenuItem key={option.id} value={option.id}>
                    {option.label}
                  </MenuItem>
                ))}
            </Select>
          </FormControl>
          <TextField
            type="number"
            label="Order"
            value={form.order_index ?? 0}
            onChange={handleNumberChange('order_index')}
            fullWidth
            helperText="Lower numbers appear first"
          />
          <TextField
            label="Icon (optional)"
            value={form.icon ?? ''}
            onChange={handleChange('icon')}
            fullWidth
          />
          <TextField
            label="Rel attribute"
            value={form.rel ?? ''}
            onChange={handleChange('rel')}
            fullWidth
          />
          <FormControlLabel
            control={
              <Switch
                checked={Boolean(form.is_external)}
                onChange={handleToggle('is_external')}
              />
            }
            label="External link"
          />
          <FormControlLabel
            control={
              <Switch
                checked={Boolean(form.open_in_new_tab)}
                onChange={handleToggle('open_in_new_tab')}
              />
            }
            label="Open in new tab"
          />
          <FormControlLabel
            control={
              <Switch checked={Boolean(form.is_active)} onChange={handleToggle('is_active')} />
            }
            label="Item is active"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!form.label.trim() || !form.url.trim()}
        >
          {item ? 'Save Changes' : 'Add Item'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

function getLocationLabel(location: MenuLocation): string {
  switch (location) {
    case 'header':
      return 'Header';
    case 'footer':
      return 'Footer';
    default:
      return 'Custom';
  }
}

const MenusPage: React.FC = () => {
  const [menus, setMenus] = useState<Array<MenuType & { items: MenuItemType[] }>>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMenuId, setSelectedMenuId] = useState<string | null>(null);
  const [menuDialogOpen, setMenuDialogOpen] = useState(false);
  const [menuItemDialogOpen, setMenuItemDialogOpen] = useState(false);
  const [editingMenu, setEditingMenu] = useState<MenuType | undefined>(undefined);
  const [editingItem, setEditingItem] = useState<MenuItemType | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<SnackbarState>({
    open: false,
    message: '',
    severity: 'success',
  });
  const [deleteTarget, setDeleteTarget] = useState<{ menuId: string } | null>(null);
  const [deleteItemTarget, setDeleteItemTarget] = useState<{ menuId: string; itemId: string } | null>(
    null
  );

  const selectedMenu = menus.find((menu) => menu.id === selectedMenuId) ?? menus[0] ?? null;

  const showSnackbar = (message: string, severity: SnackbarState['severity'] = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleSnackbarClose = () => setSnackbar((prev) => ({ ...prev, open: false }));

  const fetchMenus = useCallback(async (forceSelect = true) => {
    setLoading(true);
    setError(null);
    try {
      const data = await listMenus(true);
      // Service guarantees data.menus is an array
      setMenus(data.menus);
      if (forceSelect && !selectedMenuId && data.menus.length > 0) {
        setSelectedMenuId(data.menus[0].id);
      }
    } catch (err) {
      console.error('Failed to load menus', err);
      setError('Failed to load menus. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchMenus();
  }, [fetchMenus]);

  const handleOpenCreateMenu = () => {
    setEditingMenu(undefined);
    setMenuDialogOpen(true);
  };

  const handleEditMenu = () => {
    if (!selectedMenu) {return;}
    setEditingMenu(selectedMenu);
    setMenuDialogOpen(true);
  };

  const handleMenuDialogSubmit = async (
    values: CreateMenuRequest | UpdateMenuRequest,
    menuId?: string
  ) => {
    try {
      if (menuId) {
        await updateMenu(menuId, values as UpdateMenuRequest);
        showSnackbar('Menu updated');
      } else {
        await createMenu(values as CreateMenuRequest);
        showSnackbar('Menu created');
      }
      await fetchMenus(false);
    } catch (err) {
      console.error('Failed to save menu', err);
      showSnackbar('Failed to save menu', 'error');
    }
  };

  const handleDeleteMenu = async () => {
    if (!deleteTarget) {return;}
    try {
      await deleteMenu(deleteTarget.menuId);
      showSnackbar('Menu deleted');
      if (selectedMenuId === deleteTarget.menuId) {
        setSelectedMenuId(null);
      }
      await fetchMenus(false);
    } catch (err) {
      console.error('Failed to delete menu', err);
      showSnackbar('Failed to delete menu', 'error');
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleOpenItemDialog = (item?: MenuItemType) => {
    setEditingItem(item);
    setMenuItemDialogOpen(true);
  };

  const handleItemSubmit = async (
    menuId: string,
    values: CreateMenuItemRequest | UpdateMenuItemRequest,
    itemId?: string
  ) => {
    try {
      if (itemId) {
        await updateMenuItem(menuId, itemId, values as UpdateMenuItemRequest);
        showSnackbar('Menu item updated');
      } else {
        await createMenuItem(menuId, values as CreateMenuItemRequest);
        showSnackbar('Menu item created');
      }
      await fetchMenus(false);
    } catch (err) {
      console.error('Failed to save menu item', err);
      showSnackbar('Failed to save menu item', 'error');
    }
  };

  const handleDeleteItem = async () => {
    if (!deleteItemTarget) {return;}
    try {
      await deleteMenuItem(deleteItemTarget.menuId, deleteItemTarget.itemId);
      showSnackbar('Menu item deleted');
      await fetchMenus(false);
    } catch (err) {
      console.error('Failed to delete menu item', err);
      showSnackbar('Failed to delete menu item', 'error');
    } finally {
      setDeleteItemTarget(null);
    }
  };

  const renderMenuTree = (items: MenuItemType[]) => {
    return items.map((item) => (
      <TreeItem
        key={item.id}
        nodeId={item.id}
        label={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2">{item.label}</Typography>
            {!item.is_active && <Chip label="Inactive" size="small" color="warning" />}
            {item.is_external && (
              <Tooltip title="External link">
                <LinkIcon fontSize="small" color="action" />
              </Tooltip>
            )}
            <Box sx={{ marginLeft: 'auto' }}>
              <Tooltip title="Edit item">
                <IconButton size="small" onClick={() => handleOpenItemDialog(item)}>
                  <EditIcon fontSize="inherit" aria-label={`Edit ${item.label}`} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Delete item">
                <IconButton
                  size="small"
                  aria-label={`Delete ${item.label}`}
                  onClick={() => setDeleteItemTarget({ menuId: item.menu_id, itemId: item.id })}
                >
                  <DeleteIcon fontSize="inherit" />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        }
      >
        {/* Service guarantees item.children is always an array */}
        {item.children.length > 0 && renderMenuTree(item.children)}
      </TreeItem>
    ));
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Menu Manager
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => void fetchMenus(false)}
            disabled={loading}
          >
            Refresh
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenCreateMenu}>
            New Menu
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Menus
            </Typography>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress size={32} />
              </Box>
            ) : (
              <List dense>
                {menus.map((menu) => (
                  <ListItem key={menu.id} disablePadding>
                    <ListItemButton
                      selected={menu.id === selectedMenuId}
                      onClick={() => setSelectedMenuId(menu.id)}
                    >
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <MenuIcon fontSize="small" />
                            <span>{menu.name}</span>
                          </Box>
                        }
                        secondary={
                          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 0.5 }}>
                            <Chip size="small" label={getLocationLabel(menu.location)} />
                            {!menu.is_active && <Chip size="small" color="warning" label="Inactive" />}
                          </Box>
                        }
                        secondaryTypographyProps={{ component: 'div' }}
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            )}
            <Divider sx={{ my: 2 }} />
            <Stack spacing={1}>
              <Button
                variant="outlined"
                onClick={handleEditMenu}
                disabled={!selectedMenu}
                startIcon={<EditIcon />}
              >
                Edit Menu
              </Button>
              <Tooltip
                title={selectedMenu && selectedMenu.location !== 'custom' ? "Only custom menus can be deleted" : ""}
                arrow
              >
                <span>
                  <Button
                    variant="outlined"
                    color="error"
                    onClick={() => selectedMenu && setDeleteTarget({ menuId: selectedMenu.id })}
                    disabled={!selectedMenu || selectedMenu.location !== 'custom'}
                    startIcon={<DeleteIcon />}
                  >
                    Delete Menu
                  </Button>
                </span>
              </Tooltip>
            </Stack>
          </Paper>
        </Grid>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2, minHeight: 420 }}>
            {selectedMenu ? (
              <>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mb: 2,
                  }}
                >
                  <div>
                    <Typography variant="h6">{selectedMenu.name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Slug: {selectedMenu.slug}
                    </Typography>
                  </div>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => handleOpenItemDialog()}
                  >
                    Add Item
                  </Button>
                </Box>
                {/* Service guarantees selectedMenu.items is always an array */}
                {selectedMenu.items.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    This menu does not contain any items yet.
                  </Typography>
                ) : (
                  <TreeView
                    defaultCollapseIcon={<MenuIcon fontSize="small" />}
                    defaultExpandIcon={<MenuIcon fontSize="small" />}
                    sx={{
                      maxHeight: 520,
                      overflowY: 'auto',
                      '& .MuiTreeItem-label': {
                        width: '100%',
                      },
                    }}
                  >
                    {renderMenuTree(selectedMenu.items)}
                  </TreeView>
                )}
              </>
            ) : (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <Typography variant="body1" color="text.secondary">
                  Select a menu to view and manage its items.
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>

      <MenuDialog
        open={menuDialogOpen}
        menu={editingMenu}
        onClose={() => setMenuDialogOpen(false)}
        onSubmit={handleMenuDialogSubmit}
      />

      <MenuItemDialog
        open={menuItemDialogOpen}
        menu={selectedMenu}
        item={editingItem}
        onClose={() => setMenuItemDialogOpen(false)}
        onSubmit={handleItemSubmit}
      />

      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Delete Menu</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete this menu? This action is permanent.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={() => void handleDeleteMenu()}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(deleteItemTarget)} onClose={() => setDeleteItemTarget(null)}>
        <DialogTitle>Delete Menu Item</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete this menu item?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteItemTarget(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={() => void handleDeleteItem()}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snackbar.severity} onClose={handleSnackbarClose} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default MenusPage;
