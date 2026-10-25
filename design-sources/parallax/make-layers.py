# The about photo split for the parallax: Emil cut out (alpha), and the background with him
# removed (filled in) plus a margin all round, so it can move without its edge showing.
import numpy as np, cv2, os, sys
from PIL import Image
from rembg import remove, new_session
SRC = '/home/ramisoul/Desktop/EMIL/emil-suliman/src/assets/images/emil.webp'
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../src/assets/images/parallax'); MARGIN = int(sys.argv[2]) if len(sys.argv) > 2 else 48
os.makedirs(OUT, exist_ok=True)
photo = Image.open(SRC).convert('RGB')
# Emil: a person-segmentation model, the hair's edge refined with alpha matting
cut = remove(photo, session=new_session('u2net_human_seg'), alpha_matting=True,
             alpha_matting_foreground_threshold=240, alpha_matting_background_threshold=15, alpha_matting_erode_size=8)
alpha = np.asarray(cut)[..., 3]
# Emil, with the same margin as the background: his shirt runs out of the photo at the bottom
# (and right), so it is carried on past the edges — a shift then shows more shirt, never a gap
fg = cv2.copyMakeBorder(np.dstack([np.asarray(photo), alpha]), MARGIN, MARGIN, MARGIN, MARGIN, cv2.BORDER_REPLICATE)
Image.fromarray(fg).save(f'{OUT}/emil-fg.webp', 'WEBP', quality=82, method=6)
# the background: where Emil is (a little more, for his soft edge) filled in from around it
rgb = np.asarray(photo)
hole = cv2.dilate((alpha > 8).astype(np.uint8) * 255, np.ones((25, 25), np.uint8))
bg = cv2.inpaint(rgb, hole, 25, cv2.INPAINT_TELEA)
bg = np.where(hole[..., None] > 0, cv2.GaussianBlur(bg, (0, 0), 9), bg)        # smooth the filled part
# the margin: mirrored out, then blurred so it reads as more of the soft city
# (the photo's outermost pixels are a light line: left out, or the mirror shows it as a seam)
T = 3
big = cv2.copyMakeBorder(bg[T:-T, T:-T], MARGIN + T, MARGIN + T, MARGIN + T, MARGIN + T, cv2.BORDER_REFLECT_101)
edge = np.ones(big.shape[:2], np.uint8); edge[MARGIN + T:-(MARGIN + T), MARGIN + T:-(MARGIN + T)] = 0
big = np.where(edge[..., None] > 0, cv2.GaussianBlur(big, (0, 0), 6), big)
Image.fromarray(big).save(f'{OUT}/emil-bg.webp', 'WEBP', quality=80, method=6)
for f in ['emil-fg.webp', 'emil-bg.webp']: print(f, Image.open(f'{OUT}/{f}').size, os.path.getsize(f'{OUT}/{f}') // 1024, 'KB')
# a look: the cutout on grey, the background, and the two put back together
front = Image.open(f'{OUT}/emil-fg.webp').crop((MARGIN, MARGIN, MARGIN + 640, MARGIN + 640))
grey = Image.new('RGB', photo.size, (120, 120, 120)); grey.paste(front, (0, 0), front)
b = Image.open(f'{OUT}/emil-bg.webp').crop((MARGIN, MARGIN, MARGIN + 640, MARGIN + 640))
back = b.copy(); back.paste(front, (0, 0), front)
sheet = Image.new('RGB', (640 * 3 + 20, 640), 'white')
for k, im in enumerate([grey, b, back]): sheet.paste(im, (k * 650, 0))
import tempfile; LOOK = os.path.join(tempfile.gettempdir(), 'emil-layers-look.png')
sheet.resize((sheet.size[0] // 2, 320)).save(LOOK); print('a look at the layers:', LOOK)   # not into the site's assets
d = np.abs(np.asarray(back).astype(int) - rgb.astype(int)).mean()
print('back together vs the photo: mean difference', round(d, 2), '/255')
