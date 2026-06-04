"""Offline tests for fetch_trip's resumable-sweep logic.

Regression guard for the P2 bug where an interrupted sweep (pages 1..N saved,
then a captcha/deadline at N+1) was skipped wholesale on the next run, leaving
pages > N permanently unfetched. `_resume_point` must resume at N+1, and only
report "complete" when the last saved page is short or the cap was hit.
"""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "data" / "scraper"))
import fetch_trip as F  # noqa: E402

LIMIT = F.PAGE_LIMIT  # 50


class TestResumePoint(unittest.TestCase):
    def test_fresh_sweep_starts_at_1(self):
        self.assertEqual(F._resume_point([], 80), 1)

    def test_complete_when_last_page_short(self):
        # pages 1(full), 2(short) -> natural terminal reached
        self.assertIsNone(F._resume_point([(1, LIMIT), (2, 7)], 80))

    def test_complete_when_cap_reached(self):
        full = [(p, LIMIT) for p in range(1, 13)]  # 12 full pages, cap=12
        self.assertIsNone(F._resume_point(full, 12))

    def test_interrupted_all_full_resumes_after_last(self):
        # pages 1..3 all full, no terminal seen -> resume at 4, NOT skip
        self.assertEqual(F._resume_point([(1, LIMIT), (2, LIMIT), (3, LIMIT)], 80), 4)

    def test_resume_uses_highest_page_regardless_of_order(self):
        self.assertEqual(F._resume_point([(3, LIMIT), (1, LIMIT), (2, LIMIT)], 80), 4)

    def test_single_full_page_resumes(self):
        self.assertEqual(F._resume_point([(1, LIMIT)], 80), 2)


if __name__ == "__main__":
    unittest.main()
