/**
 * Catalogue & Multi-Filter Search View
 * Covers: Books, Authors, Publishers, M2M Book-Author mapping, and Search
 */

import { api } from '../api.js';
import { Toast, Modal, escapeHtml } from '../components.js';

let currentTab = 'books'; // 'books' | 'authors' | 'publishers'

export async function renderCatalogue(container) {
  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
      <div>
        <h2 style="font-size: 22px; margin-bottom: 4px;">Catalogue & Resource Repository</h2>
        <p style="font-size: 13.5px; color: var(--text-muted);">Manage books, authors, publishing entities, and multi-filter catalogue search.</p>
      </div>
      <div id="tab-action-container"></div>
    </div>

    <!-- Navigation Tabs -->
    <div class="tabs-nav">
      <button class="tab-btn active" id="tab-books" data-tab="books">Books Catalogue</button>
      <button class="tab-btn" id="tab-authors" data-tab="authors">Authors Directory</button>
      <button class="tab-btn" id="tab-publishers" data-tab="publishers">Publishers Directory</button>
    </div>

    <div id="tab-content-container"></div>
  `;

  // Attach tab switching
  const tabBtns = container.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.onclick = () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentTab = btn.dataset.tab;
      renderCurrentTab();
    };
  });

  renderCurrentTab();
}

function renderCurrentTab() {
  const content = document.getElementById('tab-content-container');
  const actionContainer = document.getElementById('tab-action-container');
  if (!content || !actionContainer) return;

  if (currentTab === 'books') {
    renderBooksTab(content, actionContainer);
  } else if (currentTab === 'authors') {
    renderAuthorsTab(content, actionContainer);
  } else if (currentTab === 'publishers') {
    renderPublishersTab(content, actionContainer);
  }
}

/* ==========================================================================
   BOOKS TAB
   ========================================================================== */
async function renderBooksTab(content, actionContainer) {
  actionContainer.innerHTML = `
    <button class="btn btn-primary" id="btn-add-book">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      Add New Book
    </button>
  `;

  document.getElementById('btn-add-book').onclick = () => openAddBookModal();

  content.innerHTML = `
    <!-- Multi-Filter Search Bar -->
    <div class="filter-bar">
      <div class="filter-item">
        <label for="filter-title">Book Title</label>
        <input type="text" id="filter-title" class="form-control" placeholder="Search by title..." />
      </div>
      <div class="filter-item">
        <label for="filter-author">Author Name</label>
        <input type="text" id="filter-author" class="form-control" placeholder="Search by author..." />
      </div>
      <div class="filter-item">
        <label for="filter-publisher">Publisher Name</label>
        <input type="text" id="filter-publisher" class="form-control" placeholder="Search by publisher..." />
      </div>
      <div class="filter-item">
        <label for="filter-branch">Branch Availability</label>
        <select id="filter-branch" class="form-control">
          <option value="">All Branches</option>
        </select>
      </div>
      <div style="display: flex; gap: 8px;">
        <button class="btn btn-primary" id="btn-execute-search">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          Search
        </button>
        <button class="btn btn-secondary" id="btn-clear-search">Clear</button>
      </div>
    </div>

    <!-- Books Table -->
    <div class="table-container">
      <table class="data-table" id="table-books">
        <thead>
          <tr>
            <th style="width: 80px;">Book ID</th>
            <th>Book Title</th>
            <th>Publisher</th>
            <th>Associated Authors</th>
            <th style="text-align: right; width: 220px;">Actions</th>
          </tr>
        </thead>
        <tbody id="tbody-books">
          <tr><td colspan="5" class="table-empty">Loading book catalogue...</td></tr>
        </tbody>
      </table>
    </div>
  `;

  // Populate branch dropdown in filter
  try {
    const branches = await api.getBranches();
    const branchSelect = document.getElementById('filter-branch');
    if (branchSelect) {
      branches.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b.Branch_No;
        opt.textContent = `${b.Branch_Name} (#${b.Branch_No})`;
        branchSelect.appendChild(opt);
      });
    }
  } catch (err) {
    console.error('Failed to load branches for filter:', err);
  }

  // Bind search actions
  document.getElementById('btn-execute-search').onclick = () => executeBookSearch();
  document.getElementById('btn-clear-search').onclick = () => {
    document.getElementById('filter-title').value = '';
    document.getElementById('filter-author').value = '';
    document.getElementById('filter-publisher').value = '';
    document.getElementById('filter-branch').value = '';
    loadBooksList();
  };

  // Support pressing enter in search inputs
  ['filter-title', 'filter-author', 'filter-publisher'].forEach(id => {
    const input = document.getElementById(id);
    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') executeBookSearch();
      });
    }
  });

  loadBooksList();
}

