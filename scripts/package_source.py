"""Create a source-only handoff ZIP from tracked and non-ignored project files."""
from pathlib import Path
import subprocess
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parents[1]
files = subprocess.check_output(["git", "ls-files", "-z", "--cached", "--others", "--exclude-standard"], cwd=root).decode().split("\0")
target = root.parent / "insurance-dapp-reviewed.zip"
with ZipFile(target, "w", ZIP_DEFLATED) as archive:
    for name in sorted(set(files)):
        if not name:
            continue
        path = (root / name).resolve()
        if not path.is_relative_to(root) or not path.is_file():
            continue
        if path.name == ".env" or (path.name.startswith(".env.") and path.name != ".env.example"):
            continue
        archive.write(path, "insurance-dapp/" + name)
with ZipFile(target) as archive:
    assert archive.testzip() is None
    print(f"Source ZIP verified: {len(archive.namelist())} files, {target.stat().st_size} bytes: {target}")
