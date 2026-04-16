import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from project root (parent of scrapers/)
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(env_path)

DATABASE_URL = os.getenv('DATABASE_URL', '')

if not DATABASE_URL:
    raise ValueError("DATABASE_URL not set in .env")
