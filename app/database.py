import os

from dotenv import load_dotenv
from sqlalchemy import create_engine
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