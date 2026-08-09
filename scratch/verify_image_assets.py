import os
from PIL import Image
import numpy as np

def inspect_file(filepath):
    if not os.path.exists(filepath):
        return f"FILE NOT FOUND: {filepath}"
    
    img = Image.open(filepath)
    size = img.size
    mode = img.mode
    bytes_size = os.path.getsize(filepath)
    
    arr = np.array(img.convert('RGB'))
    h, w, _ = arr.shape
    
    # Calculate non-white pixel ratio
    non_white = (arr[:, :, 0] < 240) | (arr[:, :, 1] < 240) | (arr[:, :, 2] < 240)
    non_white_pct = (np.sum(non_white) / (w * h)) * 100
    
    # Calculate dominant colors
    # Check if there is significant cyan/blue color (Logo has R < 100, G > 100, B > 150)
    is_blue_teal = (arr[:, :, 0] < 120) & (arr[:, :, 1] > 100) & (arr[:, :, 2] > 120)
    blue_teal_pct = (np.sum(is_blue_teal) / (w * h)) * 100
    
    # Check if there is black/dark grey cursive text (R < 80, G < 80, B < 80)
    is_dark = (arr[:, :, 0] < 80) & (arr[:, :, 1] < 80) & (arr[:, :, 2] < 80)
    dark_pct = (np.sum(is_dark) / (w * h)) * 100
    
    description = ""
    if blue_teal_pct > 10:
        description += f"St. Rose Diagnostic Laboratory Teal/Blue Logo Banner (Blue/Teal ratio: {blue_teal_pct:.1f}%)"
    elif dark_pct > 0.5:
        description += f"Black/Dark Cursive Signature Line (Dark pixel ratio: {dark_pct:.1f}%, Blue ratio: {blue_teal_pct:.1f}%)"
    else:
        description += f"Unknown/Light image (Dark ratio: {dark_pct:.1f}%, Blue ratio: {blue_teal_pct:.1f}%)"
        
    return {
        "path": filepath,
        "size": f"{size[0]}x{size[1]}",
        "mode": mode,
        "bytes": bytes_size,
        "blue_teal_pct": round(blue_teal_pct, 2),
        "dark_pct": round(dark_pct, 2),
        "description": description
    }

print("=== 1. VERIFYING REPORT HEADER LOGO ASSETS ===")
print("public/report-logo.png:", inspect_file(r"c:\Projects\St-rose-laboratory-result-management-system\public\report-logo.png"))
print("Templates/Docs Logo.png:", inspect_file(r"c:\Projects\St-rose-laboratory-result-management-system\Templates\Docs Logo.png"))

print("\n=== 2. VERIFYING PATHOLOGIST SIGNATURE ASSETS ===")
print("public/pathologist-signature.png:", inspect_file(r"c:\Projects\St-rose-laboratory-result-management-system\public\pathologist-signature.png"))

# Check all images extracted inside Templates/ or word/media
print("\n=== 3. SEARCHING FOR EXTRACTED SIGNATURE ASSETS IN TEMPLATES/ ===")
templates_dir = r"c:\Projects\St-rose-laboratory-result-management-system\Templates"
for root, dirs, files in os.walk(templates_dir):
    for f in files:
        if f.lower().endswith(('.png', '.jpg', '.jpeg', '.emf', '.wmf')):
            fp = os.path.join(root, f)
            print(f"Found image: {fp} ->", inspect_file(fp))
