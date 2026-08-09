import os
from PIL import Image

public_dir = r"c:\Projects\St-rose-laboratory-result-management-system\public"
for f in os.listdir(public_dir):
    p = os.path.join(public_dir, f)
    if os.path.isfile(p) and (f.endswith('.png') or f.endswith('.jpg')):
        img = Image.open(p)
        print(f"Public image: {f:30s} size={img.size}")
