/**
 * Page Builder Admin Routes
 */

import express, { Router } from 'express';

const router: Router = express.Router();

// Serve page builder admin interface
router.get('/admin/page-builder', (_req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Page Builder - Admin</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          background: #f5f5f5;
          color: #333;
        }

        .header {
          background: #fff;
          border-bottom: 1px solid #e0e0e0;
          padding: 1rem 2rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .header h1 {
          font-size: 1.5rem;
          font-weight: 600;
        }

        .header button {
          background: #2563eb;
          color: white;
          border: none;
          padding: 0.75rem 1.5rem;
          border-radius: 0.375rem;
          cursor: pointer;
          font-size: 0.875rem;
          font-weight: 500;
        }

        .header button:hover {
          background: #1d4ed8;
        }

        .container {
          max-width: 1200px;
          margin: 2rem auto;
          padding: 0 2rem;
        }

        .toolbar {
          background: #fff;
          border-radius: 0.5rem;
          padding: 1rem;
          margin-bottom: 1.5rem;
          display: flex;
          gap: 1rem;
          align-items: center;
        }

        .toolbar input {
          flex: 1;
          padding: 0.5rem 1rem;
          border: 1px solid #d1d5db;
          border-radius: 0.375rem;
          font-size: 0.875rem;
        }

        .toolbar select {
          padding: 0.5rem 1rem;
          border: 1px solid #d1d5db;
          border-radius: 0.375rem;
          font-size: 0.875rem;
          background: white;
        }

        .pages-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 1.5rem;
        }

        .page-card {
          background: #fff;
          border-radius: 0.5rem;
          padding: 1.5rem;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .page-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }

        .page-card h3 {
          font-size: 1.125rem;
          font-weight: 600;
          margin-bottom: 0.5rem;
        }

        .page-card .slug {
          color: #6b7280;
          font-size: 0.875rem;
          margin-bottom: 0.75rem;
        }

        .page-card .meta {
          display: flex;
          gap: 1rem;
          font-size: 0.75rem;
          color: #9ca3af;
        }

        .status {
          display: inline-block;
          padding: 0.25rem 0.75rem;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 500;
          text-transform: uppercase;
        }

        .status.draft {
          background: #e5e7eb;
          color: #374151;
        }

        .status.published {
          background: #d1fae5;
          color: #065f46;
        }

        .status.scheduled {
          background: #dbeafe;
          color: #1e40af;
        }

        .status.archived {
          background: #fee2e2;
          color: #991b1b;
        }

        .empty-state {
          text-align: center;
          padding: 4rem 2rem;
          background: #fff;
          border-radius: 0.5rem;
        }

        .empty-state h2 {
          font-size: 1.5rem;
          margin-bottom: 1rem;
          color: #6b7280;
        }

        .empty-state p {
          color: #9ca3af;
          margin-bottom: 2rem;
        }

        .modal {
          display: none;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          z-index: 1000;
          align-items: center;
          justify-content: center;
        }

        .modal.active {
          display: flex;
        }

        .modal-content {
          background: white;
          border-radius: 0.5rem;
          padding: 2rem;
          max-width: 500px;
          width: 90%;
        }

        .modal-content h2 {
          margin-bottom: 1.5rem;
        }

        .form-group {
          margin-bottom: 1rem;
        }

        .form-group label {
          display: block;
          margin-bottom: 0.5rem;
          font-weight: 500;
          font-size: 0.875rem;
        }

        .form-group input,
        .form-group select,
        .form-group textarea {
          width: 100%;
          padding: 0.5rem 1rem;
          border: 1px solid #d1d5db;
          border-radius: 0.375rem;
          font-size: 0.875rem;
        }

        .form-actions {
          display: flex;
          gap: 1rem;
          justify-content: flex-end;
          margin-top: 1.5rem;
        }

        .btn {
          padding: 0.5rem 1rem;
          border-radius: 0.375rem;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          border: none;
        }

        .btn-primary {
          background: #2563eb;
          color: white;
        }

        .btn-primary:hover {
          background: #1d4ed8;
        }

        .btn-secondary {
          background: #e5e7eb;
          color: #374151;
        }

        .btn-secondary:hover {
          background: #d1d5db;
        }

        .loading {
          text-align: center;
          padding: 4rem;
          color: #6b7280;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Page Builder</h1>
        <button onclick="openCreateModal()">Create New Page</button>
      </div>

      <div class="container">
        <div class="toolbar">
          <input type="text" id="searchInput" placeholder="Search pages..." onkeyup="filterPages()">
          <select id="statusFilter" onchange="filterPages()">
            <option value="">All Status</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="scheduled">Scheduled</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        <div id="pagesContainer">
          <div class="loading">Loading pages...</div>
        </div>
      </div>

      <!-- Create/Edit Modal -->
      <div id="pageModal" class="modal">
        <div class="modal-content">
          <h2 id="modalTitle">Create New Page</h2>
          <form id="pageForm" onsubmit="savePage(event)">
            <div class="form-group">
              <label for="pageTitle">Title *</label>
              <input type="text" id="pageTitle" required>
            </div>

            <div class="form-group">
              <label for="pageSlug">Slug *</label>
              <input type="text" id="pageSlug" required>
            </div>

            <div class="form-group">
              <label for="pageMetaDesc">Meta Description</label>
              <textarea id="pageMetaDesc" rows="3" maxlength="160"></textarea>
            </div>

            <div class="form-group">
              <label for="pageStatus">Status</label>
              <select id="pageStatus">
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="scheduled">Scheduled</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            <div class="form-actions">
              <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
              <button type="submit" class="btn btn-primary">Save Page</button>
            </div>
          </form>
        </div>
      </div>

      <script>
        let allPages = [];
        let currentPage = null;

        // Load pages on init
        loadPages();

        async function loadPages() {
          try {
            const response = await fetch('/api/page-builder/pages');
            const result = await response.json();

            if (result.success) {
              allPages = result.data;
              renderPages(allPages);
            } else {
              showError('Failed to load pages');
            }
          } catch (error) {
            console.error('Error loading pages:', error);
            showError('Failed to load pages');
          }
        }

        function renderPages(pages) {
          const container = document.getElementById('pagesContainer');

          if (pages.length === 0) {
            container.innerHTML = \`
              <div class="empty-state">
                <h2>No pages yet</h2>
                <p>Create your first page to get started</p>
                <button class="btn btn-primary" onclick="openCreateModal()">Create New Page</button>
              </div>
            \`;
            return;
          }

          container.innerHTML = '<div class="pages-grid">' + pages.map(page => \`
            <div class="page-card" onclick="editPage('\${page.id}')">
              <h3>\${escapeHtml(page.title)}</h3>
              <div class="slug">/pages/\${escapeHtml(page.slug)}</div>
              <div style="margin-bottom: 0.75rem;">
                <span class="status \${page.status}">\${page.status}</span>
              </div>
              <div class="meta">
                <span>Created: \${new Date(page.created_at).toLocaleDateString()}</span>
                <span>Updated: \${new Date(page.updated_at).toLocaleDateString()}</span>
              </div>
            </div>
          \`).join('') + '</div>';
        }

        function filterPages() {
          const searchTerm = document.getElementById('searchInput').value.toLowerCase();
          const statusFilter = document.getElementById('statusFilter').value;

          const filtered = allPages.filter(page => {
            const matchesSearch = page.title.toLowerCase().includes(searchTerm) ||
                                   page.slug.toLowerCase().includes(searchTerm);
            const matchesStatus = !statusFilter || page.status === statusFilter;
            return matchesSearch && matchesStatus;
          });

          renderPages(filtered);
        }

        function openCreateModal() {
          currentPage = null;
          document.getElementById('modalTitle').textContent = 'Create New Page';
          document.getElementById('pageForm').reset();
          document.getElementById('pageModal').classList.add('active');
        }

        async function editPage(pageId) {
          try {
            const response = await fetch(\`/api/page-builder/pages/\${pageId}\`);
            const result = await response.json();

            if (result.success) {
              currentPage = result.data;
              document.getElementById('modalTitle').textContent = 'Edit Page';
              document.getElementById('pageTitle').value = currentPage.title;
              document.getElementById('pageSlug').value = currentPage.slug;
              document.getElementById('pageMetaDesc').value = currentPage.meta_description || '';
              document.getElementById('pageStatus').value = currentPage.status;
              document.getElementById('pageModal').classList.add('active');
            }
          } catch (error) {
            console.error('Error loading page:', error);
            alert('Failed to load page');
          }
        }

        function closeModal() {
          document.getElementById('pageModal').classList.remove('active');
          currentPage = null;
        }

        async function savePage(event) {
          event.preventDefault();

          const data = {
            title: document.getElementById('pageTitle').value,
            slug: document.getElementById('pageSlug').value,
            meta_description: document.getElementById('pageMetaDesc').value,
            status: document.getElementById('pageStatus').value,
            layout_json: {
              version: '1.0',
              grid: {
                columns: 12,
                gap: { unit: 'px', value: 16 },
                snapToGrid: true,
                breakpoints: [
                  { name: 'mobile', minWidth: 0, columns: 4 },
                  { name: 'tablet', minWidth: 768, columns: 8 },
                  { name: 'desktop', minWidth: 1024, columns: 12 }
                ]
              },
              widgets: []
            }
          };

          try {
            const url = currentPage
              ? \`/api/page-builder/pages/\${currentPage.id}\`
              : '/api/page-builder/pages';
            const method = currentPage ? 'PUT' : 'POST';

            const response = await fetch(url, {
              method,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data)
            });

            const result = await response.json();

            if (result.success) {
              closeModal();
              loadPages();
            } else {
              alert('Error: ' + result.error);
            }
          } catch (error) {
            console.error('Error saving page:', error);
            alert('Failed to save page');
          }
        }

        function escapeHtml(text) {
          const div = document.createElement('div');
          div.textContent = text;
          return div.innerHTML;
        }

        function showError(message) {
          document.getElementById('pagesContainer').innerHTML = \`
            <div class="empty-state">
              <h2>Error</h2>
              <p>\${message}</p>
              <button class="btn btn-primary" onclick="loadPages()">Retry</button>
            </div>
          \`;
        }

        // Auto-generate slug from title
        document.getElementById('pageTitle').addEventListener('input', (e) => {
          if (!currentPage) {
            const slug = e.target.value
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-+|-+$/g, '');
            document.getElementById('pageSlug').value = slug;
          }
        });
      </script>
    </body>
    </html>
  `);
});

export default router;
