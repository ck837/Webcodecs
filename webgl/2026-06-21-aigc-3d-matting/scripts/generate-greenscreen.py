"""生成浏览器可播 H.264 绿幕 MP4 → public/greenscreen.mp4"""
import math
import os
from pathlib import Path

import cv2
import imageio.v3 as iio
import numpy as np

OUT = Path(__file__).resolve().parent.parent / "public" / "greenscreen.mp4"
W, H = 1280, 720
FPS = 30
SEC = 10


def main() -> None:
    frames: list[np.ndarray] = []
    for i in range(FPS * SEC):
        t = i / FPS
        frame = np.full((H, W, 3), (0, 255, 0), dtype=np.uint8)
        cx = int(W * 0.5 + math.sin(t * 0.7) * 80)
        cy = int(H * 0.52)

        cv2.ellipse(frame, (cx, cy + 95), (70, 22), 0, 0, 360, (45, 45, 55), -1)
        cv2.circle(frame, (cx, cy - 55), 38, (180, 160, 210), -1)
        cv2.rectangle(frame, (cx - 45, cy - 18), (cx + 45, cy + 95), (165, 111, 74), -1)
        cv2.rectangle(frame, (cx - 52, cy + 95), (cx - 18, cy + 175), (40, 40, 40), -1)
        cv2.rectangle(frame, (cx + 18, cy + 95), (cx + 52, cy + 175), (40, 40, 40), -1)
        cv2.putText(
            frame, "AIGC SUBJECT", (cx - 120, cy - 110),
            cv2.FONT_HERSHEY_SIMPLEX, 1.0, (255, 255, 255), 2,
        )
        frames.append(frame)

    iio.imwrite(
        OUT,
        np.stack(frames),
        fps=FPS,
        codec="libx264",
        pixelformat="yuv420p",
    )
    print(f"Wrote {OUT} ({os.path.getsize(OUT) // 1024} KB, H.264)")


if __name__ == "__main__":
    main()
