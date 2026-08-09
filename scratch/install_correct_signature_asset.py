import shutil, os
from PIL import Image
import numpy as np

src_signature = r"c:\Projects\St-rose-laboratory-result-management-system\scratch\extracted_cbc_media\word\media\image1.png"
dst_signature = r"c:\Projects\St-rose-laboratory-result-management-system\public\pathologist-signature.png"

# Copy image1.png (Dr. Clemente's black cursive e-signature) to public/pathologist-signature.png
shutil.copy2(src_signature, dst_signature)

# Verify dst_signature
img = Image.open(dst_signature)
arr = np.array(img.convert('RGB'))
h, w, _ = arr.shape

is_dark = (arr[:, :, 0] < 80) & (arr[:, :, 1] < 80) & (arr[:, :, 2] < 80)
dark_pct = (np.sum(is_dark) / (w * h)) * 100

is_blue = (arr[:, :, 0] < 120) & (arr[:, :, 1] > 100) & (arr[:, :, 2] > 120)
blue_pct = (np.sum(is_blue) / (w * h)) * 100

print(f"COPIED DR. CLEMENTE BLACK CURSIVE SIGNATURE TO {dst_signature}:")
print(f"  Dimensions: {w}x{h}, Mode: {img.mode}, Bytes: {os.path.getsize(dst_signature)}")
print(f"  Dark Pixel Ratio: {dark_pct:.2f}%, Blue/Teal Ratio: {blue_pct:.2f}%")
