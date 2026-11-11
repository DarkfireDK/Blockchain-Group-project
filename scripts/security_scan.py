"""Scan actual Hardhat 3 compiler output with Slither (no source recompilation).
Hardhat 3 splits input/output JSON; crytic-compile 0.3 expects a combined file.
This adapter combines them without altering AST/bytecode and materializes source names.
Run after `yarn compile`, from repository root, with slither-analyzer==0.11.5.
"""
import json
import hashlib
from pathlib import Path
from crytic_compile import CryticCompile
from crytic_compile.platform.hardhat import Hardhat, hardhat_like_parsing
from slither import Slither
from slither.__main__ import get_detectors_and_printers

ROOT = Path(__file__).resolve().parents[1]
BUILD = ROOT / "packages/hardhat/artifacts/build-info"
STAGE = ROOT / ".security-build"
STAGE.mkdir(exist_ok=True)
INFO = STAGE / "build-info"
INFO.mkdir(exist_ok=True)
# Delete only this adapter's obsolete build snapshots, never source or artifacts.
for old in INFO.glob("*.json"):
    old.unlink()
selected = []
covered = set()
for path in sorted(BUILD.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True):
    if path.name.endswith(".output.json"):
        continue
    data = json.loads(path.read_text(encoding="utf-8"))
    project = {k: v for k, v in data["input"]["sources"].items() if k.startswith("project/")}
    if not project or all(k in covered for k in project):
        continue
    if any(v["content"].replace("\r\n", "\n") != (ROOT / "packages/hardhat" / k.removeprefix("project/")).read_text(encoding="utf-8").replace("\r\n", "\n") for k, v in project.items()):
        continue  # Never scan obsolete bytecode for changed source.
    output = json.loads(path.with_name(path.stem + ".output.json").read_text(encoding="utf-8"))["output"]
    data["output"] = output
    (INFO / path.name).write_text(json.dumps(data), encoding="utf-8")
    for name, source in data["input"]["sources"].items():
        dest = (STAGE / name).resolve()
        if not dest.is_relative_to(STAGE.resolve()):
            raise ValueError("Unexpected compiler source path")
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(source["content"], encoding="utf-8", newline="\n")
    covered.update(project)
    selected.append(path.name)
expected = {"project/contracts/" + p.name for p in (ROOT / "packages/hardhat/contracts").glob("*.sol")}
if not expected.issubset(covered):
    raise RuntimeError("Compile current contracts before scanning: " + str(expected - covered))

class BuildArtifacts(Hardhat):
    def _guessed_tests(self):
        return []
    def _run_hardhat_console(self, base_cmd, command):
        return "{}"
    def _get_hardhat_paths(self, base_cmd, args):
        return {"root": self._target, "artifacts": str(STAGE), "tests": str(STAGE / "test")}
    def compile(self, compilation, **kwargs):
        hardhat_like_parsing(compilation, self._target, INFO, self._target)
    def is_dependency(self, path):
        return "/npm/" in str(path).replace("\\", "/")

slither = Slither(CryticCompile(BuildArtifacts(str(STAGE))), filter_paths=["npm/", "project/contracts/test/"], exclude_dependencies=True)
detectors, _ = get_detectors_and_printers()
for detector in detectors:
    slither.register_detector(detector)
findings = [f for group in slither.run_detectors() for f in group]
source_hash = hashlib.sha256()
for path in sorted((ROOT / "packages/hardhat/contracts").rglob("*.sol")):
    source_hash.update(path.relative_to(ROOT).as_posix().encode())
    source_hash.update(path.read_text(encoding="utf-8").replace("\r\n", "\n").encode())
digest = source_hash.hexdigest()
review_file = ROOT / "scripts/slither-reviewed.json"
review = json.loads(review_file.read_text(encoding="utf-8")) if review_file.exists() else {}
accepted = set(review.get("accepted_ids", [])) if review.get("source_sha256") == digest else set()
unreviewed = [f for f in findings if f["impact"] in ("High", "Medium") and f["id"] not in accepted]
result = {"tool": "slither-analyzer 0.11.5", "source_sha256": digest, "unreviewed_high_medium": len(unreviewed), "compiler": "0.8.30", "builds": selected,
          "contracts": sorted(expected), "detectors": len(detectors), "findings": findings}
out = ROOT / "docs/evidence/slither.json"
out.parent.mkdir(exist_ok=True, parents=True)
out.write_text(json.dumps(result, indent=2), encoding="utf-8")
for finding in findings:
    print(f"[{finding['impact']}/{finding['confidence']}] {finding['check']}: {finding['description']}")
print(f"Scanned {len(expected)} source files with {len(detectors)} detectors; {len(findings)} findings. Output: {out}")
print(f"Unreviewed High/Medium: {len(unreviewed)}; findings are retained even when reviewed.")
raise SystemExit(1 if unreviewed else 0)
