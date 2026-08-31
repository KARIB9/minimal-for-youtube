#!/usr/bin/env python3
"""Генерирует значки расширения (PNG 16/48/128) из кода, без внешних библиотек.

Форма: две красные вертикальные полосы со скруглёнными концами на чёрном
скруглённом квадрате.

Про товарный знак: с символикой YouTube эта форма не пересекается никак —
в отличие от треугольника "play", который мог бы вызвать вопросы у модерации.

Запуск:  python3 tools/make-icons.py
"""

import math
import os
import struct
import zlib

BG = (0, 0, 0)  # чёрный фон
FG = (255, 0, 51)  # красные полосы

SUPERSAMPLE = 4  # сглаживание: рисуем крупнее и усредняем

CORNER_RADIUS = 0.22

# Доли от стороны значка. Полосы намеренно толстые и с широким просветом:
# на 16px тонкие сливаются друг с другом в одно пятно.
BAR_WIDTH = 0.15

# Концы отрезков — это центры закруглений, а не видимые края: капсула
# выступает за них на половину толщины с каждой стороны.
#
# Правая полоса начинается ниже левой, а низ у обеих общий — выровнены
# по нижнему краю. Так короткая полоса читается как замысел, а не как
# сбившаяся вёрстка.
LEFT_X, LEFT_TOP, LEFT_BOTTOM = 0.38, 0.30, 0.70
RIGHT_X, RIGHT_TOP, RIGHT_BOTTOM = 0.62, 0.40, 0.70


def inside_rounded_rect(x, y, size, radius):
    cx = min(max(x, radius), size - radius)
    cy = min(max(y, radius), size - radius)
    return math.hypot(x - cx, y - cy) <= radius


def dist_to_segment(px, py, x1, y1, x2, y2):
    dx, dy = x2 - x1, y2 - y1
    length_sq = dx * dx + dy * dy
    t = 0.0 if length_sq == 0 else ((px - x1) * dx + (py - y1) * dy) / length_sq
    t = max(0.0, min(1.0, t))
    return math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))


def render(size):
    """Возвращает строки пикселей RGBA."""
    ss = size * SUPERSAMPLE
    scale = float(ss)

    radius = CORNER_RADIUS * scale

    # Полоса — отрезок с круглыми концами: скругление получается правильным
    # на любом размере само собой, без отдельного расчёта капсулы.
    width = BAR_WIDTH * scale

    bars = [
        (LEFT_X * scale, LEFT_TOP * scale, LEFT_X * scale, LEFT_BOTTOM * scale),
        (RIGHT_X * scale, RIGHT_TOP * scale, RIGHT_X * scale, RIGHT_BOTTOM * scale),
    ]

    # Сначала считаем субпиксели, потом усредняем блоками SUPERSAMPLE².
    sub = bytearray(ss * ss * 4)

    for y in range(ss):
        py = y + 0.5
        for x in range(ss):
            px = x + 0.5
            offset = (y * ss + x) * 4

            if not inside_rounded_rect(px, py, scale, radius):
                continue  # прозрачный угол

            on_bar = any(
                dist_to_segment(px, py, *bar) <= width / 2 for bar in bars
            )

            colour = FG if on_bar else BG
            sub[offset : offset + 4] = bytes((*colour, 255))

    rows = []
    block = SUPERSAMPLE * SUPERSAMPLE

    for y in range(size):
        row = bytearray()
        for x in range(size):
            r = g = b = a = 0
            for dy in range(SUPERSAMPLE):
                base = ((y * SUPERSAMPLE + dy) * ss + x * SUPERSAMPLE) * 4
                for dx in range(SUPERSAMPLE):
                    o = base + dx * 4
                    r += sub[o]
                    g += sub[o + 1]
                    b += sub[o + 2]
                    a += sub[o + 3]
            row += bytes((r // block, g // block, b // block, a // block))
        rows.append(bytes(row))

    return rows


def write_png(path, rows, size):
    raw = b"".join(b"\x00" + row for row in rows)

    def chunk(kind, data):
        return (
            struct.pack(">I", len(data))
            + kind
            + data
            + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)
        )

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9))
    png += chunk(b"IEND", b"")

    with open(path, "wb") as handle:
        handle.write(png)


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    out = os.path.join(os.path.dirname(here), "icons")
    os.makedirs(out, exist_ok=True)

    # 32 нужен Chrome: он берёт его в интерфейсе Windows, и без него
    # масштабируется 48-й — с потерей резкости.
    for size in (16, 32, 48, 128):
        path = os.path.join(out, f"icon{size}.png")
        write_png(path, render(size), size)
        print(f"{path}  {os.path.getsize(path)} байт")


if __name__ == "__main__":
    main()
