"""One-off rotation of anonymous session ids exposed by public share responses before v1.42.3."""

import importlib.util
import os
import subprocess
import sys
import uuid
from datetime import datetime
from pathlib import Path

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from models import Base, Case, FeaturedCase, Feedback, Output, User
from models.case import CaseStatus

pytestmark = pytest.mark.integration

BACKEND = Path(__file__).parent.parent
SCRIPT = BACKEND / "scripts" / "rotate_exposed_sessions.py"

_spec = importlib.util.spec_from_file_location("rotate_exposed_sessions", SCRIPT)
assert _spec and _spec.loader
rotate = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(rotate)

EXPOSED = str(uuid.uuid4())
UNRELATED = str(uuid.uuid4())


def _case(db, session_id=None, user_id=None, slug=None, deleted=False):
    case = Case(
        id=str(uuid.uuid4()),
        title="t",
        description="d",
        status=CaseStatus.COMPLETED.value,
        session_id=session_id,
        user_id=user_id,
        is_public=slug is not None,
        public_slug=slug,
        shared_at=datetime.utcnow() if slug else None,
        is_deleted=deleted,
    )
    db.add(case)
    db.flush()
    return case


def _feedback(db, case, session_id):
    output = Output(
        id=str(uuid.uuid4()),
        case_id=case.id,
        result_json={"executive_summary": "s"},
        executive_summary="s",
        confidence=0.5,
        scholar_flag=False,
    )
    db.add(output)
    db.flush()
    db.add(Feedback(output_id=output.id, session_id=session_id, rating=True))


def _seed(db):
    """One exposed session with every row kind, plus rows the rotation must not touch."""
    owner = User(id=str(uuid.uuid4()), email="o@example.com", name="O")
    db.add(owner)
    shared = _case(db, EXPOSED, slug="rotshared1")
    private = _case(db, EXPOSED)
    _case(db, EXPOSED, deleted=True)
    _case(db, EXPOSED, user_id=owner.id)
    _feedback(db, private, EXPOSED)
    _feedback(db, shared, EXPOSED)

    claimed = _case(db, user_id=owner.id, slug="rotclaim01")
    featured = _case(db, slug="rotfeat001")
    db.add(FeaturedCase(case_id=featured.id, category="career", display_order=0))
    unrelated = _case(db, UNRELATED)
    _feedback(db, unrelated, UNRELATED)
    db.commit()
    return {"private": private, "claimed": claimed, "featured": featured}


def _sessions(db):
    db.expire_all()
    cases = {c.id: (c.session_id, c.user_id) for c in db.scalars(select(Case))}
    feedback = {f.id: f.session_id for f in db.scalars(select(Feedback))}
    return cases, feedback


def test_dry_run_counts_and_writes_nothing(db_session, capsys):
    _seed(db_session)
    before = _sessions(db_session)

    assert rotate.run(db_session) == 0

    assert "exposed sessions: 1, cases: 4, feedback: 2" in capsys.readouterr().out
    assert _sessions(db_session) == before


def test_apply_moves_each_exposed_session_to_one_new_id(db_session):
    rows = _seed(db_session)
    before_cases, before_feedback = _sessions(db_session)

    assert rotate.run(db_session, apply=True, expect_sessions=1) == 0

    cases, feedback = _sessions(db_session)
    new_ids = {
        sid for cid, (sid, _) in cases.items() if before_cases[cid][0] == EXPOSED
    } | {sid for fid, sid in feedback.items() if before_feedback[fid] == EXPOSED}
    assert len(new_ids) == 1 and EXPOSED not in new_ids
    for cid, (old_session, user) in before_cases.items():
        if old_session != EXPOSED:
            assert cases[cid] == (old_session, user)
        else:
            assert cases[cid][1] == user
    assert cases[rows["claimed"].id][0] is None
    assert cases[rows["featured"].id] == (None, None)
    assert UNRELATED in feedback.values()


def test_rerun_finds_the_same_shape_under_new_ids(db_session, capsys):
    _seed(db_session)
    rotate.run(db_session, apply=True, expect_sessions=1)
    capsys.readouterr()

    assert rotate.run(db_session) == 0

    assert "exposed sessions: 1, cases: 4, feedback: 2" in capsys.readouterr().out


def test_featured_case_on_an_exposed_session_aborts(db_session):
    rows = _seed(db_session)
    rows["featured"].session_id = EXPOSED
    db_session.commit()
    before = _sessions(db_session)

    assert rotate.run(db_session) == rotate.EXIT_FEATURED
    assert rotate.run(db_session, apply=True, expect_sessions=1) == rotate.EXIT_FEATURED
    assert _sessions(db_session) == before


def test_session_count_mismatch_changes_nothing(db_session):
    _seed(db_session)
    before = _sessions(db_session)

    assert rotate.run(db_session, apply=True, expect_sessions=2) == rotate.EXIT_MISMATCH
    assert _sessions(db_session) == before


def test_failure_on_feedback_leaves_cases_untouched(db_session, monkeypatch):
    _seed(db_session)
    before = _sessions(db_session)

    def fail(_db, _mapping):
        raise RuntimeError("injected")

    monkeypatch.setattr(rotate, "_rotate_feedback", fail)

    with pytest.raises(RuntimeError):
        rotate.run(db_session, apply=True, expect_sessions=1)
    assert _sessions(db_session) == before


def test_rows_left_on_an_old_id_roll_the_apply_back(db_session, monkeypatch):
    _seed(db_session)
    before = _sessions(db_session)
    monkeypatch.setattr(rotate, "_rotate_feedback", lambda _db, _mapping: None)

    with pytest.raises(RuntimeError, match="still hold an old session id"):
        rotate.run(db_session, apply=True, expect_sessions=1)
    assert _sessions(db_session) == before


def test_old_id_opens_nothing_after_rotation(client, db_session):
    rows = _seed(db_session)
    old = {"X-Session-ID": EXPOSED}
    assert (
        client.get(f"/api/v1/cases/{rows['private'].id}", headers=old).status_code
        == 200
    )

    rotate.run(db_session, apply=True, expect_sessions=1)

    assert (
        client.get(f"/api/v1/cases/{rows['private'].id}", headers=old).status_code
        == 403
    )
    assert client.get("/api/v1/cases", headers=old).json()["cases"] == []


def test_script_runs_from_backend_dir(tmp_path):
    url = f"sqlite:///{tmp_path / 'rotate.db'}"
    engine = create_engine(url)
    Base.metadata.create_all(engine)
    with sessionmaker(bind=engine)() as db:
        _case(db, EXPOSED, slug="rotsubproc")
        db.commit()
    env = {**os.environ, "DATABASE_URL": url}

    def script(*args):
        return subprocess.run(
            [sys.executable, "scripts/rotate_exposed_sessions.py", *args],
            cwd=BACKEND,
            env=env,
            capture_output=True,
            text=True,
            timeout=120,
        )

    bare = script()
    applied = script("--apply", "--expect-sessions", "1")
    refused = script("--apply")

    assert bare.returncode == 0 and "exposed sessions: 1" in bare.stdout
    assert applied.returncode == 0 and "rotated 1 sessions" in applied.stdout
    assert refused.returncode != 0
    assert EXPOSED not in bare.stdout + applied.stdout
    with sessionmaker(bind=engine)() as db:
        assert db.scalar(select(Case.session_id)) not in (None, EXPOSED)
