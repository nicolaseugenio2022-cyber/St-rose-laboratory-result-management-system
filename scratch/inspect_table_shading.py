import zipfile
import xml.etree.ElementTree as ET

cbc_path = r"c:\Projects\St-rose-laboratory-result-management-system\Templates\CBC.docx"
NAMESPACES = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}

with zipfile.ZipFile(cbc_path, 'r') as z:
    tree = ET.fromstring(z.read('word/document.xml'))
    body = tree.find('w:body', NAMESPACES)
    
    for t_idx, tbl in enumerate(body.findall('.//w:tbl', NAMESPACES)):
        print(f"\n--- TBL[{t_idx}] ---")
        for r_idx, tr in enumerate(tbl.findall('w:tr', NAMESPACES)):
            row_shd = tr.find('.//w:shd', NAMESPACES)
            row_shd_val = row_shd.attrib.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}fill') if row_shd is not None else None
            cell_info = []
            for c_idx, tc in enumerate(tr.findall('w:tc', NAMESPACES)):
                shd = tc.find('.//w:shd', NAMESPACES)
                fill = shd.attrib.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}fill') if shd is not None else None
                txt = "".join([t.text for t in tc.findall('.//w:t', NAMESPACES) if t.text]).strip()
                cell_info.append(f"C[{c_idx}] fill={fill} '{txt}'")
            print(f"Row {r_idx:2d} (row_shd={row_shd_val}): " + " | ".join(cell_info))
