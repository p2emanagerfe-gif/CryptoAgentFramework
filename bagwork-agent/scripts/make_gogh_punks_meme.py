"""
Generates an ORIGINAL illustrated meme image for bagwork-agent's
gogh-punks-mint-day-meme item — deliberately NOT a reproduction of the
real "Distracted Boyfriend" stock photo (a copyrighted Shutterstock
image whose owner has actively pursued unlicensed commercial use).
Instead this draws simple, original geometric/silhouette figures in
the same three-character comedic structure the joke needs, in a flat
pixel-art style that nods to Gogh Punks being a pixel-art collection
without copying any of that collection's actual character art either.

No network access / image-gen API used — pure vector drawing with
Pillow. Output: bagwork-agent/media/gogh-punks-mint-day-meme.png
"""
from PIL import Image, ImageDraw, ImageFont
import os

W, H = 1200, 675
BG_TOP = (24, 20, 46)
BG_BOTTOM = (54, 30, 90)
PANEL_BG = (34, 28, 64)
ACCENT = (255, 209, 102)
ACCENT2 = (6, 214, 160)
FADE = (120, 110, 150)
WHITE = (245, 245, 250)
OUTLINE = (12, 10, 24)

img = Image.new("RGB", (W, H), BG_TOP)
draw = ImageDraw.Draw(img)

# Vertical gradient background
for y in range(H):
    t = y / H
    r = int(BG_TOP[0] + (BG_BOTTOM[0] - BG_TOP[0]) * t)
    g = int(BG_TOP[1] + (BG_BOTTOM[1] - BG_TOP[1]) * t)
    b = int(BG_TOP[2] + (BG_BOTTOM[2] - BG_TOP[2]) * t)
    draw.line([(0, y), (W, y)], fill=(r, g, b))


def load_font(size, bold=False):
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    ]
    for c in candidates:
        if os.path.exists(c):
            return ImageFont.truetype(c, size)
    return ImageFont.load_default()


title_font = load_font(40, bold=True)
label_font = load_font(26, bold=True)
small_font = load_font(20, bold=False)


def blocky_person(cx, feet_y, scale, skin, shirt, facing="right"):
    """A simple pixel-art-styled person: blocky head + torso + legs, built
    from rectangles only, feet resting on a shared baseline — an original,
    generic silhouette figure, not a likeness of any real or copyrighted
    character."""
    px = scale // 10  # pseudo-pixel unit

    def block(x0, y0, w, h, color):
        # y is measured upward from feet_y in px units
        top = feet_y - y0 * px - h * px
        bottom = feet_y - y0 * px
        draw.rectangle([cx + x0 * px, top, cx + (x0 + w) * px, bottom], fill=color, outline=OUTLINE, width=2)

    # legs (from the ground up)
    block(-3, 0, 2, 6, (40, 40, 60))
    block(1, 0, 2, 6, (40, 40, 60))
    # torso
    block(-4, 6, 8, 9, shirt)
    # head
    block(-3, 15, 6, 7, skin)
    # simple eye (direction of gaze)
    eye_x = 1 if facing == "right" else -2
    block(eye_x, 19, 1, 1, OUTLINE)


FEET_Y = 460

# ---- Panel 1: "me" (blue shirt figure), looking back ----
blocky_person(190, FEET_Y, 165, skin=(233, 196, 160), shirt=(66, 135, 245), facing="right")
draw.text((100, 490), "ME", font=label_font, fill=ACCENT, anchor="ma")
draw.text((190, 530), "refreshing the mint page\nevery 30 seconds", font=small_font, fill=WHITE, align="center", anchor="ma", spacing=6)

# panel divider
draw.line([(400, 90), (400, 600)], fill=(70, 60, 100), width=2)

# ---- Panel 2: "everything else I should be doing today" (fading figure) ----
blocky_person(560, FEET_Y, 155, skin=(215, 178, 150), shirt=FADE, facing="left")
draw.text((560, 490), "EVERYTHING ELSE I SHOULD\nBE DOING TODAY", font=small_font, fill=FADE, align="center", anchor="ma", spacing=6)

draw.line([(760, 90), (760, 600)], fill=(70, 60, 100), width=2)

# ---- Panel 3: the mint page (glowing / bright figure with a pixel-punk halo) ----
glow_cx = 970
for i in range(3, 0, -1):
    draw.ellipse(
        [glow_cx - 95 - i * 12, FEET_Y - 210 - i * 10, glow_cx + 95 + i * 12, FEET_Y + 10 + i * 10],
        outline=ACCENT2,
        width=3,
    )
blocky_person(glow_cx, FEET_Y, 170, skin=ACCENT2, shirt=ACCENT, facing="left")
draw.text((970, 490), "GOGH-PUNKS-ROBINHOOD\nMINT PAGE", font=label_font, fill=ACCENT2, align="center", anchor="ma", spacing=6)
draw.text((970, 570), "10,000 pixel portraits · 0.0003 ETH", font=small_font, fill=WHITE, anchor="ma")

# Title bar
draw.rectangle([0, 0, W, 70], fill=PANEL_BG)
draw.text((30, 15), "bag work — gogh-punks mint day", font=title_font, fill=WHITE)

# Footer disclosure strip (kept visually present — the disclosure text
# itself still ships in the actual post body per complianceGuard.js;
# this strip just signals visually that a disclosure accompanies the post)
draw.rectangle([0, H - 46, W, H], fill=PANEL_BG)
draw.text((30, H - 38), "Disclosure in post — not financial advice", font=small_font, fill=FADE)

out_dir = os.path.join(os.path.dirname(__file__), "..", "media")
os.makedirs(out_dir, exist_ok=True)
out_path = os.path.join(out_dir, "gogh-punks-mint-day-meme.png")
img.save(out_path)
print(f"Saved {out_path} ({os.path.getsize(out_path)} bytes)")
