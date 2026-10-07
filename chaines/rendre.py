r"""Rend les visuels des chaînes en PNG avec Chrome sans interface (rien n'est publié).

    python D:\Stream\OBS\chaines\rendre.py
"""
import subprocess
import urllib.parse
from pathlib import Path

ICI = Path(__file__).resolve().parent
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
PANNEAUX = [
    ("a-propos", "À propos", "Qui je suis, ce qu'on fait ici"),
    ("planning", "Planning", "Quand me trouver en live"),
    ("discord", "Discord", "La commu, même hors live"),
    ("soutenir", "Soutenir", "Dons, abonnements, follow"),
    ("materiel", "Matériel", "Ce que j'utilise en live"),
    ("regles", "Règles du chat", "Pour que ça reste cool"),
]


def rendre(html: Path, png: Path, largeur: int, hauteur: int, requete: str = "") -> None:
    url = html.as_uri() + (("?" + requete) if requete else "")
    subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
                    "--allow-file-access-from-files", "--virtual-time-budget=4000", "--default-background-color=00000000",
                    f"--window-size={largeur},{hauteur}", f"--screenshot={png}", url],
                   check=True, capture_output=True)
    print("rendu", png.relative_to(ICI))


def main() -> None:
    rendre(ICI / "twitch-latshow" / "banniere.html", ICI / "twitch-latshow" / "banniere_1200x480.png", 1200, 480)
    rendre(ICI / "twitch-latshow" / "hors-ligne.html", ICI / "twitch-latshow" / "hors-ligne_1920x1080.png", 1920, 1080)
    for nom, titre, sous in PANNEAUX:
        rendre(ICI / "twitch-latshow" / "panneaux" / "panneau.html", ICI / "twitch-latshow" / "panneaux" / f"{nom}_320x100.png",
               320, 100, urllib.parse.urlencode({"t": titre, "s": sous}))
    rendre(ICI / "youtube-latshow" / "banniere.html", ICI / "youtube-latshow" / "banniere_2560x1440.png", 2560, 1440)
    rendre(ICI / "youtube-linedev" / "banniere.html", ICI / "youtube-linedev" / "banniere_2048x1152.png", 2048, 1152)


if __name__ == "__main__":
    main()
