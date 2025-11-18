# Skrypt do generowania ikon PWA
# Wymaga Python z biblioteką Pillow: pip install pillow

from PIL import Image, ImageDraw, ImageFont
import os

# Utworz katalog static jesli nie istnieje
if not os.path.exists('static'):
    os.makedirs('static')

# Rozmiary ikon
sizes = [72, 96, 128, 144, 152, 192, 384, 512]

# Kolory
bg_color = (13, 110, 253)  # Bootstrap primary blue
text_color = (255, 255, 255)  # White

for size in sizes:
    # Utworz nowy obraz
    img = Image.new('RGB', (size, size), bg_color)
    draw = ImageDraw.Draw(img)
    
    # Dodaj tekst "N" (Neptun)
    try:
        # Sprobuj uzyc systemowej czcionki
        font_size = int(size * 0.6)
        font = ImageFont.truetype("arial.ttf", font_size)
    except:
        # Fallback do domyslnej czcionki
        font = ImageFont.load_default()
    
    # Tekst
    text = "N"
    
    # Wycentruj tekst
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    
    position = ((size - text_width) // 2, (size - text_height) // 2 - bbox[1])
    
    # Rysuj tekst
    draw.text(position, text, fill=text_color, font=font)
    
    # Zapisz
    filename = f'static/icon-{size}.png'
    img.save(filename, 'PNG')
    print(f'Created {filename}')

print('\nAll icons generated successfully!')
print('You can replace these with custom icons if needed.')
