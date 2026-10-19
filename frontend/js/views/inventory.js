/**
 * Branch & Inventory Management View
 * Endpoints: GET /inventory, PUT /inventory/{book_id}/{branch_no}, CRUD /branches
 */

import { api } from '../api.js';
import { Toast, Modal, escapeHtml } from '../components.js';

let currentInventoryTab = 'stock'; // 'stock' | 'branches'

export async function renderInventory(container) {
  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
      <div>
        <h2 style="font-size: 22px; margin-bottom: 4px;">Branch & Inventory Management</h2>
        <p style="font-size: 13.5px; color: var(--text-muted);">Manage library locations, inspect copy availability, and adjust stock counts.</p>
      </div>
      <div id="inv-action-container"></div>
    </div>

    <!-- Navigation Tabs -->
    <div class="tabs-nav">
      <button class="tab-btn active" id="tab-stock" data-tab="stock">Stock & Inventory Matrix</button>
      <button class="tab-btn" id="tab-branches" data-tab="branches">Branch Locations</button>
    </div>

    <div id="inv-content-container"></div>
  `;

  // Attach tab switching
  const tabBtns = container.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.onclick = () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentInventoryTab = btn.dataset.tab;
      renderCurrentInventoryTab();
    };
  });

  renderCurrentInventoryTab();
}

function renderCurrentInventoryTab() {
  const content = document.getElementById('inv-content-container');
  const actionContainer = document.getElementById('inv-action-container');
  if (!content || !actionContainer) return;

  if (currentInventoryTab === 'stock') {
    renderStockTab(content, actionContainer);
  } else {
    renderBranchesTab(content, actionContainer);
  }
}

/* ==========================================================================
   STOCK MATRIX TAB
   ========================================================================== */
async function renderStockTab(content, actionContainer) {
  actionContainer.innerHTML = `
    <button class="btn btn-primary" id="btn-add-stock-entry">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      Add/Set Branch Stock
    </button>
  `;

  document.getElementById('btn-add-stock-entry').onclick = () => openStockUpdateModal();

  content.innerHTML = `
    <!-- Branch Filter -->
    <div class="filter-bar">
      <div class="filter-item" style="max-width: 320px;">
        <label for="filter-inv-branch">Filter by Branch</label>
        <select id="filter-inv-branch" class="form-control">
          <option value="">All Branches</option>
        </select>
      </div>
      <button class="btn btn-secondary" id="btn-refresh-inv" style="align-self: flex-end;">
        Refresh Stock
      </button>
    </div>

    <!-- Inventory Table -->
    <div class="table-container">
      <table class="data-table" id="table-inventory">
        <thead>
          <tr>
            <th style="width: 80px;">Book ID</th>
            <th>Book Title</th>
            <th>Branch Name</th>
            <th style="width: 140px;">Available Copies</th>
            <th style="text-align: right; width: 140px;">Stock Action</th>
          </tr>
        </thead>
        <tbody id="tbody-inventory">
          <tr><td colspan="5" class="table-empty">Loading inventory records...</td></tr>
        </tbody>
      </table>
    </div>
  `;

  // Populate branch filter
  try {
    const branches = await api.getBranches();
    const select = document.getElementById('filter-inv-branch');
    if (select) {
      branches.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b.Branch_No;
        opt.textContent = `${b.Branch_Name} (#${b.Branch_No})`;
        select.appendChild(opt);
      });
      select.onchange = () => loadInventoryList(select.value);
    }
  } catch (err) {
    console.error('Failed to load branches for filter:', err);
  }

  document.getElementById('btn-refresh-inv').onclick = () => {
    const branchNo = document.getElementById('filter-inv-branch')?.value || null;
    loadInventoryList(branchNo);
  };

  loadInventoryList();
}

async function loadInventoryList(branchNo = null) {
  const tbody = document.getElementById('tbody-inventory');
  if (!tbody) return;

  try {
    const records = await api.getInventory(branchNo);
    if (records.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="table-empty">No inventory records found for selected branch.</td></tr>`;
      return;
    }

    tbody.innerHTML = records.map(item => `
      <tr>
        <td><strong>#${escapeHtml(item.Book_ID)}</strong></td>
        <td><strong style="color: var(--text-primary); font-size: 14px;">${escapeHtml(item.Book_Name)}</strong></td>
        <td>
          <span class="badge badge-peach">
            ${escapeHtml(item.Branch_Name)} (#${escapeHtml(item.Branch_No)})
          </span>
        </td>
        <td>
          <span class="badge ${item.No_Of_Copies > 0 ? 'badge-success' : 'badge-danger'}" style="font-size: 13px;">
            ${escapeHtml(item.No_Of_Copies)} copies
          </span>
        </td>
        <td style="text-align: right;">
          <button 
            class="btn btn-sm btn-primary btn-adjust-stock"
            data-book="${item.Book_ID}"
            data-bookname="${escapeHtml(item.Book_Name)}"
            data-branch="${item.Branch_No}"
            data-branchname="${escapeHtml(item.Branch_Name)}"
            data-copies="${item.No_Of_Copies}"
          >
            Adjust Stock
          </button>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.btn-adjust-stock').forEach(btn => {
      btn.onclick = () => {
        openStockUpdateModal({
          bookId: parseInt(btn.dataset.book, 10),
          bookName: btn.dataset.bookname,
          branchNo: parseInt(btn.dataset.branch, 10),
          branchName: btn.dataset.branchname,
          currentCopies: parseInt(btn.dataset.copies, 10),
        });
      };
    });

  } catch (err) {
    Toast.error(`Failed to load inventory: ${err.message}`);
  }
}

