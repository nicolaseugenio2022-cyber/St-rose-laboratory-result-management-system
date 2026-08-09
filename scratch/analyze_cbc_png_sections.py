from PIL import Image

img_path = r"c:\Projects\St-rose-laboratory-result-management-system\Templates\docs-template\CBC.png"
img = Image.open(img_path).convert('RGB')
w, h = img.size

print(f"CBC.png size: {w}x{h}")

# Let's sample colors down the vertical center at X = 200
for y in range(0, h, 20):
    r, g, b = img.getpixel((200, y))
    print(f"Y={y:3d}: RGB=({r:3d}, {g:3d}, {b:3d}) HEX=#{r:02X}{g:02X}{b:02X}")
