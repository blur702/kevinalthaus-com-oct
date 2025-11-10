/**
 * Taxonomy Management Page
 * Manages vocabularies and terms for the taxonomy system
 */

import { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Switch,
  Alert,
  Chip,
  Stack,
  CircularProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';

const API_BASE = (import.meta as any).env?.VITE_API_URL || '/api';

interface Vocabulary {
  id: string;
  name: string;
  machine_name: string;
  description?: string;
  hierarchy_depth: number;
  allow_multiple: boolean;
  required: boolean;
  weight: number;
  created_at: string;
  updated_at: string;
}

interface Term {
  id: string;
  vocabulary_id: string;
  name: string;
  slug: string;
  description?: string;
  parent_id?: string;
  weight: number;
  meta_data?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  children?: Term[];
}

export default function Taxonomy() {
  const [vocabularies, setVocabularies] = useState<Vocabulary[]>([]);
  const [selectedVocabulary, setSelectedVocabulary] = useState<Vocabulary | null>(null);
  const [terms, setTerms] = useState<Term[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [_tabValue, _setTabValue] = useState(0);

  // Vocabulary dialog state
  const [vocabularyDialog, setVocabularyDialog] = useState(false);
  const [vocabularyForm, setVocabularyForm] = useState<Partial<Vocabulary>>({});
  const [editingVocabulary, setEditingVocabulary] = useState<Vocabulary | null>(null);

  // Term dialog state
  const [termDialog, setTermDialog] = useState(false);
  const [termForm, setTermForm] = useState<Partial<Term>>({});
  const [editingTerm, setEditingTerm] = useState<Term | null>(null);

  // Load vocabularies on mount
  useEffect(() => {
    loadVocabularies();
  }, []);

  // Load terms when vocabulary is selected
  useEffect(() => {
    if (selectedVocabulary) {
      loadTerms(selectedVocabulary.id);
    }
  }, [selectedVocabulary]);

  const loadVocabularies = async () => {
    try {
      setLoading(true);
      setError(null);

      const csrfMatch = document.cookie.match(/csrf-token=([^;]+)/);
      const csrfToken = csrfMatch ? decodeURIComponent(csrfMatch[1]) : null;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }

      const response = await fetch(`${API_BASE}/taxonomy/vocabularies`, {
        credentials: 'include',
        headers,
      });

      if (!response.ok) {
        throw new Error('Failed to load vocabularies');
      }

      const data = await response.json();
      setVocabularies(data.vocabularies || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const loadTerms = async (vocabularyId: string) => {
    try {
      setLoading(true);
      setError(null);

      const csrfMatch = document.cookie.match(/csrf-token=([^;]+)/);
      const csrfToken = csrfMatch ? decodeURIComponent(csrfMatch[1]) : null;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }

      const response = await fetch(`${API_BASE}/taxonomy/vocabularies/${vocabularyId}/terms?hierarchy=true`, {
        credentials: 'include',
        headers,
      });

      if (!response.ok) {
        throw new Error('Failed to load terms');
      }

      const data = await response.json();
      setTerms(data.terms || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateVocabulary = () => {
    setVocabularyForm({
      name: '',
      machine_name: '',
      description: '',
      hierarchy_depth: 0,
      allow_multiple: true,
      required: false,
      weight: 0,
    });
    setEditingVocabulary(null);
    setVocabularyDialog(true);
  };

  const handleEditVocabulary = (vocabulary: Vocabulary) => {
    setVocabularyForm(vocabulary);
    setEditingVocabulary(vocabulary);
    setVocabularyDialog(true);
  };

  const handleSaveVocabulary = async () => {
    try {
      setError(null);

      const csrfMatch = document.cookie.match(/csrf-token=([^;]+)/);
      const csrfToken = csrfMatch ? decodeURIComponent(csrfMatch[1]) : null;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }

      const url = editingVocabulary
        ? `${API_BASE}/taxonomy/vocabularies/${editingVocabulary.id}`
        : `${API_BASE}/taxonomy/vocabularies`;
      const method = editingVocabulary ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        credentials: 'include',
        headers,
        body: JSON.stringify(vocabularyForm),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save vocabulary');
      }

      setVocabularyDialog(false);
      await loadVocabularies();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const handleDeleteVocabulary = async (id: string) => {
    if (!confirm('Are you sure you want to delete this vocabulary and all its terms?')) {
      return;
    }

    try {
      setError(null);

      const csrfMatch = document.cookie.match(/csrf-token=([^;]+)/);
      const csrfToken = csrfMatch ? decodeURIComponent(csrfMatch[1]) : null;

      const headers: Record<string, string> = {};
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }

      const response = await fetch(`${API_BASE}/taxonomy/vocabularies/${id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers,
      });

      if (!response.ok) {
        throw new Error('Failed to delete vocabulary');
      }

      if (selectedVocabulary?.id === id) {
        setSelectedVocabulary(null);
      }
      await loadVocabularies();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const handleCreateTerm = () => {
    if (!selectedVocabulary) {return;}

    setTermForm({
      vocabulary_id: selectedVocabulary.id,
      name: '',
      slug: '',
      description: '',
      parent_id: undefined,
      weight: 0,
    });
    setEditingTerm(null);
    setTermDialog(true);
  };

  const handleEditTerm = (term: Term) => {
    setTermForm(term);
    setEditingTerm(term);
    setTermDialog(true);
  };

  const handleSaveTerm = async () => {
    try {
      setError(null);

      const csrfMatch = document.cookie.match(/csrf-token=([^;]+)/);
      const csrfToken = csrfMatch ? decodeURIComponent(csrfMatch[1]) : null;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }

      const url = editingTerm
        ? `${API_BASE}/taxonomy/terms/${editingTerm.id}`
        : `${API_BASE}/taxonomy/terms`;
      const method = editingTerm ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        credentials: 'include',
        headers,
        body: JSON.stringify(termForm),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save term');
      }

      setTermDialog(false);
      if (selectedVocabulary) {
        await loadTerms(selectedVocabulary.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const handleDeleteTerm = async (id: string) => {
    if (!confirm('Are you sure you want to delete this term?')) {
      return;
    }

    try {
      setError(null);

      const csrfMatch = document.cookie.match(/csrf-token=([^;]+)/);
      const csrfToken = csrfMatch ? decodeURIComponent(csrfMatch[1]) : null;

      const headers: Record<string, string> = {};
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }

      const response = await fetch(`${API_BASE}/taxonomy/terms/${id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers,
      });

      if (!response.ok) {
        throw new Error('Failed to delete term');
      }

      if (selectedVocabulary) {
        await loadTerms(selectedVocabulary.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const renderTermTree = (terms: Term[], depth = 0) => {
    return terms.map((term) => (
      <Box key={term.id} sx={{ pl: depth * 4 }}>
        <ListItem
          secondaryAction={
            <Stack direction="row" spacing={1}>
              <IconButton edge="end" onClick={() => handleEditTerm(term)}>
                <EditIcon />
              </IconButton>
              <IconButton edge="end" onClick={() => handleDeleteTerm(term.id)}>
                <DeleteIcon />
              </IconButton>
            </Stack>
          }
        >
          <ListItemText
            primary={term.name}
            secondary={term.description || term.slug}
          />
          {term.children && term.children.length > 0 && (
            <Chip label={`${term.children.length} children`} size="small" sx={{ mr: 2 }} />
          )}
        </ListItem>
        {term.children && term.children.length > 0 && renderTermTree(term.children, depth + 1)}
      </Box>
    ));
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Taxonomy Management
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 2, height: 'calc(100vh - 200px)' }}>
        {/* Vocabularies Panel */}
        <Paper sx={{ width: '30%', display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="h6">Vocabularies</Typography>
              <Button
                startIcon={<AddIcon />}
                variant="contained"
                size="small"
                onClick={handleCreateVocabulary}
              >
                Add
              </Button>
            </Stack>
          </Box>
          <List sx={{ flex: 1, overflow: 'auto' }}>
            {loading && vocabularies.length === 0 ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              vocabularies.map((vocab) => (
                <ListItemButton
                  key={vocab.id}
                  selected={selectedVocabulary?.id === vocab.id}
                  onClick={() => setSelectedVocabulary(vocab)}
                >
                  <ListItemText
                    primary={vocab.name}
                    secondary={vocab.machine_name}
                  />
                  <ListItemSecondaryAction>
                    <IconButton edge="end" onClick={() => handleEditVocabulary(vocab)}>
                      <EditIcon />
                    </IconButton>
                    <IconButton edge="end" onClick={() => handleDeleteVocabulary(vocab.id)}>
                      <DeleteIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItemButton>
              ))
            )}
          </List>
        </Paper>

        {/* Terms Panel */}
        <Paper sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {selectedVocabulary ? (
            <>
              <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="h6">{selectedVocabulary.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {selectedVocabulary.description || selectedVocabulary.machine_name}
                    </Typography>
                  </Box>
                  <Button
                    startIcon={<AddIcon />}
                    variant="contained"
                    size="small"
                    onClick={handleCreateTerm}
                  >
                    Add Term
                  </Button>
                </Stack>
                <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                  <Chip
                    label={`Hierarchy: ${selectedVocabulary.hierarchy_depth > 0 ? 'Yes' : 'No'}`}
                    size="small"
                  />
                  <Chip
                    label={`Multiple: ${selectedVocabulary.allow_multiple ? 'Yes' : 'No'}`}
                    size="small"
                  />
                  <Chip
                    label={`Required: ${selectedVocabulary.required ? 'Yes' : 'No'}`}
                    size="small"
                  />
                </Stack>
              </Box>
              <List sx={{ flex: 1, overflow: 'auto' }}>
                {loading && terms.length === 0 ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                    <CircularProgress />
                  </Box>
                ) : terms.length === 0 ? (
                  <Box sx={{ p: 4, textAlign: 'center' }}>
                    <Typography color="text.secondary">
                      No terms yet. Click "Add Term" to create one.
                    </Typography>
                  </Box>
                ) : (
                  renderTermTree(terms)
                )}
              </List>
            </>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
              <Typography color="text.secondary">
                Select a vocabulary to manage its terms
              </Typography>
            </Box>
          )}
        </Paper>
      </Box>

      {/* Vocabulary Dialog */}
      <Dialog open={vocabularyDialog} onClose={() => setVocabularyDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingVocabulary ? 'Edit Vocabulary' : 'Create Vocabulary'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Name"
              required
              fullWidth
              value={vocabularyForm.name || ''}
              onChange={(e) => setVocabularyForm({ ...vocabularyForm, name: e.target.value })}
            />
            <TextField
              label="Machine Name"
              required
              fullWidth
              value={vocabularyForm.machine_name || ''}
              onChange={(e) => setVocabularyForm({ ...vocabularyForm, machine_name: e.target.value })}
              helperText="Lowercase, no spaces (e.g., categories, tags)"
              disabled={!!editingVocabulary}
            />
            <TextField
              label="Description"
              fullWidth
              multiline
              rows={2}
              value={vocabularyForm.description || ''}
              onChange={(e) => setVocabularyForm({ ...vocabularyForm, description: e.target.value })}
            />
            <TextField
              label="Hierarchy Depth"
              type="number"
              fullWidth
              value={vocabularyForm.hierarchy_depth ?? 0}
              onChange={(e) => setVocabularyForm({ ...vocabularyForm, hierarchy_depth: parseInt(e.target.value) })}
              helperText="0 = flat, 1+ = hierarchical"
            />
            <TextField
              label="Weight"
              type="number"
              fullWidth
              value={vocabularyForm.weight ?? 0}
              onChange={(e) => setVocabularyForm({ ...vocabularyForm, weight: parseInt(e.target.value) })}
              helperText="Display order (lower numbers first)"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={vocabularyForm.allow_multiple ?? true}
                  onChange={(e) => setVocabularyForm({ ...vocabularyForm, allow_multiple: e.target.checked })}
                />
              }
              label="Allow Multiple Terms"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={vocabularyForm.required ?? false}
                  onChange={(e) => setVocabularyForm({ ...vocabularyForm, required: e.target.checked })}
                />
              }
              label="Required"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVocabularyDialog(false)}>Cancel</Button>
          <Button onClick={handleSaveVocabulary} variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Term Dialog */}
      <Dialog open={termDialog} onClose={() => setTermDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingTerm ? 'Edit Term' : 'Create Term'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Name"
              required
              fullWidth
              value={termForm.name || ''}
              onChange={(e) => setTermForm({ ...termForm, name: e.target.value })}
            />
            <TextField
              label="Slug"
              fullWidth
              value={termForm.slug || ''}
              onChange={(e) => setTermForm({ ...termForm, slug: e.target.value })}
              helperText="Leave empty to auto-generate from name"
            />
            <TextField
              label="Description"
              fullWidth
              multiline
              rows={2}
              value={termForm.description || ''}
              onChange={(e) => setTermForm({ ...termForm, description: e.target.value })}
            />
            <TextField
              label="Weight"
              type="number"
              fullWidth
              value={termForm.weight ?? 0}
              onChange={(e) => setTermForm({ ...termForm, weight: parseInt(e.target.value) })}
              helperText="Display order (lower numbers first)"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTermDialog(false)}>Cancel</Button>
          <Button onClick={handleSaveTerm} variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
