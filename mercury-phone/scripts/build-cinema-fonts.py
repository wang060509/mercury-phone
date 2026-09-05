"""Build pinned Mercury Cinema webfont subsets and their runtime coverage table."""

from __future__ import annotations

import hashlib
import json
import os
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LOCAL_DEPENDENCIES = ROOT / ".cache" / "cinema-font-pydeps"
if LOCAL_DEPENDENCIES.is_dir():
    sys.path.insert(0, str(LOCAL_DEPENDENCIES))

from fontTools import subset
from fontTools.ttLib import TTFont


OUTPUT = ROOT / "app" / "assets" / "fonts" / "cinema"
COVERAGE_OUTPUT = ROOT / "app" / "core" / "cinema-font-coverage.js"
SOURCE_MANIFEST_PATH = ROOT / "scripts" / "cinema-font-sources.json"
SOURCE_MANIFEST = json.loads(SOURCE_MANIFEST_PATH.read_text(encoding="utf-8"))
CODEPOINT_MANIFEST_PATH = ROOT / "scripts" / "cinema-font-codepoints.json"
CODEPOINT_MANIFEST = json.loads(CODEPOINT_MANIFEST_PATH.read_text(encoding="utf-8"))
SOURCE_DIRECTORY = Path(os.environ.get("CINEMA_FONT_SOURCE_DIR", ROOT / SOURCE_MANIFEST["sourceDirectory"]))
SOURCE_ENVIRONMENT = {
    "display": "CINEMA_ZHUQUE_SOURCE",
    "reading": "CINEMA_NOTO_SERIF_SOURCE",
    "ui": "CINEMA_NOTO_SANS_SOURCE",
    "handwriting": "CINEMA_HANDWRITING_SOURCE",
}

SOURCES = {
    role: Path(os.environ.get(SOURCE_ENVIRONMENT[role], SOURCE_DIRECTORY / source["filename"]))
    for role, source in SOURCE_MANIFEST["sources"].items()
}

EXPECTED_SHA256 = {role: source["sha256"] for role, source in SOURCE_MANIFEST["sources"].items()}

OUTPUTS = {
    "display": OUTPUT / "cinema-zhuque-display.woff2",
    "reading": OUTPUT / "cinema-noto-serif-reading.woff2",
    "ui": OUTPUT / "cinema-noto-sans-ui.woff2",
    "handwriting": OUTPUT / "cinema-jason-handwriting-8.woff2",
}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest().upper()


def cmap(path: Path) -> set[int]:
    font = TTFont(path, lazy=True)
    points: set[int] = set()
    for table in font["cmap"].tables:
        if table.isUnicode():
            points.update(table.cmap)
    font.close()
    return points


def expand_ranges(ranges: list[list[int]]) -> set[int]:
    points: set[int] = set()
    previous = -1
    for start, end in ranges:
        if start > end or start <= previous:
            raise RuntimeError("Cinema font codepoint ranges must be ordered and non-overlapping.")
        points.update(range(start, end + 1))
        previous = end
    return points


def subset_font(source: Path, destination: Path, requested: set[int]) -> set[int]:
    available = cmap(source)
    selected = requested & available
    options = subset.Options()
    options.flavor = "woff2"
    options.layout_features = ["*"]
    options.name_IDs = ["*"]
    options.name_languages = ["*"]
    options.name_legacy = True
    options.notdef_glyph = True
    options.notdef_outline = True
    options.recommended_glyphs = True
    font = subset.load_font(str(source), options, lazy=False)
    worker = subset.Subsetter(options=options)
    worker.populate(unicodes=selected)
    worker.subset(font)
    destination.parent.mkdir(parents=True, exist_ok=True)
    subset.save_font(font, str(destination), options)
    return cmap(destination)


def compress_ranges(points: set[int]) -> list[list[int]]:
    ordered = sorted(points)
    if not ordered:
        return []
    ranges: list[list[int]] = []
    start = previous = ordered[0]
    for point in ordered[1:]:
        if point == previous + 1:
            previous = point
            continue
        ranges.append([start, previous])
        start = previous = point
    ranges.append([start, previous])
    return ranges


