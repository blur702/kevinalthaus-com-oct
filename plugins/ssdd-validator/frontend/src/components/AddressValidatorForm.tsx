/**
 * AddressValidatorForm - Main address validation form component
 *
 * Features:
 * - Material-UI form with validation
 * - Loading states with CircularProgress
 * - Success/error messaging
 * - Callback on successful validation
 */

import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Grid,
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import type { Address, ValidationResult, ApiError } from '../types';

interface AddressValidatorFormProps {
  onValidationComplete?: (result: ValidationResult) => void;
}

const AddressValidatorForm: React.FC<AddressValidatorFormProps> = ({
  onValidationComplete,
}) => {
  const [formData, setFormData] = useState<Address>({
    street1: '',
    street2: '',
    city: '',
    state: '',
    zip: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ValidationResult | null>(null);

  const handleChange = (field: keyof Address) => (event: React.ChangeEvent<HTMLInputElement>) => {
    let value = event.target.value;
    if (field === 'state') {
      value = value.toUpperCase().trim().slice(0, 2);
    }
    setError(null);
    setResult(null);
    setFormData({ ...formData, [field]: value });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch('/api/ssdd-validator/validate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!response.ok) {
        const errData = (await response.json()) as ApiError | { error?: string };
        throw new Error((errData as ApiError).error || errData.error || 'Validation failed');
      }
      const data: ValidationResult = await response.json();
      setResult(data);
      if (onValidationComplete) {
        onValidationComplete(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = formData.street1 && formData.city && formData.state && formData.zip;

  return (
    <Paper elevation={3} sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Validate Address
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Enter a U.S. address to validate and find the congressional district
      </Typography>

      <Box component="form" onSubmit={handleSubmit}>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Street Address"
              value={formData.street1}
              onChange={handleChange('street1')}
              required
              disabled={loading}
              placeholder="123 Main St"
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Apartment, Suite, etc. (Optional)"
              value={formData.street2}
              onChange={handleChange('street2')}
              disabled={loading}
              placeholder="Apt 4B"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="City"
              value={formData.city}
              onChange={handleChange('city')}
              required
              disabled={loading}
              placeholder="Springfield"
            />
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField
              fullWidth
              label="State"
              value={formData.state}
              onChange={handleChange('state')}
              required
              disabled={loading}
              placeholder="IL"
              inputProps={{ maxLength: 2, style: { textTransform: 'uppercase' } }}
            />
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField
              fullWidth
              label="ZIP Code"
              value={formData.zip}
              onChange={handleChange('zip')}
              required
              disabled={loading}
              placeholder="62701"
              inputProps={{ maxLength: 10 }}
            />
          </Grid>
        </Grid>

        <Button
          type="submit"
          variant="contained"
          size="large"
          fullWidth
          disabled={!isFormValid || loading}
          startIcon={loading ? <CircularProgress size={20} /> : <SearchIcon />}
          sx={{ mt: 3 }}
        >
          {loading ? 'Validating...' : 'Validate Address'}
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mt: 3 }}>
          <Typography variant="body2" fontWeight="bold">
            Validation Failed
          </Typography>
          {error}
        </Alert>
      )}

      {result && result.success && (
        <Alert severity="success" sx={{ mt: 3 }}>
          <Typography variant="body2" fontWeight="bold" gutterBottom>
            Address Validated Successfully
          </Typography>
          <Box sx={{ mt: 1 }}>
            <Typography variant="body2">
              <strong>Standardized Address:</strong><br />
              {result.standardizedAddress.street1}
              {result.standardizedAddress.street2 && ` ${result.standardizedAddress.street2}`}
              <br />
              {result.standardizedAddress.city}, {result.standardizedAddress.state} {result.standardizedAddress.zip}
            </Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              <strong>Coordinates:</strong> {result.coordinates.latitude.toFixed(6)}, {result.coordinates.longitude.toFixed(6)}
            </Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              <strong>Congressional District:</strong> {result.district.state}-{result.district.districtNumber} (SSDD: {result.ssdd})
            </Typography>
            {result.district.representative && (
              <Typography variant="body2" sx={{ mt: 1 }}>
                <strong>Representative:</strong> {result.district.representative.name} ({result.district.representative.party})
                {result.district.representative.phone && (
                  <><br />Phone: {result.district.representative.phone}</>
                )}
                {result.district.representative.website && (
                  <><br />Website: <a href={result.district.representative.website} target="_blank" rel="noopener noreferrer">{result.district.representative.website}</a></>
                )}
              </Typography>
            )}
          </Box>
        </Alert>
      )}
    </Paper>
  );
};

export default AddressValidatorForm;