async function executeBookSearch() {
  const title = document.getElementById('filter-title')?.value || '';
  const author = document.getElementById('filter-author')?.value || '';
  const publisher = document.getElementById('filter-publisher')?.value || '';
  const branch_no = document.getElementById('filter-branch')?.value || '';

  // If all are blank, load normal list
  if (!title && !author && !publisher && !branch_no) {
    return loadBooksList();
  }

  const tbody = document.getElementById('tbody-books');
  if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="table-empty">Searching books...</td></tr>`;

  try {
    const results = await api.searchBooks({ title, author, publisher, branch_no });
    await renderBooksTable(results);
    Toast.info(`Search returned ${results.length} matching books.`);
  } catch (err) {
    Toast.error(`Search failed: ${err.message}`);
  }
}

async function loadBooksList() {
  const tbody = document.getElementById('tbody-books');
  if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="table-empty">Loading books...</td></tr>`;

  try {
    const books = await api.getBooks();
    await renderBooksTable(books);
  } catch (err) {
    Toast.error(`Failed to load books: ${err.message}`);
  }
}

async function renderBooksTable(books) {
  const tbody = document.getElementById('tbody-books');
  if (!tbody) return;

  if (books.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="table-empty">No books found matching criteria.</td></tr>`;
    return;
  }

  // Fetch publishers to resolve names
  let publisherMap = {};
  try {
    const publishers = await api.getPublishers();
    publishers.forEach(p => { publisherMap[p.Pub_ID] = p.Pub_Name; });
  } catch (e) {
    console.error('Could not fetch publishers map:', e);
  }

  // Fetch authors for each book
  const bookAuthorsMap = {};
  await Promise.all(
    books.map(async (b) => {
      try {
        const authors = await api.getBookAuthors(b.Book_ID);
        bookAuthorsMap[b.Book_ID] = authors;
      } catch (err) {
        bookAuthorsMap[b.Book_ID] = [];
      }
    })
  );

  tbody.innerHTML = books.map(book => {
    const pubName = publisherMap[book.Pub_ID] || `Publisher #${book.Pub_ID}`;
    const authors = bookAuthorsMap[book.Book_ID] || [];
    const authorPills = authors.length > 0
      ? authors.map(a => `<span class="badge badge-peach" style="margin-right: 4px;">${escapeHtml(a.Author_Name)}</span>`).join('')
      : `<span style="font-size: 12px; color: var(--text-muted); font-style: italic;">No author linked</span>`;

    return `
      <tr>
        <td><strong>#${escapeHtml(book.Book_ID)}</strong></td>
        <td><strong style="color: var(--text-primary); font-size: 14px;">${escapeHtml(book.Book_Name)}</strong></td>
        <td><span class="badge badge-pink">${escapeHtml(pubName)}</span></td>
        <td>${authorPills}</td>
        <td style="text-align: right; white-space: nowrap;">
          <button class="btn btn-sm btn-secondary btn-link-author" data-id="${book.Book_ID}" data-name="${escapeHtml(book.Book_Name)}" title="Manage Authors">
            Authors
          </button>
          <button class="btn btn-sm btn-outline btn-edit-book" data-id="${book.Book_ID}" data-name="${escapeHtml(book.Book_Name)}" data-pub="${book.Pub_ID}" title="Edit Book">
            Edit
          </button>
          <button class="btn btn-sm btn-danger btn-delete-book" data-id="${book.Book_ID}" title="Delete Book">
            Delete
          </button>
        </td>
      </tr>
    `;
  }).join('');

  // Attach handlers
  tbody.querySelectorAll('.btn-link-author').forEach(btn => {
    btn.onclick = () => openLinkAuthorModal(parseInt(btn.dataset.id, 10), btn.dataset.name);
  });

  tbody.querySelectorAll('.btn-edit-book').forEach(btn => {
    btn.onclick = () => openEditBookModal(parseInt(btn.dataset.id, 10), btn.dataset.name, parseInt(btn.dataset.pub, 10));
  });

  tbody.querySelectorAll('.btn-delete-book').forEach(btn => {
    btn.onclick = () => {
      const bookId = parseInt(btn.dataset.id, 10);
      Modal.confirm({
        title: 'Delete Book',
        message: `Are you sure you want to delete Book #${bookId}? This action cannot be undone and will fail if active inventory/issue dependencies exist.`,
        confirmText: 'Delete Book',
        confirmClass: 'btn-danger',
        onConfirm: async () => {
          try {
            await api.deleteBook(bookId);
            Toast.success(`Book #${bookId} deleted successfully!`);
            loadBooksList();
          } catch (err) {
            Toast.error(`Delete failed: ${err.message}`);
          }
        },
      });
    };
  });
}

