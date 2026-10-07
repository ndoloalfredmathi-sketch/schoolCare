"""Génère les icônes de packaging de SchoolCare depuis le design du favicon.

- public/icon.png (512x512) : icône Linux
- public/icons.ico : icône Windows (multi-résolutions)
- public/icon.iconset/*.png : sources pour `iconutil` sur macOS
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
PUBLIC = ROOT / "public"

BACKGROUND = (250, 250, 250, 255)
FOREGROUND = (10, 10, 10, 255)


def find_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        r"C:\Windows\Fonts\segoeuib.ttf",
        r"C:\Windows\Fonts\arialbd.ttf",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    ]

    for candidate in candidates:
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size)

    return ImageFont.load_default()


def glyph() -> Image.Image:
    """Glyphe « S » noir, détouré sur sa boîte encrée réelle.

    Passer par la boîte encrée évite toute dépendance aux métriques de la
    police (`textbbox` inclut des marges qui varient d'une fonte à l'autre).
    """
    probe = 2048
    image = Image.new("RGBA", (probe, probe), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.text((probe * 0.1, probe * 0.1), "S", font=find_font(int(probe * 0.68)), fill=FOREGROUND)

    box = image.getbbox()

    if box is None:
        raise RuntimeError("Glyphe « S » introuvable dans la police choisie.")

    return image.crop(box)


def render(size: int, mark: Image.Image) -> Image.Image:
    # Suréchantillonnage puis réduction : bords nets à toutes les tailles.
    scale = 4
    canvas = size * scale
    image = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    radius = int(canvas * 0.25)
    draw.rounded_rectangle([(0, 0), (canvas - 1, canvas - 1)], radius=radius, fill=BACKGROUND)

    # Le glyphe occupe 52 % de la hauteur du carré, centré au pixel près.
    # On dimensionne sur la hauteur : la boîte encrée d'un « S » est haute et
    # étroite, un pourcentage de largeur donnerait un glyphe trop grand.
    target = max(1, int(canvas * 0.52))
    scaled = mark.resize(
        (max(1, int(mark.width * (target / mark.height))), target),
        Image.LANCZOS,
    )

    image.alpha_composite(
        scaled,
        ((canvas - scaled.width) // 2, (canvas - scaled.height) // 2),
    )

    return image.resize((size, size), Image.LANCZOS)


def main() -> None:
    PUBLIC.mkdir(parents=True, exist_ok=True)

    mark = glyph()
    print(f"glyphe détouré : {mark.width}x{mark.height}")

    master = render(1024, mark)
    master.save(PUBLIC / "icon.png")

    ico_sizes = [16, 24, 32, 48, 64, 128, 256]
    render(256, mark).save(PUBLIC / "icons.ico", sizes=[(s, s) for s in ico_sizes])

    iconset = PUBLIC / "icon.iconset"
    iconset.mkdir(exist_ok=True)

    for size in [16, 32, 64, 128, 256, 512]:
        render(size, mark).save(iconset / f"icon_{size}x{size}.png")
        if size <= 256:
            render(size * 2, mark).save(iconset / f"icon_{size}x{size}@2x.png")

    print("OK icon.png 512x512")
    print("OK icons.ico", ico_sizes)
    print("OK icon.iconset", len(list(iconset.glob("*.png"))), "fichiers")


if __name__ == "__main__":
    main()