async function openStockUpdateModal(preset = null) {
  let [books, branches] = await Promise.all([
    api.getBooks(),
    api.getBranches(),
  ]);

  const bookOptions = books.map(b => `
    <option value="${b.Book_ID}" ${preset && preset.bookId === b.Book_ID ? 'selected' : ''}>
      ${escapeHtml(b.Book_Name)} (#${b.Book_ID})
    </option>
  `).join('');

  const branchOptions = branches.map(b => `
    <option value="${b.Branch_No}" ${preset && preset.branchNo === b.Branch_No ? 'selected' : ''}>
      ${escapeHtml(b.Branch_Name)} (#${b.Branch_No})
    </option>
  `).join('');

  const initialCopies = preset ? preset.currentCopies : 1;

  Modal.open({
    title: preset ? `Adjust Stock: ${escapeHtml(preset.bookName)}` : 'Set Branch Inventory',
    bodyHtml: `
      <form id="form-stock-update">
        <div class="form-group">
          <label class="form-label" for="select-stock-book">Book <span class="required">*</span></label>
          <select id="select-stock-book" class="form-control" ${preset ? 'disabled' : 'required'}>
            <option value="">Select a book...</option>
            ${bookOptions}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" for="select-stock-branch">Branch <span class="required">*</span></label>
          <select id="select-stock-branch" class="form-control" ${preset ? 'disabled' : 'required'}>
            <option value="">Select a library branch...</option>
            ${branchOptions}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" for="input-stock-copies">Available Copies (No_Of_Copies) <span class="required">*</span></label>
          <input type="number" id="input-stock-copies" class="form-control" min="0" value="${initialCopies}" required />
          <span class="form-hint">Copies cannot be negative or lower than active issues of this book at this branch.</span>
        </div>
      </form>
    `,
    footerButtons: [
      { label: 'Cancel', className: 'btn-outline', onClick: () => true },
      {
        label: 'Update Stock',
        className: 'btn-primary',
        id: 'btn-submit-stock-update',
        onClick: async () => {
          const bookId = preset ? preset.bookId : parseInt(document.getElementById('select-stock-book').value, 10);
          const branchNo = preset ? preset.branchNo : parseInt(document.getElementById('select-stock-branch').value, 10);
          const copiesVal = parseInt(document.getElementById('input-stock-copies').value, 10);

          if (isNaN(bookId) || isNaN(branchNo)) {
            Toast.error('Please select both a book and branch.');
            return false;
          }
          if (isNaN(copiesVal) || copiesVal < 0) {
            Toast.error('Copies count must be an integer >= 0.');
            return false;
          }

          try {
            await api.updateInventory(bookId, branchNo, copiesVal);
            Toast.success(`Updated stock for Book #${bookId} at Branch #${branchNo} to ${copiesVal} copies!`);
            const currentFilterBranch = document.getElementById('filter-inv-branch')?.value || null;
            loadInventoryList(currentFilterBranch);
            return true;
          } catch (err) {
            Toast.error(`Stock update failed: ${err.message}`);
            return false;
          }
        },
      },
    ],
  });
}

/* ==========================================================================
   BRANCHES MANAGEMENT TAB
   ========================================================================== */
async function renderBranchesTab(content, actionContainer) {
  actionContainer.innerHTML = `
    <button class="btn btn-primary" id="btn-add-branch">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      Add New Branch
    </button>
  `;

  document.getElementById('btn-add-branch').onclick = () => openAddBranchModal();

  content.innerHTML = `
    <div class="table-container">
      <table class="data-table" id="table-branches">
        <thead>
          <tr>
            <th style="width: 100px;">Branch No</th>
            <th>Branch Name</th>
            <th>Location / Address</th>
            <th style="text-align: right; width: 180px;">Actions</th>
          </tr>
        </thead>
        <tbody id="tbody-branches">
          <tr><td colspan="4" class="table-empty">Loading branches...</td></tr>
        </tbody>
      </table>
    </div>
  `;

  loadBranchesList();
}