async function openAddBookModal() {
  let publishers = [];
  try {
    publishers = await api.getPublishers();
  } catch (err) {
    Toast.error('Could not load publishers list.');
  }

  const pubOptions = publishers.map(p => `<option value="${p.Pub_ID}">${escapeHtml(p.Pub_Name)} (#${p.Pub_ID})</option>`).join('');

  Modal.open({
    title: 'Add New Book',
    bodyHtml: `
      <form id="form-add-book">
        <div class="form-group">
          <label class="form-label" for="input-book-name">Book Title <span class="required">*</span></label>
          <input type="text" id="input-book-name" class="form-control" placeholder="Enter book title" required />
        </div>
        <div class="form-group">
          <label class="form-label" for="select-book-pub">Publisher <span class="required">*</span></label>
          <select id="select-book-pub" class="form-control" required>
            <option value="">Select a publisher...</option>
            ${pubOptions}
          </select>
          <span class="form-hint">Book must be mapped to an existing publisher record.</span>
        </div>
      </form>
    `,
    footerButtons: [
      { label: 'Cancel', className: 'btn-outline', onClick: () => true },
      {
        label: 'Create Book',
        className: 'btn-primary',
        id: 'btn-submit-add-book',
        onClick: async () => {
          const name = document.getElementById('input-book-name').value.trim();
          const pubIdVal = document.getElementById('select-book-pub').value;

          if (!name) {
            Toast.error('Please enter a book name.');
            return false;
          }
          if (!pubIdVal) {
            Toast.error('Please select a publisher.');
            return false;
          }

          try {
            await api.createBook({
              Book_Name: name,
              Pub_ID: parseInt(pubIdVal, 10),
            });
            Toast.success('Book created successfully!');
            loadBooksList();
            return true;
          } catch (err) {
            Toast.error(`Failed to create book: ${err.message}`);
            return false;
          }
        },
      },
    ],
  });
}

