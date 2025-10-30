// User creation/editing form dialog

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  FormControlLabel,
  Checkbox,
  FormHelperText,
  Box,
  Alert,
  CircularProgress,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import { Role } from '@monorepo/shared';
import type { User, UserFormMode, CreateUserRequest, UpdateUserRequest } from '../../types/user';
import { createUser, updateUser } from '../../services/usersService';

interface UserFormDialogProps {
  open: boolean;
  mode: UserFormMode;
  user?: User;
  onClose: () => void;
  onSuccess: (user: User) => void;
}

interface UserFormData {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: Role;
  active: boolean;
}

interface FormErrors {
  username?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  submit?: string;
}

const UserFormDialog: React.FC<UserFormDialogProps> = ({ open, mode, user, onClose, onSuccess }) => {
  const [formData, setFormData] = useState<UserFormData>({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    role: Role.VIEWER,
    active: true,
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);

  // Initialize form data when user changes (edit mode)
  useEffect(() => {
    if (mode === 'edit' && user) {
      setFormData({
        username: user.username,
        email: user.email,
        password: '',
        confirmPassword: '',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        role: user.role,
        active: user.active,
      });
      setErrors({});
    } else if (mode === 'edit' && !user) {
      // Edge case: edit mode requested but no user provided
      console.error('UserFormDialog: edit mode requested without a user');
      setErrors({ submit: 'Cannot edit user: no user selected.' });
      // Ensure no loading state lingers
      setLoading(false);
    } else if (mode === 'create') {
      setFormData({
        username: '',
        email: '',
        password: '',
        confirmPassword: '',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        role: Role.VIEWER,
        active: true,
      });
      setErrors({});
    }
  }, [mode, user, open]);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Username validation
    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    } else if (formData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    } else if (!/^[a-zA-Z0-9_-]+$/.test(formData.username)) {
      newErrors.username = 'Username can only contain letters, numbers, hyphens, and underscores';
    }

    // Email validation
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    // Password validation (required for create mode, optional for edit)
    if (mode === 'create') {
      if (!formData.password) {
        newErrors.password = 'Password is required';
      } else if (formData.password.length < 8) {
        newErrors.password = 'Password must be at least 8 characters';
      } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?])/.test(formData.password)) {
        newErrors.password = 'Password must contain uppercase, lowercase, number, and special character';
      }

      if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
    } else if (mode === 'edit' && formData.password) {
      // In edit mode, validate password only if provided
      if (formData.password.length < 8) {
        newErrors.password = 'Password must be at least 8 characters';
      } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?])/.test(formData.password)) {
        newErrors.password = 'Password must contain uppercase, lowercase, number, and special character';
      }

      if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setErrors({});

    try {
      if (mode === 'create') {
        const createData: CreateUserRequest = {
          username: formData.username.trim(),
          email: formData.email.trim(),
          password: formData.password,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          role: formData.role,
          active: formData.active,
        };

        const newUser = await createUser(createData);
        onSuccess(newUser);
        onClose();
      } else if (mode === 'edit' && user) {
        const updateData: UpdateUserRequest = {
          username: formData.username.trim(),
          email: formData.email.trim(),
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          role: formData.role,
          active: formData.active,
        };

        // Only include password if it was provided
        if (formData.password) {
          updateData.password = formData.password;
        }

        const updatedUser = await updateUser(user.id, updateData);
        onSuccess(updatedUser);
        onClose();
      }
    } catch (error) {
      console.error('Failed to save user:', error);
      if (error instanceof Error) {
        setErrors({ submit: error.message });
      } else {
        setErrors({ submit: 'Failed to save user. Please try again.' });
      }
    } finally {
      setLoading(false);
    }
  };

  type TextFieldKey = 'username' | 'email' | 'password' | 'confirmPassword';
  const handleChange = (field: TextFieldKey) => (
    event: React.ChangeEvent<HTMLInputElement>
  ): void => {
    const { value } = event.target;
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    // Clear error for this field
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleRoleChange = (event: SelectChangeEvent<string>): void => {
    setFormData((prev) => ({
      ...prev,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      role: event.target.value as Role,
    }));
  };

  const handleCheckboxChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    setFormData((prev) => ({
      ...prev,
      active: event.target.checked,
    }));
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{mode === 'create' ? 'Create New User' : 'Edit User'}</DialogTitle>
      {/* eslint-disable-next-line @typescript-eslint/no-misused-promises */}
      <form onSubmit={handleSubmit}>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {errors.submit && (
              <Alert severity="error" onClose={() => setErrors({ ...errors, submit: undefined })}>
                {errors.submit}
              </Alert>
            )}

            <TextField
              label="Username"
              value={formData.username}
              onChange={handleChange('username')}
              error={Boolean(errors.username)}
              helperText={errors.username || 'Unique username for login'}
              fullWidth
              required
              autoFocus
              disabled={loading}
              inputProps={{
                'aria-label': 'Username',
              }}
            />

            <TextField
              label="Email"
              type="email"
              value={formData.email}
              onChange={handleChange('email')}
              error={Boolean(errors.email)}
              helperText={errors.email || 'Valid email address'}
              fullWidth
              required
              disabled={loading}
              inputProps={{
                'aria-label': 'Email address',
              }}
            />

            <TextField
              label={mode === 'create' ? 'Password' : 'New Password (optional)'}
              type="password"
              value={formData.password}
              onChange={handleChange('password')}
              error={Boolean(errors.password)}
              helperText={
                errors.password ||
                (mode === 'edit'
                  ? 'Leave blank to keep current password'
                  : 'At least 8 characters with uppercase, lowercase, number, and special character')
              }
              fullWidth
              required={mode === 'create'}
              disabled={loading}
              inputProps={{
                'aria-label': 'Password',
              }}
            />

            <TextField
              label="Confirm Password"
              type="password"
              value={formData.confirmPassword}
              onChange={handleChange('confirmPassword')}
              error={Boolean(errors.confirmPassword)}
              helperText={errors.confirmPassword}
              fullWidth
              required={mode === 'create' || Boolean(formData.password)}
              disabled={loading}
              inputProps={{
                'aria-label': 'Confirm password',
              }}
            />

            <FormControl fullWidth required disabled={loading}>
              <InputLabel id="role-label">Role</InputLabel>
              <Select
                labelId="role-label"
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                value={formData.role}
                onChange={handleRoleChange}
                label="Role"
                inputProps={{
                  'aria-label': 'User role',
                }}
              >
                {/* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access */}
                <MenuItem value={Role.ADMIN as string}>Admin - Full system access</MenuItem>
                {/* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access */}
                <MenuItem value={Role.EDITOR as string}>Editor - Content management</MenuItem>
                {/* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access */}
                <MenuItem value={Role.VIEWER as string}>Viewer - Read-only access</MenuItem>
                {/* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access */}
                <MenuItem value={Role.GUEST as string}>Guest - Limited access</MenuItem>
              </Select>
              <FormHelperText>User permission level</FormHelperText>
            </FormControl>

            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.active}
                  onChange={handleCheckboxChange}
                  disabled={loading}
                  inputProps={{
                    'aria-label': 'Active status',
                  }}
                />
              }
              label="Active (user can log in)"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} /> : null}
          >
            {mode === 'create' ? 'Create User' : 'Save Changes'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default UserFormDialog;
