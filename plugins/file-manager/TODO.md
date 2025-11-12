# File Manager Plugin - TODO

## Critical - Must Implement Before Production

### 1. Physical File Operations (HIGH PRIORITY)
**Status:** Not Implemented
**Location:** `src/services/batchService.ts`

**Issue:** Batch copy and delete operations do not handle physical files on disk.

**Impact:**
- `batchCopyFiles()` creates duplicate database records pointing to the same physical file
- Deleting one copy will break the other copy
- `batchDeleteFiles()` with hard delete leaves orphaned files on disk
- Storage usage calculations will be incorrect

**Solution:**
- Integrate with `StorageService` from main-app
- Implement physical file copying in `batchCopyFiles()`
- Implement physical file deletion in `batchDeleteFiles()`
- Add reference counting or proper file lifecycle management

**References:**
- Lines 204-212 in `batchService.ts`
- Lines 370-372 in `batchService.ts`

### 2. Folder Permissions System (MEDIUM PRIORITY)
**Status:** Database schema exists, not implemented
**Location:** `migrations/04-create-folder-permissions.sql`, services/routes

**Issue:** The `folder_permissions` table exists but is never queried or enforced.

**Impact:**
- All access control relies solely on role checks (admin/editor/viewer)
- No granular folder-level permissions
- Cannot grant specific users access to specific folders
- Cannot implement folder sharing or collaboration features

**Solution:**
- Implement permission checking in `FolderService` methods
- Add middleware for permission validation on routes
- Create UI for permission management
- **OR** Document as future enhancement and consider removing table

### 3. Audit Logging (MEDIUM PRIORITY)
**Status:** Database schema exists, not implemented
**Location:** `migrations/05-create-file-access-log.sql`

**Issue:** The `file_access_log` table exists but is never written to.

**Impact:**
- No audit trail for file/folder access
- Cannot track who viewed/downloaded files
- Compliance issues if auditing was a requirement
- Cannot generate usage analytics

**Solution:**
- Implement logging in all route handlers
- Add middleware for automatic access logging
- Create service method for structured logging
- **OR** Document as future enhancement and consider removing table

## Important - Should Address

### 4. Error Response Format Standardization
**Status:** Inconsistent
**Location:** All route files

**Issue:** File-manager uses `{ success: false, error: 'message' }` while blog plugin uses `{ error: 'message' }`.

**Solution:**
- Choose one format and standardize across all plugins
- Update shared types if needed
- Document the standard in architecture docs

### 5. Type Safety Improvements
**Location:** `src/services/folderService.ts:495`

**Issue:** Using `any[]` instead of `Folder[]` in `buildFolderTree()`.

**Solution:**
```typescript
private buildFolderTree(folders: Folder[]): FolderWithChildren[] {
```

### 6. Pagination Support
**Status:** Not implemented
**Location:** `src/routes/folders.ts`

**Issue:** No pagination on folder listing endpoint.

**Impact:**
- Could return thousands of folders in one request
- Performance issues with large folder structures
- Memory consumption

**Solution:**
- Add pagination parameters (page, limit) to folder listing
- Add pagination to file listing within folders
- Document pagination in API docs

## Enhancement Opportunities

### 7. Transaction Isolation Level
**Location:** `src/services/folderService.ts:361`

**Issue:** Potential race condition in concurrent folder moves could create circular references.

**Solution:**
- Use serializable transaction isolation level for folder moves
- Add row-level locks with `FOR UPDATE`
- Add retry logic for transaction conflicts

### 8. Folder Search/Filter
**Status:** Not implemented

**Enhancement:** Add search capabilities:
- Search folders by name
- Filter by color, type, creator
- Full-text search on paths
- Date range filters

### 9. Bulk Operations Progress Tracking
**Status:** Basic implementation

**Enhancement:**
- WebSocket or SSE for real-time progress
- Job queue for long-running batch operations
- Resume/retry failed operations

### 10. Folder Templates
**Status:** Not implemented

**Enhancement:**
- Create folder structures from templates
- Common folder hierarchies (e.g., project structure)
- Recursive folder creation with predefined structure

## Documentation Needed

### 11. API Documentation
- Add OpenAPI/Swagger specifications
- Document all error codes and responses
- Add request/response examples
- Document rate limits

### 12. Permission Model Documentation
- Document planned permission inheritance model
- Explain permission priority (user vs role)
- Document default permissions

### 13. Migration Guide
- Document how to upgrade from basic file storage
- Database migration strategy for existing files
- Rollback procedures

## Testing Requirements

### 14. Unit Tests
- Service methods
- Validation logic
- Helper functions

### 15. Integration Tests
- API endpoints
- Database migrations
- Permission checks

### 16. Performance Tests
- Batch operations with max size
- Deep folder hierarchies (10 levels)
- Large file count per folder

## Security Hardening

### 17. Input Validation
**Status:** Partial (Joi validation, basic sanitization added)

**Improvements:**
- More comprehensive XSS protection
- SQL injection testing
- Path traversal prevention validation

### 18. Rate Limiting at Middleware Level
**Status:** Array size limits added

**Enhancement:**
- Add time-based rate limiting middleware
- Per-user rate limits
- Adaptive rate limiting based on load

### 19. CSRF Protection
- Ensure CSRF tokens for state-changing operations
- Document CSRF requirements

## Performance Optimizations

### 20. Query Optimization
- Review and optimize recursive CTEs
- Add missing composite indexes if needed
- Implement query result caching

### 21. Batch Operation Optimization
- Implement parallel processing for independent operations
- Add batch INSERT/UPDATE where applicable
- Optimize transaction boundaries

## Future Features

### 22. Folder Sharing
- Generate share links
- Time-limited access
- Password-protected shares

### 23. Folder Versioning
- Track folder structure changes
- Restore previous folder arrangements
- Audit trail for folder modifications

### 24. Storage Quota Management
- Per-user storage limits
- Per-folder size tracking
- Quota alerts and enforcement

### 25. File Metadata Propagation
- Inherit metadata from folders
- Auto-tagging based on folder
- Folder-level metadata templates

---

## Prioritization

**P0 - Block Production:**
1. Physical file operations integration

**P1 - Important for MVP:**
2. Folder permissions OR clear documentation of limitation
3. Audit logging OR remove table
4. Error response standardization
5. Pagination

**P2 - Nice to Have:**
6. Transaction isolation improvements
7. Type safety improvements
8. Search/filter capabilities
9. Comprehensive testing

**P3 - Future Enhancements:**
10. Folder sharing
11. Storage quotas
12. Advanced analytics
