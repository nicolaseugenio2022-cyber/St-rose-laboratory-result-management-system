import zipfile
import xml.etree.ElementTree as ET
import os

TEMPLATES_DIR = r"c:\Projects\St-rose-laboratory-result-management-system\Templates"

NAMESPACES = {
    'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
    'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
    'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
    'v': 'urn:schemas-microsoft-com:vml'
}

docx_files = [f for f in os.listdir(TEMPLATES_DIR) if f.endswith('.docx') and not f.startswith('~$')]

print(f"Inspecting colors across {len(docx_files)} Word templates...\n")

for filename in docx_files:
    path = os.path.join(TEMPLATES_DIR, filename)
    with zipfile.ZipFile(path, 'r') as z:
        doc_xml = z.read('word/document.xml')
        tree = ET.fromstring(doc_xml)
        
        # Collect colors
        colors = set()
        shading = set()
        
        for c in tree.findall('.//w:color', NAMESPACES):
            val = c.attrib.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}val')
            if val and val != 'auto':
                colors.add(f"#{val}")
                
        for s in tree.findall('.//w:shd', NAMESPACES):
            fill = s.attrib.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}fill')
            if fill and fill != 'auto' and fill != '000000':
                shading.add(f"#{fill}")

        # Header xml colors
        for h in [f for f in z.namelist() if f.startswith('word/header')]:
            htree = ET.fromstring(z.read(h))
            for c in htree.findall('.//w:color', NAMESPACES):
                val = c.attrib.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}val')
                if val and val != 'auto':
                    colors.add(f"#{val}")

        print(f"{filename:30s} -> Text/Border Colors: {sorted(list(colors))} | Shading/Fills: {sorted(list(shading))}")