async function openEditBookModal(bookId, currentName, currentPubId) {
  let publishers = [];
  try {
    publishers = await api.getPublishers();
  } catch (err) {
    Toast.error('Could not load publishers list.');
  }

  const pubOptions = publishers.map(p => `
    <option value="${p.Pub_ID}" ${p.Pub_ID === currentPubId ? 'selected' : ''}>
      ${escapeHtml(p.Pub_Name)} (#${p.Pub_ID})
    </option>
  `).join('');

  Modal.open({
    title: `Edit Book #${bookId}`,
    bodyHtml: `
      <form id="form-edit-book">
        <div class="form-group">
          <label class="form-label" for="input-edit-book-name">Book Title <span class="required">*</span></label>
          <input type="text" id="input-edit-book-name" class="form-control" value="${escapeHtml(currentName)}" required />
        </div>
        <div class="form-group">
          <label class="form-label" for="select-edit-book-pub">Publisher <span class="required">*</span></label>
          <select id="select-edit-book-pub" class="form-control" required>
            ${pubOptions}
          </select>
        </div>
      </form>
    `,
    footerButtons: [
      { label: 'Cancel', className: 'btn-outline', onClick: () => true },
      {
        label: 'Save Changes',
        className: 'btn-primary',
        id: 'btn-submit-edit-book',
        onClick: async () => {
          const name = document.getElementById('input-edit-book-name').value.trim();
          const pubIdVal = document.getElementById('select-edit-book-pub').value;

          if (!name) {
            Toast.error('Book title cannot be blank.');
            return false;
          }

          try {
            await api.updateBook(bookId, {
              Book_Name: name,
              Pub_ID: parseInt(pubIdVal, 10),
            });
            Toast.success(`Book #${bookId} updated!`);
            loadBooksList();
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

/* Book-Author M2M Linking Modal */
async function openLinkAuthorModal(bookId, bookName) {
  let [allAuthors, currentAuthors] = await Promise.all([
    api.getAuthors(),
    api.getBookAuthors(bookId),
  ]);

  const currentAuthorIds = new Set(currentAuthors.map(a => a.Author_ID));
  const availableAuthors = allAuthors.filter(a => !currentAuthorIds.has(a.Author_ID));

  const authorSelectOptions = availableAuthors.map(a => `
    <option value="${a.Author_ID}">${escapeHtml(a.Author_Name)} (#${a.Author_ID})</option>
  `).join('');

  const currentAuthorsList = currentAuthors.length > 0
    ? currentAuthors.map(a => `
        <li style="display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; background: var(--surface-card); border-radius: var(--radius-sm); margin-bottom: 6px; border: 1px solid var(--border-subtle);">
          <span style="font-weight: 600;">${escapeHtml(a.Author_Name)} (#${a.Author_ID})</span>
          <button class="btn btn-sm btn-danger btn-unlink-author" data-author="${a.Author_ID}">Unlink</button>
        </li>
      `).join('')
    : `<li style="color: var(--text-muted); font-size: 13px;">No authors currently assigned.</li>`;

  Modal.open({
    title: `Manage Authors: ${escapeHtml(bookName)}`,
    bodyHtml: `
      <div style="margin-bottom: 20px;">
        <h4 style="font-size: 14px; margin-bottom: 8px;">Currently Linked Authors</h4>
        <ul style="list-style: none; max-height: 160px; overflow-y: auto;" id="list-linked-authors">
          ${currentAuthorsList}
        </ul>
      </div>

      <div style="border-top: 1px solid var(--border-subtle); padding-top: 16px;">
        <h4 style="font-size: 14px; margin-bottom: 8px;">Link New Author</h4>
        <div style="display: flex; gap: 8px;">
          <select id="select-new-author" class="form-control" style="flex: 1;">
            <option value="">Select an author to link...</option>
            ${authorSelectOptions}
          </select>
          <button class="btn btn-primary" id="btn-submit-link-author">Link Author</button>
        </div>
      </div>
    `,
    footerButtons: [
      { label: 'Done', className: 'btn-secondary', onClick: () => true },
    ],
    onRender: (body) => {
      // Handle Unlink
      body.querySelectorAll('.btn-unlink-author').forEach(btn => {
        btn.onclick = async () => {
          const authorId = parseInt(btn.dataset.author, 10);
          try {
            await api.deleteBookAuthor(bookId, authorId);
            Toast.success('Author unlinked successfully!');
            Modal.close();
            openLinkAuthorModal(bookId, bookName);
            loadBooksList();
          } catch (err) {
            Toast.error(`Failed to unlink author: ${err.message}`);
          }
        };
      });

      // Handle Link
      const linkBtn = body.querySelector('#btn-submit-link-author');
      linkBtn.onclick = async () => {
        const authorIdVal = body.querySelector('#select-new-author').value;
        if (!authorIdVal) {
          Toast.error('Please select an author from the list.');
          return;
        }

        try {
          await api.linkBookAuthor({
            Book_ID: bookId,
            Author_ID: parseInt(authorIdVal, 10),
          });
          Toast.success('Author linked successfully!');
          Modal.close();
          openLinkAuthorModal(bookId, bookName);
          loadBooksList();
        } catch (err) {
          Toast.error(`Failed to link author: ${err.message}`);
        }
      };
    },
  });
}

/* ==========================================================================
   AUTHORS TAB
   ========================================================================== */
async function renderAuthorsTab(content, actionContainer) {
  actionContainer.innerHTML = `
    <button class="btn btn-primary" id="btn-add-author">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      Add New Author
    </button>
  `;

  document.getElementById('btn-add-author').onclick = () => openAddAuthorModal();

  content.innerHTML = `
    <div class="table-container">
      <table class="data-table" id="table-authors">
        <thead>
          <tr>
            <th style="width: 100px;">Author ID</th>
            <th>Author Name</th>
            <th style="text-align: right; width: 180px;">Actions</th>
          </tr>
        </thead>
        <tbody id="tbody-authors">
          <tr><td colspan="3" class="table-empty">Loading authors...</td></tr>
        </tbody>
      </table>
    </div>
  `;

  loadAuthorsList();
}

async function loadAuthorsList() {
  const tbody = document.getElementById('tbody-authors');
  if (!tbody) return;

  try {
    const authors = await api.getAuthors();
    if (authors.length === 0) {
      tbody.innerHTML = `<tr><td colspan="3" class="table-empty">No authors registered yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = authors.map(author => `
      <tr>
        <td><strong>#${escapeHtml(author.Author_ID)}</strong></td>
        <td><strong style="font-size: 14px;">${escapeHtml(author.Author_Name)}</strong></td>
        <td style="text-align: right;">
          <button class="btn btn-sm btn-outline btn-edit-author" data-id="${author.Author_ID}" data-name="${escapeHtml(author.Author_Name)}">
            Edit
          </button>
          <button class="btn btn-sm btn-danger btn-delete-author" data-id="${author.Author_ID}">
            Delete
          </button>
        </td>
      </tr>
    `).join('');

    // Attach Edit
    tbody.querySelectorAll('.btn-edit-author').forEach(btn => {
      btn.onclick = () => openEditAuthorModal(parseInt(btn.dataset.id, 10), btn.dataset.name);
    });

    // Attach Delete
    tbody.querySelectorAll('.btn-delete-author').forEach(btn => {
      btn.onclick = () => {
        const id = parseInt(btn.dataset.id, 10);
        Modal.confirm({
          title: 'Delete Author',
          message: `Are you sure you want to delete Author #${id}? Deleting will fail if any book-author mappings reference this author.`,
          confirmText: 'Delete Author',
          confirmClass: 'btn-danger',
          onConfirm: async () => {
            try {
              await api.deleteAuthor(id);
              Toast.success(`Author #${id} deleted successfully!`);
              loadAuthorsList();
            } catch (err) {
              Toast.error(`Delete failed: ${err.message}`);
            }
          },
        });
      };
    });

  } catch (err) {
    Toast.error(`Failed to load authors: ${err.message}`);
  }
}

function openAddAuthorModal() {
  Modal.open({
    title: 'Add New Author',
    bodyHtml: `
      <form id="form-add-author">
        <div class="form-group">
          <label class="form-label" for="input-author-name">Author Name <span class="required">*</span></label>
          <input type="text" id="input-author-name" class="form-control" placeholder="Enter author full name" required />
        </div>
      </form>
    `,
    footerButtons: [
      { label: 'Cancel', className: 'btn-outline', onClick: () => true },
      {
        label: 'Create Author',
        className: 'btn-primary',
        id: 'btn-submit-add-author',
        onClick: async () => {
          const name = document.getElementById('input-author-name').value.trim();
          if (!name) {
            Toast.error('Author name is required.');
            return false;
          }
          try {
            await api.createAuthor({ Author_Name: name });
            Toast.success('Author added successfully!');
            loadAuthorsList();
            return true;
          } catch (err) {
            Toast.error(`Failed to add author: ${err.message}`);
            return false;
          }
        },
      },
    ],
  });
}

function openEditAuthorModal(authorId, currentName) {
  Modal.open({
    title: `Edit Author #${authorId}`,
    bodyHtml: `
      <form id="form-edit-author">
        <div class="form-group">
          <label class="form-label" for="input-edit-author-name">Author Name <span class="required">*</span></label>
          <input type="text" id="input-edit-author-name" class="form-control" value="${escapeHtml(currentName)}" required />
        </div>
      </form>
    `,
    footerButtons: [
      { label: 'Cancel', className: 'btn-outline', onClick: () => true },
      {
        label: 'Save Changes',
        className: 'btn-primary',
        id: 'btn-submit-edit-author',
        onClick: async () => {
          const name = document.getElementById('input-edit-author-name').value.trim();
          if (!name) {
            Toast.error('Author name cannot be empty.');
            return false;
          }
          try {
            await api.updateAuthor(authorId, { Author_Name: name });
            Toast.success(`Author #${authorId} updated!`);
            loadAuthorsList();
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

/* ==========================================================================
   PUBLISHERS TAB
   ========================================================================== */
async function renderPublishersTab(content, actionContainer) {
  actionContainer.innerHTML = `
    <button class="btn btn-primary" id="btn-add-publisher">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      Add New Publisher
    </button>
  `;

  document.getElementById('btn-add-publisher').onclick = () => openAddPublisherModal();

  content.innerHTML = `
    <div class="table-container">
      <table class="data-table" id="table-publishers">
        <thead>
          <tr>
            <th style="width: 100px;">Pub ID</th>
            <th>Publisher Name</th>
            <th style="text-align: right; width: 180px;">Actions</th>
          </tr>
        </thead>
        <tbody id="tbody-publishers">
          <tr><td colspan="3" class="table-empty">Loading publishers...</td></tr>
        </tbody>
      </table>
    </div>
  `;

  loadPublishersList();
}

async function loadPublishersList() {
  const tbody = document.getElementById('tbody-publishers');
  if (!tbody) return;

  try {
    const publishers = await api.getPublishers();
    if (publishers.length === 0) {
      tbody.innerHTML = `<tr><td colspan="3" class="table-empty">No publishers registered yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = publishers.map(pub => `
      <tr>
        <td><strong>#${escapeHtml(pub.Pub_ID)}</strong></td>
        <td><strong style="font-size: 14px;">${escapeHtml(pub.Pub_Name)}</strong></td>
        <td style="text-align: right;">
          <button class="btn btn-sm btn-outline btn-edit-pub" data-id="${pub.Pub_ID}" data-name="${escapeHtml(pub.Pub_Name)}">
            Edit
          </button>
          <button class="btn btn-sm btn-danger btn-delete-pub" data-id="${pub.Pub_ID}">
            Delete
          </button>
        </td>
      </tr>
    `).join('');

    // Attach Edit
    tbody.querySelectorAll('.btn-edit-pub').forEach(btn => {
      btn.onclick = () => openEditPublisherModal(parseInt(btn.dataset.id, 10), btn.dataset.name);
    });

    // Attach Delete
    tbody.querySelectorAll('.btn-delete-pub').forEach(btn => {
      btn.onclick = () => {
        const id = parseInt(btn.dataset.id, 10);
        Modal.confirm({
          title: 'Delete Publisher',
          message: `Are you sure you want to delete Publisher #${id}? This will fail if existing books are published by this publisher.`,
          confirmText: 'Delete Publisher',
          confirmClass: 'btn-danger',
          onConfirm: async () => {
            try {
              await api.deletePublisher(id);
              Toast.success(`Publisher #${id} deleted!`);
              loadPublishersList();
            } catch (err) {
              Toast.error(`Delete failed: ${err.message}`);
            }
          },
        });
      };
    });

  } catch (err) {
    Toast.error(`Failed to load publishers: ${err.message}`);
  }
}

function openAddPublisherModal() {
  Modal.open({
    title: 'Add New Publisher',
    bodyHtml: `
      <form id="form-add-publisher">
        <div class="form-group">
          <label class="form-label" for="input-pub-name">Publisher Name <span class="required">*</span></label>
          <input type="text" id="input-pub-name" class="form-control" placeholder="Enter publisher name" required />
        </div>
      </form>
    `,
    footerButtons: [
      { label: 'Cancel', className: 'btn-outline', onClick: () => true },
      {
        label: 'Create Publisher',
        className: 'btn-primary',
        id: 'btn-submit-add-publisher',
        onClick: async () => {
          const name = document.getElementById('input-pub-name').value.trim();
          if (!name) {
            Toast.error('Publisher name is required.');
            return false;
          }
          try {
            await api.createPublisher({ Pub_Name: name });
            Toast.success('Publisher created successfully!');
            loadPublishersList();
            return true;
          } catch (err) {
            Toast.error(`Failed to create publisher: ${err.message}`);
            return false;
          }
        },
      },
    ],
  });
}

function openEditPublisherModal(pubId, currentName) {
  Modal.open({
    title: `Edit Publisher #${pubId}`,
    bodyHtml: `
      <form id="form-edit-publisher">
        <div class="form-group">
          <label class="form-label" for="input-edit-pub-name">Publisher Name <span class="required">*</span></label>
          <input type="text" id="input-edit-pub-name" class="form-control" value="${escapeHtml(currentName)}" required />
        </div>
      </form>
    `,
    footerButtons: [
      { label: 'Cancel', className: 'btn-outline', onClick: () => true },
      {
        label: 'Save Changes',
        className: 'btn-primary',
        id: 'btn-submit-edit-pub',
        onClick: async () => {
          const name = document.getElementById('input-edit-pub-name').value.trim();
          if (!name) {
            Toast.error('Publisher name cannot be blank.');
            return false;
          }
          try {
            await api.updatePublisher(pubId, { Pub_Name: name });
            Toast.success(`Publisher #${pubId} updated!`);
            loadPublishersList();
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
