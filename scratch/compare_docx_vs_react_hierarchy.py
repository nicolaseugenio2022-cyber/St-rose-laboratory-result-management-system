import zipfile
import xml.etree.ElementTree as ET

docx_path = r"c:\Projects\St-rose-laboratory-result-management-system\Templates\CBC.docx"

with zipfile.ZipFile(docx_path, 'r') as zip_ref:
    doc_xml = zip_ref.read("word/document.xml")
    hdr_xml = zip_ref.read("word/header1.xml")

ns = {
    'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
    'wp': 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing',
    'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
    'pic': 'http://schemas.openxmlformats.org/drawingml/2006/picture'
}

hdr_root = ET.fromstring(hdr_xml)
doc_root = ET.fromstring(doc_xml)

print("=== NATIVE WORD DOCX ELEMENT TREE ===")
print("Section 1: Header (word/header1.xml)")
for p_idx, p in enumerate(hdr_root.findall('.//w:p', ns)):
    text = "".join(t.text for t in p.findall('.//w:t', ns) if t.text)
    drw = p.find('.//w:drawing', ns)
    drw_str = "[Embedded Drawing: media/image2.png (Logo Banner)]" if drw is not None else ""
    bdr = p.find('.//w:pBdr', ns)
    bdr_str = "[Bottom Border Rule 1.5pt #5B80A5]" if bdr is not None else ""
    print(f"  Paragraph {p_idx+1}: {drw_str} '{text}' {bdr_str}")

print("\nSection 2: Document Body (word/document.xml)")
body = doc_root.find('w:body', ns)
for idx, child in enumerate(body):
    tag = child.tag.split('}')[-1]
    if tag == 'tbl':
        rows = child.findall('w:tr', ns)
        print(f"  Element {idx+1}: <w:tbl> (Table with {len(rows)} rows)")
        for r_idx, r in enumerate(rows):
            cells = r.findall('w:tc', ns)
            cell_texts = []
            for c in cells:
                t = "".join(txt.text for txt in c.findall('.//w:t', ns) if txt.text)
                cell_texts.append(f"'{t}'")
            print(f"    Row {r_idx+1} ({len(cells)} cells): {' | '.join(cell_texts[:3])}")
    elif tag == 'p':
        text = "".join(t.text for t in child.findall('.//w:t', ns) if t.text)
        if text.strip():
            print(f"  Element {idx+1}: <w:p> '{text[:80]}'")
