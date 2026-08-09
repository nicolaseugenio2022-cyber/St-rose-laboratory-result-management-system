import zipfile
import xml.etree.ElementTree as ET
import os

TEMPLATES_DIR = r"c:\Projects\St-rose-laboratory-result-management-system\Templates"
TARGETS = ["CBC.docx", "URINALYSIS.docx", "BLOOD TYPING.docx", "HIV RESULT FORM.docx"]

NAMESPACES = {
    'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
    'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
    'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
    'v': 'urn:schemas-microsoft-com:vml'
}

def estimate_template_height(filename):
    path = os.path.join(TEMPLATES_DIR, filename)
    with zipfile.ZipFile(path, 'r') as z:
        tree = ET.fromstring(z.read('word/document.xml'))
        
        # Top margin
        top_margin_mm = 31.6
        bottom_margin_mm = 34.8
        sectPr = tree.find('.//w:sectPr', NAMESPACES)
        if sectPr is not None:
            pgMar = sectPr.find('w:pgMar', NAMESPACES)
            if pgMar is not None:
                top_margin_mm = int(pgMar.attrib.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}top', 0)) / 20 * 0.352778
                bottom_margin_mm = int(pgMar.attrib.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}bottom', 0)) / 20 * 0.352778

        # Estimate header height (logo + text ~ 25mm)
        header_height_mm = 25.0
        
        body = tree.find('w:body', NAMESPACES)
        content_height_pt = 0
        
        for elem in body:
            tag = elem.tag.split('}')[-1]
            if tag == 'p':
                # Check paragraph font size or default 12pt
                sizes = [int(sz.attrib.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}val', 24))/2 for sz in elem.findall('.//w:sz', NAMESPACES)]
                p_sz = max(sizes) if sizes else 12.0
                # Line height approx 1.2 * font size
                lines = 1
                text = "".join([t.text for t in elem.findall('.//w:t', NAMESPACES) if t.text])
                drawings = len(elem.findall('.//w:drawing', NAMESPACES) + elem.findall('.//v:shape', NAMESPACES))
                
                if drawings > 0:
                    content_height_pt += 45.0 # signature/image approx 45pt
                elif text.strip():
                    content_height_pt += p_sz * 1.3
                else:
                    content_height_pt += 10.0 # empty line
                    
            elif tag == 'tbl':
                rows = elem.findall('w:tr', NAMESPACES)
                for r in rows:
                    # check max font in row
                    sizes = [int(sz.attrib.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}val', 20))/2 for sz in r.findall('.//w:sz', NAMESPACES)]
                    row_sz = max(sizes) if sizes else 10.0
                    content_height_pt += max(row_sz * 1.5, 16.0) # approx row height
                    
        content_height_mm = content_height_pt * 0.352778
        total_occupied_mm = top_margin_mm + header_height_mm + content_height_mm
        pct_of_a4 = (total_occupied_mm / 297.0) * 100
        
        print(f"{filename:25s}: TopMar={top_margin_mm:.1f}mm, Content={content_height_mm:.1f}mm, Total Occupied={total_occupied_mm:.1f}mm / 297mm ({pct_of_a4:.1f}% of A4)")

for t in TARGETS:
    estimate_template_height(t)
