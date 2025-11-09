/**
 * AddressHistory - Display user's validated address history
 *
 * Features:
 * - Paginated table/list view
 * - Click to view on map
 * - Date formatting
 * - Loading states
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  CircularProgress,
  Alert,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import { Map as MapIcon } from '@mui/icons-material';
import type { AddressHistoryItem, ApiError } from '../types';

interface AddressHistoryProps {
  onViewOnMap?: (item: AddressHistoryItem) => void;
}

const AddressHistory: React.FC<AddressHistoryProps> = ({ onViewOnMap }) => {
  const [history, setHistory] = useState<AddressHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/ssdd-validator/addresses', {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData: ApiError = await response.json();
        throw new Error(errorData.error || 'Failed to load address history');
      }

      const data: AddressHistoryItem[] = await response.json();
      setHistory(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load address history');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const formatAddress = (address: AddressHistoryItem['address']): string => {
    const parts = [
      address.street1,
      address.street2,
      `${address.city}, ${address.state} ${address.zip}`,
    ].filter(Boolean);
    return parts.join(', ');
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <Paper elevation={3} sx={{ p: 3, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Paper>
    );
  }

  if (error) {
    return (
      <Paper elevation={3} sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Paper>
    );
  }

  if (history.length === 0) {
    return (
      <Paper elevation={3} sx={{ p: 3 }}>
        <Alert severity="info">
          No address validation history found. Validate an address to see it appear here.
        </Alert>
      </Paper>
    );
  }

  const paginatedHistory = history.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  return (
    <Paper elevation={3}>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h6">Address Validation History</Typography>
        <Typography variant="body2" color="text.secondary">
          {history.length} {history.length === 1 ? 'address' : 'addresses'} validated
        </Typography>
      </Box>

      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Address</TableCell>
              <TableCell>Congressional District</TableCell>
              <TableCell>SSDD</TableCell>
              <TableCell>Validated</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedHistory.map((item) => (
              <TableRow key={item.id} hover>
                <TableCell>
                  <Typography variant="body2">
                    {formatAddress(item.address)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    label={`${item.districtState}-${item.districtNumber}`}
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2" fontFamily="monospace">
                    {item.ssdd}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" color="text.secondary">
                    {formatDate(item.validatedAt)}
                  </Typography>
                </TableCell>
                <TableCell align="center">
                  <Tooltip title="View on map">
                    <IconButton
                      size="small"
                      onClick={() => onViewOnMap?.(item)}
                      color="primary"
                    >
                      <MapIcon />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        rowsPerPageOptions={[5, 10, 25, 50]}
        component="div"
        count={history.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
      />
    </Paper>
  );
};

export default AddressHistory;
