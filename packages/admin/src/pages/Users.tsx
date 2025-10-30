// User management page with data table and operations

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TableSortLabel,
  Checkbox,
  IconButton,
  Chip,
  Tooltip,
  CircularProgress,
  Alert,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  InputAdornment,
  Menu,
  MenuItem as MenuItemType,
  ListItemIcon,
  ListItemText,
  SelectChangeEvent,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Search as SearchIcon,
  FileUpload as ImportIcon,
  MoreVert as MoreIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { Role } from '../../shared/src/security/rbac-types';
import type { User, UserListParams } from '../types/user';
import { listUsers, deleteUser, bulkDelete } from '../services/usersService';
import UserFormDialog from '../components/users/UserFormDialog';
import UserDetailDialog from '../components/users/UserDetailDialog';
import BulkOperationsDialog from '../components/users/BulkOperationsDialog';

type SortField = 'username' | 'email' | 'role' | 'createdAt' | 'lastLogin';
type SortOrder = 'asc' | 'desc';

const Users: React.FC = () => {
  // Data state
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Sorting state
  const [sortBy, setSortBy] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<boolean | 'all'>('all');

  // Selection state
  const [selected, setSelected] = useState<readonly string[]>([]);

  // Dialog state
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingUser, setEditingUser] = useState<User | undefined>(undefined);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [viewingUser, setViewingUser] = useState<User | null>(null);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  // Snackbar state
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // Actions menu state
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [menuUser, setMenuUser] = useState<User | null>(null);

  // Fetch users
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params: UserListParams = {
        page: page + 1, // API uses 1-based pagination
        limit: rowsPerPage,
        sortBy,
        sortOrder,
      };

      if (searchQuery) {
        params.search = searchQuery;
      }
      if (roleFilter !== 'all') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        params.role = roleFilter as Role;
      }
      if (statusFilter !== 'all' && typeof statusFilter === 'boolean') {
        params.active = statusFilter;
      }

      const response = await listUsers(params);
      setUsers(response.users);
      setTotal(response.total);
    } catch (err) {
      console.error('Failed to fetch users:', err);
      setError('Failed to load users');
      showSnackbar('Failed to load users', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, sortBy, sortOrder, searchQuery, roleFilter, statusFilter]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  // Snackbar helper
  const showSnackbar = (
    message: string,
    severity: 'success' | 'error' | 'info' | 'warning' = 'success'
  ): void => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCloseSnackbar = (): void => {
    setSnackbar({ ...snackbar, open: false });
  };

  // Sorting
  const handleSort = (field: SortField): void => {
    const isAsc = sortBy === field && sortOrder === 'asc';
    setSortOrder(isAsc ? 'desc' : 'asc');
    setSortBy(field);
    setPage(0);
  };

  // Pagination
  const handleChangePage = (_event: unknown, newPage: number): void => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>): void => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Selection
  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>): void => {
    if (event.target.checked) {
      setSelected(users.map((u) => u.id));
    } else {
      setSelected([]);
    }
  };

  const handleSelectOne = (userId: string): void => {
    setSelected((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const isSelected = (userId: string): boolean => selected.includes(userId);

  // CRUD operations
  const handleCreateUser = (): void => {
    setFormMode('create');
    setEditingUser(undefined);
    setFormDialogOpen(true);
  };

  const handleEditUser = (user: User): void => {
    setFormMode('edit');
    setEditingUser(user);
    setFormDialogOpen(true);
    setAnchorEl(null);
  };

  const handleViewUser = (user: User): void => {
    setViewingUser(user);
    setDetailDialogOpen(true);
    setAnchorEl(null);
  };

  const handleDeleteUser = (user: User): void => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
    setAnchorEl(null);
  };

  const confirmDelete = async (): Promise<void> => {
    if (!userToDelete) {
      return;
    }

    try {
      await deleteUser(userToDelete.id);
      showSnackbar(`User "${userToDelete.username}" deleted successfully`, 'success');
      setDeleteDialogOpen(false);
      setUserToDelete(null);
      void fetchUsers();
    } catch (err) {
      console.error('Failed to delete user:', err);
      showSnackbar('Failed to delete user', 'error');
    }
  };

  const handleBulkDelete = async (): Promise<void> => {
    if (selected.length === 0) {
      return;
    }

    try {
      const result = await bulkDelete([...selected]);
      showSnackbar(`Successfully deleted ${result.deleted} user(s)`, 'success');
      setSelected([]);
      setShowBulkDeleteConfirm(false);
      void fetchUsers();
    } catch (err) {
      console.error('Failed to bulk delete:', err);
      showSnackbar('Failed to delete users', 'error');
      setShowBulkDeleteConfirm(false);
    }
  };

  const handleFormSuccess = (user: User): void => {
    const action = formMode === 'create' ? 'created' : 'updated';
    showSnackbar(`User "${user.username}" ${action} successfully`, 'success');
    void fetchUsers();
  };

  const handleBulkOperationsSuccess = (): void => {
    void fetchUsers();
  };

  // Actions menu
  const handleOpenMenu = (event: React.MouseEvent<HTMLElement>, user: User): void => {
    setAnchorEl(event.currentTarget);
    setMenuUser(user);
  };

  const handleCloseMenu = (): void => {
    setAnchorEl(null);
    setMenuUser(null);
  };

  // Filters
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    setSearchQuery(event.target.value);
    setPage(0);
  };


  const handleRoleFilterChange = (event: SelectChangeEvent): void => {
    setRoleFilter(event.target.value);
    setPage(0);
  };

  const handleStatusFilterChange = (event: SelectChangeEvent): void => {
    const value = event.target.value;
    setStatusFilter(value === 'all' ? 'all' : value === 'true');
    setPage(0);
  };

  // Formatting helpers
  const getRoleColor = (role: Role): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
    switch (role) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      case Role.ADMIN:
        return 'error';
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      case Role.EDITOR:
        return 'primary';
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      case Role.VIEWER:
        return 'info';
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      case Role.GUEST:
        return 'default';
      default:
        return 'default';
    }
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Users
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage user accounts and permissions
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreateUser}>
          Create User
        </Button>
      </Box>

      {/* Filters and Actions */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box display="flex" gap={2} flexWrap="wrap" alignItems="center">
          <TextField
            placeholder="Search by username or email..."
            value={searchQuery}
            onChange={handleSearchChange}
            size="small"
            sx={{ minWidth: 300, flex: 1 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />

          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Role</InputLabel>
            <Select value={roleFilter} onChange={handleRoleFilterChange} label="Role">
              <MenuItem value="all">All Roles</MenuItem>
              {/* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access */}
              <MenuItem value={Role.ADMIN as string}>Admin</MenuItem>
              {/* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access */}
              <MenuItem value={Role.EDITOR as string}>Editor</MenuItem>
              {/* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access */}
              <MenuItem value={Role.VIEWER as string}>Viewer</MenuItem>
              {/* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access */}
              <MenuItem value={Role.GUEST as string}>Guest</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFilter === 'all' ? 'all' : String(statusFilter)}
              onChange={handleStatusFilterChange}
              label="Status"
            >
              <MenuItem value="all">All Status</MenuItem>
              <MenuItem value="true">Active</MenuItem>
              <MenuItem value="false">Inactive</MenuItem>
            </Select>
          </FormControl>

          <Tooltip title="Refresh">
            <IconButton onClick={() => void fetchUsers()} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>

          <Box sx={{ flexGrow: 1 }} />

          {selected.length > 0 && (
            <>
              <Chip label={`${selected.length} selected`} color="primary" />
              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={() => setShowBulkDeleteConfirm(true)}
                size="small"
              >
                Delete Selected
              </Button>
            </>
          )}

          <Button
            variant="outlined"
            startIcon={<ImportIcon />}
            onClick={() => setBulkDialogOpen(true)}
            size="small"
          >
            Import/Export
          </Button>
        </Box>
      </Paper>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Data Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  indeterminate={selected.length > 0 && selected.length < users.length}
                  checked={users.length > 0 && selected.length === users.length}
                  onChange={handleSelectAll}
                  inputProps={{ 'aria-label': 'Select all users' }}
                />
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortBy === 'username'}
                  direction={sortBy === 'username' ? sortOrder : 'asc'}
                  onClick={() => handleSort('username')}
                >
                  Username
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortBy === 'email'}
                  direction={sortBy === 'email' ? sortOrder : 'asc'}
                  onClick={() => handleSort('email')}
                >
                  Email
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortBy === 'role'}
                  direction={sortBy === 'role' ? sortOrder : 'asc'}
                  onClick={() => handleSort('role')}
                >
                  Role
                </TableSortLabel>
              </TableCell>
              <TableCell>Status</TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortBy === 'createdAt'}
                  direction={sortBy === 'createdAt' ? sortOrder : 'asc'}
                  onClick={() => handleSort('createdAt')}
                >
                  Created
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortBy === 'lastLogin'}
                  direction={sortBy === 'lastLogin' ? sortOrder : 'asc'}
                  onClick={() => handleSort('lastLogin')}
                >
                  Last Login
                </TableSortLabel>
              </TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 8 }}>
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 8 }}>
                  <Typography variant="body2" color="text.secondary">
                    No users found
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow
                  key={user.id}
                  hover
                  selected={isSelected(user.id)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={isSelected(user.id)}
                      onChange={() => handleSelectOne(user.id)}
                      inputProps={{ 'aria-label': `Select ${user.username}` }}
                    />
                  </TableCell>
                  <TableCell onClick={() => handleViewUser(user)}>{user.username}</TableCell>
                  <TableCell onClick={() => handleViewUser(user)}>{user.email}</TableCell>
                  <TableCell onClick={() => handleViewUser(user)}>
                    {/* eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unnecessary-type-assertion */}
                    <Chip label={user.role} color={getRoleColor(user.role as Role)} size="small" />
                  </TableCell>
                  <TableCell onClick={() => handleViewUser(user)}>
                    <Chip
                      label={user.active ? 'Active' : 'Inactive'}
                      color={user.active ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell onClick={() => handleViewUser(user)}>
                    {formatDate(user.createdAt)}
                  </TableCell>
                  <TableCell onClick={() => handleViewUser(user)}>
                    {user.lastLogin ? formatDate(user.lastLogin) : 'Never'}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="View Details">
                      <IconButton size="small" onClick={() => handleViewUser(user)}>
                        <ViewIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => handleEditUser(user)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="More Actions">
                      <IconButton size="small" onClick={(e) => handleOpenMenu(e, user)}>
                        <MoreIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <TablePagination
          rowsPerPageOptions={[10, 25, 50, 100]}
          component="div"
          count={total}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </TableContainer>

      {/* Actions Menu */}
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleCloseMenu}>
        <MenuItemType onClick={() => menuUser && handleViewUser(menuUser)}>
          <ListItemIcon>
            <ViewIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>View Details</ListItemText>
        </MenuItemType>
        <MenuItemType onClick={() => menuUser && handleEditUser(menuUser)}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit User</ListItemText>
        </MenuItemType>
        <MenuItemType onClick={() => menuUser && handleDeleteUser(menuUser)}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>Delete User</ListItemText>
        </MenuItemType>
      </Menu>

      {/* Dialogs */}
      <UserFormDialog
        open={formDialogOpen}
        mode={formMode}
        user={editingUser}
        onClose={() => setFormDialogOpen(false)}
        onSuccess={handleFormSuccess}
      />

      <UserDetailDialog
        open={detailDialogOpen}
        user={viewingUser}
        onClose={() => setDetailDialogOpen(false)}
        onEdit={handleEditUser}
      />

      <BulkOperationsDialog
        open={bulkDialogOpen}
        onClose={() => setBulkDialogOpen(false)}
        onSuccess={handleBulkOperationsSuccess}
        selectedUserIds={selected}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete user "{userToDelete?.username}"? This action cannot be
            undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={() => void confirmDelete()} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk Delete Confirmation Dialog */}
      <Dialog
        open={showBulkDeleteConfirm && selected.length > 0}
        onClose={() => setShowBulkDeleteConfirm(false)}
      >
        <DialogTitle>Confirm Bulk Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete {selected.length} selected user(s)? This action cannot
            be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowBulkDeleteConfirm(false)}>Cancel</Button>
          <Button onClick={() => void handleBulkDelete()} color="error" variant="contained">
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Users;
