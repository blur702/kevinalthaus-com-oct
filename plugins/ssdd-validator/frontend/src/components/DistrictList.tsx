/**
 * DistrictList - Browse all congressional districts
 *
 * Features:
 * - Paginated table view
 * - State filter dropdown
 * - Click to view boundary on map
 * - Representative information display
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  IconButton,
  Tooltip,
  Grid,
} from '@mui/material';
import { Map as MapIcon } from '@mui/icons-material';
import type { DistrictInfo, ApiError } from '../types';

interface DistrictListProps {
  onViewOnMap?: (district: DistrictInfo) => void;
}

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
];

const DistrictList: React.FC<DistrictListProps> = ({ onViewOnMap }) => {
  const [districts, setDistricts] = useState<DistrictInfo[]>([]);
  const [filteredDistricts, setFilteredDistricts] = useState<DistrictInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [selectedState, setSelectedState] = useState<string>('');

  useEffect(() => {
    loadDistricts();
  }, []);

  useEffect(() => {
    if (selectedState) {
      setFilteredDistricts(
        districts.filter((d) => d.state === selectedState)
      );
    } else {
      setFilteredDistricts(districts);
    }
    setPage(0);
  }, [selectedState, districts]);

  const loadDistricts = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/ssdd-validator/districts', {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData: ApiError = await response.json();
        throw new Error(errorData.error || 'Failed to load districts');
      }

      const result = await response.json();
      const data: DistrictInfo[] = result.districts || [];
      setDistricts(data);
      setFilteredDistricts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load districts');
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

  const paginatedDistricts = filteredDistricts.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  return (
    <Paper elevation={3}>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6}>
            <Typography variant="h6">Congressional Districts</Typography>
            <Typography variant="body2" color="text.secondary">
              {filteredDistricts.length} {filteredDistricts.length === 1 ? 'district' : 'districts'}
              {selectedState && ` in ${selectedState}`}
            </Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth size="small">
              <InputLabel>Filter by State</InputLabel>
              <Select
                value={selectedState}
                label="Filter by State"
                onChange={(e) => setSelectedState(e.target.value)}
              >
                <MenuItem value="">
                  <em>All States</em>
                </MenuItem>
                {US_STATES.map((state) => (
                  <MenuItem key={state} value={state}>
                    {state}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Box>

      {filteredDistricts.length === 0 ? (
        <Box sx={{ p: 3 }}>
          <Alert severity="info">
            No districts found{selectedState ? ` for state ${selectedState}` : ''}.
          </Alert>
        </Box>
      ) : (
        <>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>State</TableCell>
                  <TableCell>District</TableCell>
                  <TableCell>SSDD</TableCell>
                  <TableCell>Representative</TableCell>
                  <TableCell>Party</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedDistricts.map((district) => (
                  <TableRow key={district.ssdd} hover>
                    <TableCell>
                      <Chip label={district.state} size="small" />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        District {district.districtNumber}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontFamily="monospace">
                        {district.ssdd}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {district.representativeName || (
                          <em style={{ color: '#999' }}>Not available</em>
                        )}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {district.representativeParty ? (
                        <Chip
                          label={district.representativeParty}
                          size="small"
                          color={
                            district.representativeParty === 'Republican'
                              ? 'error'
                              : district.representativeParty === 'Democrat'
                              ? 'primary'
                              : 'default'
                          }
                        />
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          -
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="View boundary on map">
                        <IconButton
                          size="small"
                          onClick={() => onViewOnMap?.(district)}
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
            rowsPerPageOptions={[10, 25, 50, 100]}
            component="div"
            count={filteredDistricts.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </>
      )}
    </Paper>
  );
};

export default DistrictList;
