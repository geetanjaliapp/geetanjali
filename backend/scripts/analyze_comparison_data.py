"""
Analyze multi-pass vs single-pass comparison data.

Phase 3 analysis script: Queries comparison records to generate quality metrics
and inform the Phase 4 switch decision.

Usage:
    python -m backend.scripts.analyze_comparison_data
    python -m backend.scripts.analyze_comparison_data --format json
    python -m backend.scripts.analyze_comparison_data --since 2026-01-01

Output metrics:
    - Success rates for each pipeline
    - Average confidence scores and difference
    - Scholar flag rates
    - Duration statistics
    - Quality indicators for switch decision
"""

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

# Add backend to path for imports
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy import func
from sqlalchemy.orm import Session

from db import SessionLocal
from models.multipass import MultiPassComparison


def get_comparison_stats(db: Session, since: datetime | None = None) -> dict[str, Any]:
    """Calculate statistics from comparison data.

    Args:
        db: Database session
        since: Optional datetime to filter records after this date

    Returns:
        Dictionary of statistics
    """
    query = db.query(MultiPassComparison)
    if since:
        query = query.filter(MultiPassComparison.created_at >= since)

    records = query.all()
    total = len(records)

    if total == 0:
        return {
            "total_comparisons": 0,
            "message": "No comparison data available",
        }

    # Success rates
    mp_success = sum(1 for r in records if r.multipass_success)
    sp_success = sum(1 for r in records if r.singlepass_success)
    both_success = sum(1 for r in records if r.multipass_success and r.singlepass_success)
    both_failed = sum(1 for r in records if not r.multipass_success and not r.singlepass_success)

    # Confidence scores (only for successful runs)
    mp_confidences = [r.multipass_confidence for r in records if r.multipass_confidence is not None]
    sp_confidences = [r.singlepass_confidence for r in records if r.singlepass_confidence is not None]
    conf_diffs = [r.confidence_diff for r in records if r.confidence_diff is not None]

    # Scholar flags
    mp_scholar_flags = [r.multipass_scholar_flag for r in records if r.multipass_scholar_flag is not None]
    sp_scholar_flags = [r.singlepass_scholar_flag for r in records if r.singlepass_scholar_flag is not None]

    # Durations
    mp_durations = [r.multipass_duration_ms for r in records if r.multipass_duration_ms is not None]
    sp_durations = [r.singlepass_duration_ms for r in records if r.singlepass_duration_ms is not None]
    duration_diffs = [r.duration_diff_ms for r in records if r.duration_diff_ms is not None]

    # Review status
    reviewed = sum(1 for r in records if r.reviewed)
    prefer_mp = sum(1 for r in records if r.reviewer_preference == "multipass")
    prefer_sp = sum(1 for r in records if r.reviewer_preference == "singlepass")

    return {
        "total_comparisons": total,
        "date_range": {
            "earliest": min(r.created_at for r in records).isoformat() if records else None,
            "latest": max(r.created_at for r in records).isoformat() if records else None,
        },
        "success_rates": {
            "multipass_success_rate": mp_success / total,
            "singlepass_success_rate": sp_success / total,
            "both_success_rate": both_success / total,
            "both_failed_rate": both_failed / total,
            "multipass_success_count": mp_success,
            "singlepass_success_count": sp_success,
        },
        "confidence_scores": {
            "multipass_avg": sum(mp_confidences) / len(mp_confidences) if mp_confidences else None,
            "singlepass_avg": sum(sp_confidences) / len(sp_confidences) if sp_confidences else None,
            "multipass_min": min(mp_confidences) if mp_confidences else None,
            "multipass_max": max(mp_confidences) if mp_confidences else None,
            "singlepass_min": min(sp_confidences) if sp_confidences else None,
            "singlepass_max": max(sp_confidences) if sp_confidences else None,
            "avg_diff_mp_minus_sp": sum(conf_diffs) / len(conf_diffs) if conf_diffs else None,
            "diff_samples": len(conf_diffs),
        },
        "scholar_flags": {
            "multipass_flag_rate": sum(mp_scholar_flags) / len(mp_scholar_flags) if mp_scholar_flags else None,
            "singlepass_flag_rate": sum(sp_scholar_flags) / len(sp_scholar_flags) if sp_scholar_flags else None,
            "multipass_flagged_count": sum(mp_scholar_flags) if mp_scholar_flags else 0,
            "singlepass_flagged_count": sum(sp_scholar_flags) if sp_scholar_flags else 0,
        },
        "duration_ms": {
            "multipass_avg": sum(mp_durations) / len(mp_durations) if mp_durations else None,
            "singlepass_avg": sum(sp_durations) / len(sp_durations) if sp_durations else None,
            "avg_diff_mp_minus_sp": sum(duration_diffs) / len(duration_diffs) if duration_diffs else None,
        },
        "review_status": {
            "total_reviewed": reviewed,
            "prefer_multipass": prefer_mp,
            "prefer_singlepass": prefer_sp,
            "unreviewed": total - reviewed,
        },
    }