async function loadBranchesList() {
  const tbody = document.getElementById('tbody-branches');
  if (!tbody) return;

  try {
    const branches = await api.getBranches();
    if (branches.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="table-empty">No library branches configured yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = branches.map(b => `
      <tr>
        <td><strong>#${escapeHtml(b.Branch_No)}</strong></td>
        <td><strong style="font-size: 14px;">${escapeHtml(b.Branch_Name)}</strong></td>
        <td>${escapeHtml(b.Location)}</td>
        <td style="text-align: right;">
          <button class="btn btn-sm btn-outline btn-edit-branch" data-id="${b.Branch_No}" data-name="${escapeHtml(b.Branch_Name)}" data-loc="${escapeHtml(b.Location)}">
            Edit
          </button>
          <button class="btn btn-sm btn-danger btn-delete-branch" data-id="${b.Branch_No}">
            Delete
          </button>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.btn-edit-branch').forEach(btn => {
      btn.onclick = () => openEditBranchModal(parseInt(btn.dataset.id, 10), btn.dataset.name, btn.dataset.loc);
    });

    tbody.querySelectorAll('.btn-delete-branch').forEach(btn => {
      btn.onclick = () => {
        const id = parseInt(btn.dataset.id, 10);
        Modal.confirm({
          title: 'Delete Library Branch',
          message: `Are you sure you want to delete Branch #${id}? This will fail if books or active circulations reference this branch.`,
          confirmText: 'Delete Branch',
          confirmClass: 'btn-danger',
          onConfirm: async () => {
            try {
              await api.deleteBranch(id);
              Toast.success(`Branch #${id} deleted successfully!`);
              loadBranchesList();
            } catch (err) {
              Toast.error(`Delete failed: ${err.message}`);
            }
          },
        });
      };
    });

  } catch (err) {
    Toast.error(`Failed to load branches: ${err.message}`);
  }
}

function openAddBranchModal() {
  Modal.open({
    title: 'Add New Library Branch',
    bodyHtml: `
      <form id="form-add-branch">
        <div class="form-group">
          <label class="form-label" for="input-branch-name">Branch Name <span class="required">*</span></label>
          <input type="text" id="input-branch-name" class="form-control" placeholder="e.g. Central City Branch" required />
        </div>
        <div class="form-group">
          <label class="form-label" for="input-branch-location">Location / Address <span class="required">*</span></label>
          <input type="text" id="input-branch-location" class="form-control" placeholder="e.g. 104 Main Street, Building B" required />
        </div>
      </form>
    `,
    footerButtons: [
      { label: 'Cancel', className: 'btn-outline', onClick: () => true },
      {
        label: 'Create Branch',
        className: 'btn-primary',
        id: 'btn-submit-add-branch',
        onClick: async () => {
          const name = document.getElementById('input-branch-name').value.trim();
          const location = document.getElementById('input-branch-location').value.trim();

          if (!name || !location) {
            Toast.error('Both branch name and location are required.');
            return false;
          }

          try {
            await api.createBranch({ Branch_Name: name, Location: location });
            Toast.success('Library branch created successfully!');
            loadBranchesList();
            return true;
          } catch (err) {
            Toast.error(`Failed to create branch: ${err.message}`);
            return false;
          }
        },
      },
    ],
  });
}

function openEditBranchModal(branchNo, currentName, currentLocation) {
  Modal.open({
    title: `Edit Branch #${branchNo}`,
    bodyHtml: `
      <form id="form-edit-branch">
        <div class="form-group">
          <label class="form-label" for="input-edit-branch-name">Branch Name <span class="required">*</span></label>
          <input type="text" id="input-edit-branch-name" class="form-control" value="${escapeHtml(currentName)}" required />
        </div>
        <div class="form-group">
          <label class="form-label" for="input-edit-branch-loc">Location / Address <span class="required">*</span></label>
          <input type="text" id="input-edit-branch-loc" class="form-control" value="${escapeHtml(currentLocation)}" required />
        </div>
      </form>
    `,
    footerButtons: [
      { label: 'Cancel', className: 'btn-outline', onClick: () => true },
      {
        label: 'Save Changes',
        className: 'btn-primary',
        id: 'btn-submit-edit-branch',
        onClick: async () => {
          const name = document.getElementById('input-edit-branch-name').value.trim();
          const loc = document.getElementById('input-edit-branch-loc').value.trim();

          if (!name || !loc) {
            Toast.error('Branch name and location cannot be blank.');
            return false;
          }

          try {
            await api.updateBranch(branchNo, { Branch_Name: name, Location: loc });
            Toast.success(`Branch #${branchNo} updated!`);
            loadBranchesList();
            return true;
          } catch (err) {
            Toast.error(`Update failed: ${err.message}`);
            return false;
          }
        },
      },
    ],
  });
}
