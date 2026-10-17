from sqlalchemy import (
    Column,
    Date,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.orm import relationship

from database import Base


class LibraryBranch(Base):
    """Represents a library branch."""

    __tablename__ = "Library_Branch"

    Branch_No = Column(Integer, primary_key=True, index=True)
    Branch_Name = Column(String(150), nullable=False)
    Location = Column(String(255), nullable=False)

    copies = relationship("Copies", back_populates="branch")
    issued_records = relationship("Issued", back_populates="branch")


class Student(Base):
    """Stores student information."""

    __tablename__ = "Student"

    Student_ID = Column(Integer, primary_key=True, index=True)
    Student_Name = Column(String(150), nullable=False)
    Phone = Column(String(20), nullable=False)
    Address = Column(String(255), nullable=False)

    issued_records = relationship("Issued", back_populates="student")


class Publisher(Base):
    """Stores publisher information."""

    __tablename__ = "Publisher"

    Pub_ID = Column(Integer, primary_key=True, index=True)
    Pub_Name = Column(String(150), nullable=False)

    books = relationship("Book", back_populates="publisher")


class Author(Base):
    """Stores author information."""

    __tablename__ = "Author"

    Author_ID = Column(Integer, primary_key=True, index=True)
    Author_Name = Column(String(150), nullable=False)

    book_links = relationship("BookAuthor", back_populates="author")


class Book(Base):
    """Stores book catalogue information."""

    __tablename__ = "Book"

    Book_ID = Column(Integer, primary_key=True, index=True)
    Book_Name = Column(String(255), nullable=False)
    Pub_ID = Column(
        Integer,
        ForeignKey("Publisher.Pub_ID"),
        nullable=False,
    )

    publisher = relationship("Publisher", back_populates="books")
    author_links = relationship("BookAuthor", back_populates="book")
    copies = relationship("Copies", back_populates="book")
    issued_records = relationship("Issued", back_populates="book")


class BookAuthor(Base):
    """Maps books to authors using a composite primary key."""

    __tablename__ = "Book_Author"

    Book_ID = Column(
        Integer,
        ForeignKey("Book.Book_ID"),
        primary_key=True,
    )
    Author_ID = Column(
        Integer,
        ForeignKey("Author.Author_ID"),
        primary_key=True,
    )

    book = relationship("Book", back_populates="author_links")
    author = relationship("Author", back_populates="book_links")


class Copies(Base):
    """Stores available copies of a book at each branch."""

    __tablename__ = "Copies"

    Book_ID = Column(
        Integer,
        ForeignKey("Book.Book_ID"),
        primary_key=True,
    )
    Branch_No = Column(
        Integer,
        ForeignKey("Library_Branch.Branch_No"),
        primary_key=True,
    )
    No_Of_Copies = Column(Integer, nullable=False, default=0)

    book = relationship("Book", back_populates="copies")
    branch = relationship("LibraryBranch", back_populates="copies")


class Issued(Base):
    """Stores book issue records using the submitted schema."""

    __tablename__ = "Issued"

    Student_ID = Column(
        Integer,
        ForeignKey("Student.Student_ID"),
        primary_key=True,
    )
    Book_ID = Column(
        Integer,
        ForeignKey("Book.Book_ID"),
        primary_key=True,
    )
    Branch_No = Column(
        Integer,
        ForeignKey("Library_Branch.Branch_No"),
        primary_key=True,
    )
    From_date = Column(Date, primary_key=True)
    Due_date = Column(Date, nullable=False)

    student = relationship("Student", back_populates="issued_records")
    book = relationship("Book", back_populates="issued_records")
    branch = relationship("LibraryBranch", back_populates="issued_records")