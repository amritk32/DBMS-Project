/**
 * Circulation Desk View: Issue & Return Lifecycle
 * Endpoints: GET /issues, POST /issues, POST /issues/{student_id}/{book_id}/{branch_no}/{from_date}/return
 */

import { api } from '../api.js';
import { Toast, Modal, escapeHtml } from '../components.js';

export async function renderCirculation(container) {
  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
      <div>
        <h2 style="font-size: 22px; margin-bottom: 4px;">Circulation Desk: Issue & Return Operations</h2>
        <p style="font-size: 13.5px; color: var(--text-muted);">Process book checkouts, monitor active loans, and record book returns into branch inventory.</p>
      </div>
      <div style="display: flex; gap: 10px;">
        <button class="btn btn-secondary" id="btn-refresh-issues">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>
          Refresh Desk
        </button>
        <button class="btn btn-primary" id="btn-open-issue-modal">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Issue a Book
        </button>
      </div>
    </div>

    <!-- Active Issues Table Card -->
    <div class="card">
      <div class="card-header">
        <div class="card-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
          Active Book Issues
          <span class="badge badge-pink" id="badge-total-issues">0 Active</span>
        </div>
      </div>

      <div class="table-container">
        <table class="data-table" id="table-active-issues">
          <thead>
            <tr>
              <th>Student</th>
              <th>Book Title</th>
              <th>Issuing Branch</th>
              <th>Issue Date (From_date)</th>
              <th>Due Date</th>
              <th>Loan Status</th>
              <th style="text-align: right; width: 140px;">Action</th>
            </tr>
          </thead>
          <tbody id="tbody-issues">
            <tr><td colspan="7" class="table-empty">Loading active circulation records...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById('btn-refresh-issues').onclick = () => loadIssuesList();
  document.getElementById('btn-open-issue-modal').onclick = () => openIssueBookModal();

  loadIssuesList();
}

async function loadIssuesList() {
  const tbody = document.getElementById('tbody-issues');
  if (!tbody) return;

  try {
    const [issues, students, books, branches] = await Promise.all([
      api.getIssues(),
      api.getStudents(),
      api.getBooks(),
      api.getBranches(),
    ]);

    // Build lookup maps
    const studentMap = {};
    students.forEach(s => { studentMap[s.Student_ID] = `${s.Student_Name} (#${s.Student_ID})`; });

    const bookMap = {};
    books.forEach(b => { bookMap[b.Book_ID] = `${b.Book_Name} (#${b.Book_ID})`; });

    const branchMap = {};
    branches.forEach(br => { branchMap[br.Branch_No] = `${br.Branch_Name} (#${br.Branch_No})`; });

    const countBadge = document.getElementById('badge-total-issues');
    if (countBadge) {
      countBadge.textContent = `${issues.length} Active`;
    }

    if (issues.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="table-empty">No books currently issued. All inventory copies are in library shelves.</td></tr>`;
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];

    tbody.innerHTML = issues.map(item => {
      const studentLabel = studentMap[item.Student_ID] || `Student #${item.Student_ID}`;
      const bookLabel = bookMap[item.Book_ID] || `Book #${item.Book_ID}`;
      const branchLabel = branchMap[item.Branch_No] || `Branch #${item.Branch_No}`;
      const isOverdue = item.Due_date < todayStr;

      return `
        <tr>
          <td><strong style="color: var(--text-primary);">${escapeHtml(studentLabel)}</strong></td>
          <td><strong style="color: var(--text-primary); font-size: 14px;">${escapeHtml(bookLabel)}</strong></td>
          <td><span class="badge badge-peach">${escapeHtml(branchLabel)}</span></td>
          <td>${escapeHtml(item.From_date)}</td>
          <td>
            <span style="font-weight: 700; color: ${isOverdue ? 'var(--color-danger)' : 'var(--text-primary)'}">
              ${escapeHtml(item.Due_date)}
            </span>
          </td>
          <td>
            <span class="badge ${isOverdue ? 'badge-danger' : 'badge-pink'}">
              ${isOverdue ? 'OVERDUE' : 'ACTIVE LOAN'}
            </span>
          </td>
          <td style="text-align: right;">
            <button 
              class="btn btn-sm btn-primary btn-return-book"
              data-student="${item.Student_ID}"
              data-book="${item.Book_ID}"
              data-branch="${item.Branch_No}"
              data-from="${item.From_date}"
              data-booklabel="${escapeHtml(bookLabel)}"
            >
              Return Book
            </button>
          </td>
        </tr>
      `;
    }).join('');

    // Attach Return Book Handlers
    tbody.querySelectorAll('.btn-return-book').forEach(btn => {
      btn.onclick = () => {
        const studentId = parseInt(btn.dataset.student, 10);
        const bookId = parseInt(btn.dataset.book, 10);
        const branchNo = parseInt(btn.dataset.branch, 10);
        const fromDate = btn.dataset.from;
        const bookLabel = btn.dataset.booklabel;

        Modal.confirm({
          title: 'Return Issued Book',
          message: `Process return for ${bookLabel} from Student #${studentId} to Branch #${branchNo} (issued ${fromDate})? This will delete the issue record and restore 1 copy to branch inventory.`,
          confirmText: 'Return Book',
          confirmClass: 'btn-primary',
          onConfirm: async () => {
            try {
              const res = await api.returnIssue(studentId, bookId, branchNo, fromDate);
              Toast.success(res.message || 'Book returned successfully!');
              // Immediate state sync
              loadIssuesList();
            } catch (err) {
              Toast.error(`Failed to return book: ${err.message}`);
            }
          },
        });
      };
    });

  } catch (err) {
    Toast.error(`Failed to load issues: ${err.message}`);
  }
}

