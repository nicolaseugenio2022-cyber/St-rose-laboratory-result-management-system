import zipfile
import xml.etree.ElementTree as ET
import os

TEMPLATES_DIR = r"c:\Projects\St-rose-laboratory-result-management-system\Templates"
TABULAR_TEMPLATES = [
    ("CBC", "CBC.docx"),
    ("CHEM_8", "CHEM 8.docx"),
    ("CHEM_10", "CHEM 10.docx"),
    ("HDL_LDL", "HDL-LDL.docx"),
    ("ESR", "ESR.docx")
]

NAMESPACES = {
    'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
    'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
}

out = []

def log(msg=""):
    out.append(str(msg))

for code, filename in TABULAR_TEMPLATES:
    path = os.path.join(TEMPLATES_DIR, filename)
    log(f"=======================================================")
    log(f"AUDIT FOR TEMPLATE: {code} ({filename})")
    log(f"=======================================================")
    
    with zipfile.ZipFile(path, 'r') as z:
        tree = ET.fromstring(z.read('word/document.xml'))
        body = tree.find('w:body', NAMESPACES)
        
        # Section properties (Margins)
        sectPr = tree.find('.//w:sectPr', NAMESPACES)
        if sectPr is not None:
            pgMar = sectPr.find('w:pgMar', NAMESPACES)
            if pgMar is not None:
                top = int(pgMar.attrib.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}top', 0)) / 20 * 0.352778
                bottom = int(pgMar.attrib.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}bottom', 0)) / 20 * 0.352778
                left = int(pgMar.attrib.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}left', 0)) / 20 * 0.352778
                right = int(pgMar.attrib.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}right', 0)) / 20 * 0.352778
                log(f"MARGINS (mm): Top={top:.1f}mm, Bottom={bottom:.1f}mm, Left={left:.1f}mm, Right={right:.1f}mm")

        # Extract Header text / image
        headers = [f for f in z.namelist() if f.startswith('word/header')]
        for h in headers:
            htree = ET.fromstring(z.read(h))
            htexts = [t.text for t in htree.findall('.//w:t', NAMESPACES) if t.text]
            log(f" Header [{h}] text: {' '.join(htexts)}")

        # Audit paragraphs and tables in body
        for idx, child in enumerate(body):
            tag = child.tag.split('}')[-1]
            if tag == 'p':
                p_text = "".join([t.text for t in child.findall('.//w:t', NAMESPACES) if t.text]).strip()
                if p_text:
                    pPr = child.find('w:pPr', NAMESPACES)
                    align = ""
                    if pPr is not None:
                        jc = pPr.find('w:jc', NAMESPACES)
                        if jc is not None: align = jc.attrib.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}val', '')
                    
                    fonts = set()
                    sizes = set()
                    bolds = False
                    colors = set()
                    for rPr in child.findall('.//w:rPr', NAMESPACES):
                        rFont = rPr.find('w:rFonts', NAMESPACES)
                        if rFont is not None:
                            fn = rFont.attrib.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}ascii')
                            if fn: fonts.add(fn)
                        sz = rPr.find('w:sz', NAMESPACES)
                        if sz is not None:
                            sizes.add(int(sz.attrib.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}val', 0)) / 2)
                        if rPr.find('w:b', NAMESPACES) is not None:
                            bolds = True
                        c = rPr.find('w:color', NAMESPACES)
                        if c is not None:
                            colors.add(c.attrib.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}val'))
                    
                    log(f" P[{idx:2d}] (align={align:6s}, font={fonts}, sz={sizes}, bold={bolds}, color={colors}): '{p_text}'")
            elif tag == 'tbl':
                gridCols = child.findall('.//w:gridCol', NAMESPACES)
                col_w = [int(gc.attrib.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}w', 0))/20 for gc in gridCols]
                rows = child.findall('w:tr', NAMESPACES)
                log(f" TBL[{idx:2d}] {len(rows)} rows | GridCol Widths (pt): {col_w}")
                
                for r_idx, row in enumerate(rows):
                    cells = row.findall('w:tc', NAMESPACES)
                    cell_texts = []
                    for c in cells:
                        ctext = "".join([t.text for t in c.findall('.//w:t', NAMESPACES) if t.text]).strip()
                        c_fonts = set()
                        c_sizes = set()
                        c_bolds = False
                        for rPr in c.findall('.//w:rPr', NAMESPACES):
                            rFont = rPr.find('w:rFonts', NAMESPACES)
                            if rFont is not None:
                                fn = rFont.attrib.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}ascii')
                                if fn: c_fonts.add(fn)
                            sz = rPr.find('w:sz', NAMESPACES)
                            if sz is not None:
                                c_sizes.add(int(sz.attrib.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}val', 0)) / 2)
                            if rPr.find('w:b', NAMESPACES) is not None:
                                c_bolds = True
                        cell_texts.append(f"'{ctext}' (sz={c_sizes}, b={c_bolds})")
                    log(f"   Row {r_idx:2d}: " + " | ".join(cell_texts))
    log()

with open(r"c:\Projects\St-rose-laboratory-result-management-system\scratch\deep_tabular_audit.txt", "w", encoding="utf-8") as f:
    f.write("\n".join(out))

print("AUDIT_FILE_WRITTEN")
