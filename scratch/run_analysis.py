import zipfile
import xml.etree.ElementTree as ET
import os

TEMPLATES_DIR = r"c:\Projects\St-rose-laboratory-result-management-system\Templates"
TARGETS = ["CBC.docx", "URINALYSIS.docx", "BLOOD TYPING.docx", "HIV RESULT FORM.docx"]

NAMESPACES = {
    'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
    'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
    'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
    'pic': 'http://schemas.openxmlformats.org/drawingml/2006/picture',
    'wp': 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing',
    'v': 'urn:schemas-microsoft-com:vml'
}

out_lines = []

def log(msg):
    out_lines.append(str(msg))

def analyze_template(filename):
    path = os.path.join(TEMPLATES_DIR, filename)
    log(f"\n=======================================================")
    log(f"DETAILED ANALYSIS: {filename}")
    log(f"=======================================================")
    
    with zipfile.ZipFile(path, 'r') as z:
        # Document.xml
        doc_xml = z.read('word/document.xml')
        tree = ET.fromstring(doc_xml)
        
        # Margins & Section Pr
        sectPr = tree.find('.//w:sectPr', NAMESPACES)
        if sectPr is not None:
            pgMar = sectPr.find('w:pgMar', NAMESPACES)
            if pgMar is not None:
                top = int(pgMar.attrib.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}top', 0)) / 20
                bottom = int(pgMar.attrib.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}bottom', 0)) / 20
                left = int(pgMar.attrib.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}left', 0)) / 20
                right = int(pgMar.attrib.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}right', 0)) / 20
                log(f"MARGINS (pt): Top={top}, Bottom={bottom}, Left={left}, Right={right}")
                log(f"MARGINS (mm): Top={top*0.352778:.2f}mm, Bottom={bottom*0.352778:.2f}mm, Left={left*0.352778:.2f}mm, Right={right*0.352778:.2f}mm")

        # Check Header/Footer XML contents & relationships (e.g. Logos, header text)
        for h in [f for f in z.namelist() if f.startswith('word/header') or f.startswith('word/footer')]:
            h_tree = ET.fromstring(z.read(h))
            texts = [t.text for t in h_tree.findall('.//w:t', NAMESPACES) if t.text]
            images = h_tree.findall('.//w:drawing', NAMESPACES) + h_tree.findall('.//v:shape', NAMESPACES)
            log(f" {h} -> Text: {' '.join(texts)} | Images count: {len(images)}")
            
        body = tree.find('w:body', NAMESPACES)
        for idx, child in enumerate(body):
            tag = child.tag.split('}')[-1]
            if tag == 'p':
                # Paragraph details
                p_text = "".join([t.text for t in child.findall('.//w:t', NAMESPACES) if t.text])
                pPr = child.find('w:pPr', NAMESPACES)
                align = ""
                spacing_before = 0
                spacing_after = 0
                line_spacing = ""
                if pPr is not None:
                    jc = pPr.find('w:jc', NAMESPACES)
                    if jc is not None: align = jc.attrib.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}val', '')
                    sp = pPr.find('w:spacing', NAMESPACES)
                    if sp is not None:
                        spacing_before = int(sp.attrib.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}before', 0)) / 20
                        spacing_after = int(sp.attrib.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}after', 0)) / 20
                        line_spacing = sp.attrib.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}line', '')
                
                # Check run font sizes & bold
                fonts = set()
                sizes = set()
                bolds = False
                for rPr in child.findall('.//w:rPr', NAMESPACES):
                    rFont = rPr.find('w:rFonts', NAMESPACES)
                    if rFont is not None:
                        fn = rFont.attrib.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}ascii') or rFont.attrib.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}hAnsi')
                        if fn: fonts.add(fn)
                    sz = rPr.find('w:sz', NAMESPACES)
                    if sz is not None:
                        sizes.add(int(sz.attrib.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}val', 0)) / 2)
                    if rPr.find('w:b', NAMESPACES) is not None:
                        bolds = True
                
                img_cnt = len(child.findall('.//w:drawing', NAMESPACES) + child.findall('.//v:shape', NAMESPACES))
                img_str = f" [IMAGES:{img_cnt}]" if img_cnt > 0 else ""
                log(f"P[{idx}] align={align:6s} spBefore={spacing_before}pt spAfter={spacing_after}pt fonts={fonts} sz={sizes} bold={bolds}{img_str}: '{p_text}'")
                
            elif tag == 'tbl':
                rows = child.findall('w:tr', NAMESPACES)
                tblPr = child.find('w:tblPr', NAMESPACES)
                borders = []
                if tblPr is not None:
                    tblBorders = tblPr.find('w:tblBorders', NAMESPACES)
                    if tblBorders is not None:
                        for b in tblBorders:
                            borders.append(f"{b.tag.split('}')[-1]}={b.attrib.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}val')}")
                
                gridCols = child.findall('.//w:gridCol', NAMESPACES)
                col_w = [int(gc.attrib.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}w', 0))/20 for gc in gridCols]
                
                log(f"TBL[{idx}] {len(rows)} rows | Borders: {borders} | GridCol Widths (pt): {col_w}")
                for r_idx, row in enumerate(rows):
                    cells = row.findall('w:tc', NAMESPACES)
                    cell_info = []
                    for c in cells:
                        c_text = "".join([t.text for t in c.findall('.//w:t', NAMESPACES) if t.text]).strip()
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
                        cell_info.append(f"'{c_text}' (sz={c_sizes}, b={c_bolds})")
                    log(f"   Row {r_idx:2d}: " + " | ".join(cell_info))

for t in TARGETS:
    analyze_template(t)

with open(r"c:\Projects\St-rose-laboratory-result-management-system\scratch\analysis_clean.txt", "w", encoding="utf-8") as f:
    f.write("\n".join(out_lines))

print("DONE_WRITING_UTF8")