async function openIssueBookModal() {
  let [students, books, branches, inventory] = await Promise.all([
    api.getStudents(),
    api.getBooks(),
    api.getBranches(),
    api.getInventory(),
  ]);

  if (students.length === 0) {
    Toast.error('Please register at least one student before issuing books.');
    return;
  }
  if (books.length === 0) {
    Toast.error('Please add at least one book to catalogue before issuing.');
    return;
  }
  if (branches.length === 0) {
    Toast.error('Please create at least one library branch before issuing.');
    return;
  }

  // Pre-calculate today and +14 days
  const today = new Date();
  const fromDateStr = today.toISOString().split('T')[0];
  const dueDateObj = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
  const dueDateStr = dueDateObj.toISOString().split('T')[0];

  const studentOptions = students.map(s => `
    <option value="${s.Student_ID}">${escapeHtml(s.Student_Name)} (ID: ${s.Student_ID}, Phone: ${escapeHtml(s.Phone)})</option>
  `).join('');

  const bookOptions = books.map(b => `
    <option value="${b.Book_ID}">${escapeHtml(b.Book_Name)} (#${b.Book_ID})</option>
  `).join('');

  const branchOptions = branches.map(br => `
    <option value="${br.Branch_No}">${escapeHtml(br.Branch_Name)} (#${br.Branch_No})</option>
  `).join('');

  Modal.open({
    title: 'Issue Book to Student',
    bodyHtml: `
      <form id="form-issue-book">
        <div class="form-group">
          <label class="form-label" for="select-issue-student">Student <span class="required">*</span></label>
          <select id="select-issue-student" class="form-control" required>
            <option value="">Select student...</option>
            ${studentOptions}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label" for="select-issue-book">Book Title <span class="required">*</span></label>
          <select id="select-issue-book" class="form-control" required>
            <option value="">Select book...</option>
            ${bookOptions}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label" for="select-issue-branch">Branch Location <span class="required">*</span></label>
          <select id="select-issue-branch" class="form-control" required>
            <option value="">Select branch...</option>
            ${branchOptions}
          </select>
          <div id="stock-availability-indicator" style="margin-top: 6px; font-size: 12.5px;"></div>
        </div>

        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label" for="input-issue-from">Issue Date (From_date) <span class="required">*</span></label>
            <input type="date" id="input-issue-from" class="form-control" value="${fromDateStr}" required />
          </div>
          <div class="form-group">
            <label class="form-label" for="input-issue-due">Due Date <span class="required">*</span></label>
            <input type="date" id="input-issue-due" class="form-control" value="${dueDateStr}" required />
          </div>
        </div>
      </form>
    `,
    footerButtons: [
      { label: 'Cancel', className: 'btn-outline', onClick: () => true },
      {
        label: 'Issue Book',
        className: 'btn-primary',
        id: 'btn-submit-issue-book',
        onClick: async () => {
          const studentIdVal = document.getElementById('select-issue-student').value;
          const bookIdVal = document.getElementById('select-issue-book').value;
          const branchNoVal = document.getElementById('select-issue-branch').value;
          const fromDate = document.getElementById('input-issue-from').value;
          const dueDate = document.getElementById('input-issue-due').value;

          if (!studentIdVal || !bookIdVal || !branchNoVal || !fromDate || !dueDate) {
            Toast.error('All form fields are required to issue a book.');
            return false;
          }

          if (dueDate < fromDate) {
            Toast.error('Due date cannot precede the issue date.');
            return false;
          }

          const payload = {
            Student_ID: parseInt(studentIdVal, 10),
            Book_ID: parseInt(bookIdVal, 10),
            Branch_No: parseInt(branchNoVal, 10),
            From_date: fromDate,
            Due_date: dueDate,
          };

          try {
            await api.createIssue(payload);
            Toast.success('Book issued successfully!');
            loadIssuesList();
            return true;
          } catch (err) {
            Toast.error(`Failed to issue book: ${err.message}`);
            return false;
          }
        },
      },
    ],
    onRender: (body) => {
      // Live stock indicator when book and branch are picked
      const bookSelect = body.querySelector('#select-issue-book');
      const branchSelect = body.querySelector('#select-issue-branch');
      const indicator = body.querySelector('#stock-availability-indicator');

      const checkStock = () => {
        const bId = parseInt(bookSelect.value, 10);
        const brNo = parseInt(branchSelect.value, 10);
        if (!bId || !brNo) {
          indicator.innerHTML = '';
          return;
        }

        const match = inventory.find(i => i.Book_ID === bId && i.Branch_No === brNo);
        if (!match) {
          indicator.innerHTML = `<span style="color: var(--color-danger); font-weight: 700;">⚠ No inventory entry found for this book at this branch (0 copies).</span>`;
        } else if (match.No_Of_Copies <= 0) {
          indicator.innerHTML = `<span style="color: var(--color-danger); font-weight: 700;">⚠ 0 copies available at this branch. Issue will be rejected.</span>`;
        } else {
          indicator.innerHTML = `<span style="color: var(--color-success); font-weight: 700;">✓ ${match.No_Of_Copies} copy/copies available at this branch.</span>`;
        }
      };

      bookSelect.onchange = checkStock;
      branchSelect.onchange = checkStock;
    },
  });
}
