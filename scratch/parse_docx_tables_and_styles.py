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

root = ET.fromstring(doc_xml)
hdr_root = ET.fromstring(hdr_xml)

print("=== PAGE MARGINS (twips / mm) ===")
sectPr = root.find('.//w:sectPr', ns)
if sectPr is not None:
    pgMar = sectPr.find('w:pgMar', ns)
    if pgMar is not None:
        top = int(pgMar.attrib.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}top', 0)) / 56.69
        bottom = int(pgMar.attrib.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}bottom', 0)) / 56.69
        left = int(pgMar.attrib.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}left', 0)) / 56.69
        right = int(pgMar.attrib.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}right', 0)) / 56.69
        print(f"  Top: {top:.1f}mm, Bottom: {bottom:.1f}mm, Left: {left:.1f}mm, Right: {right:.1f}mm")

print("\n=== HEADER XML ANALYSIS ===")
for p in hdr_root.findall('.//w:p', ns):
    text = "".join(t.text for t in p.findall('.//w:t', ns) if t.text)
    pBdr = p.find('.//w:pBdr', ns)
    border_info = "No Border"
    if pBdr is not None:
        b = pBdr.find('w:bottom', ns)
        if b is not None:
            border_info = f"Bottom Border: val={b.attrib.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}val')}, color=#{b.attrib.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}color')}, sz={b.attrib.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}sz')}"
    print(f"Header Para: '{text}' | {border_info}")

print("\n=== TABLES IN DOCUMENT.XML ===")
tables = root.findall('.//w:tbl', ns)
for idx, tbl in enumerate(tables):
    print(f"\n--- TABLE {idx + 1} ---")
    grid = tbl.find('w:tblGrid', ns)
    if grid is not None:
        cols = [int(c.attrib.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}w', 0)) for c in grid.findall('w:gridCol', ns)]
        total_w = sum(cols)
        pcts = [f"{(c/total_w)*100:.1f}%" for c in cols]
        print(f"Grid Columns (twips): {cols} | Percentages: {pcts}")
    
    rows = tbl.findall('w:tr', ns)
    print(f"Row Count: {len(rows)}")
    for r_idx, row in enumerate(rows):
        cells = row.findall('w:tc', ns)
        cell_texts = []
        for c in cells:
            t = "".join(txt.text for txt in c.findall('.//w:t', ns) if txt.text)
            shd = c.find('.//w:shd', ns)
            shd_fill = f"#{shd.attrib.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}fill')}" if shd is not None else "none"
            cell_texts.append(f"'{t}' (shd:{shd_fill})")
        row_str = " | ".join(cell_texts)
        print(f"  Row {r_idx+1}: {row_str}")
