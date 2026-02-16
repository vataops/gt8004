"""
Developer utility tool functions.
All tools are pure functions with no LLM dependency.
"""

import difflib
import json
import re
from datetime import datetime, timezone


def json_format(json_str: str, minify: bool = False) -> str:
    """Parse and prettify or minify JSON."""
    try:
        parsed = json.loads(json_str)
    except json.JSONDecodeError as e:
        return json.dumps({"error": f"Invalid JSON: {e}"})

    if minify:
        return json.dumps(parsed, separators=(",", ":"), ensure_ascii=False)
    return json.dumps(parsed, indent=2, ensure_ascii=False)


def timestamp_convert(value: str, to_format: str = "iso") -> str:
    """
    Convert between Unix epoch and ISO 8601 strings.

    If input is numeric, treat as epoch seconds and convert to ISO.
    If input is a date string, parse and convert to epoch.
    """
    stripped = value.strip()

    # Try parsing as numeric (epoch seconds or milliseconds)
    try:
        numeric = float(stripped)
        # If value looks like milliseconds (> year 2100 in seconds), convert
        if numeric > 4_102_444_800:
            numeric = numeric / 1000.0
        dt = datetime.fromtimestamp(numeric, tz=timezone.utc)
        if to_format == "epoch":
            return json.dumps({"epoch": numeric, "iso": dt.isoformat()})
        return json.dumps({"iso": dt.isoformat(), "epoch": numeric})
    except (ValueError, OverflowError, OSError):
        pass

    # Try parsing as ISO 8601 date string
    for fmt in (
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%dT%H:%M:%S.%f%z",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M:%S.%f",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d",
    ):
        try:
            dt = datetime.strptime(stripped, fmt)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            epoch = dt.timestamp()
            return json.dumps({"epoch": epoch, "iso": dt.isoformat()})
        except ValueError:
            continue

    return json.dumps({"error": f"Cannot parse timestamp: {stripped}"})


def regex_test(pattern: str, text: str) -> str:
    """Run regex against text, return JSON with matches, groups, and spans."""
    try:
        compiled = re.compile(pattern)
    except re.error as e:
        return json.dumps({"error": f"Invalid regex: {e}"})

    matches = []
    for m in compiled.finditer(text):
        match_info = {
            "match": m.group(),
            "span": list(m.span()),
            "groups": list(m.groups()),
        }
        if m.groupdict():
            match_info["named_groups"] = m.groupdict()
        matches.append(match_info)

    return json.dumps({
        "pattern": pattern,
        "text": text,
        "match_count": len(matches),
        "matches": matches,
    }, ensure_ascii=False)


def diff_text(text_a: str, text_b: str) -> str:
    """Return unified diff between two texts."""
    lines_a = text_a.splitlines(keepends=True)
    lines_b = text_b.splitlines(keepends=True)

    diff = list(difflib.unified_diff(
        lines_a,
        lines_b,
        fromfile="text_a",
        tofile="text_b",
        lineterm="",
    ))

    if not diff:
        return json.dumps({"diff": "", "changed": False})

    return json.dumps({
        "diff": "\n".join(diff),
        "changed": True,
    }, ensure_ascii=False)
