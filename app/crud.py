from datetime import date

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
import models, schemas

                       
# Map API resource names to their ORM model and primary key.
RESOURCES = {
    "students": (models.Student, "Student_ID"),
    "branches": (models.LibraryBranch, "Branch_No"),
    "publishers": (models.Publisher, "Pub_ID"),
    "authors": (models.Author, "Author_ID"),
    "books": (models.Book, "Book_ID"),
}

# Fetch all records from the current table
def get_all(db: Session, resource: str):
    model, _ = RESOURCES[resource]
    return db.query(model).all()

# Fetch one record using the primary key
def get_one(db: Session, resource: str, item_id: int):
    model, pk = RESOURCES[resource]
    item = db.query(model).filter(getattr(model, pk) == item_id).first()

    if item is None:
        raise HTTPException(status_code=404, detail=f"{resource[:-1].title()} not found")

    return item

# Create one record and automatically assign primary key
def create_one(db: Session, resource: str, data: dict):
    model, _ = RESOURCES[resource]
    item = model(**data)

    try:
        db.add(item)
        db.commit()
        db.refresh(item)
        return item
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Cannot create this record because a related record or constraint is invalid.",
        )

# Update existing record
def update_one(db: Session, resource: str, item_id: int, data: dict):
    item = get_one(db, resource, item_id)

    for key, value in data.items():
        setattr(item, key, value)

    try:
        db.commit()
        db.refresh(item)
        return item
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Update violates a database constraint.")

# Delete one record
def delete_one(db: Session, resource: str, item_id: int):
    item = get_one(db, resource, item_id)

    try:
        db.delete(item)
        db.commit()
        return {"message": "Record deleted successfully"}
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Record is referenced by other records and cannot be deleted.",
        )


# ---------- Book-author mapping ----------
# Add book author based on primary keys bookid and author id if not exists raise error
def add_book_author(db: Session, book_id: int, author_id: int):
    if not db.get(models.Book, book_id):
        raise HTTPException(status_code=404, detail="Book not found")

    if not db.get(models.Author, author_id):
        raise HTTPException(status_code=404, detail="Author not found")

    mapping = models.BookAuthor(Book_ID=book_id, Author_ID=author_id)

    try:
        db.add(mapping)
        db.commit()
        return mapping
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="This book-author mapping already exists.")

# Fetch book authors based on bookid
def get_book_authors(db: Session, book_id: int):
    if not db.get(models.Book, book_id):
        raise HTTPException(status_code=404, detail="Book not found")

    return (
        db.query(models.Author)
        .join(models.BookAuthor, models.BookAuthor.Author_ID == models.Author.Author_ID)
        .filter(models.BookAuthor.Book_ID == book_id)
        .all()
    )

# Remove from book author based on foreign keys bookid and authorid
def remove_book_author(db: Session, book_id: int, author_id: int):
    mapping = db.get(models.BookAuthor, (book_id, author_id))

    if mapping is None:
        raise HTTPException(status_code=404, detail="Book-author mapping not found")

    db.delete(mapping)
    db.commit()
    return {"message": "Book-author mapping deleted"}


# ---------- Branch inventory ----------
# List branch information
def list_inventory(db: Session, branch_no: int | None = None):
    query = (
        db.query(models.Copies, models.Book, models.LibraryBranch)
        .join(models.Book, models.Book.Book_ID == models.Copies.Book_ID)
        .join(
            models.LibraryBranch,
            models.LibraryBranch.Branch_No == models.Copies.Branch_No,
        )
    )

    if branch_no is not None:
        query = query.filter(models.Copies.Branch_No == branch_no)

    return [
        {
            "Book_ID": copies.Book_ID,
            "Book_Name": book.Book_Name,
            "Branch_No": copies.Branch_No,
            "Branch_Name": branch.Branch_Name,
            "No_Of_Copies": copies.No_Of_Copies,
        }
        for copies, book, branch in query.all()
    ]

