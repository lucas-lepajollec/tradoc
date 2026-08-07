import sqlite3
import json
import asyncio
from pathlib import Path
from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel

class JobRecord(BaseModel):
    id: str
    file_name: str
    file_type: str  # "epub" or "pdf"
    source_lang: str
    target_lang: str
    model: str
    status: str  # "PENDING", "PROCESSING", "PAUSED", "COMPLETED", "FAILED"
    total_chunks: int
    completed_chunks: int
    glossary_name: Optional[str] = None
    system_prompt: Optional[str] = None
    temperature: float = 1.50
    concurrency: int = 1
    chunk_size: int = 1000
    job_type: str = "translation"  # "translation" or "proofreading"
    created_at: str
    completed_at: Optional[str] = None

class SegmentRecord(BaseModel):
    id: Optional[int] = None
    job_id: str
    chunk_index: int
    original_text: str
    translated_text: Optional[str] = None
    status: str  # "PENDING", "PROCESSING", "DONE", "FAILED"
    error_message: Optional[str] = None
    node_indices: List[int] = []
    tokens_est: int = 0
    updated_at: str

class CheckpointDatabase:
    def __init__(self, db_path: Path):
        self.db_path = db_path
        self._lock = asyncio.Lock()
        self._init_db()

    def _get_conn(self):
        conn = sqlite3.connect(str(self.db_path), timeout=30.0, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        try:
            conn.execute("PRAGMA journal_mode=WAL;")
            conn.execute("PRAGMA busy_timeout=30000;")
        except Exception:
            pass
        return conn

    def _init_db(self):
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS jobs (
                id TEXT PRIMARY KEY,
                file_name TEXT NOT NULL,
                file_type TEXT NOT NULL,
                source_lang TEXT NOT NULL,
                target_lang TEXT NOT NULL,
                model TEXT NOT NULL,
                status TEXT NOT NULL,
                total_chunks INTEGER DEFAULT 0,
                completed_chunks INTEGER DEFAULT 0,
                glossary_name TEXT,
                system_prompt TEXT,
                temperature REAL DEFAULT 1.5,
                concurrency INTEGER DEFAULT 1,
                chunk_size INTEGER DEFAULT 1000,
                job_type TEXT DEFAULT 'translation',
                created_at TEXT NOT NULL,
                completed_at TEXT
            )
            """)
            for col, col_def in [("temperature", "REAL DEFAULT 1.5"), ("concurrency", "INTEGER DEFAULT 1"), ("chunk_size", "INTEGER DEFAULT 1000"), ("job_type", "TEXT DEFAULT 'translation'")]:
                try:
                    cursor.execute(f"ALTER TABLE jobs ADD COLUMN {col} {col_def}")
                except sqlite3.OperationalError:
                    pass

            cursor.execute("""
            CREATE TABLE IF NOT EXISTS segments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                job_id TEXT NOT NULL,
                chunk_index INTEGER NOT NULL,
                original_text TEXT NOT NULL,
                translated_text TEXT,
                status TEXT NOT NULL,
                error_message TEXT,
                node_indices_json TEXT,
                tokens_est INTEGER DEFAULT 0,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
            )
            """)
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_segments_job ON segments(job_id, chunk_index);")
            
            # Auto-pause any jobs left in 'PROCESSING' state when server previously stopped/restarted
            cursor.execute("UPDATE jobs SET status = 'PAUSED' WHERE status = 'PROCESSING'")
            cursor.execute("UPDATE segments SET status = 'PENDING' WHERE status = 'PROCESSING'")
            conn.commit()

    async def create_job(self, job: JobRecord, segments: List[SegmentRecord]):
        async with self._lock:
            with self._get_conn() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                INSERT INTO jobs (id, file_name, file_type, source_lang, target_lang, model, status, total_chunks, completed_chunks, glossary_name, system_prompt, temperature, concurrency, chunk_size, job_type, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    job.id, job.file_name, job.file_type, job.source_lang, job.target_lang,
                    job.model, job.status, job.total_chunks, job.completed_chunks,
                    job.glossary_name, job.system_prompt, job.temperature, job.concurrency, job.chunk_size, getattr(job, 'job_type', 'translation'), job.created_at
                ))
                for seg in segments:
                    cursor.execute("""
                    INSERT INTO segments (job_id, chunk_index, original_text, translated_text, status, node_indices_json, tokens_est, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        seg.job_id, seg.chunk_index, seg.original_text, seg.translated_text,
                        seg.status, json.dumps(seg.node_indices), seg.tokens_est, seg.updated_at
                    ))
                conn.commit()

    async def get_job(self, job_id: str) -> Optional[JobRecord]:
        async with self._lock:
            with self._get_conn() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT * FROM jobs WHERE id = ?", (job_id,))
                row = cursor.fetchone()
                if row:
                    return JobRecord(**dict(row))
                return None

    async def list_jobs(self) -> List[JobRecord]:
        async with self._lock:
            with self._get_conn() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT * FROM jobs ORDER BY created_at DESC")
                return [JobRecord(**dict(r)) for r in cursor.fetchall()]

    async def update_job_status(self, job_id: str, status: str, completed_at: Optional[str] = None):
        async with self._lock:
            with self._get_conn() as conn:
                cursor = conn.cursor()
                if completed_at:
                    cursor.execute("UPDATE jobs SET status = ?, completed_at = ? WHERE id = ?", (status, completed_at, job_id))
                else:
                    cursor.execute("UPDATE jobs SET status = ? WHERE id = ?", (status, job_id))
                conn.commit()

    async def update_job_config(
        self,
        job_id: str,
        temperature: Optional[float] = None,
        concurrency: Optional[int] = None,
        model: Optional[str] = None,
        chunk_size: Optional[int] = None
    ):
        async with self._lock:
            with self._get_conn() as conn:
                cursor = conn.cursor()
                if temperature is not None:
                    cursor.execute("UPDATE jobs SET temperature = ? WHERE id = ?", (temperature, job_id))
                if concurrency is not None:
                    cursor.execute("UPDATE jobs SET concurrency = ? WHERE id = ?", (concurrency, job_id))
                if model is not None:
                    cursor.execute("UPDATE jobs SET model = ? WHERE id = ?", (model, job_id))
                if chunk_size is not None:
                    cursor.execute("UPDATE jobs SET chunk_size = ? WHERE id = ?", (chunk_size, job_id))
                conn.commit()

    async def get_segments(self, job_id: str) -> List[SegmentRecord]:
        async with self._lock:
            with self._get_conn() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT * FROM segments WHERE job_id = ? ORDER BY chunk_index ASC", (job_id,))
                rows = cursor.fetchall()
                results = []
                for r in rows:
                    d = dict(r)
                    d["node_indices"] = json.loads(d.pop("node_indices_json", "[]"))
                    results.append(SegmentRecord(**d))
                return results

    async def update_segment_done(self, job_id: str, chunk_index: int, translated_text: str):
        now = datetime.now().isoformat()
        async with self._lock:
            with self._get_conn() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                UPDATE segments 
                SET status = 'DONE', translated_text = ?, error_message = NULL, updated_at = ?
                WHERE job_id = ? AND chunk_index = ?
                """, (translated_text, now, job_id, chunk_index))
                
                cursor.execute("""
                UPDATE jobs 
                SET completed_chunks = (SELECT COUNT(*) FROM segments WHERE job_id = ? AND status = 'DONE')
                WHERE id = ?
                """, (job_id, job_id))
                conn.commit()

    async def update_segment_failed(self, job_id: str, chunk_index: int, error_msg: str):
        now = datetime.now().isoformat()
        async with self._lock:
            with self._get_conn() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                UPDATE segments 
                SET status = 'FAILED', error_message = ?, updated_at = ?
                WHERE job_id = ? AND chunk_index = ?
                """, (error_msg, now, job_id, chunk_index))
                conn.commit()

    async def reset_failed_segments(self, job_id: str):
        now = datetime.now().isoformat()
        async with self._lock:
            with self._get_conn() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                UPDATE segments SET status = 'PENDING', error_message = NULL, updated_at = ?
                WHERE job_id = ? AND status = 'FAILED'
                """, (now, job_id))
                conn.commit()

    async def delete_job(self, job_id: str):
        async with self._lock:
            with self._get_conn() as conn:
                cursor = conn.cursor()
                cursor.execute("DELETE FROM segments WHERE job_id = ?", (job_id,))
                cursor.execute("DELETE FROM jobs WHERE id = ?", (job_id,))
                conn.commit()
