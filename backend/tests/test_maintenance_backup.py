"""maintenance.sh backup: a bad dump fails loudly and never rotates out a good backup."""

import json
import os
import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
SCRIPT = REPO_ROOT / "scripts" / "maintenance.sh"

pytestmark = [
    pytest.mark.unit,
    pytest.mark.skipif(
        not SCRIPT.exists() and os.environ.get("CI") != "true",
        reason="repo root not mounted (backend container)",
    ),
]

HEADER = "--\n-- PostgreSQL database dump\n--\n"

DOCKER = """#!/bin/bash
case "$*" in
  *pg_dump*)
    case "$DUMP" in
      ok) printf '%s' "$HEADER"; head -c 3100000 /dev/zero | tr '\\0' 'x' ;;
      small) printf '%s' "$HEADER" ;;
      noheader) head -c 3100000 /dev/zero | tr '\\0' 'x' ;;
      fail) exit 1 ;;
    esac ;;
esac
exit 0
"""

CURL = """#!/bin/bash
printf '%s\\0' "$*" >> "$CURL_LOG"
while [[ $# -gt 0 ]]; do [[ $1 == -d ]] && printf '%s\\0' "$2" >> "$CURL_LOG.body"; shift; done
exit 0
"""

# Multi-line output with a tab, quotes and backslashes, as `free -h` and `docker ps` give
FREE = """#!/bin/bash
printf '        total\\tused\\n"Mem:"  1.9Gi\\t1.2Gi \\\\ x \\\\cache\\n'
"""


@pytest.fixture
def env(tmp_path):
    stubs = tmp_path / "bin"
    stubs.mkdir()
    for name, body in {
        "docker": DOCKER,
        "curl": CURL,
        "openssl": "#!/bin/bash\nexit 1\n",
        "free": FREE,
    }.items():
        (stubs / name).write_text(body)
        (stubs / name).chmod(0o755)
    backups = tmp_path / "backups"
    backups.mkdir()
    return {
        "PATH": f"{stubs}:{os.environ['PATH']}",
        "DEPLOY_DIR": str(tmp_path / "app"),
        "DEPLOY_BACKUP_DIR": str(backups),
        "HEADER": HEADER,
        "CURL_LOG": str(tmp_path / "curl.log"),
        "RESEND_API_KEY": "test",
        "CONTACT_EMAIL_TO": "ops@example.invalid",
    }


def _run(env, task, dump):
    return subprocess.run(
        ["bash", str(SCRIPT), task],
        env={**env, "DUMP": dump},
        capture_output=True,
        text=True,
        timeout=60,
    )


def _seed(env, n):
    backups = Path(env["DEPLOY_BACKUP_DIR"])
    for day in range(1, n + 1):
        f = backups / f"geetanjali_202601{day:02d}_030000.sql.gz"
        f.write_bytes(b"old")
        os.utime(f, (day * 86400, day * 86400))
    return sorted(p.name for p in backups.iterdir())


def _alert_bodies(env):
    log = Path(env["CURL_LOG"] + ".body")
    return [json.loads(b) for b in log.read_text().split("\0")[:-1]] if log.exists() else []


def _curl_calls(env):
    log = Path(env["CURL_LOG"])
    return log.read_text().split("\0")[:-1] if log.exists() else []


@pytest.mark.parametrize("dump", ["fail", "small", "noheader"])
def test_bad_dump_fails_and_keeps_existing_backups(env, dump):
    before = _seed(env, 7)

    result = _run(env, "backup", dump)

    assert result.returncode != 0, result.stdout
    assert sorted(p.name for p in Path(env["DEPLOY_BACKUP_DIR"]).iterdir()) == before
    calls = _curl_calls(env)
    assert len(calls) == 1, calls
    assert "https://api.resend.com/emails" in calls[0]
    assert "Backup Failed" in calls[0]


def test_good_dump_is_kept_and_old_backups_rotate(env):
    _seed(env, 7)
    stale = Path(env["DEPLOY_BACKUP_DIR"]) / ".geetanjali_20260101_030000.sql"
    stale.write_text("partial")
    os.utime(stale, (86400, 86400))

    result = _run(env, "backup", "ok")

    assert result.returncode == 0, result.stdout + result.stderr
    backups = sorted(p.name for p in Path(env["DEPLOY_BACKUP_DIR"]).iterdir())
    assert len(backups) == 7
    assert "geetanjali_20260101_030000.sql.gz" not in backups
    newest = [b for b in backups if not b.startswith("geetanjali_202601")]
    assert len(newest) == 1
    assert _curl_calls(env) == []


def test_daily_runs_the_remaining_tasks_after_a_failed_backup(env):
    result = _run(env, "daily", "fail")

    assert result.returncode != 0
    assert "Checking Redis memory usage" in result.stdout
    assert "Daily Maintenance Complete" in result.stdout


def test_concurrent_runs_dump_is_left_alone(env):
    running = Path(env["DEPLOY_BACKUP_DIR"]) / ".geetanjali_20260101_030000.sql"
    running.write_text("being written")

    assert _run(env, "backup", "ok").returncode == 0
    assert running.exists()


def test_multi_line_alert_is_valid_json(env):
    result = _run(env, "report", "ok")

    assert "ALERT SENT: Weekly Server Report" in result.stdout, result.stdout + result.stderr
    (body,) = _alert_bodies(env)
    assert body["subject"] == "[Geetanjali] Weekly Server Report"
    assert '"Mem:"  1.9Gi\t1.2Gi \\ x \\cache\n' in body["text"]
