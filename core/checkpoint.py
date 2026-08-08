import asyncio
import json
import logging
import sqlite3
import threading
from contextlib import closing
from datetime import datetime
from pathlib import Path
from typing import Any, Callable, List, Optional, TypeVar

from pydantic import BaseModel, Field


logger = logging.getLogger("tradoc.checkpoint")
T = TypeVar("T")


class JobRecord(BaseModel):
    id: str
    file_name: str
    file_type: str
    source_lang: str
    target_lang: str
    model: str
    status: str
    total_chunks: int
    completed_chunks: int
    glossary_name: Optional[str] = None
    system_prompt: Optional[str] = None
    temperature: float = 1.5
    concurrency: int = 1
    chunk_size: int = 1000
    job_type: str = "translation"
    source_path: Optional[str] = None
    output_path: Optional[str] = None
    parser_version: int = 1
    api_type: str = "openai"
    endpoint: Optional[str] = None
    enable_proofreading: bool = False
    enable_prompt_caching: bool = False
    created_at: str
    completed_at: Optional[str] = None


class SegmentRecord(BaseModel):
    id: Optional[int] = None
    job_id: str
    chunk_index: int
    original_text: str
    translated_text: Optional[str] = None
    status: str
    error_message: Optional[str] = None
    node_indices: List[int] = Field(default_factory=list)
    tokens_est: int = 0
    updated_at: str


