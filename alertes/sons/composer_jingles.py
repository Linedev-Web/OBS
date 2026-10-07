"""Jingles des alertes de live (demande du client, 2026-10-07 : « de la musique quand ça touche les alertes, pour que ça
donne envie », façon montage After Effects). Chaque son : whoosh à 0 s, impact à 0,25 s, puis 3,5 s du meilleur moment
d'un jingle composé par ACE-Step 1.5 (même chaîne que D:\\Stream\\OBS\\musique\\composer.py), plus quelques bruitages
d'accent. -14 LUFS, limiteur à -1 dB, mp3 192 k 48 kHz.

    D:\\Stream\\Clone\\.venv\\Scripts\\python.exe composer_jingles.py            compose ce qui manque, contrôle la voix
    D:\\Stream\\Clone\\.venv\\Scripts\\python.exe composer_jingles.py --ecoute   refait seulement _ecoute.mp4

L'animation des alertes suit ce minutage : arrivée sur le whoosh, impact (zoom, secousse) à 0,25 s.
Bruitages : D:\\Stream\\Dev\\Assets\\Sons (Pixabay Content License, usage commercial libre ; Kenney CC0). Ne modifie rien
dans D:\\Stream\\Dev.
"""
import json
import subprocess
import sys
import time
from pathlib import Path

import numpy as np

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
ICI = Path(__file__).resolve().parent
DEV = Path(r"D:\Stream\Dev")
SONS = DEV / "Assets" / "Sons"
sys.path.insert(0, str(DEV / "Habillage" / "_prototypes" / "Chanson_ace"))
sys.path.insert(0, str(ICI.parents[1] / "musique"))
from ace import PORTABLE, appel, demarrer_comfy, sonie  # noqa: E402
import composer  # noqa: E402  (modele_whisper, chante, duree)

TRAVAIL = ICI / "_Archives_travail"
DUREE_ACE = 16        # secondes composées ; on n'en garde que le meilleur moment
GARDE = 3.5           # secondes de jingle gardées
DEPART = 0.25         # le jingle et l'impact arrivent à 0,25 s (après le whoosh)
LUFS = -14.0
ESSAIS = 3
SR = 48000
LICENCE = ("Jingle composé en local par ACE-Step 1.5 (poids MIT, repackagés Comfy-Org en Apache 2.0) ; bruitages Pixabay "
           "Content License (usage commercial libre) et Kenney CC0. Usage commercial autorisé.")

PIX = {"whoosh": SONS / "whoosh-short.mp3", "impact": SONS / "impact-bass-1.mp3", "impact2": SONS / "impact-bass-2.mp3",
       "sparkle": SONS / "sparkle.mp3", "chime": SONS / "chime.mp3", "pop": SONS / "pop.mp3",
       "pieces": SONS / "kenney" / "kenney_casino-audio" / "Audio" / "chips-collide-2.ogg"}

