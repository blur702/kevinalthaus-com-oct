# Settings.tsx Race Condition & Memory Leak Fixes

## Issues to Fix

### Issue #5: Race Conditions
- Multiple async requests can overlap when rapidly switching tabs
- No cancellation mechanism for in-flight requests
- No loading state checks to prevent concurrent loads

### Issue #6: Memory Leaks
- Missing cleanup functions in useEffect hooks
- State updates on unmounted components
- No `isMounted` checks for async operations

## Implementation Pattern

### Step 1: Add isMounted ref and AbortControllers

```typescript
import React, { useState, useEffect, useCallback, useRef } from 'react';

function Settings() {
  // Add mounted state tracking
  const isMountedRef = useRef(true);

  // Add AbortControllers for each async operation
  const siteSettingsAbortController = useRef<AbortController | null>(null);
  const securitySettingsAbortController = useRef<AbortController | null>(null);
  const emailSettingsAbortController = useRef<AbortController | null>(null);
  const apiKeysAbortController = useRef<AbortController | null>(null);

  // ... existing state ...

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;

      // Cancel all in-flight requests
      siteSettingsAbortController.current?.abort();
      securitySettingsAbortController.current?.abort();
      emailSettingsAbortController.current?.abort();
      apiKeysAbortController.current?.abort();
    };
  }, []);
```

### Step 2: Update async loading functions

```typescript
  const loadSiteSettings = useCallback(async () => {
    // Prevent concurrent loads
    if (siteSettingsLoading) {
      return;
    }

    // Cancel previous request if still running
    siteSettingsAbortController.current?.abort();

    // Create new AbortController
    siteSettingsAbortController.current = new AbortController();

    setSiteSettingsLoading(true);
    setSiteSettingsError('');

    try {
      const response = await api.get('/settings/site', {
        signal: siteSettingsAbortController.current.signal
      });

      // Only update state if component is still mounted
      if (isMountedRef.current) {
        setSiteSettings(response.data);
      }
    } catch (error) {
      // Don't set error if request was aborted
      if (axios.isCancel(error)) {
        console.log('Site settings request canceled');
        return;
      }

      if (isMountedRef.current) {
        setSiteSettingsError('Failed to load site settings');
      }
    } finally {
      if (isMountedRef.current) {
        setSiteSettingsLoading(false);
      }
    }
  }, [siteSettingsLoading]); // Add dependency
```

### Step 3: Update useEffect for tab changes

```typescript
  useEffect(() => {
    // Cancel all in-flight requests when tab changes
    siteSettingsAbortController.current?.abort();
    securitySettingsAbortController.current?.abort();
    emailSettingsAbortController.current?.abort();
    apiKeysAbortController.current?.abort();

    // Load data for active tab
    if (activeTab === 0) {
      loadSiteSettings();
    } else if (activeTab === 1) {
      loadSecuritySettings();
    } else if (activeTab === 2) {
      loadEmailSettings();
    } else if (activeTab === 3) {
      loadApiKeys();
    }

    // Cleanup function
    return () => {
      // Cancel requests if tab changes before load completes
      siteSettingsAbortController.current?.abort();
      securitySettingsAbortController.current?.abort();
      emailSettingsAbortController.current?.abort();
      apiKeysAbortController.current?.abort();
    };
  }, [activeTab, loadSiteSettings, loadSecuritySettings, loadEmailSettings, loadApiKeys]);
```

### Step 4: Update save/submit functions

```typescript
  const handleSaveSiteSettings = async () => {
    if (siteSettingsSaving) {
      return; // Prevent double submission
    }

    setSiteSettingsSaving(true);
    setSiteSettingsError('');

    try {
      await api.put('/settings/site', siteSettings);

      if (isMountedRef.current) {
        // Show success message
        setSuccessMessage('Site settings saved successfully');
      }
    } catch (error) {
      if (isMountedRef.current) {
        setSiteSettingsError('Failed to save site settings');
      }
    } finally {
      if (isMountedRef.current) {
        setSiteSettingsSaving(false);
      }
    }
  };
```

### Step 5: Update settingsService.ts to accept AbortSignal

