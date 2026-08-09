import zipfile
import os

TEMPLATES_DIR = r"c:\Projects\St-rose-laboratory-result-management-system\Templates"
PUBLIC_DIR = r"c:\Projects\St-rose-laboratory-result-management-system\public"

# Extract header logo from CBC.docx
cbc_path = os.path.join(TEMPLATES_DIR, "CBC.docx")
with zipfile.ZipFile(cbc_path, 'r') as z:
    logo_data = z.read("word/media/image1.png")
    out_path = os.path.join(PUBLIC_DIR, "report-logo.png")
    with open(out_path, "wb") as f:
        f.write(logo_data)
    print(f"Extracted official Word template report logo ({len(logo_data)} bytes) -> {out_path}")