FANFARE = "triumphant electro fanfare, bright brass synths, rising build, big punchy drums, victorious celebration jingle, short"
CARILLON = "euphoric uplifting chord stab, bright bells and chimes, sparkling happy electro jingle, punchy drums, short"
PLUCK = "bright energetic synth pluck melody, catchy short jingle, punchy drums, uplifting electro pop notification, short"
# (fichier, marque, description ACE-Step, BPM, tonalité, impact, [(bruitage, départ s, gain dB)])
JINGLES = [
    ("follow", "latshow", PLUCK, 128, "C major", "impact", [("sparkle", 0.25, -8)]),
    ("sub", "latshow", FANFARE, 128, "D major", "impact2", [("sparkle", 0.30, -8)]),
    ("resub", "latshow", FANFARE + ", warm and grateful", 126, "E major", "impact2", [("sparkle", 0.30, -8)]),
    ("gift", "latshow", "festive party electro jingle, joyful horn synths, bright energetic drums, celebration, confetti mood, short",
     130, "F major", "impact2", [("sparkle", 0.25, -6), ("pop", 0.35, -8)]),
    ("tip", "latshow", CARILLON, 124, "G major", "impact", [("pieces", 0.20, -3), ("chime", 0.35, -10)]),
    ("cheer", "latshow", "playful bouncy electro motif, quirky fun synth lead, retro video game jingle, punchy drums, short",
     140, "A major", "impact", [("pop", 0.25, -6)]),
    ("raid", "latshow", "epic drum roll build up into a powerful festival drop, massive synths, hype, energetic, short",
     128, "F minor", "impact2", []),
    ("yt-abonne", "latshow", PLUCK, 126, "G major", "impact", [("sparkle", 0.25, -8)]),
    ("yt-membre", "latshow", FANFARE, 128, "A major", "impact2", [("sparkle", 0.30, -8)]),
    ("superchat", "latshow", CARILLON, 124, "C major", "impact", [("pieces", 0.20, -3), ("chime", 0.35, -10)]),
    ("linedev-abonne", "linedev", "bright chillhop jingle, warm rhodes chord stab, crisp punchy boom bap drums, positive, short",
     96, "F major", "impact", [("pop", 0.25, -8)]),
    ("linedev-membre", "linedev", "uplifting lofi hip hop jingle, jazzy keys, punchy drums, warm and celebratory, short",
     92, "Bb major", "impact", [("sparkle", 0.30, -10)]),
    ("linedev-superchat", "linedev", "bright lofi jingle with bells and chimes, jazzy major chords, warm and happy, punchy drums, short",
     90, "D major", "impact", [("pieces", 0.20, -4), ("chime", 0.35, -10)]),
    ("linedev-tip", "linedev", "happy jazzy lofi jingle, warm piano chords, bright chimes, crisp drums, short",
     94, "E major", "impact", [("pieces", 0.20, -4)]),
]


def graphe(style: str, bpm: int, tonalite: str, graine: int) -> dict:
    """Workflow officiel ACE-Step 1.5 sans paroles (comme composer.py), 16 s."""
    return {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": "ace_step_1.5_turbo_aio.safetensors"}},
        "2": {"class_type": "ModelSamplingAuraFlow", "inputs": {"model": ["1", 0], "shift": 3}},
        "3": {"class_type": "TextEncodeAceStepAudio1.5", "inputs": {
            "clip": ["1", 1], "tags": f"instrumental, no vocals, {style}", "lyrics": "[Instrumental]", "seed": graine, "bpm": bpm,
            "duration": DUREE_ACE, "timesignature": "4", "language": "en", "keyscale": tonalite, "generate_audio_codes": True,
            "cfg_scale": 2.0, "temperature": 0.85, "top_p": 0.9, "top_k": 0, "min_p": 0.0}},
        "4": {"class_type": "ConditioningZeroOut", "inputs": {"conditioning": ["3", 0]}},
        "5": {"class_type": "EmptyAceStep1.5LatentAudio", "inputs": {"seconds": DUREE_ACE, "batch_size": 1}},
        "6": {"class_type": "KSampler", "inputs": {"model": ["2", 0], "positive": ["3", 0], "negative": ["4", 0], "latent_image": ["5", 0],
                                                   "seed": graine, "steps": 8, "cfg": 1.0, "sampler_name": "euler", "scheduler": "simple", "denoise": 1.0}},
        "7": {"class_type": "VAEDecodeAudio", "inputs": {"samples": ["6", 0], "vae": ["1", 2]}},
        "8": {"class_type": "SaveAudio", "inputs": {"audio": ["7", 0], "filename_prefix": "obs_alertes/ace"}},
    }


def generer(style: str, bpm: int, tonalite: str, graine: int) -> Path:
    ident = appel("/prompt", json.dumps({"prompt": graphe(style, bpm, tonalite, graine), "client_id": "obs-alertes"}).encode())["prompt_id"]
    while True:
        time.sleep(1.5)
        histo = appel(f"/history/{ident}")
        if ident in histo:
            etat = histo[ident]["status"]
            if etat.get("status_str") == "error":
                sys.exit(f"échec ComfyUI : {json.dumps(etat.get('messages', [])[-1:], ensure_ascii=False)[:800]}")
            f = [f for n in histo[ident]["outputs"].values() for f in n.get("audio", [])][0]
            return PORTABLE / "ComfyUI" / "output" / f.get("subfolder", "") / f["filename"]


