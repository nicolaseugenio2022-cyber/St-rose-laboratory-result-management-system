from PIL import Image
import numpy as np

img = Image.open(r"c:\Projects\St-rose-laboratory-result-management-system\Templates\docs-template\CBC.png").convert('RGB')
arr = np.array(img)
h, w, _ = arr.shape

print("--- CBC.png HEADER DETAILED MEASUREMENTS ---")

# Find top margin of content
is_content = (arr[:, :, 0] < 240) | (arr[:, :, 1] < 240) | (arr[:, :, 2] < 240)
row_indices = np.where(np.any(is_content, axis=1))[0]
top_y = row_indices[0]
print(f"Top-most content row: Y={top_y}px")

# Find logo right edge X
logo_mask = (arr[:120, :250, 0] < 200) | (arr[:120, :250, 1] < 200)
logo_cols = np.where(np.any(logo_mask, axis=0))[0]
print(f"Logo X span: {logo_cols[0]}px to {logo_cols[-1]}px (Width: {logo_cols[-1]-logo_cols[0]+1}px)")

# Find header text X span
text_mask = (arr[:120, 200:, 0] < 100) & (arr[:120, 200:, 1] < 100) & (arr[:120, 200:, 2] < 100)
text_cols = np.where(np.any(text_mask, axis=0))[0] + 200
print(f"Right Header Text X span: {text_cols[0]}px to {text_cols[-1]}px")

# Find header line Y and X span
line_mask = (arr[:150, :, 0] < 120) & (arr[:150, :, 1] < 140) & (arr[:150, :, 2] < 180)
line_rows = np.where(np.any(line_mask, axis=1))[0]
line_cols = np.where(np.any(line_mask, axis=0))[0]
print(f"Divider Line Y={line_rows[0]}px to {line_rows[-1]}px")
print(f"Divider Line X={line_cols[0]}px to {line_cols[-1]}px (Length: {line_cols[-1]-line_cols[0]+1}px)")