class CheckpointDatabase:
    """Small async facade over SQLite.

    SQLite work is executed in a worker thread so large reads/writes cannot freeze
    FastAPI's event loop. A process-local lock keeps migrations and transactions
    ordered; WAL and the busy timeout cover concurrent readers and other processes.
    """

    def __init__(self, db_path: Path):
        self.db_path = db_path
        self._thread_lock = threading.RLock()
        self._init_db()

    def _get_conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self.db_path), timeout=30.0, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys=ON")
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA busy_timeout=30000")
        return conn

    def _run_sync(self, operation: Callable[[sqlite3.Connection], T]) -> T:
        with self._thread_lock:
            with closing(self._get_conn()) as conn:
                return operation(conn)

    async def _run(self, operation: Callable[[sqlite3.Connection], T]) -> T:
        return await asyncio.to_thread(self._run_sync, operation)

    def _init_db(self) -> None:
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        with self._thread_lock, closing(self._get_conn()) as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS jobs (
                    id TEXT PRIMARY KEY,
                    file_name TEXT NOT NULL,
                    file_type TEXT NOT NULL,
                    source_lang TEXT NOT NULL,
                    target_lang TEXT NOT NULL,
                    model TEXT NOT NULL,
                    status TEXT NOT NULL,
                    total_chunks INTEGER NOT NULL DEFAULT 0,
                    completed_chunks INTEGER NOT NULL DEFAULT 0,
                    glossary_name TEXT,
                    system_prompt TEXT,
                    temperature REAL NOT NULL DEFAULT 1.5,
                    concurrency INTEGER NOT NULL DEFAULT 1,
                    chunk_size INTEGER NOT NULL DEFAULT 1000,
                    job_type TEXT NOT NULL DEFAULT 'translation',
                    source_path TEXT,
                    output_path TEXT,
                    parser_version INTEGER NOT NULL DEFAULT 1,
                    api_type TEXT NOT NULL DEFAULT 'openai',
                    endpoint TEXT,
                    enable_proofreading INTEGER NOT NULL DEFAULT 0,
                    enable_prompt_caching INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL,
                    completed_at TEXT
                )
                """
            )
            migrations = {
                "temperature": "REAL NOT NULL DEFAULT 1.5",
                "concurrency": "INTEGER NOT NULL DEFAULT 1",
                "chunk_size": "INTEGER NOT NULL DEFAULT 1000",
                "job_type": "TEXT NOT NULL DEFAULT 'translation'",
                "source_path": "TEXT",
                "output_path": "TEXT",
                "parser_version": "INTEGER NOT NULL DEFAULT 1",
                "api_type": "TEXT NOT NULL DEFAULT 'openai'",
                "endpoint": "TEXT",
                "enable_proofreading": "INTEGER NOT NULL DEFAULT 0",
                "enable_prompt_caching": "INTEGER NOT NULL DEFAULT 0",
            }
            existing = {row[1] for row in conn.execute("PRAGMA table_info(jobs)")}
            for column, definition in migrations.items():
                if column not in existing:
                    conn.execute(f"ALTER TABLE jobs ADD COLUMN {column} {definition}")

            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS segments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    job_id TEXT NOT NULL,
                    chunk_index INTEGER NOT NULL,
                    original_text TEXT NOT NULL,
                    translated_text TEXT,
                    status TEXT NOT NULL,
                    error_message TEXT,
                    node_indices_json TEXT,
                    tokens_est INTEGER NOT NULL DEFAULT 0,
                    updated_at TEXT NOT NULL,
                    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
                )
                """
            )
            conn.execute("CREATE INDEX IF NOT EXISTS idx_segments_job ON segments(job_id, chunk_index)")
            try:
                conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS ux_segments_job_chunk ON segments(job_id, chunk_index)")
            except sqlite3.IntegrityError:
                logger.warning("Duplicate segment indexes found; uniqueness migration skipped")

            # A process that stopped mid-request leaves no reliable running worker.
            conn.execute("UPDATE jobs SET status = 'PAUSED' WHERE status = 'PROCESSING'")
            conn.execute("UPDATE segments SET status = 'PENDING' WHERE status = 'PROCESSING'")
            conn.execute("PRAGMA optimize")
            conn.commit()

    @staticmethod
    def _job_from_row(row: sqlite3.Row) -> JobRecord:
        data = dict(row)
        data["enable_proofreading"] = bool(data.get("enable_proofreading", 0))
        data["enable_prompt_caching"] = bool(data.get("enable_prompt_caching", 0))
        return JobRecord(**data)

    @staticmethod
    def _segment_from_row(row: sqlite3.Row) -> SegmentRecord:
        data = dict(row)
        raw_indices = data.pop("node_indices_json", None)
        try:
            data["node_indices"] = json.loads(raw_indices or "[]")
        except (TypeError, json.JSONDecodeError):
            data["node_indices"] = []
        return SegmentRecord(**data)

    async def create_job(self, job: JobRecord, segments: List[SegmentRecord]) -> None:
        def operation(conn: sqlite3.Connection) -> None:
            conn.execute(
                """
                INSERT INTO jobs (
                    id, file_name, file_type, source_lang, target_lang, model, status,
                    total_chunks, completed_chunks, glossary_name, system_prompt,
                    temperature, concurrency, chunk_size, job_type, source_path,
                    output_path, parser_version, api_type, endpoint,
                    enable_proofreading, enable_prompt_caching, created_at, completed_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    job.id, job.file_name, job.file_type, job.source_lang, job.target_lang,
                    job.model, job.status, job.total_chunks, job.completed_chunks,
                    job.glossary_name, job.system_prompt, job.temperature, job.concurrency,
                    job.chunk_size, job.job_type, job.source_path, job.output_path,
                    job.parser_version, job.api_type, job.endpoint,
                    int(job.enable_proofreading), int(job.enable_prompt_caching),
                    job.created_at, job.completed_at,
                ),
            )
            conn.executemany(
                """
                INSERT INTO segments (
                    job_id, chunk_index, original_text, translated_text, status,
                    error_message, node_indices_json, tokens_est, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    (
                        seg.job_id, seg.chunk_index, seg.original_text, seg.translated_text,
                        seg.status, seg.error_message, json.dumps(seg.node_indices),
                        seg.tokens_est, seg.updated_at,
                    )
                    for seg in segments
                ],
            )
            conn.commit()

        await self._run(operation)

    async def get_job(self, job_id: str) -> Optional[JobRecord]:
        def operation(conn: sqlite3.Connection) -> Optional[JobRecord]:
            row = conn.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
            return self._job_from_row(row) if row else None

        return await self._run(operation)

    async def list_jobs(self) -> List[JobRecord]:
        def operation(conn: sqlite3.Connection) -> List[JobRecord]:
            rows = conn.execute("SELECT * FROM jobs ORDER BY created_at DESC").fetchall()
            return [self._job_from_row(row) for row in rows]

        return await self._run(operation)

    async def update_job_status(
        self, job_id: str, status: str, completed_at: Optional[str] = None
    ) -> bool:
        def operation(conn: sqlite3.Connection) -> bool:
            cursor = conn.execute(
                "UPDATE jobs SET status = ?, completed_at = ? WHERE id = ?",
                (status, completed_at, job_id),
            )
            conn.commit()
            return cursor.rowcount == 1

        return await self._run(operation)

    async def transition_job_status(
        self, job_id: str, allowed_from: List[str], status: str
    ) -> bool:
        if not allowed_from:
            return False

        def operation(conn: sqlite3.Connection) -> bool:
            placeholders = ",".join("?" for _ in allowed_from)
            cursor = conn.execute(
                f"UPDATE jobs SET status = ?, completed_at = NULL WHERE id = ? AND status IN ({placeholders})",
                (status, job_id, *allowed_from),
            )
            conn.commit()
            return cursor.rowcount == 1

        return await self._run(operation)

    async def update_job_config(
        self,
        job_id: str,
        temperature: Optional[float] = None,
        concurrency: Optional[int] = None,
        model: Optional[str] = None,
        chunk_size: Optional[int] = None,
        api_type: Optional[str] = None,
        endpoint: Optional[str] = None,
        enable_proofreading: Optional[bool] = None,
        enable_prompt_caching: Optional[bool] = None,
    ) -> bool:
        updates: list[str] = []
        values: list[Any] = []
        fields = {
            "temperature": temperature,
            "concurrency": concurrency,
            "model": model,
            "chunk_size": chunk_size,
            "api_type": api_type,
            "endpoint": endpoint,
            "enable_proofreading": None if enable_proofreading is None else int(enable_proofreading),
            "enable_prompt_caching": None if enable_prompt_caching is None else int(enable_prompt_caching),
        }
        for field, value in fields.items():
            if value is not None:
                updates.append(f"{field} = ?")
                values.append(value)
        if not updates:
            return True

        def operation(conn: sqlite3.Connection) -> bool:
            cursor = conn.execute(
                f"UPDATE jobs SET {', '.join(updates)} WHERE id = ?",
                (*values, job_id),
            )
            conn.commit()
            return cursor.rowcount == 1

        return await self._run(operation)

    async def set_output_path(self, job_id: str, output_path: str) -> None:
        await self.update_job_field(job_id, "output_path", output_path)

    async def update_job_field(self, job_id: str, field: str, value: Any) -> None:
        allowed = {"source_path", "output_path"}
        if field not in allowed:
            raise ValueError("Unsupported job field")

        def operation(conn: sqlite3.Connection) -> None:
            conn.execute(f"UPDATE jobs SET {field} = ? WHERE id = ?", (value, job_id))
            conn.commit()

        await self._run(operation)

    async def get_segments(self, job_id: str) -> List[SegmentRecord]:
        def operation(conn: sqlite3.Connection) -> List[SegmentRecord]:
            rows = conn.execute(
                "SELECT * FROM segments WHERE job_id = ? ORDER BY chunk_index ASC", (job_id,)
            ).fetchall()
            return [self._segment_from_row(row) for row in rows]

        return await self._run(operation)

    async def update_segment_processing(self, job_id: str, chunk_index: int) -> bool:
        now = datetime.now().isoformat()

        def operation(conn: sqlite3.Connection) -> bool:
            cursor = conn.execute(
                """
                UPDATE segments SET status = 'PROCESSING', error_message = NULL, updated_at = ?
                WHERE job_id = ? AND chunk_index = ? AND status IN ('PENDING', 'FAILED')
                """,
                (now, job_id, chunk_index),
            )
            conn.commit()
            return cursor.rowcount == 1

        return await self._run(operation)

    async def update_segment_done(self, job_id: str, chunk_index: int, translated_text: str) -> None:
        now = datetime.now().isoformat()

        def operation(conn: sqlite3.Connection) -> None:
            conn.execute(
                """
                UPDATE segments
                SET status = 'DONE', translated_text = ?, error_message = NULL, updated_at = ?
                WHERE job_id = ? AND chunk_index = ?
                """,
                (translated_text, now, job_id, chunk_index),
            )
            conn.execute(
                """
                UPDATE jobs SET completed_chunks = (
                    SELECT COUNT(*) FROM segments WHERE job_id = ? AND status = 'DONE'
                ) WHERE id = ?
                """,
                (job_id, job_id),
            )
            conn.commit()

        await self._run(operation)

    async def update_segments_done_batch(self, job_id: str, translations: dict[int, str]) -> None:
        now = datetime.now().isoformat()

        def operation(conn: sqlite3.Connection) -> None:
            conn.executemany(
                """
                UPDATE segments
                SET status = 'DONE', translated_text = ?, error_message = NULL, updated_at = ?
                WHERE job_id = ? AND chunk_index = ?
                """,
                [(text, now, job_id, index) for index, text in translations.items()],
            )
            conn.execute(
                """
                UPDATE jobs SET completed_chunks = (
                    SELECT COUNT(*) FROM segments WHERE job_id = ? AND status = 'DONE'
                ) WHERE id = ?
                """,
                (job_id, job_id),
            )
            conn.commit()

        await self._run(operation)

    async def update_segment_failed(self, job_id: str, chunk_index: int, error_msg: str) -> None:
        now = datetime.now().isoformat()

        def operation(conn: sqlite3.Connection) -> None:
            conn.execute(
                """
                UPDATE segments SET status = 'FAILED', error_message = ?, updated_at = ?
                WHERE job_id = ? AND chunk_index = ?
                """,
                (error_msg[:1000], now, job_id, chunk_index),
            )
            conn.commit()

        await self._run(operation)

    async def reset_failed_segments(self, job_id: str) -> None:
        now = datetime.now().isoformat()

        def operation(conn: sqlite3.Connection) -> None:
            conn.execute(
                """
                UPDATE segments SET status = 'PENDING', error_message = NULL, updated_at = ?
                WHERE job_id = ? AND status = 'FAILED'
                """,
                (now, job_id),
            )
            conn.commit()

        await self._run(operation)

    async def reset_processing_segments(self, job_id: str) -> None:
        now = datetime.now().isoformat()

        def operation(conn: sqlite3.Connection) -> None:
            conn.execute(
                """
                UPDATE segments SET status = 'PENDING', updated_at = ?
                WHERE job_id = ? AND status = 'PROCESSING'
                """,
                (now, job_id),
            )
            conn.commit()

        await self._run(operation)

    async def count_unfinished_segments(self, job_id: str) -> int:
        def operation(conn: sqlite3.Connection) -> int:
            row = conn.execute(
                "SELECT COUNT(*) AS count FROM segments WHERE job_id = ? AND status != 'DONE'",
                (job_id,),
            ).fetchone()
            return int(row["count"])

        return await self._run(operation)

    async def count_jobs_using_path(self, relative_path: str, exclude_job_id: str) -> int:
        def operation(conn: sqlite3.Connection) -> int:
            row = conn.execute(
                """
                SELECT COUNT(*) AS count FROM jobs
                WHERE id != ? AND (source_path = ? OR output_path = ?)
                """,
                (exclude_job_id, relative_path, relative_path),
            ).fetchone()
            return int(row["count"])

        return await self._run(operation)

    async def count_jobs_with_filename(self, file_name: str, exclude_job_id: str) -> int:
        def operation(conn: sqlite3.Connection) -> int:
            row = conn.execute(
                "SELECT COUNT(*) AS count FROM jobs WHERE id != ? AND file_name = ?",
                (exclude_job_id, file_name),
            ).fetchone()
            return int(row["count"])

        return await self._run(operation)

    async def delete_job(self, job_id: str) -> bool:
        def operation(conn: sqlite3.Connection) -> bool:
            cursor = conn.execute("DELETE FROM jobs WHERE id = ?", (job_id,))
            conn.commit()
            return cursor.rowcount == 1

        return await self._run(operation)
