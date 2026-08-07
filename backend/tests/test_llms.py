"""Tests for the /llms.txt discovery endpoints.

The convention (llmstxt.org) is that /llms.txt is a parsed *index* of links and /llms-full.txt
carries the corpus. The split is the whole point: tools regex the index, so putting 450KB of
verse text there breaks every consumer built against the standard. These tests pin the split.
"""

import uuid

import pytest

from api.llms import build_llms_full, build_llms_index
from models.verse import Verse


@pytest.fixture
def verses(db_session):
    """Two verses in one chapter plus one in another, to exercise chapter grouping."""
    rows = [
        Verse(
            id=str(uuid.uuid4()),
            canonical_id="BG_2_47",
            chapter=2,
            verse=47,
            sanskrit_iast="karmaṇy-evādhikāras te",
            sanskrit_devanagari="कर्मण्येवाधिकारस्ते",
            translation_en="You have the right to work only, but never to its fruits.",
            paraphrase_en="Focus on your duty without attachment to outcomes.",
            consulting_principles=["duty_focused_action"],
            source="test",
            license="test",
        ),
        Verse(
            id=str(uuid.uuid4()),
            canonical_id="BG_2_48",
            chapter=2,
            verse=48,
            sanskrit_iast="yoga-sthaḥ kuru karmāṇi",
            sanskrit_devanagari="योगस्थः कुरु कर्माणि",
            translation_en="Perform action established in yoga.",
            paraphrase_en="Act from a place of inner equilibrium.",
            consulting_principles=["equanimity"],
            source="test",
            license="test",
        ),
        Verse(
            id=str(uuid.uuid4()),
            canonical_id="BG_3_1",
            chapter=3,
            verse=1,
            sanskrit_iast="jyāyasī cet karmaṇas te",
            sanskrit_devanagari="ज्यायसी चेत्कर्मणस्ते",
            translation_en="If you consider knowledge superior to action.",
            paraphrase_en="Arjuna asks why he is urged to act.",
            consulting_principles=["discernment"],
            source="test",
            license="test",
        ),
    ]
    db_session.add_all(rows)
    db_session.commit()
    return rows


@pytest.mark.unit
class TestLlmsIndex:
    def test_index_is_a_link_index_not_a_corpus(self):
        """The index must stay small and link out. This is the convention's whole contract."""
        content = build_llms_index()

        assert content.startswith("# Geetanjali"), "llms.txt must open with an H1"
        assert "/llms-full.txt" in content, "index must point at the corpus"
        assert len(content) < 4000, (
            f"index grew to {len(content)} chars — corpus content belongs in llms-full.txt"
        )

    def test_index_discloses_how_audio_and_guidance_are_produced(self):
        """Neither audio nor guidance is human-authored; an LLM reading this should be told.

        Normalised because the prose is hard-wrapped -- the disclosure spans a line break.
        """
        content = " ".join(build_llms_index().split())
        assert "synthesised rather than recorded" in content
        assert "not advice from a person" in content

    def test_endpoint_serves_plain_text(self, client):
        response = client.get("/llms.txt")
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/plain")
        assert response.text.startswith("# Geetanjali")


@pytest.mark.unit
class TestLlmsFull:
    def test_renders_every_verse(self, verses):
        content = build_llms_full(verses)
        for v in verses:
            assert v.canonical_id in content
            assert v.translation_en in content
            assert v.sanskrit_devanagari in content

    def test_groups_by_chapter_without_repeating_headings(self, verses):
        """Two verses share chapter 2; the heading must appear once, not per verse."""
        content = build_llms_full(verses)
        assert content.count("## Chapter 2") == 1
        assert content.count("## Chapter 3") == 1

    def test_labels_the_generated_commentary_on_every_entry(self, verses):
        """paraphrase_en is generated commentary, not scripture, and must not read as source text.

        Labelled per entry rather than only in the header: consumers chunk this file, and a
        chunk split away from the preamble would otherwise present commentary as the Gita.
        """
        content = build_llms_full(verses)

        for v in verses:
            assert f"Leadership insight (generated commentary): {v.paraphrase_en}" in content

        # The bare label must never appear -- that was the original defect.
        assert "Paraphrase:" not in content

    def test_omits_missing_fields_rather_than_printing_none(self, verses):
        """A verse with no paraphrase must not render the literal string None."""
        verses[0].paraphrase_en = None
        content = build_llms_full(verses)
        assert "Paraphrase: None" not in content
        assert "None" not in content.split("### BG_2_47")[1].split("### ")[0]

    def test_endpoint_serves_plain_text(self, client, verses):
        response = client.get("/llms-full.txt")
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/plain")
        assert "BG_2_47" in response.text
