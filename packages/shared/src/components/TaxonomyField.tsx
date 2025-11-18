/**
 * Taxonomy Field Component
 * Reusable component for selecting taxonomy terms in forms
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  OutlinedInput,
  SelectChangeEvent,
  FormHelperText,
  CircularProgress,
} from '@mui/material';

// Use window for client-side, fallback to '/api' for server-side imports
const API_BASE = (typeof window !== 'undefined' && (window as any).__ENV__?.VITE_API_URL) || '/api';

interface Term {
  id: string;
  vocabulary_id: string;
  name: string;
  slug: string;
  description?: string;
  parent_id?: string;
  weight: number;
}

interface Vocabulary {
  id: string;
  name: string;
  machine_name: string;
  allow_multiple: boolean;
  required: boolean;
}

export interface TaxonomyFieldProps {
  vocabularyId?: string;
  vocabularyMachineName?: string;
  label: string;
  value: string | string[];
  onChange: (value: string | string[]) => void;
  helperText?: string;
  error?: boolean;
  disabled?: boolean;
  required?: boolean;
}

export const TaxonomyField: React.FC<TaxonomyFieldProps> = ({
  vocabularyId,
  vocabularyMachineName,
  label,
  value,
  onChange,
  helperText,
  error = false,
  disabled = false,
  required = false,
}) => {
  const [vocabulary, setVocabulary] = useState<Vocabulary | null>(null);
  const [terms, setTerms] = useState<Term[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    loadVocabularyAndTerms();
  }, [vocabularyId, vocabularyMachineName]);

  const loadVocabularyAndTerms = async () => {
    if (!vocabularyId && !vocabularyMachineName) {
      setLoadError('Either vocabularyId or vocabularyMachineName must be provided');
      return;
    }

    try {
      setLoading(true);
      setLoadError(null);

      // Get CSRF token
      const csrfMatch = document.cookie.match(/csrf-token=([^;]+)/);
      const csrfToken = csrfMatch ? decodeURIComponent(csrfMatch[1]) : null;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }

      // Load vocabulary
      const vocabUrl = vocabularyId
        ? `${API_BASE}/taxonomy/vocabularies/${vocabularyId}`
        : `${API_BASE}/taxonomy/vocabularies/machine-name/${vocabularyMachineName}`;

      const vocabResponse = await fetch(vocabUrl, {
        credentials: 'include',
        headers,
      });

      if (!vocabResponse.ok) {
        if (vocabResponse.status === 404) {
          throw new Error(
            `Vocabulary "${vocabularyMachineName || vocabularyId}" not found. Please contact an administrator to set up taxonomy vocabularies.`
          );
        }
        throw new Error('Failed to load vocabulary');
      }

      const vocabData = await vocabResponse.json();
      const loadedVocab = vocabData.vocabulary;
      setVocabulary(loadedVocab);

      // Load terms
      const termsResponse = await fetch(
        `${API_BASE}/taxonomy/vocabularies/${loadedVocab.id}/terms`,
        {
          credentials: 'include',
          headers,
        }
      );

      if (!termsResponse.ok) {
        throw new Error('Failed to load terms');
      }

      const termsData = await termsResponse.json();
      setTerms(termsData.terms || []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (event: SelectChangeEvent<string | string[]>) => {
    const newValue = event.target.value;
    onChange(newValue);
  };

  const isMultiple = vocabulary?.allow_multiple ?? false;
  const isRequired = required || vocabulary?.required || false;

  if (loading) {
    return (
      <FormControl fullWidth disabled data-testid="taxonomy-field-loading">
        <InputLabel>{label}</InputLabel>
        <Box sx={{ display: 'flex', alignItems: 'center', p: 2 }}>
          <CircularProgress size={20} sx={{ mr: 1 }} />
          {vocabulary?.name ? `Loading ${vocabulary.name}...` : 'Loading...'}
        </Box>
      </FormControl>
    );
  }

  if (loadError) {
    return (
      <FormControl fullWidth error data-testid="taxonomy-field-error">
        <InputLabel>{label}</InputLabel>
        <OutlinedInput label={label} disabled value="" />
        <FormHelperText>{loadError}</FormHelperText>
      </FormControl>
    );
  }

  if (!vocabulary) {
    return null;
  }

  return (
    <FormControl fullWidth error={error} disabled={disabled} required={isRequired}>
      <InputLabel id={`taxonomy-${vocabulary.machine_name}-label`}>{label}</InputLabel>
      <Select
        labelId={`taxonomy-${vocabulary.machine_name}-label`}
        id={`taxonomy-${vocabulary.machine_name}`}
        data-testid="taxonomy-field-select"
        multiple={isMultiple}
        value={value}
        onChange={handleChange}
        input={<OutlinedInput label={label} />}
        renderValue={(selected) => {
          if (isMultiple && Array.isArray(selected)) {
            return (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {selected.map((termId) => {
                  const term = terms.find((t) => t.id === termId);
                  return term ? (
                    <Chip key={termId} label={term.name} size="small" />
                  ) : null;
                })}
              </Box>
            );
          }
          const term = terms.find((t) => t.id === selected);
          return term ? term.name : '';
        }}
      >
        {terms.length === 0 ? (
          <MenuItem disabled value="">
            <em>No terms available</em>
          </MenuItem>
        ) : (
          terms.map((term) => (
            <MenuItem key={term.id} value={term.id}>
              {term.name}
              {term.description && (
                <span style={{ marginLeft: '8px', color: '#999', fontSize: '0.875em' }}>
                  - {term.description}
                </span>
              )}
            </MenuItem>
          ))
        )}
      </Select>
      {helperText && <FormHelperText>{helperText}</FormHelperText>}
    </FormControl>
  );
};
