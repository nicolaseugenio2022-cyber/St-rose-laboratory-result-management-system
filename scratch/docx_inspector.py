import zipfile
import xml.etree.ElementTree as ET
import os

TEMPLATES_DIR = r"c:\Projects\St-rose-laboratory-result-management-system\Templates"
TARGET_DOCX = ["CBC.docx", "URINALYSIS.docx", "BLOOD TYPING.docx", "HIV RESULT FORM.docx"]

NAMESPACES = {
    'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
    'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
    'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
    'pic': 'http://schemas.openxmlformats.org/drawingml/2006/picture',
    'wp': 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing',
    'v': 'urn:schemas-microsoft-com:vml'
}

def inspect_docx(filename):
    path = os.path.join(TEMPLATES_DIR, filename)
    print(f"\n==========================================")
    print(f"INSPECTING: {filename}")
    print(f"==========================================")
    
    with zipfile.ZipFile(path, 'r') as z:
        file_list = z.namelist()
        print("Files inside docx:", [f for f in file_list if not f.startswith('word/theme') and not f.startswith('docProps')])
        
        # Read document.xml
        doc_xml = z.read('word/document.xml')
        tree = ET.fromstring(doc_xml)
        
        # Page Margins & Setup
        sectPr = tree.find('.//w:sectPr', NAMESPACES)
        if sectPr is not None:
            pgMar = sectPr.find('w:pgMar', NAMESPACES)
            if pgMar is not None:
                top = int(pgMar.attrib.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}top', 0)) / 20 # dxa to pt (1 pt = 20 dxa)
                bottom = int(pgMar.attrib.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}bottom', 0)) / 20
                left = int(pgMar.attrib.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}left', 0)) / 20
                right = int(pgMar.attrib.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}right', 0)) / 20
                print(f"Page Margins (pt/mm): Top={top}pt ({top*0.352778:.1f}mm), Bottom={bottom}pt ({bottom*0.352778:.1f}mm), Left={left}pt ({left*0.352778:.1f}mm), Right={right}pt ({right*0.352778:.1f}mm)")
            
            pgSz = sectPr.find('w:pgSz', NAMESPACES)
            if pgSz is not None:
                w = int(pgSz.attrib.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}w', 0)) / 20
                h = int(pgSz.attrib.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}h', 0)) / 20
                print(f"Page Size: {w}pt x {h}pt ({w*0.352778:.1f}mm x {h*0.352778:.1f}mm)")

        # Headers / Footers
        headers = [f for f in file_list if f.startswith('word/header')]
        footers = [f for f in file_list if f.startswith('word/footer')]
        print(f"Headers present: {headers}")
        print(f"Footers present: {footers}")
        for hf in headers + footers:
            hf_xml = z.read(hf)
            hf_tree = ET.fromstring(hf_xml)
            texts = [t.text for t in hf_tree.findall('.//w:t', NAMESPACES) if t.text]
            print(f"  {hf} text: {' '.join(texts)}")
        
        # Body Paragraphs and Tables
        body = tree.find('w:body', NAMESPACES)
        if body is None:
            return

        child_index = 0
        for elem in body:
            tag = elem.tag.split('}')[-1]
            if tag == 'p':
                # Paragraph
                text = "".join([t.text for t in elem.findall('.//w:t', NAMESPACES) if t.text])
                if not text.strip():
                    # check if drawing or image
                    drawings = elem.findall('.//w:drawing', NAMESPACES) + elem.findall('.//v:shape', NAMESPACES)
                    if drawings:
                        print(f"P[{child_index}]: [IMAGE/DRAWING PRESENT] count={len(drawings)}")
                    else:
                        print(f"P[{child_index}]: [EMPTY LINE]")
                else:
                    # Get font details
                    fonts = set()
                    sizes = set()
                    bolds = False
                    for rPr in elem.findall('.//w:rPr', NAMESPACES):
                        rFont = rPr.find('w:rFonts', NAMESPACES)
                        if rFont is not None:
                            font_name = rFont.attrib.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}ascii') or rFont.attrib.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}hAnsi')
                            if font_name: fonts.add(font_name)
                        sz = rPr.find('w:sz', NAMESPACES)
                        if sz is not None:
                            val = int(sz.attrib.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}val', 0)) / 2 # half-points to pt
                            sizes.add(val)
                        if rPr.find('w:b', NAMESPACES) is not None:
                            bolds = True
                    align = ""
                    pPr = elem.find('w:pPr', NAMESPACES)
                    if pPr is not None:
                        jc = pPr.find('w:jc', NAMESPACES)
                        if jc is not None:
                            align = jc.attrib.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}val', '')
                    print(f"P[{child_index}] (align={align}, font={fonts}, sz={sizes}, bold={bolds}): {text[:100]}")
            elif tag == 'tbl':
                # Table
                rows = elem.findall('w:tr', NAMESPACES)
                tblPr = elem.find('w:tblPr', NAMESPACES)
                gridCols = elem.findall('.//w:gridCol', NAMESPACES)
                col_widths = [int(gc.attrib.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}w', 0))/20 for gc in gridCols]
                print(f"TBL[{child_index}]: {len(rows)} rows, gridCols widths (pt): {col_widths}")
                
                # Examine table rows and cells
                for r_idx, row in enumerate(rows):
                    cells = row.findall('w:tc', NAMESPACES)
                    cell_texts = []
                    for c_idx, cell in enumerate(cells):
                        ctext = "".join([t.text for t in cell.findall('.//w:t', NAMESPACES) if t.text]).strip()
                        # check cell width
                        tcPr = cell.find('w:tcPr', NAMESPACES)
                        tcW = ""
                        if tcPr is not None:
                            tcW_elem = tcPr.find('w:tcW', NAMESPACES)
                            if tcW_elem is not None:
                                tcW = tcW_elem.attrib.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}w', '')
                        cell_texts.append(f"[{ctext}] (w={tcW})")
                    print(f"  Row {r_idx}: {' | '.join(cell_texts[:6])}{' ...' if len(cell_texts)>6 else ''}")
            child_index += 1

for docx in TARGET_DOCX:
    inspect_docx(docx)
