import zipfile
import xml.etree.ElementTree as ET

docx_path = r"c:\Projects\St-rose-laboratory-result-management-system\Templates\CBC.docx"

with zipfile.ZipFile(docx_path, 'r') as zip_ref:
    hdr_xml = zip_ref.read("word/header1.xml")
    rels_xml = zip_ref.read("word/_rels/header1.xml.rels")

print("=== HEADER RELS XML ===")
print(rels_xml.decode('utf-8'))

print("\n=== FULL HEADER1.XML PRINT ===")
root = ET.fromstring(hdr_xml)

# Print all elements, attributes, tags, text
def dump_tree(elem, level=0):
    indent = "  " * level
    tag = elem.tag.split('}')[-1]
    attribs = " ".join(f'{k.split("}")[-1]}="{v}"' for k, v in elem.attrib.items())
    text = elem.text.strip() if elem.text and elem.text.strip() else ""
    if text or attribs:
        print(f"{indent}<{tag} {attribs}>{text}")
    else:
        print(f"{indent}<{tag}>")
    for child in elem:
        dump_tree(child, level + 1)

dump_tree(root)
