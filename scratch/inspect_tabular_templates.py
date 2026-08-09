import zipfile
import xml.etree.ElementTree as ET
import os

TEMPLATES_DIR = r"c:\Projects\St-rose-laboratory-result-management-system\Templates"
TABULAR_FILES = ["CBC.docx", "CHEM 8.docx", "CHEM 10.docx", "HDL-LDL.docx", "ESR.docx"]

NAMESPACES = {
    'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
    'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
}

for filename in TABULAR_FILES:
    path = os.path.join(TEMPLATES_DIR, filename)
    print(f"\n=======================================================")
    print(f"TABULAR TEMPLATE INSPECTION: {filename}")
    print(f"=======================================================")
    
    with zipfile.ZipFile(path, 'r') as z:
        tree = ET.fromstring(z.read('word/document.xml'))
        body = tree.find('w:body', NAMESPACES)
        
        tables = body.findall('.//w:tbl', NAMESPACES)
        print(f"Total tables found: {len(tables)}")
        
        for t_idx, tbl in enumerate(tables):
            gridCols = tbl.findall('.//w:gridCol', NAMESPACES)
            col_widths = [int(gc.attrib.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}w', 0))/20 for gc in gridCols]
            rows = tbl.findall('w:tr', NAMESPACES)
            print(f" Table [{t_idx}]: {len(rows)} rows | Column Widths (pt): {col_widths}")
            
            for r_idx, row in enumerate(rows):
                cells = row.findall('w:tc', NAMESPACES)
                cell_texts = ["".join([t.text for t in c.findall('.//w:t', NAMESPACES) if t.text]).strip() for c in cells]
                # Print non-empty row preview
                if any(cell_texts):
                    print(f"   Row {r_idx:2d}: " + " | ".join(cell_texts[:4]))
