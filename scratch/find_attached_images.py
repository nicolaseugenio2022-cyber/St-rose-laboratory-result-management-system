import os
import glob
from PIL import Image

# Search brain directory and system generated files for attached images
brain_dir = r"C:\Users\Nicol\.gemini\antigravity-ide\brain\854b0348-2ba4-4049-a5ad-8032465993f5"

print("Searching for attached images in brain directory...")
for root, dirs, files in os.walk(brain_dir):
    for file in files:
        if file.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
            full_p = os.path.join(root, file)
            try:
                img = Image.open(full_p)
                print(f" Found image: {file:35s} path={full_p} size={img.size}")
            except Exception as e:
                pass
