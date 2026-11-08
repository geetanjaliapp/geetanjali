"""The startup warm-up and GET /verses/daily cache the same verse of the day."""

import contextlib
import uuid
from datetime import date

import pytest

from models.verse import Verse

pytestmark = pytest.mark.integration

# Inserted in reverse chapter/verse order, so a query without ORDER BY returns them
# reversed. An even count means the reversed and sorted picks never coincide.
FEATURED = [(18, 66), (12, 10), (7, 5), (2, 47)]


def _seed(db):
    for chapter, number in FEATURED:
        db.add(
            Verse(
                id=str(uuid.uuid4()),
                canonical_id=f"BG_{chapter}_{number}",
                chapter=chapter,
                verse=number,
                is_featured=True,
            )
        )
    db.commit()


def test_warm_up_caches_the_verse_the_endpoint_serves(
    client, db_session, mock_cache, monkeypatch
):
    import db as db_module
    from main import _warm_daily_verse_cache
    from services.cache import daily_verse_key

    _seed(db_session)
    monkeypatch.setattr(
        db_module, "SessionLocal", lambda: contextlib.nullcontext(db_session)
    )
    in_order = sorted(FEATURED)
    chapter, number = in_order[date.today().timetuple().tm_yday % len(in_order)]

    _warm_daily_verse_cache()
    served = client.get("/api/v1/verses/daily")

    assert mock_cache.get(daily_verse_key())["canonical_id"] == f"BG_{chapter}_{number}"
    assert served.status_code == 200
    assert served.json()["canonical_id"] == f"BG_{chapter}_{number}"
