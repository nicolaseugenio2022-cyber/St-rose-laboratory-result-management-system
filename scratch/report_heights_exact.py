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

def analyze_report_block_height(filename):
    path = os.path.join(TEMPLATES_DIR, filename)
    with zipfile.ZipFile(path, 'r') as z:
        tree = ET.fromstring(z.read('word/document.xml'))
        
        top_margin_mm = 31.6
        sectPr = tree.find('.//w:sectPr', NAMESPACES)
        if sectPr is not None:
            pgMar = sectPr.find('w:pgMar', NAMESPACES)
            if pgMar is not None:
                top_margin_mm = int(pgMar.attrib.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}top', 0)) / 20 * 0.352778

        header_height_mm = 22.0 # Logo + address text
        
        body = tree.find('w:body', NAMESPACES)
        report_height_pt = 0
        
        # Count elements until signature block end
        for elem in body:
            tag = elem.tag.split('}')[-1]
            if tag == 'p':
                text = "".join([t.text for t in elem.findall('.//w:t', NAMESPACES) if t.text])
                drawings = len(elem.findall('.//w:drawing', NAMESPACES) + elem.findall('.//v:shape', NAMESPACES))
                
                # Check if this is client comment text below signatures
                if any(kw in text for kw in ["Drop down", "Color dropdown", "Ang result here", "Pwede ba to gawan", "Sa CBC automatic", "IBAHIN NA LANG"]):
                    break # Stop at comments
                
                if drawings > 0:
                    report_height_pt += 35.0 # signature line
                elif "Pathologist" in text or "Medical Technologist" in text or "PAULO ANTONIO" in text:
                    report_height_pt += 18.0
                elif text.strip():
                    sizes = [int(sz.attrib.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}val', 24))/2 for sz in elem.findall('.//w:sz', NAMESPACES)]
                    p_sz = max(sizes) if sizes else 12.0
                    report_height_pt += p_sz * 1.3
                else:
                    report_height_pt += 6.0
                    
            elif tag == 'tbl':
                rows = elem.findall('w:tr', NAMESPACES)
                for r in rows:
                    sizes = [int(sz.attrib.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}val', 20))/2 for sz in r.findall('.//w:sz', NAMESPACES)]
                    row_sz = max(sizes) if sizes else 10.0
                    report_height_pt += max(row_sz * 1.4, 15.0)
                    
        report_height_mm = report_height_pt * 0.352778
        total_mm = top_margin_mm + header_height_mm + report_height_mm
        half_a4 = 297.0 / 2.0 # 148.5mm
        
        print(f"REPORT: {filename:22s} | Content Height: {total_mm:.1f}mm | Target Half-A4: 148.5mm | Occupies: {(total_mm/297.0)*100:.1f}% of A4 | Exceeds Half-A4? {'YES (Documented Exception)' if total_mm > half_a4 else 'NO (Half-A4 Compliant)'}")

for t in TARGETS:
    analyze_report_block_height(t)
