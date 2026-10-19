/**
 * Students Directory View
 * Endpoints: GET /students, POST /students, PUT /students/{id}, DELETE /students/{id}
 */

import { api } from '../api.js';
import { Toast, Modal, escapeHtml } from '../components.js';

let cachedStudents = [];

export async function renderStudents(container) {
  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
      <div>
        <h2 style="font-size: 22px; margin-bottom: 4px;">Student Membership Directory</h2>
        <p style="font-size: 13.5px; color: var(--text-muted);">Manage registered library students, contact information, and account details.</p>
      </div>
      <button class="btn btn-primary" id="btn-add-student">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Register Student
      </button>
    </div>

    <!-- Filter & Search Bar -->
    <div class="filter-bar">
      <div class="filter-item" style="max-width: 320px;">
        <label for="filter-student-search">Quick Search</label>
        <input type="text" id="filter-student-search" class="form-control" placeholder="Search by name, phone, or ID..." />
      </div>
      <button class="btn btn-secondary" id="btn-refresh-students" style="align-self: flex-end;">
        Refresh Directory
      </button>
    </div>

    <!-- Students Table Card -->
    <div class="table-container">
      <table class="data-table" id="table-students">
        <thead>
          <tr>
            <th style="width: 100px;">Student ID</th>
            <th>Full Name</th>
            <th>Phone Number</th>
            <th>Residential Address</th>
            <th style="text-align: right; width: 180px;">Actions</th>
          </tr>
        </thead>
        <tbody id="tbody-students">
          <tr><td colspan="5" class="table-empty">Loading student records...</td></tr>
        </tbody>
      </table>
    </div>
  `;

  document.getElementById('btn-add-student').onclick = () => openAddStudentModal();
  document.getElementById('btn-refresh-students').onclick = () => loadStudentsList();

  const searchInput = document.getElementById('filter-student-search');
  if (searchInput) {
    searchInput.oninput = () => {
      const query = searchInput.value.toLowerCase().trim();
      const filtered = cachedStudents.filter(s => 
        s.Student_Name.toLowerCase().includes(query) ||
        s.Phone.toLowerCase().includes(query) ||
        String(s.Student_ID).includes(query) ||
        s.Address.toLowerCase().includes(query)
      );
      renderStudentsTable(filtered);
    };
  }

  loadStudentsList();
}

async function loadStudentsList() {
  const tbody = document.getElementById('tbody-students');
  if (!tbody) return;

  try {
    cachedStudents = await api.getStudents();
    renderStudentsTable(cachedStudents);
  } catch (err) {
    Toast.error(`Failed to load students: ${err.message}`);
  }
}

function renderStudentsTable(students) {
  const tbody = document.getElementById('tbody-students');
  if (!tbody) return;

  if (students.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="table-empty">No students found.</td></tr>`;
    return;
  }

  tbody.innerHTML = students.map(student => `
    <tr>
      <td><strong>#${escapeHtml(student.Student_ID)}</strong></td>
      <td><strong style="color: var(--text-primary); font-size: 14px;">${escapeHtml(student.Student_Name)}</strong></td>
      <td><span class="badge badge-peach">${escapeHtml(student.Phone)}</span></td>
      <td>${escapeHtml(student.Address)}</td>
      <td style="text-align: right;">
        <button 
          class="btn btn-sm btn-outline btn-edit-student" 
          data-id="${student.Student_ID}" 
          data-name="${escapeHtml(student.Student_Name)}" 
          data-phone="${escapeHtml(student.Phone)}" 
          data-addr="${escapeHtml(student.Address)}"
        >
          Edit
        </button>
        <button 
          class="btn btn-sm btn-danger btn-delete-student" 
          data-id="${student.Student_ID}"
        >
          Delete
        </button>
      </td>
    </tr>
  `).join('');

  // Attach Edit
  tbody.querySelectorAll('.btn-edit-student').forEach(btn => {
    btn.onclick = () => {
      openEditStudentModal(
        parseInt(btn.dataset.id, 10),
        btn.dataset.name,
        btn.dataset.phone,
        btn.dataset.addr
      );
    };
  });

  // Attach Delete
  tbody.querySelectorAll('.btn-delete-student').forEach(btn => {
    btn.onclick = () => {
      const studentId = parseInt(btn.dataset.id, 10);
      Modal.confirm({
        title: 'Delete Student Record',
        message: `Are you sure you want to delete Student #${studentId}? This action will fail if the student currently holds active book loans.`,
        confirmText: 'Delete Student',
        confirmClass: 'btn-danger',
        onConfirm: async () => {
          try {
            await api.deleteStudent(studentId);
            Toast.success(`Student #${studentId} deleted successfully!`);
            loadStudentsList();
          } catch (err) {
            Toast.error(`Delete failed: ${err.message}`);
          }
        },
      });
    };
  });
}

