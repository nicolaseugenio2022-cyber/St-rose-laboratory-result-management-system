import os
from PIL import Image

logo_path = r"c:\Projects\St-rose-laboratory-result-management-system\Templates\Docs Logo.png"
if os.path.exists(logo_path):
    img = Image.open(logo_path)
    print(f"Docs Logo.png EXISTS! Size: {img.size}, Mode: {img.mode}, Bytes: {os.path.getsize(logo_path)}")
else:
    print("Docs Logo.png NOT found directly at path, listing Templates directory...")
    templates_dir = r"c:\Projects\St-rose-laboratory-result-management-system\Templates"
    for f in os.listdir(templates_dir):
        if 'logo' in f.lower() or 'doc' in f.lower():
            print(" Found:", f)
