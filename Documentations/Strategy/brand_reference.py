# -*- coding: utf-8 -*-
"""
Брандира reference.docx за фирмения стил на Елаците-МЕД АД:
- шрифтове за основен текст и заглавия
- теракотен (фирмен) цвят за заглавията
- стил на заглавната страница (Title)

Употреба:
    python brand_reference.py
"""
import os
from docx import Document
from docx.shared import Pt, RGBColor, Cm, Emu
from docx.enum.text import WD_ALIGN_PARAGRAPH

HERE = os.path.dirname(os.path.abspath(__file__))
REF = os.path.join(HERE, "reference.docx")
LOGO = os.path.join(HERE, "image", "app", "em_logo.jpg")

# Фирмени цветове (взети от логото – теракота)
BRAND = RGBColor(0xB0, 0x42, 0x1A)      # основен теракотен
BRAND_DARK = RGBColor(0x7A, 0x2E, 0x12)  # по-тъмен нюанс за H1
TEXT = RGBColor(0x22, 0x22, 0x22)        # почти черен за текста

BODY_FONT = "Calibri"
HEAD_FONT = "Calibri"

doc = Document(REF)

def set_font(style, name=None, size=None, color=None, bold=None):
    f = style.font
    if name:
        f.name = name
    if size is not None:
        f.size = Pt(size)
    if color is not None:
        f.color.rgb = color
    if bold is not None:
        f.bold = bold

styles = doc.styles

# Основен текст
if "Normal" in styles:
    set_font(styles["Normal"], BODY_FONT, 11, TEXT)

# Заглавия
heading_specs = {
    "Title": (26, BRAND_DARK, True),
    "Heading 1": (18, BRAND_DARK, True),
    "Heading 2": (14, BRAND, True),
    "Heading 3": (12, BRAND, True),
    "Heading 4": (11, BRAND, True),
}
for name, (size, color, bold) in heading_specs.items():
    if name in styles:
        set_font(styles[name], HEAD_FONT, size, color, bold)

# Стил на съдържанието (TOC) – да е четим
for name in ["TOC Heading", "TOC 1", "TOC 2", "TOC 3"]:
    if name in styles:
        set_font(styles[name], BODY_FONT, color=TEXT)

doc.save(REF)
print("Брандиран reference.docx е записан:", REF)
