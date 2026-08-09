from PIL import Image

img = Image.open(r"c:\Projects\St-rose-laboratory-result-management-system\Templates\docs-template\CBC.png").convert('RGB')
w, h = img.size

print("--- DETAILED PIXEL SCAN OF CBC.png ---")
# Find header logo banner coordinates
logo_pixels = []
for y in range(0, 150):
    for x in range(0, 250):
        r, g, b = img.getpixel((x, y))
        # Logo banner has teal / blue background color (not white/grey)
        if (g > 100 or b > 100) and not (r > 240 and g > 240 and b > 240):
            logo_pixels.append((x, y, (r, g, b)))

if logo_pixels:
    min_x = min(p[0] for p in logo_pixels)
    max_x = max(p[0] for p in logo_pixels)
    min_y = min(p[1] for p in logo_pixels)
    max_y = max(p[1] for p in logo_pixels)
    print(f"Header Logo Banner Box: X={min_x}..{max_x} (width {max_x-min_x+1}px), Y={min_y}..{max_y} (height {max_y-min_y+1}px)")

# Find Header horizontal line Y position
line_pixels = []
for y in range(50, 150):
    for x in range(200, 500):
        r, g, b = img.getpixel((x, y))
        if r < 150 and g < 150 and b < 150: # Dark line
            line_pixels.append((x, y))

if line_pixels:
    min_y = min(p[1] for p in line_pixels)
    max_y = max(p[1] for p in line_pixels)
    min_x = min(p[0] for p in line_pixels)
    max_x = max(p[0] for p in line_pixels)
    print(f"Header Divider Line: Y={min_y}..{max_y}, X={min_x}..{max_x} (length {max_x-min_x+1}px)")
