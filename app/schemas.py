from datetime import date
from pydantic import BaseModel, ConfigDict, Field


class ORMBase(BaseModel):
    """Enable serialization from SQLAlchemy model objects."""

    model_config = ConfigDict(from_attributes=True)


# ---------- Students ----------

class StudentCreate(BaseModel):
    Student_Name: str = Field(min_length=1, max_length=150)
    Phone: str = Field(min_length=1, max_length=20)
    Address: str = Field(min_length=1, max_length=255)


class StudentUpdate(StudentCreate):
    pass


class StudentOut(StudentCreate, ORMBase):
    Student_ID: int


# ---------- Library branches ----------

class BranchCreate(BaseModel):
    Branch_Name: str = Field(min_length=1, max_length=150)
    Location: str = Field(min_length=1, max_length=255)


class BranchUpdate(BranchCreate):
    pass


class BranchOut(BranchCreate, ORMBase):
    Branch_No: int


# ---------- Publishers ----------

class PublisherCreate(BaseModel):
    Pub_Name: str = Field(min_length=1, max_length=150)


class PublisherUpdate(PublisherCreate):
    pass


class PublisherOut(PublisherCreate, ORMBase):
    Pub_ID: int


# ---------- Authors ----------

class AuthorCreate(BaseModel):
    Author_Name: str = Field(min_length=1, max_length=150)


class AuthorUpdate(AuthorCreate):
    pass


class AuthorOut(AuthorCreate, ORMBase):
    Author_ID: int


# ---------- Books ----------

class BookCreate(BaseModel):
    Book_Name: str = Field(min_length=1, max_length=255)
    Pub_ID: int


class BookUpdate(BookCreate):
    pass


class BookOut(BookCreate, ORMBase):
    Book_ID: int


# ---------- Book-author mapping ----------

class BookAuthorCreate(BaseModel):
    Book_ID: int
    Author_ID: int


class BookAuthorOut(BookAuthorCreate, ORMBase):
    pass


# ---------- Available copies ----------

class CopiesCreate(BaseModel):
    Book_ID: int
    Branch_No: int
    No_Of_Copies: int = Field(ge=0)


class CopiesUpdate(BaseModel):
    No_Of_Copies: int = Field(ge=0)


class CopiesOut(CopiesCreate, ORMBase):
    pass


# ---------- Issuing and returning books ----------

class IssueCreate(BaseModel):
    Student_ID: int
    Book_ID: int
    Branch_No: int
    From_date: date
    Due_date: date


class IssueOut(IssueCreate, ORMBase):
    pass