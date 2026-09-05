"""Fetch and verify the pinned source fonts used by the Cinema subset build."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import urllib.request
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = Path(__file__).with_name("cinema-font-sources.json")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def verified(path: Path, expected: str) -> bool:
    return path.is_file() and sha256(path) == expected


def download_with_curl(url: str, temporary: Path) -> bool:
    curl = shutil.which("curl") or shutil.which("curl.exe")
    if not curl:
        return False
    result = subprocess.run(
        [
            curl,
            "--fail",
            "--location",
            "--silent",
            "--show-error",
            "--connect-timeout",
            "20",
            "--max-time",
            "300",
            "--retry",
            "2",
            "--retry-all-errors",
            "--output",
            str(temporary),
            url,
        ],
        check=False,
    )
    return result.returncode == 0


def download_with_urllib(url: str, temporary: Path) -> None:
    request = urllib.request.Request(url, headers={"User-Agent": "Mercury-Cinema-Font-Build/1"})
    with urllib.request.urlopen(request, timeout=30) as response, temporary.open("wb") as output:
        shutil.copyfileobj(response, output, length=1024 * 1024)


def download(url: str, destination: Path) -> None:
    temporary = destination.with_suffix(destination.suffix + ".part")
    temporary.parent.mkdir(parents=True, exist_ok=True)
    try:
        if not download_with_curl(url, temporary):
            temporary.unlink(missing_ok=True)
            download_with_urllib(url, temporary)
        os.replace(temporary, destination)
    finally:
        temporary.unlink(missing_ok=True)


def acquire(role: str, source: dict[str, str], source_directory: Path, verify_only: bool) -> Path:
    destination = source_directory / source["filename"]
    if verified(destination, source["sha256"]):
        print(f"{role}: verified {destination}")
        return destination
    if verify_only:
        raise RuntimeError(f"Missing or invalid cached {role} source: {destination}")

    archive_member = source.get("archiveMember")
    if archive_member:
        download_path = source_directory / source["downloadFilename"]
        if not verified(download_path, source["downloadSha256"]):
            download(source["url"], download_path)
        if not verified(download_path, source["downloadSha256"]):
            raise RuntimeError(f"Unexpected {role} download hash: {sha256(download_path)}")
        with zipfile.ZipFile(download_path) as archive:
            with archive.open(archive_member) as bundled, destination.open("wb") as output:
                shutil.copyfileobj(bundled, output)
    else:
        download(source["url"], destination)

    if not verified(destination, source["sha256"]):
        actual = sha256(destination) if destination.exists() else "missing"
        destination.unlink(missing_ok=True)
        raise RuntimeError(f"Unexpected {role} source hash: {actual}")
    print(f"{role}: acquired {destination}")
    return destination


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--verify-only", action="store_true")
    parser.add_argument("--source-dir", type=Path)
    options = parser.parse_args()
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    configured = options.source_dir or Path(os.environ.get("CINEMA_FONT_SOURCE_DIR", ROOT / manifest["sourceDirectory"]))
    source_directory = configured.resolve()
    source_directory.mkdir(parents=True, exist_ok=True)
    for role, source in manifest["sources"].items():
        acquire(role, source, source_directory, options.verify_only)


if __name__ == "__main__":
    main()
