import zipfile
import os
from PIL import Image

p = r"c:\Projects\St-rose-laboratory-result-management-system\Templates\A. Lab Details.docx"
dst = r"c:\Projects\St-rose-laboratory-result-management-system\public\report-logo.png"

with zipfile.ZipFile(p, 'r') as z:
    data = z.read('word/media/image1.png')
    with open(dst, 'wb') as f:
        f.write(data)
    img = Image.open(dst)
    print(f"Extracted image1.png from A. Lab Details.docx ({len(data)} bytes) size={img.size} mode={img.mode}")
