import zipfile
import xml.etree.ElementTree as ET
import os

docx_path = r"c:\Projects\St-rose-laboratory-result-management-system\Templates\CBC.docx"

with zipfile.ZipFile(docx_path, 'r') as zip_ref:
    print("=== FILES IN CBC.docx ===")
    for f in zip_ref.namelist():
        print(" -", f)

    document_xml = zip_ref.read("word/document.xml")
    headers = [f for f in zip_ref.namelist() if "header" in f]
    styles_xml = zip_ref.read("word/styles.xml") if "word/styles.xml" in zip_ref.namelist() else None

    print("\n=== HEADER FILES FOUND ===")
    for h in headers:
        header_content = zip_ref.read(h)
        print(f"--- {h} ---")
        print(header_content.decode('utf-8', errors='ignore')[:1000])

    print("\n--- DOCUMENT.XML SAMPLE ---")
    print(document_xml.decode('utf-8', errors='ignore')[:1500])
