import os
from PIL import Image
import numpy as np

def detail_img(path):
    if not os.path.exists(path):
        return f"File DOES NOT EXIST: {path}"
    img = Image.open(path)
    size = img.size
    mode = img.mode
    bytes_size = os.path.getsize(path)
    arr = np.array(img.convert('RGB'))
    
    # Check teal/blue ratio
    is_blue_teal = (arr[:, :, 0] < 120) & (arr[:, :, 1] > 100) & (arr[:, :, 2] > 120)
    blue_teal_pct = (np.sum(is_blue_teal) / (size[0] * size[1])) * 100
    
    # Check dark pixel ratio
    is_dark = (arr[:, :, 0] < 80) & (arr[:, :, 1] < 80) & (arr[:, :, 2] < 80)
    dark_pct = (np.sum(is_dark) / (size[0] * size[1])) * 100
    
    return f"Path: {path}\n  Size: {size[0]}x{size[1]}, Mode: {mode}, Bytes: {bytes_size}\n  Blue/Teal Pct: {blue_teal_pct:.2f}%, Dark Pct: {dark_pct:.2f}%"

print("--- REPORT LOGO ASSET ---")
print(detail_img(r"c:\Projects\St-rose-laboratory-result-management-system\public\report-logo.png"))

print("\n--- PATHOLOGIST SIGNATURE ASSET ---")
print(detail_img(r"c:\Projects\St-rose-laboratory-result-management-system\public\pathologist-signature.png"))