def mono(fichier: Path) -> np.ndarray:
    brut = subprocess.run(["ffmpeg", "-v", "error", "-i", str(fichier), "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                          capture_output=True, check=True).stdout
    return np.frombuffer(brut, dtype=np.float32)


def meilleur_moment(fichier: Path) -> tuple[float, float]:
    """Début (s) de la fenêtre de GARDE secondes la plus forte, qui démarre sur une attaque franche. Rend (début, score)."""
    x = mono(fichier)
    pas = int(0.05 * SR)
    rms = np.sqrt(np.convolve(x ** 2, np.ones(pas) / pas, mode="valid")[::pas] + 1e-12)
    fen, avant = int(GARDE / 0.05), 10
    meilleur, debut = -1.0, 1.0
    for s in range(avant + 4, len(rms) - fen - 2):
        energie = float(rms[s:s + fen].mean())
        attaque = float(rms[s:s + 4].mean() - rms[s - avant:s].mean())
        score = energie + 1.5 * max(attaque, 0.0)
        if score > meilleur:
            meilleur, debut = score, s * 0.05
    return debut, meilleur


def assembler(brut: Path, debut: float, impact: str, accents: list, cible: Path) -> float:
    """Whoosh 0 s + impact et jingle à 0,25 s + accents ; -14 LUFS, limiteur -1 dB ; rend la durée."""
    TRAVAIL.mkdir(parents=True, exist_ok=True)
    jingle = TRAVAIL / f"_{cible.stem}_jingle.wav"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{debut:.2f}", "-t", f"{GARDE:.2f}", "-i", str(brut),
                    "-af", f"afade=t=in:d=0.02,afade=t=out:st={GARDE - 0.7:.2f}:d=0.7", "-ar", str(SR), "-ac", "2", str(jingle)], check=True)
    entrees = [(PIX["whoosh"], 0.0, -5), (PIX[impact], DEPART, -3), (jingle, DEPART, 0)] + [(PIX[n], t, g) for n, t, g in accents]
    args, chaines = ["ffmpeg", "-v", "error", "-y"], []
    for i, (f, t, g) in enumerate(entrees):
        args += ["-i", str(f)]
        chaines.append(f"[{i}:a]aresample={SR},aformat=channel_layouts=stereo,volume={g}dB,adelay={int(t * 1000)}|{int(t * 1000)}[a{i}]")
    total = DEPART + GARDE + 0.15
    graphe_f = ";".join(chaines) + ";" + "".join(f"[a{i}]" for i in range(len(entrees))) + \
        f"amix=inputs={len(entrees)}:normalize=0:duration=longest,atrim=0:{total:.2f},afade=t=out:st={total - 0.3:.2f}:d=0.3[m]"
    melange = TRAVAIL / f"_{cible.stem}_mix.wav"
    subprocess.run(args + ["-filter_complex", graphe_f, "-map", "[m]", str(melange)], check=True)
    gain = LUFS - sonie(melange)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(melange), "-af", f"volume={gain:.2f}dB,alimiter=limit=0.891:level=false",
                    "-ar", str(SR), "-b:a", "192k", str(cible)], check=True)
    jingle.unlink(); melange.unlink()
    return composer.duree(cible)


