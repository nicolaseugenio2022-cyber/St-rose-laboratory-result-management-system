import zipfile
import os
from PIL import Image
import numpy as np

docx_path = r"c:\Projects\St-rose-laboratory-result-management-system\Templates\CBC.docx"
output_dir = r"c:\Projects\St-rose-laboratory-result-management-system\scratch\extracted_cbc_media"
os.makedirs(output_dir, exist_ok=True)

with zipfile.ZipFile(docx_path, 'r') as zip_ref:
    for file_info in zip_ref.infolist():
        if file_info.filename.startswith("word/media/"):
            zip_ref.extract(file_info, output_dir)
            extracted_path = os.path.join(output_dir, file_info.filename)
            print(f"Extracted: {file_info.filename}")

# Inspect all extracted images in output_dir/word/media/
media_dir = os.path.join(output_dir, "word", "media")
if os.path.exists(media_dir):
    for f in os.listdir(media_dir):
        fp = os.path.join(media_dir, f)
        img = Image.open(fp)
        arr = np.array(img.convert('RGB'))
        h, w, _ = arr.shape
        
        is_blue = (arr[:, :, 0] < 120) & (arr[:, :, 1] > 100) & (arr[:, :, 2] > 120)
        blue_pct = (np.sum(is_blue) / (w * h)) * 100
        
        is_dark = (arr[:, :, 0] < 80) & (arr[:, :, 1] < 80) & (arr[:, :, 2] < 80)
        dark_pct = (np.sum(is_dark) / (w * h)) * 100
        
        print(f"\nMedia File: {f}")
        print(f"  Dimensions: {w}x{h}, Mode: {img.mode}, Bytes: {os.path.getsize(fp)}")
        print(f"  Blue/Teal Pct: {blue_pct:.2f}%, Dark Pct: {dark_pct:.2f}%")
