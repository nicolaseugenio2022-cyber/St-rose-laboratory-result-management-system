from PIL import Image
import os

img_path = r"c:\Projects\St-rose-laboratory-result-management-system\Templates\docs-template\CBC.png"
img = Image.open(img_path)

print(f"Image dimensions: {img.size} (Width x Height)")
print(f"Image mode: {img.mode}")

# Let's inspect colors at key regions of CBC.png
# Header region (top 0-150px)
# Demographics region (150-250px)
# Table region (250-500px)
# Signatures region (500-650px)

def get_pixel_hex(x, y):
    px = img.getpixel((x, y))
    if isinstance(px, tuple):
        return f"#{px[0]:02X}{px[1]:02X}{px[2]:02X}"
    return str(px)

print("\n--- SAMPLE COLOR INSPECTION FROM CBC.png ---")
print("Top Left Header Logo area (20, 40):", get_pixel_hex(20, 40))
print("Header Right Title area (350, 35):", get_pixel_hex(350, 35))
print("Header Divider Line area (350, 85):", get_pixel_hex(350, 85))
print("Demographics Shading area (450, 150):", get_pixel_hex(450, 150))
print("Table Header Shading area (200, 260):", get_pixel_hex(200, 260))
print("Row 1 Shading area (200, 280):", get_pixel_hex(200, 280))
print("Row 2 Background area (200, 305):", get_pixel_hex(200, 305))
print("Signature Clemente area (150, 520):", get_pixel_hex(150, 520))
