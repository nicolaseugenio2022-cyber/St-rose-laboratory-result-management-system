import os, re

repo_dir = r"c:\Projects\St-rose-laboratory-result-management-system"

print("--- SEARCHING FOR ALL SIGNATURE URL ASSIGNMENTS ---")
for root, dirs, files in os.walk(repo_dir):
    if "node_modules" in root or ".next" in root or ".git" in root:
        continue
    for f in files:
        if f.endswith(('.ts', '.tsx', '.json', '.sql', '.js', '.md')):
            fp = os.path.join(root, f)
            try:
                with open(fp, 'r', encoding='utf-8', errors='ignore') as file:
                    content = file.read()
                    if 'signature' in content.lower() or 'logo' in content.lower():
                        matches = re.findall(r'.{0,40}(?:signature|logo).{0,40}', content, re.IGNORECASE)
                        for m in matches[:5]:
                            if 'logo' in m.lower() and 'sig' in m.lower():
                                print(f"FILE: {fp}")
                                print(f"  Match: {m.strip()}")
            except Exception as e:
                pass
