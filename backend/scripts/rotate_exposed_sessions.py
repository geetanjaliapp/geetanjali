"""Give a fresh session id to every anonymous session that ever shared a case.

Before v1.42.3 a shared case's public response carried its owner's session id. Run once
after upgrading, from backend/:

    python scripts/rotate_exposed_sessions.py            # dry run, counts only
    python scripts/rotate_exposed_sessions.py --apply --expect-sessions N

Each exposed session gets one new id across all its cases (shared or not, deleted or
not) and its feedback: the rows a session id grants access to. experiment_events keeps
the old ids; nothing reads them for access. The new ids sit on the same shared cases, so
a later dry run reports the same counts; the apply checks that no case or feedback row
keeps an old id before it commits. Owners lose access from the browser that held the
old id. Nothing is written to disk and no id is printed.
Take a database dump before --apply; it is the only undo.
"""

import argparse
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import func, or_, select, update  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from models import Case, FeaturedCase, Feedback  # noqa: E402

EXIT_MISMATCH = 1
EXIT_FEATURED = 2


def exposed_sessions(db: Session) -> list[str]:
    ever_shared = or_(
        Case.is_public,
        Case.shared_at.isnot(None),
        Case.public_slug.isnot(None),
    )
    query = select(Case.session_id).where(Case.session_id.isnot(None), ever_shared)
    return sorted(set(db.scalars(query)))


def featured_in(db: Session, sessions: list[str]) -> int:
    query = (
        select(func.count())
        .select_from(Case)
        .join(FeaturedCase, FeaturedCase.case_id == Case.id)
        .where(Case.session_id.in_(sessions))
    )
    return db.scalar(query) or 0


def _count(db: Session, column, sessions: list[str]) -> int:
    query = select(func.count()).where(column.in_(sessions))
    return db.scalar(query) or 0


def _rotate_cases(db: Session, mapping: dict[str, str]) -> None:
    for old, new in mapping.items():
        db.execute(update(Case).where(Case.session_id == old).values(session_id=new))


def _rotate_feedback(db: Session, mapping: dict[str, str]) -> None:
    for old, new in mapping.items():
        db.execute(
            update(Feedback).where(Feedback.session_id == old).values(session_id=new)
        )


def run(db: Session, apply: bool = False, expect_sessions: int | None = None) -> int:
    sessions = exposed_sessions(db)
    if sessions and featured_in(db, sessions):
        print("ABORT: a featured case belongs to an exposed session; nothing changed")
        return EXIT_FEATURED

    cases = _count(db, Case.session_id, sessions)
    feedback = _count(db, Feedback.session_id, sessions)
    print(f"exposed sessions: {len(sessions)}, cases: {cases}, feedback: {feedback}")
    if not apply:
        print("dry run: nothing changed")
        return 0

    if len(sessions) != expect_sessions:
        print(f"ABORT: expected {expect_sessions} sessions; nothing changed")
        return EXIT_MISMATCH

    mapping = {old: str(uuid.uuid4()) for old in sessions}
    try:
        _rotate_cases(db, mapping)
        _rotate_feedback(db, mapping)
        left = _count(db, Case.session_id, sessions)
        left += _count(db, Feedback.session_id, sessions)
        if left:
            raise RuntimeError(f"{left} rows still hold an old session id")
        db.commit()
    except Exception:
        db.rollback()
        raise
    print(f"rotated {len(mapping)} sessions; rows left on old ids: 0")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Rotate exposed anonymous session ids."
    )
    parser.add_argument("--apply", action="store_true", help="write the rotation")
    parser.add_argument(
        "--expect-sessions",
        type=int,
        help="required with --apply: the session count from the dry run",
    )
    args = parser.parse_args(argv)
    if args.apply and args.expect_sessions is None:
        parser.error("--apply requires --expect-sessions")

    from db.connection import SessionLocal

    with SessionLocal() as db:
        return run(db, apply=args.apply, expect_sessions=args.expect_sessions)


if __name__ == "__main__":
    sys.exit(main())
