"""Remove image background with rembg.

Usage:
  python scripts/rembg_matting.py input.jpg output.png

Install runtime dependency separately:
  pip install rembg pillow
"""

from __future__ import annotations

import sys
from pathlib import Path


def main() -> int:
    if len(sys.argv) != 3:
        print("usage: rembg_matting.py <input-image> <output-png>", file=sys.stderr)
        return 2

    input_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])
    output_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        from rembg import remove
    except ImportError:
        print("missing dependency: pip install rembg pillow", file=sys.stderr)
        return 3

    source = input_path.read_bytes()
    result = remove(source)
    output_path.write_bytes(result)
    print(str(output_path))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
