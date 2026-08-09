import shutil
import os

src_logo = r"c:\Projects\St-rose-laboratory-result-management-system\Templates\St. Rose Proposed New Logo (1).png"
dst_logo = r"c:\Projects\St-rose-laboratory-result-management-system\public\report-logo.png"

if os.path.exists(src_logo):
    shutil.copyfile(src_logo, dst_logo)
    print(f"Copied official report logo ({os.path.getsize(src_logo)} bytes) -> {dst_logo}")
else:
    print("Source logo not found!")