def ecoute(catalogue: list) -> None:
    """Chaque son, 1 s de silence, son nom à l'écran."""
    TRAVAIL.mkdir(parents=True, exist_ok=True)
    parties, police = [], "C\\:/Windows/Fonts/arialbd.ttf"
    for i, m in enumerate(catalogue, 1):
        d = m["duree_s"] + 1.0
        extrait = TRAVAIL / f"_ecoute_{i:02d}.mp4"
        texte = f"{i:02d}  {m['marque']}  -  {m['fichier'].replace('.mp3', '')}"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", f"color=c=0x101826:s=1920x1080:d={d:.2f}", "-i", str(ICI / m["fichier"]),
                        "-filter_complex", "[1:a]apad[a]", "-map", "0:v", "-map", "[a]", "-t", f"{d:.2f}",
                        "-vf", f"drawtext=fontfile='{police}':text='{texte}':fontcolor=white:fontsize=64:x=(w-text_w)/2:y=(h-text_h)/2",
                        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-ar", "48000", str(extrait)], check=True)
        parties.append(extrait)
    liste = TRAVAIL / "_liste.txt"
    liste.write_text("".join(f"file '{p.as_posix()}'\n" for p in parties), encoding="utf-8")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(liste), "-c", "copy", str(ICI / "_ecoute.mp4")], check=True)
    for p in parties + [liste]:
        p.unlink()


def charger() -> dict:
    f = ICI / "catalogue.json"
    return {m["fichier"]: m for m in json.loads(f.read_text(encoding="utf-8"))["sons"]} if f.exists() else {}


def ecrire(par_fichier: dict) -> list:
    ordre = [j[0] + ".mp3" for j in JINGLES]
    sons = [par_fichier[f] for f in ordre if f in par_fichier]
    (ICI / "catalogue.json").write_text(json.dumps({
        "_note": "Sons des alertes, composés par composer_jingles.py. Minutage : whoosh 0 s, impact et jingle à 0,25 s.",
        "licence": LICENCE, "lufs_cible": LUFS, "duree_ace_s": DUREE_ACE, "garde_s": GARDE, "sons": sons}, ensure_ascii=False, indent=1),
        encoding="utf-8")
    return sons


def main() -> None:
    if "--ecoute" in sys.argv:
        ecoute(ecrire(charger()))
        return
    (TRAVAIL / "bruts").mkdir(parents=True, exist_ok=True)
    catalogue = charger()
    a_faire = [j for j in JINGLES if j[0] + ".mp3" not in catalogue or not (ICI / (j[0] + ".mp3")).exists()]
    if a_faire:
        demarrer_comfy()
    modele = composer.modele_whisper() if a_faire else None
    for n, (nom, marque, style, bpm, tonalite, impact, accents) in enumerate(JINGLES, 1):
        if (nom, marque, style, bpm, tonalite, impact, accents) not in a_faire:
            continue
        for essai in range(ESSAIS):
            graine = 900 + n + 1000 * essai
            brut = generer(style, bpm, tonalite, graine)
            copie = TRAVAIL / "bruts" / f"{nom}_graine{graine}{brut.suffix}"
            copie.write_bytes(brut.read_bytes())
            voix = composer.chante(modele, copie)
            print(f"{nom} graine {graine} : {'VOIX' if voix['voix'] else 'instrumental'} ({voix['mots_surs']} mots)", flush=True)
            if not voix["voix"]:
                break
        debut, score = meilleur_moment(copie)
        cible = ICI / f"{nom}.mp3"
        d = assembler(copie, debut, impact, accents, cible)
        catalogue[cible.name] = {"fichier": cible.name, "marque": marque, "style": style, "bpm": bpm, "tonalite": tonalite, "graine": graine,
                                 "extrait_ace_s": [round(debut, 2), round(debut + GARDE, 2)], "duree_s": d, "lufs": round(sonie(cible), 1),
                                 "bruitages": [PIX["whoosh"].name, PIX[impact].name] + [PIX[a[0]].name for a in accents],
                                 "voix_detectee": voix["voix"]}
        print(f"  -> {cible.name} : {d:.2f} s, {catalogue[cible.name]['lufs']} LUFS (extrait {debut:.2f} s)", flush=True)
        ecrire(catalogue)
    ecoute(ecrire(catalogue))
    print("écoute :", ICI / "_ecoute.mp4")


if __name__ == "__main__":
    main()