```typescript
// In packages/admin/src/services/settingsService.ts

export async function getSiteSettings(signal?: AbortSignal): Promise<SiteSettings> {
  const { data } = await api.get<SiteSettings>('/settings/site', { signal });
  return data;
}

export async function updateSiteSettings(settings: SiteSettings, signal?: AbortSignal): Promise<void> {
  await api.put('/settings/site', settings, { signal });
}

// ... similarly for other settings functions
```

## Files to Modify

1. **packages/admin/src/pages/Settings.tsx**
   - Add `isMountedRef` and AbortController refs
   - Update all async loading functions
   - Add cleanup function to main useEffect
   - Add loading state checks to prevent concurrent operations

2. **packages/admin/src/services/settingsService.ts**
   - Add optional `signal?: AbortSignal` parameter to all functions
   - Pass signal to api.get/post/put/delete calls

## Testing Checklist

- [ ] Rapidly switch between tabs - no duplicate requests
- [ ] Refresh page while requests are in flight - no console errors
- [ ] Navigate away from Settings page - no console errors
- [ ] Submit form twice quickly - only one submission
- [ ] Check browser DevTools for memory leaks
- [ ] Verify no "setState on unmounted component" warnings

## Benefits

1. **Race Condition Prevention**: AbortController cancels in-flight requests
2. **Memory Leak Prevention**: isMountedRef prevents setState on unmounted components
3. **Better UX**: Loading states prevent duplicate operations
4. **Cleaner Code**: Proper cleanup functions
5. **React Best Practices**: Follows React 18+ patterns

## Implementation Priority

1. **High Priority**: Add isMountedRef and cleanup on unmount (fixes memory leaks)
2. **High Priority**: Add AbortControllers to all async operations (fixes race conditions)
3. **Medium Priority**: Update settingsService to accept AbortSignal
4. **Low Priority**: Add request deduplication logic

## Additional Recommendations

1. Consider using a data fetching library like TanStack Query (React Query) which handles:
   - Automatic request cancellation
   - Request deduplication
   - Caching
   - Loading and error states

2. Consider moving to a state management library like Zustand or Redux Toolkit for complex state

3. Consider splitting Settings.tsx into smaller components (one per tab)

## Example Complete Implementation (Site Settings Tab)

```typescript
const Settings: React.FC = () => {
  const isMountedRef = useRef(true);
  const siteSettingsAbortController = useRef<AbortController | null>(null);

  const [activeTab, setActiveTab] = useState(0);
  const [siteSettings, setSiteSettings] = useState<SiteSettings>({});
  const [siteSettingsLoading, setSiteSettingsLoading] = useState(false);
  const [siteSettingsSaving, setSiteSettingsSaving] = useState(false);
  const [siteSettingsError, setSiteSettingsError] = useState('');

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      siteSettingsAbortController.current?.abort();
    };
  }, []);

  const loadSiteSettings = useCallback(async () => {
    if (siteSettingsLoading) return;

    siteSettingsAbortController.current?.abort();
    siteSettingsAbortController.current = new AbortController();

    setSiteSettingsLoading(true);
    setSiteSettingsError('');

    try {
      const data = await getSiteSettings(siteSettingsAbortController.current.signal);

      if (isMountedRef.current) {
        setSiteSettings(data);
      }
    } catch (error) {
      if (axios.isCancel(error)) return;

      if (isMountedRef.current) {
        setSiteSettingsError('Failed to load settings');
      }
    } finally {
      if (isMountedRef.current) {
        setSiteSettingsLoading(false);
      }
    }
  }, [siteSettingsLoading]);

  const handleSaveSiteSettings = async () => {
    if (siteSettingsSaving) return;

    setSiteSettingsSaving(true);
    setSiteSettingsError('');

    try {
      await updateSiteSettings(siteSettings);

      if (isMountedRef.current) {
        // Success
      }
    } catch (error) {
      if (isMountedRef.current) {
        setSiteSettingsError('Failed to save');
      }
    } finally {
      if (isMountedRef.current) {
        setSiteSettingsSaving(false);
      }
    }
  };

  useEffect(() => {
    if (activeTab === 0) {
      loadSiteSettings();
    }

    return () => {
      siteSettingsAbortController.current?.abort();
    };
  }, [activeTab, loadSiteSettings]);

  // ... rest of component
};
```
