# Compatibility wrapper for old path.
# Canonical spec: packaging/pyinstaller/win64.spec
from pathlib import Path

canonical = Path(__file__).resolve().parents[1] / "packaging" / "pyinstaller" / "win64.spec"
exec(canonical.read_text(encoding="utf-8"), globals())
