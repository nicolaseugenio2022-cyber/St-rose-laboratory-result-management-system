import zipfile
import xml.etree.ElementTree as ET

cbc_path = r"c:\Projects\St-rose-laboratory-result-management-system\Templates\CBC.docx"
NAMESPACES = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}

with zipfile.ZipFile(cbc_path, 'r') as z:
    header_xml = z.read('word/header1.xml')
    tree = ET.fromstring(header_xml)
    
    print("--- HEADER XML TABLES & PARAGRAPHS ---")
    for tbl in tree.findall('.//w:tbl', NAMESPACES):
        for r_idx, tr in enumerate(tbl.findall('w:tr', NAMESPACES)):
            cell_txts = []
            for c_idx, tc in enumerate(tr.findall('w:tc', NAMESPACES)):
                txt = "".join([t.text for t in tc.findall('.//w:t', NAMESPACES) if t.text]).strip()
                cell_txts.append(f"Cell[{c_idx}]: '{txt}'")
            print(f"Row {r_idx}: " + " | ".join(cell_txts))
            
    for p in tree.findall('.//w:p', NAMESPACES):
        p_txt = "".join([t.text for t in p.findall('.//w:t', NAMESPACES) if t.text]).strip()
        pBdr = p.find('.//w:pBdr', NAMESPACES)
        bdr_info = "pBdr=" + str(pBdr.attrib) if pBdr is not None else ""
        if p_txt or pBdr is not None:
            print(f"P: '{p_txt}' {bdr_info}")
