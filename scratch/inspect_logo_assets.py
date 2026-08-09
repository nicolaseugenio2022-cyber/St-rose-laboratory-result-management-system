import zipfile
import os

TEMPLATES_DIR = r"c:\Projects\St-rose-laboratory-result-management-system\Templates"
PUBLIC_DIR = r"c:\Projects\St-rose-laboratory-result-management-system\public"

print("Checking logo assets in Templates and public...\n")

# Check public files
if os.path.exists(PUBLIC_DIR):
    print("Files in public/:", os.listdir(PUBLIC_DIR))

# Inspect docx media files
for f in ["CBC.docx", "URINALYSIS.docx", "BLOOD TYPING.docx", "HIV RESULT FORM.docx"]:
    path = os.path.join(TEMPLATES_DIR, f)
    with zipfile.ZipFile(path, 'r') as z:
        media_files = [m for m in z.namelist() if m.startswith('word/media/')]
        for m in media_files:
            data = z.read(m)
            print(f"{f:22s} -> {m:25s} | Size: {len(data)} bytes")
