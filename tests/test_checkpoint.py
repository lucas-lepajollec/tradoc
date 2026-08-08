import tempfile
import unittest
from datetime import datetime
from pathlib import Path

from core.checkpoint import CheckpointDatabase, JobRecord, SegmentRecord


class CheckpointTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.db = CheckpointDatabase(Path(self.temp.name) / "test.db")

    async def asyncTearDown(self):
        self.temp.cleanup()

    async def test_atomic_claim_and_cascade(self):
        now = datetime.now().isoformat()
        job = JobRecord(
            id="job-one",
            file_name="book.txt",
            file_type="txt",
            source_lang="en",
            target_lang="fr",
            model="test",
            status="PENDING",
            total_chunks=1,
            completed_chunks=0,
            source_path="jobs/job-one/input/book.txt",
            output_path="jobs/job-one/output/traduit_book.txt",
            created_at=now,
        )
        segment = SegmentRecord(
            job_id=job.id,
            chunk_index=0,
            original_text="<p>Hello</p>",
            status="PENDING",
            node_indices=[0],
            updated_at=now,
        )
        await self.db.create_job(job, [segment])
        self.assertTrue(await self.db.transition_job_status(job.id, ["PENDING"], "PROCESSING"))
        self.assertFalse(await self.db.transition_job_status(job.id, ["PENDING"], "PROCESSING"))
        self.assertTrue(await self.db.update_segment_processing(job.id, 0))
        await self.db.update_segment_done(job.id, 0, "<p>Bonjour</p>")
        self.assertEqual((await self.db.get_job(job.id)).completed_chunks, 1)
        self.assertTrue(await self.db.delete_job(job.id))
        self.assertEqual(await self.db.get_segments(job.id), [])


if __name__ == "__main__":
    unittest.main()
