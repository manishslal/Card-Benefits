import psycopg2
from psycopg2.extras import RealDictCursor
from contextlib import contextmanager
from .config import DATABASE_URL


def get_connection():
    """Get a database connection."""
    return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)


@contextmanager
def get_cursor():
    """Context manager for database cursor with auto-commit."""
    conn = get_connection()
    try:
        cur = conn.cursor()
        yield cur
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()
