#!/usr/bin/env python3
"""Write NSIS MUI bitmaps (24-bit uncompressed BMP) for the Windows installer."""

from __future__ import annotations

import struct
from pathlib import Path


def write_bmp24(path: Path, width: int, height: int, b: int, g: int, r: int) -> None:
    row_pad = (4 - ((width * 3) % 4)) % 4
    row_size = width * 3 + row_pad
    pixel_data_size = row_size * height
    header_size = 40
    file_size = 14 + header_size + pixel_data_size
    path.parent.mkdir(parents=True, exist_ok=True)

    row = bytes([b, g, r] * width) + bytes(row_pad)
    pixels = row * height

    with path.open("wb") as f:
        f.write(b"BM")
        f.write(struct.pack("<I", file_size))
        f.write(struct.pack("<HH", 0, 0))
        f.write(struct.pack("<I", 14 + header_size))
        f.write(struct.pack("<I", header_size))
        f.write(struct.pack("<i", width))
        f.write(struct.pack("<i", height))
        f.write(struct.pack("<H", 1))
        f.write(struct.pack("<H", 24))
        f.write(struct.pack("<I", 0))
        f.write(struct.pack("<I", pixel_data_size))
        f.write(struct.pack("<i", 0))
        f.write(struct.pack("<i", 0))
        f.write(struct.pack("<I", 0))
        f.write(struct.pack("<I", 0))
        f.write(pixels)


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    out = root / "src-frontend" / "src-tauri" / "nsis-assets"
    # Sidebar / welcome: deep slate
    write_bmp24(out / "nsis-sidebar.bmp", 164, 314, 0x2A, 0x32, 0x3D)
    # Header strip: accent teal on dark
    write_bmp24(out / "nsis-header.bmp", 150, 57, 0x2A, 0x32, 0x3D)
    print(f"Wrote {out / 'nsis-sidebar.bmp'} and {out / 'nsis-header.bmp'}")


if __name__ == "__main__":
    main()
