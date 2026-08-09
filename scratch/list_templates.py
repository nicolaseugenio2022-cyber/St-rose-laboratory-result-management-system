import os

templates_dir = r"c:\Projects\St-rose-laboratory-result-management-system\Templates"
files = os.listdir(templates_dir)
print("Files in Templates directory:")
for f in files:
    full_p = os.path.join(templates_dir, f)
    print(f"  {f:40s} ({os.path.getsize(full_p)} bytes)")