# Update inventory based on incrementation or decrementation of books
def set_inventory(db: Session, book_id: int, branch_no: int, count: int):
    if count < 0:
        raise HTTPException(status_code=422, detail="Available copies cannot be negative")

    record = db.get(models.Copies, (book_id, branch_no))

    if record is None:
        if not db.get(models.Book, book_id):
            raise HTTPException(status_code=404, detail="Book not found")
        if not db.get(models.LibraryBranch, branch_no):
            raise HTTPException(status_code=404, detail="Branch not found")

        record = models.Copies(
            Book_ID=book_id,
            Branch_No=branch_no,
            No_Of_Copies=count,
        )
        db.add(record)
    else:
        # Do not reduce availability below the number already issued.
        active_issues = (
            db.query(models.Issued)
            .filter(
                models.Issued.Book_ID == book_id,
                models.Issued.Branch_No == branch_no,
            )
            .count()
        )

        if count < active_issues:
            raise HTTPException(
                status_code=409,
                detail="Available copies cannot be lower than recorded active issues.",
            )

        record.No_Of_Copies = count

    try:
        db.commit()
        db.refresh(record)
        return record
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Inventory update failed")


# ---------- Issue and return ----------

def issue_book(db: Session, data: schemas.IssueCreate):
    if data.Due_date < data.From_date:
        raise HTTPException(status_code=422, detail="Due date cannot precede issue date")

    if not db.get(models.Student, data.Student_ID):
        raise HTTPException(status_code=404, detail="Student not found")
    if not db.get(models.Book, data.Book_ID):
        raise HTTPException(status_code=404, detail="Book not found")
    if not db.get(models.LibraryBranch, data.Branch_No):
        raise HTTPException(status_code=404, detail="Branch not found")

    inventory = db.get(models.Copies, (data.Book_ID, data.Branch_No))

    if inventory is None or inventory.No_Of_Copies <= 0:
        raise HTTPException(status_code=409, detail="No available copies at this branch")

    # The existing composite key identifies the issue record.
    issue_key = (
        data.Student_ID,
        data.Book_ID,
        data.Branch_No,
        data.From_date,
    )

    if db.get(models.Issued, issue_key):
        raise HTTPException(
            status_code=409,
            detail="An issue record with these key values already exists",
        )

    issue = models.Issued(**data.model_dump())

    try:
        inventory.No_Of_Copies -= 1
        db.add(issue)
        db.commit()
        db.refresh(issue)
        return issue
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Could not create the issue record")


def list_issues(db: Session):
    return db.query(models.Issued).all()

# Get issue record of a student
def get_issue(
    db: Session,
    student_id: int,
    book_id: int,
    branch_no: int,
    from_date: date,
):
    key = (student_id, book_id, branch_no, from_date)
    issue = db.get(models.Issued, key)

    if issue is None:
        raise HTTPException(status_code=404, detail="Issue record not found")

    return issue

# Return the book
def return_book(
    db: Session,
    student_id: int,
    book_id: int,
    branch_no: int,
    from_date: date,
):
    issue = get_issue(db, student_id, book_id, branch_no, from_date)
    inventory = db.get(models.Copies, (book_id, branch_no))

    if inventory is None:
        raise HTTPException(status_code=409, detail="Inventory record is missing")

    try:
        # The original schema has no Return_Date or Status column.
        # Delete the issue row and restore its available copy.
        db.delete(issue)
        inventory.No_Of_Copies += 1
        db.commit()
        return {"message": "Book returned successfully"}
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Could not process the return")


# ---------- Reports ----------

def summary_report(db: Session):
    return {
        "total_students": db.query(models.Student).count(),
        "total_books": db.query(models.Book).count(),
        "total_authors": db.query(models.Author).count(),
        "total_publishers": db.query(models.Publisher).count(),
        "total_branches": db.query(models.LibraryBranch).count(),
        "total_issue_records": db.query(models.Issued).count(),
        "total_available_copies": (
            db.query(func.coalesce(func.sum(models.Copies.No_Of_Copies), 0)).scalar()
        ),
    }


def overdue_report(db: Session, today: date | None = None):
    # All rows in Issued are treated as currently outstanding issues.
    today = today or date.today()

    return (
        db.query(models.Issued)
        .filter(models.Issued.Due_date < today)
        .order_by(models.Issued.Due_date)
        .all()
    )