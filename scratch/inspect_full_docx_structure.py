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

doc_root = ET.fromstring(doc_xml)
hdr_root = ET.fromstring(hdr_xml)

print("=== BODY CHILDREN SEQUENCE IN DOCUMENT.XML ===")
body = doc_root.find('w:body', ns)
for idx, child in enumerate(body):
    tag = child.tag.split('}')[-1]
    if tag == 'p':
        text = "".join(t.text for t in child.findall('.//w:t', ns) if t.text)
        print(f"Child {idx+1}: <Paragraph> '{text[:60]}'")
    elif tag == 'tbl':
        # inspect table rows
        rows = child.findall('w:tr', ns)
        print(f"Child {idx+1}: <Table> ({len(rows)} rows)")
    else:
        print(f"Child {idx+1}: <{tag}>")
