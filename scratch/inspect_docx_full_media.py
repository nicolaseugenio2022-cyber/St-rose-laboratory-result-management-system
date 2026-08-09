import zipfile
import xml.etree.ElementTree as ET
import os

cbc_path = r"c:\Projects\St-rose-laboratory-result-management-system\Templates\CBC.docx"

with zipfile.ZipFile(cbc_path, 'r') as z:
    print("Files in CBC.docx zip:")
    for f in z.namelist():
        if 'media' in f or 'header' in f or 'document' in f:
            print(f"  {f:30s} ({len(z.read(f))} bytes)")
    
    # Inspect header XML
    header_xml = z.read('word/header1.xml')
    print("\n--- header1.xml contents ---")
    tree = ET.fromstring(header_xml)
    for elem in tree.iter():
        if elem.tag.endswith('t'):
            print("Text:", elem.text)
        elif elem.tag.endswith('blip') or elem.tag.endswith('imagedata'):
            print("Image ref:", elem.attrib)
