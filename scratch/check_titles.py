import zipfile
import xml.etree.ElementTree as ET
import os

TEMPLATES_DIR = r"c:\Projects\St-rose-laboratory-result-management-system\Templates"
TABULAR = ["CBC.docx", "CHEM 8.docx", "CHEM 10.docx", "HDL-LDL.docx", "ESR.docx"]
NAMESPACES = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}

for f in TABULAR:
    path = os.path.join(TEMPLATES_DIR, f)
    with zipfile.ZipFile(path, 'r') as z:
        tree = ET.fromstring(z.read('word/document.xml'))
        body = tree.find('w:body', NAMESPACES)
        print(f"=== {f} ===")
        for child in body:
            tag = child.tag.split('}')[-1]
            if tag == 'p':
                txt = "".join([t.text for t in child.findall('.//w:t', NAMESPACES) if t.text]).strip()
                if txt:
                    print(f"  P: '{txt}'")
            elif tag == 'tbl':
                print(f"  TBL: {len(child.findall('w:tr', NAMESPACES))} rows")
