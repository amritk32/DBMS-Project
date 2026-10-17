# Library Management System API

A Python backend for a DBMS course project using FastAPI, SQLAlchemy ORM,
Pydantic, and SQLite.

## Features

- CRUD operations for students, books, authors, publishers, and branches
- Book-author many-to-many mapping
- Branch-wise available-copy management
- Book issue and return operations
- Book search by title, author, publisher, and branch
- Summary, overdue, and issued-book reports
- Interactive API documentation through Swagger UI

## Requirements

- Python 3.10 or later
- pip

## Setup

Create and activate a virtual environment.

Linux/macOS:

```bash
python -m venv .venv
source .venv/bin/activate
```

Windows:

```powershell
python -m venv .venv
.venv\Scripts\activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

## Run the API

Run the following command from the project root:

```bash
uvicorn app.main:app --reload
```

Open the API documentation:

- Swagger UI: http://127.0.0.1:8000/docs
- ReDoc: http://127.0.0.1:8000/redoc
- Health check: http://127.0.0.1:8000/health

## Database

The default database URL is:

```text
sqlite:///./library.db
```

The application creates missing tables when it starts. Existing tables
are not automatically migrated or altered.

If your faculty requires an existing SQL schema, create that schema first
and verify that its column names, types, and primary keys match the ORM
models before running the application.

## Important limitations

The submitted Issued schema does not include a return date, status, or
dedicated issue ID. To preserve the original schema, returning a book
deletes its issue record and restores one available copy. Consequently,
past issue records cannot be retained as return history.

The API is intended for a classroom project. Production deployment would
require authentication, tighter CORS settings, database migrations,
and stronger concurrency controls.

## Main endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | /students | List students |
| POST | /students | Create student |
| GET | /books | List books |
| POST | /books | Create book |
| GET | /authors | List authors |
| GET | /publishers | List publishers |
| GET | /branches | List branches |
| POST | /book-authors | Link a book and author |
| GET | /inventory | View available copies |
| PUT | /inventory/{book_id}/{branch_no} | Update available copies |
| POST | /issues | Issue a book |
| GET | /issues | List issue records |
| POST | /issues/{student_id}/{book_id}/{branch_no}/{from_date}/return | Return a book |
| GET | /reports/summary | Summary counts |
| GET | /reports/overdue | Overdue issue records |

Every resource also has GET-by-ID, PUT-by-ID, and DELETE-by-ID
endpoints where applicable.
