# The about photo in depth

On desktop the about photo has depth with the mouse (src/app/sections/about/parallax.ts):
the city behind slides against the mouse, Emil cut out in front moves a little with it.

The two layers, src/assets/images/parallax:
- emil-fg.webp — Emil, cut out, with the same 48px margin (736 x 736; his shirt carried on past the edges)
- emil-bg.webp — the background with him removed and filled in, 48px bigger on every side
  (736 x 736) so it can move without its edge showing

Both are made from src/assets/images/emil.webp by make-layers.py. With a new photo, replace
emil.webp (640 x 640) and run it again:

    python3 -m venv /tmp/venv && /tmp/venv/bin/pip install "rembg[cpu]" opencv-python-headless numpy pillow
    /tmp/venv/bin/python design-sources/parallax/make-layers.py

(rembg downloads its person-cutout model, ~170 MB, the first time.) It prints how far the two
put back together are from the photo: about 2/255 is right.
