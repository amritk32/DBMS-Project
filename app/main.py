from datetime import date
from typing import Type

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session

import crud, models, schemas
from database import Base, engine, get_db


# Importing models before create_all ensures all eight tables are registered.
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Library Management System API",
    description="Backend API for students, books, branches, inventory and issue management.",
    version="1.0.0",
)

# Allow local frontend development. Restrict origins before production deployment.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Resource configuration keeps common CRUD routes concise.
RESOURCE_CONFIG = {
    "students": (
        schemas.StudentCreate,
        schemas.StudentUpdate,
        schemas.StudentOut,
    ),
    "branches": (
        schemas.BranchCreate,
        schemas.BranchUpdate,
        schemas.BranchOut,
    ),
    "publishers": (
        schemas.PublisherCreate,
        schemas.PublisherUpdate,
        schemas.PublisherOut,
    ),
    "authors": (
        schemas.AuthorCreate,
        schemas.AuthorUpdate,
        schemas.AuthorOut,
    ),
    "books": (
        schemas.BookCreate,
        schemas.BookUpdate,
        schemas.BookOut,
    ),
}


@app.get("/")
def home():
    """Check whether the API is running."""
    return {
        "message": "Library Management System API is running",
        "docs": "/docs",
    }


@app.get("/health")
def health_check():
    """Basic application health endpoint."""
    return {"status": "ok"}


# ---------- Generic CRUD endpoints ----------

def register_crud_routes(
    resource: str,
    create_schema: Type[BaseModel],
    update_schema: Type[BaseModel],
    output_schema: Type[BaseModel],
):
    """Register standard CRUD endpoints for a resource."""

    route = f"/{resource}"

    def list_items(db: Session = Depends(get_db)):
        return crud.get_all(db, resource)

    def get_item(item_id: int, db: Session = Depends(get_db)):
        return crud.get_one(db, resource, item_id)

    def create_item(
        payload: create_schema,
        db: Session = Depends(get_db),
    ):
        return crud.create_one(db, resource, payload.model_dump())

    def update_item(
        item_id: int,
        payload: update_schema,
        db: Session = Depends(get_db),
    ):
        return crud.update_one(
            db,
            resource,
            item_id,
            payload.model_dump(),
        )

    def delete_item(item_id: int, db: Session = Depends(get_db)):
        return crud.delete_one(db, resource, item_id)

    # Use unique route names so FastAPI can register each endpoint safely.
    list_items.__name__ = f"list_{resource}"
    get_item.__name__ = f"get_{resource[:-1]}_by_id"
    create_item.__name__ = f"create_{resource[:-1]}"
    update_item.__name__ = f"update_{resource[:-1]}"
    delete_item.__name__ = f"delete_{resource[:-1]}"

    app.add_api_route(
        route,
        list_items,
        methods=["GET"],
        response_model=list[output_schema],
        tags=[resource.title()],
    )
    app.add_api_route(
        route + "/{item_id}",
        get_item,
        methods=["GET"],
        response_model=output_schema,
        tags=[resource.title()],
    )
    app.add_api_route(
        route,
        create_item,
        methods=["POST"],
        response_model=output_schema,
        status_code=201,
        tags=[resource.title()],
    )
    app.add_api_route(
        route + "/{item_id}",
        update_item,
        methods=["PUT"],
        response_model=output_schema,
        tags=[resource.title()],
    )
    app.add_api_route(
        route + "/{item_id}",
        delete_item,
        methods=["DELETE"],
        tags=[resource.title()],
    )


for resource_name, schemas_tuple in RESOURCE_CONFIG.items():
    register_crud_routes(resource_name, *schemas_tuple)


# ---------- Book search ----------

