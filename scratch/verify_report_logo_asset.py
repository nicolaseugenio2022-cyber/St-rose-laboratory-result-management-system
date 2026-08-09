import os
from PIL import Image
import numpy as np

report_logo_path = r"c:\Projects\St-rose-laboratory-result-management-system\public\report-logo.png"
docs_logo_path = r"c:\Projects\St-rose-laboratory-result-management-system\Templates\Docs Logo.png"

img1 = Image.open(report_logo_path)
img2 = Image.open(docs_logo_path)

print("--- REPORT HEADER LOGO VERIFICATION ---")
print(f"public/report-logo.png: Dimensions {img1.size}, Mode {img1.mode}, Bytes {os.path.getsize(report_logo_path)}")
print(f"Templates/Docs Logo.png: Dimensions {img2.size}, Mode {img2.mode}, Bytes {os.path.getsize(docs_logo_path)}")

# Check if file contents are byte-for-byte identical
same_bytes = (os.path.getsize(report_logo_path) == os.path.getsize(docs_logo_path))
print(f"File sizes identical: {same_bytes}")
