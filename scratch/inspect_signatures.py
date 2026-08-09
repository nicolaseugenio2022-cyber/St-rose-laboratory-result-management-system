import zipfile
import os

TEMPLATES_DIR = r"c:\Projects\St-rose-laboratory-result-management-system\Templates"
PUBLIC_DIR = r"c:\Projects\St-rose-laboratory-result-management-system\public"

print("Inspecting signature images in docx files and public...\n")

for f in ["CBC.docx", "URINALYSIS.docx", "BLOOD TYPING.docx", "HIV RESULT FORM.docx"]:
    path = os.path.join(TEMPLATES_DIR, f)
    with zipfile.ZipFile(path, 'r') as z:
        media_files = [m for m in z.namelist() if m.startswith('word/media/')]
        for m in media_files:
            data = z.read(m)
            print(f"{f:22s} -> {m:25s} | Size: {len(data)} bytes")
            if len(data) > 10000: # image2.png (44678 bytes) is the pathologist signature!
                out_path = os.path.join(PUBLIC_DIR, "pathologist-signature.png")
                if not os.path.exists(out_path):
                    with open(out_path, "wb") as sig_f:
                        sig_f.write(data)
                    print(f"   --> Extracted Pathologist e-signature ({len(data)} bytes) -> {out_path}")
