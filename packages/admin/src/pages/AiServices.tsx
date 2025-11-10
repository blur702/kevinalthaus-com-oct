import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
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
  TextField,
  InputAdornment,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Settings as SettingsIcon,
  Science as TestIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
} from '@mui/icons-material';
import type {
  AIServiceConfig,
  AIPromptCategory,
  AIPrompt,
} from '../types/aiService';
import {
  listAIServices,
  testAIService,
  listCategories,
  deleteCategory,
  listPrompts,
  deletePrompt,
  updatePrompt,
  type ListPromptsParams,
} from '../services/aiServicesService';
import ServiceConfigDialog from '../components/aiServices/ServiceConfigDialog';
import PromptDialog from '../components/aiServices/PromptDialog';
import CategoryDialog from '../components/aiServices/CategoryDialog';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`ai-services-tabpanel-${index}`}
      aria-labelledby={`ai-services-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

const AiServices: React.FC = () => {
  // Tab state
  const [activeTab, setActiveTab] = useState(0);

  // Services state
  const [services, setServices] = useState<AIServiceConfig[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [selectedService, setSelectedService] = useState<AIServiceConfig | null>(null);
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [testingService, setTestingService] = useState<string | null>(null);

  // Categories state
  const [categories, setCategories] = useState<AIPromptCategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<AIPromptCategory | null>(null);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [deleteCategoryId, setDeleteCategoryId] = useState<string | null>(null);

  // Prompts state
  const [prompts, setPrompts] = useState<AIPrompt[]>([]);
  const [promptsTotal, setPromptsTotal] = useState(0);
  const [promptsPage, setPromptsPage] = useState(0);
  const [promptsRowsPerPage, setPromptsRowsPerPage] = useState(25);
  const [loadingPrompts, setLoadingPrompts] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<AIPrompt | null>(null);
  const [promptDialogOpen, setPromptDialogOpen] = useState(false);
  const [deletePromptId, setDeletePromptId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [favoriteFilter, setFavoriteFilter] = useState<boolean | 'all'>('all');

  // Snackbar state
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  }>({
    open: false,
    message: '',
    severity: 'info',
  });

  // ============================================================================
  // Utility Functions
  // ============================================================================

  const showSnackbar = useCallback((
    message: string,
    severity: 'success' | 'error' | 'info' | 'warning'
  ): void => {
    setSnackbar({ open: true, message, severity });
  }, []);

  // ============================================================================
  // Services Functions
  // ============================================================================

  const loadServices = useCallback(async (): Promise<void> => {
    setLoadingServices(true);
    try {
      const data = await listAIServices();
      setServices(data);
    } catch (error) {
      showSnackbar('Failed to load AI services', 'error');
    } finally {
      setLoadingServices(false);
    }
  }, [showSnackbar]);

  const handleConfigureService = (service: AIServiceConfig): void => {
    setSelectedService(service);
    setServiceDialogOpen(true);
  };

  const handleTestService = async (serviceName: string): Promise<void> => {
    setTestingService(serviceName);
    try {
      const result = await testAIService(serviceName);
      showSnackbar(result.message, result.configured ? 'success' : 'warning');
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      showSnackbar(err.response?.data?.error || 'Service test failed', 'error');
    } finally {
      setTestingService(null);
    }
  };

  // ============================================================================
  // Categories Functions
  // ============================================================================

  const loadCategories = useCallback(async (): Promise<void> => {
    setLoadingCategories(true);
    try {
      const data = await listCategories();
      setCategories(data);
    } catch (error) {
      showSnackbar('Failed to load categories', 'error');
    } finally {
      setLoadingCategories(false);
    }
  }, [showSnackbar]);

  const handleCreateCategory = (): void => {
    setSelectedCategory(null);
    setCategoryDialogOpen(true);
  };

  const handleEditCategory = (category: AIPromptCategory): void => {
    setSelectedCategory(category);
    setCategoryDialogOpen(true);
  };

  const handleDeleteCategory = async (): Promise<void> => {
    if (!deleteCategoryId) return;

    try {
      await deleteCategory(deleteCategoryId);
      showSnackbar('Category deleted successfully', 'success');
      loadCategories();
      if (activeTab === 1) {
        loadPrompts();
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      showSnackbar(err.response?.data?.error || 'Failed to delete category', 'error');
    } finally {
      setDeleteCategoryId(null);
    }
  };

  // ============================================================================
  // Prompts Functions
  // ============================================================================

  const loadPrompts = useCallback(async (): Promise<void> => {
    setLoadingPrompts(true);
    try {
      const params: ListPromptsParams = {
        page: promptsPage + 1,
        limit: promptsRowsPerPage,
      };

      if (searchQuery) params.search = searchQuery;
      if (categoryFilter !== 'all') params.category_id = categoryFilter;
      if (favoriteFilter !== 'all') params.is_favorite = favoriteFilter;

      const data = await listPrompts(params);
      setPrompts(data.prompts);
      setPromptsTotal(data.total);
    } catch (error) {
      showSnackbar('Failed to load prompts', 'error');
    } finally {
      setLoadingPrompts(false);
    }
  }, [promptsPage, promptsRowsPerPage, searchQuery, categoryFilter, favoriteFilter, showSnackbar]);

  // ============================================================================
  // Effects
  // ============================================================================

  // Load data on mount and tab change
  useEffect(() => {
    if (activeTab === 0) {
      loadServices();
    } else if (activeTab === 1) {
      loadPrompts();
      loadCategories();
    } else if (activeTab === 2) {
      loadCategories();
    }
  }, [activeTab, loadServices, loadPrompts, loadCategories]);

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleCreatePrompt = (): void => {
    setSelectedPrompt(null);
    setPromptDialogOpen(true);
  };

  const handleEditPrompt = (prompt: AIPrompt): void => {
    setSelectedPrompt(prompt);
    setPromptDialogOpen(true);
  };

  const handleToggleFavorite = async (prompt: AIPrompt): Promise<void> => {
    try {
      await updatePrompt(prompt.id, { is_favorite: !prompt.is_favorite });
      showSnackbar(
        `Prompt ${prompt.is_favorite ? 'removed from' : 'added to'} favorites`,
        'success'
      );
      loadPrompts();
    } catch (error) {
      showSnackbar('Failed to update favorite status', 'error');
    }
  };

  const handleDeletePrompt = async (): Promise<void> => {
    if (!deletePromptId) return;

    try {
      await deletePrompt(deletePromptId);
      showSnackbar('Prompt deleted successfully', 'success');
      loadPrompts();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      showSnackbar(err.response?.data?.error || 'Failed to delete prompt', 'error');
    } finally {
      setDeletePromptId(null);
    }
  };

  const handleSnackbarClose = (): void => {
    setSnackbar({ ...snackbar, open: false });
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number): void => {
    setActiveTab(newValue);
  };

  const handleServiceDialogSuccess = (): void => {
    loadServices();
    showSnackbar('Service configuration updated successfully', 'success');
  };

  const handleCategoryDialogSuccess = (): void => {
    loadCategories();
    if (activeTab === 1) {
      loadPrompts();
    }
    showSnackbar(
      `Category ${selectedCategory ? 'updated' : 'created'} successfully`,
      'success'
    );
  };

  const handlePromptDialogSuccess = (): void => {
    loadPrompts();
    showSnackbar(
      `Prompt ${selectedPrompt ? 'updated' : 'created'} successfully`,
      'success'
    );
  };

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          AI Services Management
        </Typography>
      </Box>

      <Paper sx={{ width: '100%' }}>
        <Tabs value={activeTab} onChange={handleTabChange} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tab label="AI Services" />
          <Tab label="Prompt Library" />
          <Tab label="Categories" />
        </Tabs>

        {/* Services Tab */}
        <TabPanel value={activeTab} index={0}>
          <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              startIcon={<RefreshIcon />}
              onClick={loadServices}
              disabled={loadingServices}
            >
              Refresh
            </Button>
          </Box>

          {loadingServices ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Service Name</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>API Key Configured</TableCell>
                    <TableCell>Model</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {services.map((service) => (
                    <TableRow key={service.id}>
                      <TableCell>
                        <Typography variant="body1" sx={{ textTransform: 'capitalize' }}>
                          {service.service_name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={service.enabled ? 'Enabled' : 'Disabled'}
                          color={service.enabled ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={service.api_key_configured ? 'Yes' : 'No'}
                          color={service.api_key_configured ? 'success' : 'warning'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{service.settings.model || 'Not set'}</TableCell>
                      <TableCell align="right">
                        <Tooltip title="Configure">
                          <IconButton
                            size="small"
                            onClick={() => handleConfigureService(service)}
                          >
                            <SettingsIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Test Connection">
                          <IconButton
                            size="small"
                            onClick={() => handleTestService(service.service_name)}
                            disabled={testingService === service.service_name}
                          >
                            {testingService === service.service_name ? (
                              <CircularProgress size={20} />
                            ) : (
                              <TestIcon />
                            )}
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </TabPanel>

        {/* Prompts Tab */}
        <TabPanel value={activeTab} index={1}>
          <Box sx={{ mb: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
            <TextField
              placeholder="Search prompts..."
              size="small"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
              sx={{ flexGrow: 1 }}
            />
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleCreatePrompt}
            >
              Create Prompt
            </Button>
            <Button
              startIcon={<RefreshIcon />}
              onClick={loadPrompts}
              disabled={loadingPrompts}
            >
              Refresh
            </Button>
          </Box>

          {loadingPrompts ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Title</TableCell>
                      <TableCell>Category</TableCell>
                      <TableCell>Variables</TableCell>
                      <TableCell>Favorite</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {prompts.map((prompt) => (
                      <TableRow key={prompt.id}>
                        <TableCell>
                          <Typography variant="body1">{prompt.title}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {prompt.content.length > 60
                              ? `${prompt.content.substring(0, 60)}...`
                              : prompt.content}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {prompt.category_name ? (
                            <Chip label={prompt.category_name} size="small" />
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              Uncategorized
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          {prompt.variables.length > 0 ? (
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                              {prompt.variables.slice(0, 3).map((v) => (
                                <Chip key={v} label={v} size="small" variant="outlined" />
                              ))}
                              {prompt.variables.length > 3 && (
                                <Chip
                                  label={`+${prompt.variables.length - 3}`}
                                  size="small"
                                  variant="outlined"
                                />
                              )}
                            </Box>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              None
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <IconButton
                            size="small"
                            onClick={() => handleToggleFavorite(prompt)}
                          >
                            {prompt.is_favorite ? (
                              <StarIcon color="warning" />
                            ) : (
                              <StarBorderIcon />
                            )}
                          </IconButton>
                        </TableCell>
                        <TableCell align="right">
                          <Tooltip title="Edit">
                            <IconButton
                              size="small"
                              onClick={() => handleEditPrompt(prompt)}
                            >
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton
                              size="small"
                              onClick={() => setDeletePromptId(prompt.id)}
                            >
                              <DeleteIcon />
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
                count={promptsTotal}
                rowsPerPage={promptsRowsPerPage}
                page={promptsPage}
                onPageChange={(_e, newPage) => setPromptsPage(newPage)}
                onRowsPerPageChange={(e) => {
                  setPromptsRowsPerPage(parseInt(e.target.value, 10));
                  setPromptsPage(0);
                }}
              />
            </>
          )}
        </TabPanel>

        {/* Categories Tab */}
        <TabPanel value={activeTab} index={2}>
          <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleCreateCategory}
            >
              Create Category
            </Button>
            <Button
              startIcon={<RefreshIcon />}
              onClick={loadCategories}
              disabled={loadingCategories}
            >
              Refresh
            </Button>
          </Box>

          {loadingCategories ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>Sort Order</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {categories.map((category) => (
                    <TableRow key={category.id}>
                      <TableCell>
                        <Typography variant="body1">{category.name}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {category.description || 'No description'}
                        </Typography>
                      </TableCell>
                      <TableCell>{category.sort_order}</TableCell>
                      <TableCell align="right">
                        <Tooltip title="Edit">
                          <IconButton
                            size="small"
                            onClick={() => handleEditCategory(category)}
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            onClick={() => setDeleteCategoryId(category.id)}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </TabPanel>
      </Paper>

      {/* Dialogs */}
      <ServiceConfigDialog
        open={serviceDialogOpen}
        service={selectedService}
        onClose={() => setServiceDialogOpen(false)}
        onSuccess={handleServiceDialogSuccess}
      />

      <PromptDialog
        open={promptDialogOpen}
        prompt={selectedPrompt}
        onClose={() => setPromptDialogOpen(false)}
        onSuccess={handlePromptDialogSuccess}
      />

      <CategoryDialog
        open={categoryDialogOpen}
        category={selectedCategory}
        onClose={() => setCategoryDialogOpen(false)}
        onSuccess={handleCategoryDialogSuccess}
      />

      {/* Delete Confirmations */}
      <Dialog open={Boolean(deletePromptId)} onClose={() => setDeletePromptId(null)}>
        <DialogTitle>Delete Prompt</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this prompt? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeletePromptId(null)}>Cancel</Button>
          <Button onClick={handleDeletePrompt} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(deleteCategoryId)} onClose={() => setDeleteCategoryId(null)}>
        <DialogTitle>Delete Category</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this category? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteCategoryId(null)}>Cancel</Button>
          <Button onClick={handleDeleteCategory} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={handleSnackbarClose}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default AiServices;
