import shutil
import os

src = r"c:\Projects\St-rose-laboratory-result-management-system\Templates\Docs Logo.png"
dst = r"c:\Projects\St-rose-laboratory-result-management-system\public\report-logo.png"

shutil.copyfile(src, dst)
print(f"Successfully copied 'Templates/Docs Logo.png' ({os.path.getsize(src)} bytes) -> {dst}")