def calculate_switch_readiness(stats: dict[str, Any]) -> dict[str, Any]:
    """Calculate switch readiness indicators based on Phase 4 criteria.

    Switch decision criteria (from design doc):
    1. Multi-pass confidence scores stable and meaningful (not consistently low)
    2. Scholar flag rate <20% (acceptable for expert review)
    3. No P0/P1 failures in multi-pass workflow
    4. User satisfaction on multi-pass output acceptable

    Args:
        stats: Statistics from get_comparison_stats

    Returns:
        Dictionary with readiness indicators
    """
    if stats.get("total_comparisons", 0) == 0:
        return {"ready": False, "reason": "No comparison data available"}

    indicators = {}
    issues = []

    # Check 1: Multipass success rate
    mp_success_rate = stats["success_rates"]["multipass_success_rate"]
    indicators["multipass_success_rate"] = {
        "value": mp_success_rate,
        "threshold": 0.95,
        "passed": mp_success_rate >= 0.95,
    }
    if mp_success_rate < 0.95:
        issues.append(f"Multipass success rate {mp_success_rate:.1%} < 95% threshold")

    # Check 2: Confidence scores meaningful
    mp_conf = stats["confidence_scores"]["multipass_avg"]
    if mp_conf is not None:
        indicators["multipass_confidence_avg"] = {
            "value": mp_conf,
            "threshold": 0.65,
            "passed": mp_conf >= 0.65,
        }
        if mp_conf < 0.65:
            issues.append(f"Multipass avg confidence {mp_conf:.2f} < 0.65 threshold")
    else:
        indicators["multipass_confidence_avg"] = {"value": None, "passed": False}
        issues.append("No confidence data available")

    # Check 3: Scholar flag rate <20%
    mp_flag_rate = stats["scholar_flags"]["multipass_flag_rate"]
    if mp_flag_rate is not None:
        indicators["multipass_scholar_flag_rate"] = {
            "value": mp_flag_rate,
            "threshold": 0.20,
            "passed": mp_flag_rate <= 0.20,
        }
        if mp_flag_rate > 0.20:
            issues.append(f"Multipass scholar flag rate {mp_flag_rate:.1%} > 20% threshold")
    else:
        indicators["multipass_scholar_flag_rate"] = {"value": None, "passed": False}
        issues.append("No scholar flag data available")

    # Check 4: Confidence improvement over singlepass
    conf_diff = stats["confidence_scores"]["avg_diff_mp_minus_sp"]
    if conf_diff is not None:
        indicators["confidence_improvement"] = {
            "value": conf_diff,
            "threshold": 0,
            "passed": conf_diff >= 0,
        }
        if conf_diff < 0:
            issues.append(f"Multipass confidence lower than singlepass by {abs(conf_diff):.2f}")

    # Check 5: Sufficient sample size
    sample_size = stats["total_comparisons"]
    indicators["sample_size"] = {
        "value": sample_size,
        "threshold": 50,
        "passed": sample_size >= 50,
    }
    if sample_size < 50:
        issues.append(f"Only {sample_size} comparisons; need 50+ for confident decision")

    # Overall readiness
    all_passed = all(
        ind.get("passed", False)
        for ind in indicators.values()
        if ind.get("value") is not None
    )

    return {
        "ready": all_passed and len(issues) == 0,
        "indicators": indicators,
        "issues": issues,
        "recommendation": (
            "READY: Consider switching to multipass as primary pipeline"
            if all_passed and len(issues) == 0
            else f"NOT READY: {len(issues)} issue(s) to address"
        ),
    }


