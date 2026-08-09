import zipfile
import xml.etree.ElementTree as ET

docx_path = r"c:\Projects\St-rose-laboratory-result-management-system\Templates\CBC.docx"

with zipfile.ZipFile(docx_path, 'r') as zip_ref:
    doc_xml = zip_ref.read("word/document.xml")

ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
root = ET.fromstring(doc_xml)

sectPr = root.find('.//w:sectPr', ns)
if sectPr is not None:
    pgMar = sectPr.find('w:pgMar', ns)
    if pgMar is not None:
        top_twips = int(pgMar.attrib.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}top', 0))
        bottom_twips = int(pgMar.attrib.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}bottom', 0))
        left_twips = int(pgMar.attrib.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}left', 0))
        right_twips = int(pgMar.attrib.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}right', 0))
        header_twips = int(pgMar.attrib.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}header', 0))
        footer_twips = int(pgMar.attrib.get('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}footer', 0))

        print(f"Header Top Offset (twips): {header_twips} -> {header_twips / 56.69:.2f} mm ({header_twips / 1440:.2f} inches)")
        print(f"Body Top Margin   (twips): {top_twips} -> {top_twips / 56.69:.2f} mm ({top_twips / 1440:.2f} inches)")
        print(f"Body Left Margin  (twips): {left_twips} -> {left_twips / 56.69:.2f} mm ({left_twips / 1440:.2f} inches)")
        print(f"Body Right Margin (twips): {right_twips} -> {right_twips / 56.69:.2f} mm ({right_twips / 1440:.2f} inches)")
        print(f"Footer Offset     (twips): {footer_twips} -> {footer_twips / 56.69:.2f} mm ({footer_twips / 1440:.2f} inches)")