def write_coverage_module(coverage: dict[str, set[int]]) -> None:
    ranges = {role: compress_ranges(points) for role, points in coverage.items()}
    payload = json.dumps(ranges, ensure_ascii=True, separators=(",", ":"))
    source = f'''(function exposeMercuryCinemaFontCoverage(global) {{
  "use strict";
  const ranges = Object.freeze({payload});
  const roleClasses = Object.freeze({{ display: "cinema-display--fallback", reading: "cinema-reading--fallback", ui: "cinema-ui--fallback", handwriting: "cinema-handwriting--fallback" }});
  function contains(roleRanges, point) {{
    let low = 0;
    let high = roleRanges.length - 1;
    while (low <= high) {{
      const middle = (low + high) >> 1;
      const [start, end] = roleRanges[middle];
      if (point < start) high = middle - 1;
      else if (point > end) low = middle + 1;
      else return true;
    }}
    return false;
  }}
  function supports(role, value) {{
    const roleRanges = ranges[role] || [];
    return Array.from(String(value || "")).every((character) => {{
      const point = character.codePointAt(0);
      if (/\\s/u.test(character)) return true;
      return contains(roleRanges, point);
    }});
  }}
  function applyWholeStringFallback(node, role, value) {{
    const fallback = !supports(role, value);
    node?.setAttribute?.("data-cinema-font-role", role);
    node?.setAttribute?.("data-cinema-font-fallback", fallback ? "true" : "false");
    if (fallback && roleClasses[role]) node?.classList?.add?.(roleClasses[role]);
    return fallback;
  }}
  const api = Object.freeze({{ ranges, supports, applyWholeStringFallback }});
  global.MercuryCinemaFontCoverage = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
}})(typeof window !== "undefined" ? window : globalThis);\n'''
    COVERAGE_OUTPUT.write_text(source, encoding="utf-8", newline="\r\n")


def main() -> None:
    codepoint_hash = sha256(CODEPOINT_MANIFEST_PATH)
    if codepoint_hash != SOURCE_MANIFEST["codepointManifestSha256"]:
        raise RuntimeError(f"Unexpected Cinema codepoint manifest hash: {codepoint_hash}")
    for role, path in SOURCES.items():
        if not path.is_file():
            raise FileNotFoundError(f"Missing {role} font source: {path}. Run scripts/fetch-cinema-fonts.py first.")
        actual = sha256(path)
        if actual != EXPECTED_SHA256[role]:
            raise RuntimeError(f"Unexpected {role} source hash: {actual}")

    profiles = {role: expand_ranges(CODEPOINT_MANIFEST["ranges"][role]) for role in SOURCES}
    coverage = {role: subset_font(SOURCES[role], OUTPUTS[role], points) for role, points in profiles.items()}
    write_coverage_module(coverage)

    serif_license = OUTPUT / "NotoSerifSC-OFL.txt"
    sans_license = OUTPUT / "NotoSansSC-OFL.txt"
    if serif_license.is_file() and not sans_license.exists():
        shutil.copyfile(serif_license, sans_license)

    for role, destination in OUTPUTS.items():
        missing = profiles[role] - coverage[role]
        output_hash = sha256(destination)
        if output_hash != SOURCE_MANIFEST["approvedOutputs"][role]:
            raise RuntimeError(f"Unexpected {role} output hash: {output_hash}")
        print(f"{role}: {destination.name} bytes={destination.stat().st_size} cmap={len(coverage[role])} requested-missing={len(missing)} sha256={output_hash}")
    coverage_hash = sha256(COVERAGE_OUTPUT)
    if coverage_hash != SOURCE_MANIFEST["approvedOutputs"]["coverage"]:
        raise RuntimeError(f"Unexpected Cinema font coverage output hash: {coverage_hash}")


if __name__ == "__main__":
    main()
