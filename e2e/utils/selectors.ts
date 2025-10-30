/**
 * Common selectors used across E2E tests
 *
 * Centralizing selectors makes tests more maintainable
 * and easier to update when UI changes.
 */

export const selectors = {
  // Authentication selectors
  auth: {
    loginForm: 'form',
    identifierInput: 'input[name="identifier"]',
    passwordInput: 'input[name="password"]',
    submitButton: 'button[type="submit"]',
    errorAlert: '.MuiAlert-standardError',
    registerLink: 'a[href="/register"]',
    forgotPasswordLink: 'a[href="/reset-password"]',
  },

  // Dashboard selectors
  dashboard: {
    title: 'h1:has-text("Dashboard")',
    statCard: {
      container: '.MuiCard-root',
      title: '.MuiTypography-body2',
      value: '.MuiTypography-h4',
      change: '.MuiChip-root',
    },
    recentActivity: {
      section: 'h6:has-text("Recent Activity")',
      noActivity: 'text=No recent activity',
    },
    quickActions: {
      section: 'h6:has-text("Quick Actions")',
    },
  },

  // User management selectors
  users: {
    title: 'h1:has-text("Users")',
    createButton: 'button:has-text("Create User")',
    searchInput: 'input[placeholder*="Search"]',
    roleFilter: 'label:has-text("Role") + div select',
    statusFilter: 'label:has-text("Status") + div select',
    refreshButton: 'button[aria-label*="Refresh"]',

    // Table selectors
    table: {
      container: 'table',
      headerRow: 'thead tr',
      bodyRows: 'tbody tr',
      selectAllCheckbox: 'thead input[type="checkbox"]',
      rowCheckbox: 'tbody input[type="checkbox"]',
      sortLabel: '.MuiTableSortLabel-root',
      noDataMessage: 'text=No users found',
    },

    // Pagination selectors
    pagination: {
      container: '.MuiTablePagination-root',
      rowsPerPage: 'select[aria-label*="rows per page"]',
      previousButton: 'button[aria-label="Go to previous page"]',
      nextButton: 'button[aria-label="Go to next page"]',
      pageInfo: '.MuiTablePagination-displayedRows',
    },

    // Action buttons
    actions: {
      viewButton: 'button[aria-label*="View"]',
      editButton: 'button[aria-label*="Edit"]',
      deleteButton: 'button[aria-label*="Delete"]',
      moreButton: 'button[aria-label*="More"]',
    },

    // User row data
    row: {
      username: 'td:nth-child(2)',
      email: 'td:nth-child(3)',
      roleChip: 'td:nth-child(4) .MuiChip-root',
      statusChip: 'td:nth-child(5) .MuiChip-root',
      createdAt: 'td:nth-child(6)',
      lastLogin: 'td:nth-child(7)',
    },

    // Bulk actions
    bulk: {
      selectedChip: '.MuiChip-root:has-text("selected")',
      deleteSelectedButton: 'button:has-text("Delete Selected")',
      importExportButton: 'button:has-text("Import/Export")',
    },
  },

  // User form dialog selectors
  userForm: {
    dialog: '[role="dialog"]',
    title: '[role="dialog"] h2',
    usernameInput: 'input[name="username"]',
    emailInput: 'input[name="email"]',
    passwordInput: 'input[name="password"]',
    roleSelect: 'label:has-text("Role") + div select',
    activeCheckbox: 'input[type="checkbox"][name="active"]',
    cancelButton: 'button:has-text("Cancel")',
    submitButton: 'button[type="submit"]',
    errorMessage: '.MuiFormHelperText-root.Mui-error',
  },

  // User detail dialog selectors
  userDetail: {
    dialog: '[role="dialog"]',
    title: '[role="dialog"] h2',
    closeButton: 'button[aria-label="close"]',
    editButton: 'button:has-text("Edit")',
    field: (label: string): string => `text=${label}`,
    activityTimeline: '[data-testid="activity-timeline"]',
  },

  // Delete confirmation dialog
  deleteDialog: {
    dialog: '[role="dialog"]',
    title: 'h2:has-text("Confirm Delete")',
    message: '[role="dialog"] p',
    cancelButton: 'button:has-text("Cancel")',
    confirmButton: 'button:has-text("Delete")',
  },

  // Bulk operations dialog
  bulkDialog: {
    dialog: '[role="dialog"]',
    title: 'h2:has-text("Bulk Operations")',
    importTab: 'button:has-text("Import")',
    exportTab: 'button:has-text("Export")',
    fileInput: 'input[type="file"]',
    uploadButton: 'button:has-text("Upload")',
    downloadButton: 'button:has-text("Download")',
    closeButton: 'button:has-text("Close")',
  },

  // Common UI elements
  common: {
    loading: '.MuiCircularProgress-root',
    errorAlert: '.MuiAlert-standardError',
    successAlert: '.MuiAlert-standardSuccess',
    warningAlert: '.MuiAlert-standardWarning',
    infoAlert: '.MuiAlert-standardInfo',
    snackbar: '.MuiSnackbar-root',
    closeButton: 'button[aria-label="close"]',
  },

  // Navigation selectors
  navigation: {
    sidebar: 'nav',
    dashboardLink: 'a[href="/"]',
    usersLink: 'a[href="/users"]',
    contentLink: 'a[href="/content"]',
    analyticsLink: 'a[href="/analytics"]',
    settingsLink: 'a[href="/settings"]',
    userMenu: '[data-testid="user-menu"]',
    logoutButton: '[data-testid="logout-button"]',
  },
};

/**
 * Helper to get table row by index
 *
 * @param index - Row index (0-based)
 * @returns Row selector
 */
export function getTableRow(index: number): string {
  return `tbody tr:nth-child(${index + 1})`;
}

/**
 * Helper to get table cell by row and column
 *
 * @param rowIndex - Row index (0-based)
 * @param colIndex - Column index (1-based for nth-child)
 * @returns Cell selector
 */
export function getTableCell(rowIndex: number, colIndex: number): string {
  return `${getTableRow(rowIndex)} td:nth-child(${colIndex})`;
}

/**
 * Helper to get input by label text
 *
 * @param labelText - Label text
 * @returns Input selector
 */
export function getInputByLabel(labelText: string): string {
  return `label:has-text("${labelText}") + div input`;
}

/**
 * Helper to get select by label text
 *
 * @param labelText - Label text
 * @returns Select selector
 */
export function getSelectByLabel(labelText: string): string {
  return `label:has-text("${labelText}") + div select`;
}

/**
 * Helper to get button by text
 *
 * @param buttonText - Button text
 * @returns Button selector
 */
export function getButtonByText(buttonText: string): string {
  return `button:has-text("${buttonText}")`;
}

/**
 * Helper to get chip by text
 *
 * @param chipText - Chip text
 * @returns Chip selector
 */
export function getChipByText(chipText: string): string {
  return `.MuiChip-root:has-text("${chipText}")`;
}

/**
 * Helper to get alert by severity and text
 *
 * @param severity - Alert severity
 * @param text - Alert text (optional)
 * @returns Alert selector
 */
export function getAlert(severity: 'error' | 'success' | 'warning' | 'info', text?: string): string {
  const baseSelector = `.MuiAlert-standard${severity.charAt(0).toUpperCase() + severity.slice(1)}`;
  return text ? `${baseSelector}:has-text("${text}")` : baseSelector;
}