@app.get("/search/books", tags=["Books"])
def search_books(
    title: str | None = Query(default=None, min_length=1),
    author: str | None = Query(default=None, min_length=1),
    publisher: str | None = Query(default=None, min_length=1),
    branch_no: int | None = None,
    db: Session = Depends(get_db),
):
    """Search books by title, author, publisher or branch availability."""
    query = db.query(models.Book)

    if title:
        query = query.filter(models.Book.Book_Name.ilike(f"%{title}%"))

    if publisher:
        query = (
            query.join(models.Publisher)
            .filter(models.Publisher.Pub_Name.ilike(f"%{publisher}%"))
        )

    if author:
        query = (
            query.join(models.BookAuthor)
            .join(models.Author)
            .filter(models.Author.Author_Name.ilike(f"%{author}%"))
        )

    if branch_no is not None:
        query = (
            query.join(models.Copies)
            .filter(
                models.Copies.Branch_No == branch_no,
                models.Copies.No_Of_Copies > 0,
            )
        )

    return query.distinct().all()


# ---------- Book-author mapping ----------

@app.post(
    "/book-authors",
    response_model=schemas.BookAuthorOut,
    status_code=201,
    tags=["Book Authors"],
)
def create_book_author(
    payload: schemas.BookAuthorCreate,
    db: Session = Depends(get_db),
):
    return crud.add_book_author(db, payload.Book_ID, payload.Author_ID)


@app.get("/books/{book_id}/authors", tags=["Book Authors"])
def list_book_authors(book_id: int, db: Session = Depends(get_db)):
    return crud.get_book_authors(db, book_id)


@app.delete(
    "/books/{book_id}/authors/{author_id}",
    tags=["Book Authors"],
)
def delete_book_author(
    book_id: int,
    author_id: int,
    db: Session = Depends(get_db),
):
    return crud.remove_book_author(db, book_id, author_id)


# ---------- Branch inventory ----------

@app.get("/inventory", tags=["Inventory"])
def get_inventory(
    branch_no: int | None = None,
    db: Session = Depends(get_db),
):
    return crud.list_inventory(db, branch_no)


@app.get("/branches/{branch_no}/inventory", tags=["Inventory"])
def get_branch_inventory(
    branch_no: int,
    db: Session = Depends(get_db),
):
    if not db.get(models.LibraryBranch, branch_no):
        raise HTTPException(status_code=404, detail="Branch not found")

    return crud.list_inventory(db, branch_no)


@app.put(
    "/inventory/{book_id}/{branch_no}",
    response_model=schemas.CopiesOut,
    tags=["Inventory"],
)
def update_inventory(
    book_id: int,
    branch_no: int,
    payload: schemas.CopiesUpdate,
    db: Session = Depends(get_db),
):
    return crud.set_inventory(
        db,
        book_id,
        branch_no,
        payload.No_Of_Copies,
    )


# ---------- Issue and return ----------

@app.post(
    "/issues",
    response_model=schemas.IssueOut,
    status_code=201,
    tags=["Issues"],
)
def create_issue(
    payload: schemas.IssueCreate,
    db: Session = Depends(get_db),
):
    return crud.issue_book(db, payload)


@app.get("/issues", response_model=list[schemas.IssueOut], tags=["Issues"])
def list_issues(db: Session = Depends(get_db)):
    return crud.list_issues(db)


@app.get("/issues/{student_id}/{book_id}/{branch_no}/{from_date}", tags=["Issues"])
def get_issue(
    student_id: int,
    book_id: int,
    branch_no: int,
    from_date: date,
    db: Session = Depends(get_db),
):
    return crud.get_issue(db, student_id, book_id, branch_no, from_date)


@app.post(
    "/issues/{student_id}/{book_id}/{branch_no}/{from_date}/return",
    tags=["Issues"],
)
def return_issued_book(
    student_id: int,
    book_id: int,
    branch_no: int,
    from_date: date,
    db: Session = Depends(get_db),
):
    return crud.return_book(
        db,
        student_id,
        book_id,
        branch_no,
        from_date,
    )


# ---------- Reports ----------

@app.get("/reports/summary", tags=["Reports"])
def get_summary(db: Session = Depends(get_db)):
    return crud.summary_report(db)


@app.get("/reports/overdue", tags=["Reports"])
def get_overdue(db: Session = Depends(get_db)):
    return crud.overdue_report(db)


@app.get("/reports/issued-books", tags=["Reports"])
def get_issued_books(db: Session = Depends(get_db)):
    return crud.list_issues(db)