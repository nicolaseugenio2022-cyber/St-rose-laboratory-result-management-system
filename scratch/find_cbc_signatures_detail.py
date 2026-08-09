from PIL import Image
import numpy as np

img = Image.open(r"c:\Projects\St-rose-laboratory-result-management-system\Templates\docs-template\CBC.png").convert('RGB')
arr = np.array(img)

sub = arr[420:650, :]
is_not_white = (sub[:, :, 0] < 250) | (sub[:, :, 1] < 250) | (sub[:, :, 2] < 250)
rows = np.where(np.any(is_not_white, axis=1))[0]
cols = np.where(np.any(is_not_white, axis=0))[0]

if len(rows) > 0:
    min_x = cols[0]
    max_x = cols[-1]
    min_y = 420 + rows[0]
    max_y = 420 + rows[-1]
    print(f"Signature Section Box: X={min_x}..{max_x} (Width: {max_x-min_x+1}px), Y={min_y}..{max_y} (Height: {max_y-min_y+1}px)")