def format_report(stats: dict[str, Any], readiness: dict[str, Any]) -> str:
    """Format statistics as human-readable report.

    Args:
        stats: Statistics from get_comparison_stats
        readiness: Readiness indicators from calculate_switch_readiness

    Returns:
        Formatted report string
    """
    lines = []
    lines.append("=" * 60)
    lines.append("MULTI-PASS vs SINGLE-PASS COMPARISON ANALYSIS")
    lines.append("=" * 60)
    lines.append("")

    if stats.get("total_comparisons", 0) == 0:
        lines.append("No comparison data available.")
        lines.append("Enable comparison mode with MULTIPASS_COMPARISON_MODE=True")
        return "\n".join(lines)

    # Overview
    lines.append(f"Total Comparisons: {stats['total_comparisons']}")
    if stats["date_range"]["earliest"]:
        lines.append(f"Date Range: {stats['date_range']['earliest']} to {stats['date_range']['latest']}")
    lines.append("")

    # Success Rates
    lines.append("SUCCESS RATES")
    lines.append("-" * 40)
    sr = stats["success_rates"]
    lines.append(f"  Multi-pass:  {sr['multipass_success_rate']:.1%} ({sr['multipass_success_count']}/{stats['total_comparisons']})")
    lines.append(f"  Single-pass: {sr['singlepass_success_rate']:.1%} ({sr['singlepass_success_count']}/{stats['total_comparisons']})")
    lines.append(f"  Both OK:     {sr['both_success_rate']:.1%}")
    lines.append(f"  Both Failed: {sr['both_failed_rate']:.1%}")
    lines.append("")

    # Confidence Scores
    lines.append("CONFIDENCE SCORES")
    lines.append("-" * 40)
    cs = stats["confidence_scores"]
    if cs["multipass_avg"] is not None:
        lines.append(f"  Multi-pass avg:  {cs['multipass_avg']:.3f} (min: {cs['multipass_min']:.3f}, max: {cs['multipass_max']:.3f})")
    if cs["singlepass_avg"] is not None:
        lines.append(f"  Single-pass avg: {cs['singlepass_avg']:.3f} (min: {cs['singlepass_min']:.3f}, max: {cs['singlepass_max']:.3f})")
    if cs["avg_diff_mp_minus_sp"] is not None:
        diff = cs["avg_diff_mp_minus_sp"]
        sign = "+" if diff > 0 else ""
        lines.append(f"  Avg difference:  {sign}{diff:.3f} (multipass - singlepass)")
    lines.append("")

    # Scholar Flags
    lines.append("SCHOLAR FLAG RATES")
    lines.append("-" * 40)
    sf = stats["scholar_flags"]
    if sf["multipass_flag_rate"] is not None:
        lines.append(f"  Multi-pass:  {sf['multipass_flag_rate']:.1%} ({sf['multipass_flagged_count']} flagged)")
    if sf["singlepass_flag_rate"] is not None:
        lines.append(f"  Single-pass: {sf['singlepass_flag_rate']:.1%} ({sf['singlepass_flagged_count']} flagged)")
    lines.append("")

    # Duration
    lines.append("DURATION (milliseconds)")
    lines.append("-" * 40)
    dm = stats["duration_ms"]
    if dm["multipass_avg"] is not None:
        lines.append(f"  Multi-pass avg:  {dm['multipass_avg']:,.0f} ms ({dm['multipass_avg']/1000:.1f} sec)")
    if dm["singlepass_avg"] is not None:
        lines.append(f"  Single-pass avg: {dm['singlepass_avg']:,.0f} ms ({dm['singlepass_avg']/1000:.1f} sec)")
    if dm["avg_diff_mp_minus_sp"] is not None:
        diff = dm["avg_diff_mp_minus_sp"]
        sign = "+" if diff > 0 else ""
        lines.append(f"  Avg difference:  {sign}{diff:,.0f} ms")
    lines.append("")

    # Review Status
    lines.append("MANUAL REVIEW STATUS")
    lines.append("-" * 40)
    rv = stats["review_status"]
    lines.append(f"  Reviewed:       {rv['total_reviewed']}/{stats['total_comparisons']}")
    lines.append(f"  Prefer MP:      {rv['prefer_multipass']}")
    lines.append(f"  Prefer SP:      {rv['prefer_singlepass']}")
    lines.append("")

    # Switch Readiness
    lines.append("=" * 60)
    lines.append("SWITCH READINESS ASSESSMENT")
    lines.append("=" * 60)
    lines.append("")

    for name, indicator in readiness.get("indicators", {}).items():
        status = "PASS" if indicator.get("passed") else "FAIL"
        value = indicator.get("value")
        threshold = indicator.get("threshold")
        if value is not None:
            if isinstance(value, float) and value < 1:
                lines.append(f"  [{status}] {name}: {value:.3f} (threshold: {threshold})")
            else:
                lines.append(f"  [{status}] {name}: {value} (threshold: {threshold})")
    lines.append("")

    if readiness.get("issues"):
        lines.append("Issues:")
        for issue in readiness["issues"]:
            lines.append(f"  - {issue}")
        lines.append("")

    lines.append(f">>> {readiness.get('recommendation', 'Unable to assess')}")
    lines.append("")

    return "\n".join(lines)


def main():
    """Run comparison analysis."""
    parser = argparse.ArgumentParser(description="Analyze multi-pass comparison data")
    parser.add_argument(
        "--format",
        choices=["text", "json"],
        default="text",
        help="Output format (default: text)",
    )
    parser.add_argument(
        "--since",
        type=str,
        help="Only analyze records since this date (YYYY-MM-DD)",
    )
    args = parser.parse_args()

    since = None
    if args.since:
        since = datetime.fromisoformat(args.since)

    db = SessionLocal()
    try:
        stats = get_comparison_stats(db, since=since)
        readiness = calculate_switch_readiness(stats)

        if args.format == "json":
            output = {
                "statistics": stats,
                "switch_readiness": readiness,
                "generated_at": datetime.utcnow().isoformat(),
            }
            print(json.dumps(output, indent=2, default=str))
        else:
            print(format_report(stats, readiness))

    finally:
        db.close()


if __name__ == "__main__":
    main()
