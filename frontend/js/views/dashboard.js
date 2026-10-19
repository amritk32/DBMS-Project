/**
 * Dashboard & Reports View
 * Endpoints: GET /health, GET /reports/summary, GET /reports/overdue, POST /issues/.../return
 */

import { api } from '../api.js';
import { Toast, Modal, escapeHtml } from '../components.js';

export async function renderDashboard(container) {
  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
      <div>
        <h2 style="font-size: 22px; margin-bottom: 4px;">System Overview & Analytics</h2>
        <p style="font-size: 13.5px; color: var(--text-muted);">Real-time metrics, system health status, and active overdue circulations.</p>
      </div>
      <button class="btn btn-secondary" id="btn-refresh-dashboard">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>
        Refresh Dashboard
      </button>
    </div>

    <!-- Summary Metrics Grid -->
    <div class="metrics-grid" id="dashboard-metrics">
      <div class="stat-card">
        <span class="stat-card-label">Total Books</span>
        <span class="stat-card-value" id="stat-books">-</span>
        <span class="stat-card-badge">Catalogue</span>
      </div>
      <div class="stat-card">
        <span class="stat-card-label">Available Copies</span>
        <span class="stat-card-value" id="stat-copies">-</span>
        <span class="stat-card-badge">Stocked</span>
      </div>
      <div class="stat-card">
        <span class="stat-card-label">Active Issues</span>
        <span class="stat-card-value" id="stat-issues">-</span>
        <span class="stat-card-badge">Circulating</span>
      </div>
      <div class="stat-card">
        <span class="stat-card-label">Registered Students</span>
        <span class="stat-card-value" id="stat-students">-</span>
        <span class="stat-card-badge">Members</span>
      </div>
      <div class="stat-card">
        <span class="stat-card-label">Library Branches</span>
        <span class="stat-card-value" id="stat-branches">-</span>
        <span class="stat-card-badge">Locations</span>
      </div>
      <div class="stat-card">
        <span class="stat-card-label">Authors / Pubs</span>
        <span class="stat-card-value" id="stat-contributors">-</span>
        <span class="stat-card-badge">Creators</span>
      </div>
    </div>

    <!-- Overdue Issues Section -->
    <div class="card" style="margin-top: 24px;">
      <div class="card-header">
        <div class="card-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          Overdue Books Monitoring
          <span class="badge badge-danger" id="badge-overdue-count">0 Overdue</span>
        </div>
      </div>
      
      <div class="table-container">
        <table class="data-table" id="table-overdue">
          <thead>
            <tr>
              <th>Student ID</th>
              <th>Book ID</th>
              <th>Branch No</th>
              <th>Issue Date</th>
              <th>Due Date</th>
              <th>Status</th>
              <th style="text-align: right;">Action</th>
            </tr>
          </thead>
          <tbody id="tbody-overdue">
            <tr><td colspan="7" class="table-empty">Loading overdue records...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Bind refresh
  document.getElementById('btn-refresh-dashboard').onclick = () => loadDashboardData();

  await loadDashboardData();
}

async function loadDashboardData() {
  try {
    const [summary, overdue] = await Promise.all([
      api.getSummary(),
      api.getOverdue(),
    ]);

    // Populate Metrics
    document.getElementById('stat-books').textContent = summary.total_books ?? 0;
    document.getElementById('stat-copies').textContent = summary.total_available_copies ?? 0;
    document.getElementById('stat-issues').textContent = summary.total_issue_records ?? 0;
    document.getElementById('stat-students').textContent = summary.total_students ?? 0;
    document.getElementById('stat-branches').textContent = summary.total_branches ?? 0;
    document.getElementById('stat-contributors').textContent = `${summary.total_authors ?? 0} / ${summary.total_publishers ?? 0}`;

    // Overdue badge
    const overdueCount = overdue.length;
    const badgeOverdue = document.getElementById('badge-overdue-count');
    if (badgeOverdue) {
      badgeOverdue.textContent = `${overdueCount} Overdue`;
      badgeOverdue.className = overdueCount > 0 ? 'badge badge-danger' : 'badge badge-success';
    }

    // Populate Overdue Table
    const tbody = document.getElementById('tbody-overdue');
    if (!tbody) return;

    if (overdue.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="table-empty">✓ No overdue circulations currently recorded. Excellent!</td></tr>`;
      return;
    }

    tbody.innerHTML = overdue.map(item => `
      <tr>
        <td><strong>#${escapeHtml(item.Student_ID)}</strong></td>
        <td><strong>#${escapeHtml(item.Book_ID)}</strong></td>
        <td>Branch ${escapeHtml(item.Branch_No)}</td>
        <td>${escapeHtml(item.From_date)}</td>
        <td><span style="color: var(--color-danger); font-weight: 700;">${escapeHtml(item.Due_date)}</span></td>
        <td><span class="badge badge-danger">OVERDUE</span></td>
        <td style="text-align: right;">
          <button 
            class="btn btn-sm btn-primary btn-return-overdue"
            data-student="${escapeHtml(item.Student_ID)}"
            data-book="${escapeHtml(item.Book_ID)}"
            data-branch="${escapeHtml(item.Branch_No)}"
            data-from="${escapeHtml(item.From_date)}"
          >
            Return Book
          </button>
        </td>
      </tr>
    `).join('');

    // Attach return handlers
    tbody.querySelectorAll('.btn-return-overdue').forEach(btn => {
      btn.onclick = async () => {
        const studentId = parseInt(btn.dataset.student, 10);
        const bookId = parseInt(btn.dataset.book, 10);
        const branchNo = parseInt(btn.dataset.branch, 10);
        const fromDate = btn.dataset.from;

        Modal.confirm({
          title: 'Return Overdue Book',
          message: `Process book return for Student #${studentId}, Book #${bookId} at Branch #${branchNo} (issued on ${fromDate})? This will restore 1 available copy to inventory.`,
          confirmText: 'Confirm Return',
          confirmClass: 'btn-primary',
          onConfirm: async () => {
            try {
              const res = await api.returnIssue(studentId, bookId, branchNo, fromDate);
              Toast.success(res.message || 'Book returned successfully!');
              await loadDashboardData();
            } catch (err) {
              Toast.error(`Failed to return book: ${err.message}`);
            }
          },
        });
      };
    });

  } catch (err) {
    Toast.error(`Failed to load dashboard data: ${err.message}`);
  }
}
