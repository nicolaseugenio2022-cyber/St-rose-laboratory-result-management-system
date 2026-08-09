import os
from PIL import Image

png_path = r"c:\Projects\St-rose-laboratory-result-management-system\Templates\docs-template\CBC.png"
if os.path.exists(png_path):
    img = Image.open(png_path)
    print(f"Templates/docs-template/CBC.png EXISTS! Size: {img.size}, Mode: {img.mode}, Bytes: {os.path.getsize(png_path)}")
else:
    print("Templates/docs-template/CBC.png NOT found directly at path! Searching Templates directory...")
    templates_dir = r"c:\Projects\St-rose-laboratory-result-management-system\Templates"
    for root, dirs, files in os.walk(templates_dir):
        for f in files:
            if 'cbc' in f.lower():
                print(" Found:", os.path.join(root, f))
