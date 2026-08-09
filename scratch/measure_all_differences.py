from PIL import Image
import numpy as np

img = Image.open(r"c:\Projects\St-rose-laboratory-result-management-system\Templates\docs-template\CBC.png").convert('RGB')
arr = np.array(img)
h, w, _ = arr.shape

print(f"=== FULL IMAGE METRICS (CBC.png: {w}x{h} px) ===")

# Helper to find bounding box of non-white pixels in a bounding rectangle
def find_bbox(min_x, min_y, max_x, max_y, r_thresh=245, g_thresh=245, b_thresh=245):
    sub = arr[min_y:max_y, min_x:max_x]
    is_non_white = (sub[:, :, 0] < r_thresh) | (sub[:, :, 1] < g_thresh) | (sub[:, :, 2] < b_thresh)
    rows = np.where(np.any(is_non_white, axis=1))[0]
    cols = np.where(np.any(is_non_white, axis=0))[0]
    if len(rows) == 0 or len(cols) == 0:
        return None
    abs_min_x = min_x + cols[0]
    abs_max_x = min_x + cols[-1]
    abs_min_y = min_y + rows[0]
    abs_max_y = min_y + rows[-1]
    return {
        "x": abs_min_x,
        "y": abs_min_y,
        "w": abs_max_x - abs_min_x + 1,
        "h": abs_max_y - abs_min_y + 1,
        "right": abs_max_x,
        "bottom": abs_max_y
    }

logo_box = find_bbox(0, 0, 220, 120)
print("1. Logo Banner Box:", logo_box)

header_title_box = find_bbox(200, 0, 550, 50)
print("2. Lab Title Box:", header_title_box)

address_box = find_bbox(200, 30, 550, 90)
print("3. Address Block Box:", address_box)

divider_box = find_bbox(150, 80, 550, 110, r_thresh=150, g_thresh=150, b_thresh=150)
print("4. Divider Line Box:", divider_box)

demo_box = find_bbox(0, 115, 550, 220)
print("5. Demographics Table Box:", demo_box)

table_box = find_bbox(0, 220, 550, 420)
print("6. Examination Table Box:", table_box)

remarks_box = find_bbox(0, 380, 550, 420)
print("7. Remarks Row Box:", remarks_box)

sig_box = find_bbox(0, 420, 550, 600)
print("8. Signature Section Box:", sig_box)
