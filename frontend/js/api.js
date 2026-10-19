/**
 * Centralized API Client for Library Management System
 * Backend: FastAPI + SQLAlchemy + SQLite at http://127.0.0.1:8000
 */

export const API_BASE = 'http://127.0.0.1:8000';

class ApiClient {
  constructor(baseUrl = API_BASE) {
    this.baseUrl = baseUrl;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };

    const config = {
      ...options,
      headers,
    };

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(url, config);
      const isJson = response.headers.get('content-type')?.includes('application/json');
      const data = isJson ? await response.json() : await response.text();

      if (!response.ok) {
        let errorMessage = `HTTP Error ${response.status}`;
        if (data && typeof data === 'object') {
          if (typeof data.detail === 'string') {
            errorMessage = data.detail;
          } else if (Array.isArray(data.detail)) {
            // Pydantic 422 validation errors
            errorMessage = data.detail
              .map(err => {
                const field = err.loc ? err.loc[err.loc.length - 1] : 'field';
                return `${field}: ${err.msg}`;
              })
              .join('; ');
          } else if (data.message) {
            errorMessage = data.message;
          }
        }
        const error = new Error(errorMessage);
        error.status = response.status;
        error.data = data;
        throw error;
      }

      return data;
    } catch (err) {
      if (!err.status) {
        // Network or CORS connection error
        const netErr = new Error(`Connection error to ${this.baseUrl}: ${err.message}`);
        netErr.status = 0;
        throw netErr;
      }
      throw err;
    }
  }

  // Health
  getHealth() {
    return this.request('/health');
  }

  // Reports
  getSummary() {
    return this.request('/reports/summary');
  }

  getOverdue() {
    return this.request('/reports/overdue');
  }

  getIssuedBooks() {
    return this.request('/reports/issued-books');
  }

  // Students CRUD
  getStudents() {
    return this.request('/students');
  }

  getStudent(studentId) {
    return this.request(`/students/${studentId}`);
  }

  createStudent(payload) {
    // payload: { Student_Name, Phone, Address }
    return this.request('/students', {
      method: 'POST',
      body: payload,
    });
  }

  updateStudent(studentId, payload) {
    return this.request(`/students/${studentId}`, {
      method: 'PUT',
      body: payload,
    });
  }

  deleteStudent(studentId) {
    return this.request(`/students/${studentId}`, {
      method: 'DELETE',
    });
  }

  // Branches CRUD
  getBranches() {
    return this.request('/branches');
  }

  getBranch(branchNo) {
    return this.request(`/branches/${branchNo}`);
  }

  createBranch(payload) {
    // payload: { Branch_Name, Location }
    return this.request('/branches', {
      method: 'POST',
      body: payload,
    });
  }

  updateBranch(branchNo, payload) {
    return this.request(`/branches/${branchNo}`, {
      method: 'PUT',
      body: payload,
    });
  }

  deleteBranch(branchNo) {
    return this.request(`/branches/${branchNo}`, {
      method: 'DELETE',
    });
  }

  // Publishers CRUD
  getPublishers() {
    return this.request('/publishers');
  }

  getPublisher(pubId) {
    return this.request(`/publishers/${pubId}`);
  }

  createPublisher(payload) {
    // payload: { Pub_Name }
    return this.request('/publishers', {
      method: 'POST',
      body: payload,
    });
  }

  updatePublisher(pubId, payload) {
    return this.request(`/publishers/${pubId}`, {
      method: 'PUT',
      body: payload,
    });
  }

  deletePublisher(pubId) {
    return this.request(`/publishers/${pubId}`, {
      method: 'DELETE',
    });
  }

  // Authors CRUD
  getAuthors() {
    return this.request('/authors');
  }

  getAuthor(authorId) {
    return this.request(`/authors/${authorId}`);
  }

  createAuthor(payload) {
    // payload: { Author_Name }
    return this.request('/authors', {
      method: 'POST',
      body: payload,
    });
  }

  updateAuthor(authorId, payload) {
    return this.request(`/authors/${authorId}`, {
      method: 'PUT',
      body: payload,
    });
  }

  deleteAuthor(authorId) {
    return this.request(`/authors/${authorId}`, {
      method: 'DELETE',
    });
  }

  // Books CRUD & Multi-filter Search
  getBooks() {
    return this.request('/books');
  }

  getBook(bookId) {
    return this.request(`/books/${bookId}`);
  }

  createBook(payload) {
    // payload: { Book_Name, Pub_ID }
    return this.request('/books', {
      method: 'POST',
      body: payload,
    });
  }

  updateBook(bookId, payload) {
    return this.request(`/books/${bookId}`, {
      method: 'PUT',
      body: payload,
    });
  }

  deleteBook(bookId) {
    return this.request(`/books/${bookId}`, {
      method: 'DELETE',
    });
  }

  searchBooks({ title, author, publisher, branch_no } = {}) {
    const params = new URLSearchParams();
    if (title && title.trim()) params.append('title', title.trim());
    if (author && author.trim()) params.append('author', author.trim());
    if (publisher && publisher.trim()) params.append('publisher', publisher.trim());
    if (branch_no !== undefined && branch_no !== null && branch_no !== '') {
      params.append('branch_no', branch_no);
    }
    const qs = params.toString();
    return this.request(`/search/books${qs ? `?${qs}` : ''}`);
  }

  // Book-Author Many-to-Many Linking
  linkBookAuthor(payload) {
    // payload: { Book_ID: int, Author_ID: int }
    return this.request('/book-authors', {
      method: 'POST',
      body: payload,
    });
  }

  getBookAuthors(bookId) {
    return this.request(`/books/${bookId}/authors`);
  }

  deleteBookAuthor(bookId, authorId) {
    return this.request(`/books/${bookId}/authors/${authorId}`, {
      method: 'DELETE',
    });
  }

  // Inventory
  getInventory(branchNo = null) {
    const qs = branchNo !== null && branchNo !== undefined && branchNo !== '' ? `?branch_no=${branchNo}` : '';
    return this.request(`/inventory${qs}`);
  }

  getBranchInventory(branchNo) {
    return this.request(`/branches/${branchNo}/inventory`);
  }

  updateInventory(bookId, branchNo, noOfCopies) {
    // payload: { No_Of_Copies: int }
    return this.request(`/inventory/${bookId}/${branchNo}`, {
      method: 'PUT',
      body: { No_Of_Copies: parseInt(noOfCopies, 10) },
    });
  }

  // Circulation: Issue & Return Lifecycle
  getIssues() {
    return this.request('/issues');
  }

  getIssue(studentId, bookId, branchNo, fromDate) {
    return this.request(`/issues/${studentId}/${bookId}/${branchNo}/${fromDate}`);
  }

  createIssue(payload) {
    // payload: { Student_ID, Book_ID, Branch_No, From_date, Due_date }
    return this.request('/issues', {
      method: 'POST',
      body: payload,
    });
  }

  returnIssue(studentId, bookId, branchNo, fromDate) {
    // POST /issues/{student_id}/{book_id}/{branch_no}/{from_date}/return
    return this.request(`/issues/${studentId}/${bookId}/${branchNo}/${fromDate}/return`, {
      method: 'POST',
    });
  }
}

export const api = new ApiClient();
