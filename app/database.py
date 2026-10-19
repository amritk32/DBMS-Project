import os

from dotenv import load_dotenv
from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker

# Load database configuration from the .env file.
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./library.db")

# SQLite requires this option for FastAPI's request-handling threads.
connect_args = (
    {"check_same_thread": False}
    if DATABASE_URL.startswith("sqlite")
    else {}
)

# Create the SQLAlchemy engine.
engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True,
)

# Enable SQLite foreign key constraints for DBMS integrity checks
if DATABASE_URL.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

# Create a database session factory.
SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
)

# Base class for all ORM models.
Base = declarative_base()


def get_db():
    """Provide one database session per request."""
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()
