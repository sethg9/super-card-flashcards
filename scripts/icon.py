"""Regenerate the checked-in Windows icon using Pillow (optional development tool)."""
from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parent.parent / 'assets'
size = 1024
image = Image.new('RGBA', (size, size), (0, 0, 0, 0))
draw = ImageDraw.Draw(image)
draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=240, fill='#78f542')
for points in [[(48, 98), (128, 54), (208, 98), (128, 142), (48, 98)], [(48, 130), (128, 174), (208, 130)], [(48, 162), (128, 206), (208, 162)]]:
    scaled = [(x * 4, y * 4) for x, y in points]
    draw.line(scaled, fill='#102008', width=48, joint='curve')
    for x, y in scaled:
        draw.ellipse((x - 24, y - 24, x + 24, y + 24), fill='#102008')
image = image.resize((256, 256), Image.Resampling.LANCZOS)
image.save(root / 'icon.png')
image.save(root / 'icon.ico', sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