function openAddStudentModal() {
  Modal.open({
    title: 'Register New Student',
    bodyHtml: `
      <form id="form-add-student">
        <div class="form-group">
          <label class="form-label" for="input-student-name">Student Full Name <span class="required">*</span></label>
          <input type="text" id="input-student-name" class="form-control" placeholder="e.g. John Doe" required maxlength="150" />
        </div>
        <div class="form-group">
          <label class="form-label" for="input-student-phone">Phone Number <span class="required">*</span></label>
          <input type="text" id="input-student-phone" class="form-control" placeholder="e.g. +1 555-0192" required maxlength="20" />
        </div>
        <div class="form-group">
          <label class="form-label" for="input-student-address">Residential Address <span class="required">*</span></label>
          <textarea id="input-student-address" class="form-control" rows="2" placeholder="e.g. 742 Evergreen Terrace" required maxlength="255"></textarea>
        </div>
      </form>
    `,
    footerButtons: [
      { label: 'Cancel', className: 'btn-outline', onClick: () => true },
      {
        label: 'Register Student',
        className: 'btn-primary',
        id: 'btn-submit-add-student',
        onClick: async () => {
          const name = document.getElementById('input-student-name').value.trim();
          const phone = document.getElementById('input-student-phone').value.trim();
          const address = document.getElementById('input-student-address').value.trim();

          if (!name || !phone || !address) {
            Toast.error('All student fields (Name, Phone, Address) are required.');
            return false;
          }

          try {
            await api.createStudent({
              Student_Name: name,
              Phone: phone,
              Address: address,
            });
            Toast.success('Student registered successfully!');
            loadStudentsList();
            return true;
          } catch (err) {
            Toast.error(`Registration failed: ${err.message}`);
            return false;
          }
        },
      },
    ],
  });
}

function openEditStudentModal(studentId, currentName, currentPhone, currentAddr) {
  Modal.open({
    title: `Edit Student #${studentId}`,
    bodyHtml: `
      <form id="form-edit-student">
        <div class="form-group">
          <label class="form-label" for="input-edit-student-name">Student Full Name <span class="required">*</span></label>
          <input type="text" id="input-edit-student-name" class="form-control" value="${escapeHtml(currentName)}" required maxlength="150" />
        </div>
        <div class="form-group">
          <label class="form-label" for="input-edit-student-phone">Phone Number <span class="required">*</span></label>
          <input type="text" id="input-edit-student-phone" class="form-control" value="${escapeHtml(currentPhone)}" required maxlength="20" />
        </div>
        <div class="form-group">
          <label class="form-label" for="input-edit-student-address">Residential Address <span class="required">*</span></label>
          <textarea id="input-edit-student-address" class="form-control" rows="2" required maxlength="255">${escapeHtml(currentAddr)}</textarea>
        </div>
      </form>
    `,
    footerButtons: [
      { label: 'Cancel', className: 'btn-outline', onClick: () => true },
      {
        label: 'Save Changes',
        className: 'btn-primary',
        id: 'btn-submit-edit-student',
        onClick: async () => {
          const name = document.getElementById('input-edit-student-name').value.trim();
          const phone = document.getElementById('input-edit-student-phone').value.trim();
          const address = document.getElementById('input-edit-student-address').value.trim();

          if (!name || !phone || !address) {
            Toast.error('All student fields are required.');
            return false;
          }

          try {
            await api.updateStudent(studentId, {
              Student_Name: name,
              Phone: phone,
              Address: address,
            });
            Toast.success(`Student #${studentId} updated successfully!`);
            loadStudentsList();
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
