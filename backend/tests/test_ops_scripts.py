"""Guards on the server scripts that cron runs.

These have no runtime signal of their own: a broken crontab line fails silently every night.
"""

import re
import subprocess
from pathlib import Path

import pytest

pytestmark = pytest.mark.unit

REPO_ROOT = Path(__file__).resolve().parents[2]
SETUP_CRONS = REPO_ROOT / "scripts" / "setup-crons.sh"
CRON_ENTRY = re.compile(r"^(@\w+|[\d*/,-]+(\s+[\d*/,-]+){4})\s")


def _cron_entries() -> list[str]:
    out = subprocess.run(
        ["bash", str(SETUP_CRONS), "--show"], capture_output=True, text=True, check=True
    ).stdout
    return [line for line in out.splitlines() if CRON_ENTRY.match(line)]


def test_cron_entries_are_found():
    entries = _cron_entries()
    assert any("maintenance.sh seo" in e for e in entries), entries


def test_no_cron_entry_contains_a_percent_sign():
    # cron turns an unescaped % into a newline and feeds the rest to stdin. The SEO refresh
    # line had one (curl -w '%{http_code}') and failed silently for nine months.
    offenders = [e for e in _cron_entries() if "%" in e]
    assert offenders == []
