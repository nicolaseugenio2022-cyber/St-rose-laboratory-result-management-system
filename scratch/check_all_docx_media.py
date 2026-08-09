import zipfile
import os
from PIL import Image

templates_dir = r"c:\Projects\St-rose-laboratory-result-management-system\Templates"

for f in os.listdir(templates_dir):
    if f.endswith('.docx'):
        p = os.path.join(templates_dir, f)
        with zipfile.ZipFile(p, 'r') as z:
            media = [m for m in z.namelist() if m.startswith('word/media/')]
            for m in media:
                data = z.read(m)
                print(f"Docx: {f:25s} Media: {m:25s} Size: {len(data)} bytes")
