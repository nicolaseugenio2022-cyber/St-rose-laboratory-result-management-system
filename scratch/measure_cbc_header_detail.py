from PIL import Image
import numpy as np

img = Image.open(r"c:\Projects\St-rose-laboratory-result-management-system\Templates\docs-template\CBC.png").convert('RGB')
arr = np.array(img)
h, w, _ = arr.shape

print(f"=== REFERENCE CBC.PNG (Viewport {w}x{h} px) ===")

# Logo banner has white text on teal/blue background (R=0..150, G=120..220, B=150..255)
logo_mask = (arr[:120, :200, 0] < 180) & (arr[:120, :200, 1] > 100) & (arr[:120, :200, 2] > 120)
l_rows = np.where(np.any(logo_mask, axis=1))[0]
l_cols = np.where(np.any(logo_mask, axis=0))[0]
if len(l_rows) > 0:
    print(f"Logo BBox: Left={l_cols[0]}px, Right={l_cols[-1]}px (Width={l_cols[-1]-l_cols[0]+1}px), Top={l_rows[0]}px, Bottom={l_rows[-1]}px (Height={l_rows[-1]-l_rows[0]+1}px)")

# Header text block (non-white pixels in right column Y=0..100, X=180..525)
hdr_text_mask = (arr[:100, 180:525, 0] < 200) | (arr[:100, 180:525, 1] < 200) | (arr[:100, 180:525, 2] < 200)
t_rows = np.where(np.any(hdr_text_mask, axis=1))[0]
t_cols = np.where(np.any(hdr_text_mask, axis=0))[0] + 180
if len(t_rows) > 0:
    print(f"Header Text Block BBox: Left={t_cols[0]}px, Right={t_cols[-1]}px (Width={t_cols[-1]-t_cols[0]+1}px), Top={t_rows[0]}px, Bottom={t_rows[-1]}px (Height={t_rows[-1]-t_rows[0]+1}px)")

# Divider Line (horizontal line around Y=80..110)
# Look at horizontal lines in Y=80..110
for y in range(75, 115):
    row_pixels = arr[y, 160:525]
    non_white_count = np.sum((row_pixels[:, 0] < 200) | (row_pixels[:, 1] < 200) | (row_pixels[:, 2] < 200))
    if non_white_count > 200:
        print(f"Divider Line found at Y={y}px, span count={non_white_count}px")

# Demographics Table Top (Border around Y=110..140)
for y in range(105, 140):
    row_pixels = arr[y, 50:525]
    non_white_count = np.sum((row_pixels[:, 0] < 220) | (row_pixels[:, 1] < 220) | (row_pixels[:, 2] < 220))
    if non_white_count > 300:
        print(f"Demographics Table Top Border found at Y={y}px")
        break
