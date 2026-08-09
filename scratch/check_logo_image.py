from PIL import Image
import os

png_path = r"c:\Projects\St-rose-laboratory-result-management-system\Templates\St. Rose Proposed New Logo (1).png"
if os.path.exists(png_path):
    img = Image.open(png_path)
    print(f"Image format: {img.format}, size: {img.size}, mode: {img.mode}")
