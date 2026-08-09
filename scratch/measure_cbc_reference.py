from PIL import Image
import numpy as np

img = Image.open(r"c:\Projects\St-rose-laboratory-result-management-system\Templates\docs-template\CBC.png").convert('RGB')
arr = np.array(img)

# Find vertical bounding box of non-white pixels (where white is approx >= 250,250,250)
is_content = (arr[:, :, 0] < 240) | (arr[:, :, 1] < 240) | (arr[:, :, 2] < 240)
row_has_content = np.any(is_content, axis=1)
content_rows = np.where(row_has_content)[0]

print(f"Content vertical bounds: Y={content_rows[0]} to Y={content_rows[-1]} (Total height: {content_rows[-1] - content_rows[0]}px)")

# Let's inspect horizontal bounding box
col_has_content = np.any(is_content, axis=0)
content_cols = np.where(col_has_content)[0]
print(f"Content horizontal bounds: X={content_cols[0]} to X={content_cols[-1]} (Total width: {content_cols[-1] - content_cols[0]}px)")
