import shutil
import os

src = r"C:\Users\Nicol\.gemini\antigravity-ide\brain\854b0348-2ba4-4049-a5ad-8032465993f5\media__1786181000898.png"
dst = r"c:\Projects\St-rose-laboratory-result-management-system\public\report-logo.png"

if os.path.exists(src):
    shutil.copyfile(src, dst)
    print(f"Successfully installed official report logo asset from Attachment 3 ({os.path.getsize(src)} bytes) -> {dst}")
else:
    print("Source logo Attachment 3 not found!")
