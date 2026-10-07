"""Musique de fond des écrans de live (demande du client, 2026-10-07 : « des bonnes musiques qui ont de la pêche,
fait maison »). Composée en local par ACE-Step 1.5 dans le ComfyUI du client, avec la même chaîne que la bibliothèque des
shorts (D:\\Stream\\Dev\\Assets\\Musique\\composer_ace.py) : workflow officiel, 8 étapes, euler, cfg 1, shift 3.

    D:\\Stream\\Clone\\.venv\\Scripts\\python.exe composer.py            compose ce qui manque, contrôle la voix, écoute
    D:\\Stream\\Clone\\.venv\\Scripts\\python.exe composer.py --ecoute   refait seulement la vidéo d'écoute

Sorties : <marque>\\<ambiance>\\NN_<style>.mp3 (2 par dossier, lus en boucle par la source VLC d'OBS), -18 LUFS,
mp3 320 k 48 kHz ; catalogue.json (style, BPM, tonalité, graine : régénérable à l'identique) ;
_Archives_travail\\_ecoute.mp4 (10 s de chaque morceau, numérotés). Un morceau qui chante (Whisper, même règle que
Dev\\Assets\\Musique\\detecter_voix.py) est refait avec la graine suivante. Ne touche à rien dans D:\\Stream\\Dev.
"""
import json
import re
import subprocess
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
ICI = Path(__file__).resolve().parent
DEV = Path(r"D:\Stream\Dev")
sys.path.insert(0, str(DEV / "Habillage" / "_prototypes" / "Chanson_ace"))
from ace import PORTABLE, appel, demarrer_comfy, sonie  # noqa: E402

TRAVAIL = ICI / "_Archives_travail"
BRUTS = TRAVAIL / "bruts"
DUREE = 150          # secondes demandées à ACE-Step (max du nœud : 1000)
DUREE_MIN = 110      # en dessous (fin trop tôt), on refait avec une autre graine
LUFS = -18.0
ESSAIS = 3           # graines essayées au plus par morceau
LICENCE = "Composé en local par ACE-Step 1.5 (poids MIT, repackagés Comfy-Org en Apache 2.0), usage commercial autorisé"

# (marque, ambiance, nom court, description ACE-Step, BPM, tonalité). Numéro = rang + 1. Aucun nom d'artiste.
MORCEAUX = [
    ("latshow", "demarrage", "synthwave-montee", "energetic synthwave, driving drums, pulsing analog bass, bright arpeggios, gradual build up, "
     "gaming stream intro, exciting anticipation", 120, "A minor"),
    ("latshow", "demarrage", "electro-depart", "upbeat electro house, punchy four on the floor kick, sidechained synth chords, rising energy, "
     "catchy lead riff, gaming stream starting", 124, "F minor"),
    ("latshow", "pause", "lofi-house", "chill lofi house, warm soft kick, mellow chords, laid back groove, relaxed but positive, background music",
     118, "D minor"),
    ("latshow", "pause", "chill-electro", "chill electronic, soft punchy drums, warm bass, dreamy pads, light plucks, relaxed coffee break vibe",
     105, "E minor"),
    ("latshow", "bebe", "lofi-doux", "calm lofi, soft muffled piano, gentle brushed drums, warm vinyl texture, peaceful and tender, slow",
     78, "F major"),
    ("latshow", "bebe", "piano-feutre", "soft felt piano, gentle ambient pads, very calm, tender lullaby mood, light soft beat, cozy",
     72, "C major"),
    ("latshow", "fin", "outro-epique", "warm cinematic electronic outro, uplifting synth chords, steady drums, emotional and slightly epic, "
     "end of stream, grateful", 110, "C major"),
    ("latshow", "fin", "synthwave-coucher", "warm synthwave, nostalgic sunset mood, steady drums, lush pads, melodic and uplifting, outro",
     100, "G major"),
    ("linedev", "demarrage", "chillhop-focus", "upbeat chillhop, crisp punchy drums, jazzy guitar chops, warm bass, focused coding vibe, positive energy",
     95, "G major"),
    ("linedev", "demarrage", "lofi-peche", "upbeat lofi hip hop, punchy boom bap drums, jazzy rhodes keys, head nodding groove, motivated study session",
     92, "D minor"),
    ("linedev", "pause", "jazz-hop", "relaxed jazz hop, swing drums, upright bass, rhodes piano, laid back coffee break groove",
     88, "Bb major"),
    ("linedev", "pause", "lofi-cafe", "chill lofi, soft drums, warm guitar, mellow keys, cozy coffee shop vibe, relaxed",
     84, "E major"),
    ("linedev", "bebe", "lofi-berceuse", "very calm lofi, soft felt piano, gentle brushed drums, tender and peaceful, slow, cozy",
     70, "F major"),
    ("linedev", "bebe", "ambient-doux", "soft ambient, warm pads, gentle music box melody, very calm, peaceful, soft light beat",
     68, "D major"),
    ("linedev", "fin", "lofi-lumineuse", "bright uplifting lofi, crisp drums, warm major chords, happy jazzy keys, satisfied end of lesson vibe",
     96, "C major"),
    ("linedev", "fin", "chillhop-soleil", "sunny chillhop, bouncy drums, warm bass, bright guitar and keys, positive and grateful outro",
     100, "A major"),
]


def graphe(style: str, bpm: int, tonalite: str, graine: int) -> dict:
    """Workflow officiel ACE-Step 1.5 sans paroles (comme Dev\\Assets\\Musique\\composer_ace.py), durée de live."""
    return {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": "ace_step_1.5_turbo_aio.safetensors"}},
        "2": {"class_type": "ModelSamplingAuraFlow", "inputs": {"model": ["1", 0], "shift": 3}},
        "3": {"class_type": "TextEncodeAceStepAudio1.5", "inputs": {
            "clip": ["1", 1], "tags": f"instrumental, no vocals, {style}", "lyrics": "[Instrumental]", "seed": graine, "bpm": bpm,
            "duration": DUREE, "timesignature": "4", "language": "en", "keyscale": tonalite, "generate_audio_codes": True,
            "cfg_scale": 2.0, "temperature": 0.85, "top_p": 0.9, "top_k": 0, "min_p": 0.0}},
        "4": {"class_type": "ConditioningZeroOut", "inputs": {"conditioning": ["3", 0]}},
        "5": {"class_type": "EmptyAceStep1.5LatentAudio", "inputs": {"seconds": DUREE, "batch_size": 1}},
        "6": {"class_type": "KSampler", "inputs": {"model": ["2", 0], "positive": ["3", 0], "negative": ["4", 0], "latent_image": ["5", 0],
                                                   "seed": graine, "steps": 8, "cfg": 1.0, "sampler_name": "euler", "scheduler": "simple", "denoise": 1.0}},
        "7": {"class_type": "VAEDecodeAudio", "inputs": {"samples": ["6", 0], "vae": ["1", 2]}},
        "8": {"class_type": "SaveAudio", "inputs": {"audio": ["7", 0], "filename_prefix": "obs_live/ace"}},
    }


def generer(style: str, bpm: int, tonalite: str, graine: int) -> Path:
    import time
    ident = appel("/prompt", json.dumps({"prompt": graphe(style, bpm, tonalite, graine), "client_id": "obs-live"}).encode())["prompt_id"]
    while True:
        time.sleep(2)
        histo = appel(f"/history/{ident}")
        if ident in histo:
            etat = histo[ident]["status"]
            if etat.get("status_str") == "error":
                sys.exit(f"échec ComfyUI : {json.dumps(etat.get('messages', [])[-1:], ensure_ascii=False)[:800]}")
            f = [f for n in histo[ident]["outputs"].values() for f in n.get("audio", [])][0]
            return PORTABLE / "ComfyUI" / "output" / f.get("subfolder", "") / f["filename"]


def duree(fichier: Path) -> float:
    return round(float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(fichier)],
                                      capture_output=True, text=True).stdout), 2)


def vraie_fin(fichier: Path) -> float:
    """ACE-Step finit parfois avant la durée demandée : instant où commence un silence durable (après 20 s), sinon la durée."""
    sortie = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(fichier), "-af", "silencedetect=n=-45dB:d=3", "-f", "null", "-"],
                            capture_output=True, text=True, encoding="utf-8", errors="replace").stderr
    debuts = [float(x) for x in re.findall(r"silence_start: ([0-9.]+)", sortie) if float(x) >= 20]
    return min(debuts) if debuts else duree(fichier)


def finaliser(brut: Path, cible: Path) -> float:
    """Coupe à la vraie fin, -18 LUFS (gain mesuré puis limiteur), fondus, mp3 320 k 48 kHz. Rend la durée finale."""
    fin = vraie_fin(brut)
    gain = LUFS - sonie(brut)
    cible.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(brut), "-t", f"{fin:.2f}",
                    "-af", f"volume={gain:.2f}dB,alimiter=limit=0.89:level=false,afade=t=in:d=0.4,afade=t=out:st={fin - 2.5:.2f}:d=2.5",
                    "-ar", "48000", "-b:a", "320k", str(cible)], check=True)
    return duree(cible)


def chante(modele, fichier: Path) -> dict:
    """Même règle que Dev\\Assets\\Musique\\detecter_voix.py (mots sûrs dans des segments de parole)."""
    import detecter_voix
    return detecter_voix.analyser(modele, fichier)


def modele_whisper():
    sys.path.insert(0, str(DEV / "Assets" / "Musique"))
    import detecter_voix  # ajoute les DLL CUDA du venv Clone
    return detecter_voix.WhisperModel("large-v3", device="cuda", compute_type="float16", download_root=str(detecter_voix.MODELES))


def ecoute(catalogue: list) -> None:
    """10 s de chaque morceau (de 20 à 30 s), numéro, marque, ambiance et style à l'écran."""
    TRAVAIL.mkdir(exist_ok=True)
    parties, police = [], "C\\:/Windows/Fonts/arialbd.ttf"
    for m in catalogue:
        extrait = TRAVAIL / f"_extrait_{m['numero']:02d}.mp4"
        texte = f"{m['numero']:02d}  {m['marque']} / {m['ambiance']}  -  {m['nom']}  ({m['bpm']} BPM)"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "color=c=0x101826:s=1920x1080:d=10", "-ss", "20", "-t", "10",
                        "-i", str(ICI / m["fichier"]), "-vf", f"drawtext=fontfile='{police}':text='{texte}':fontcolor=white:fontsize=56:"
                        "x=(w-text_w)/2:y=(h-text_h)/2", "-af", "afade=t=in:d=0.3,afade=t=out:st=9.4:d=0.6", "-shortest",
                        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-ar", "48000", str(extrait)], check=True)
        parties.append(extrait)
    liste = TRAVAIL / "_liste.txt"
    liste.write_text("".join(f"file '{p.as_posix()}'\n" for p in parties), encoding="utf-8")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(liste), "-c", "copy", str(TRAVAIL / "_ecoute.mp4")],
                   check=True)
    for p in parties + [liste]:
        p.unlink()


def charger_catalogue() -> dict:
    f = ICI / "catalogue.json"
    return {m["numero"]: m for m in json.loads(f.read_text(encoding="utf-8"))["morceaux"]} if f.exists() else {}


def ecrire_catalogue(par_numero: dict) -> list:
    morceaux = [par_numero[n] for n in sorted(par_numero)]
    (ICI / "catalogue.json").write_text(json.dumps({
        "_note": "Musique des écrans de live, composée par composer.py. Régénérable à l'identique (style, BPM, tonalité, graine, durée demandée).",
        "licence": LICENCE, "duree_demandee_s": DUREE, "lufs_cible": LUFS, "morceaux": morceaux}, ensure_ascii=False, indent=1), encoding="utf-8")
    return morceaux


def main() -> None:
    if "--ecoute" in sys.argv:
        ecoute(ecrire_catalogue(charger_catalogue()))
        return
    BRUTS.mkdir(parents=True, exist_ok=True)
    catalogue = charger_catalogue()
    a_faire = [n for n in range(1, len(MORCEAUX) + 1) if n not in catalogue or not (ICI / catalogue[n]["fichier"]).exists()]
    if a_faire:
        demarrer_comfy()
    # 1. Composition (graine 700 + numéro, puis +1000 par nouvel essai si trop court)
    candidats = {}
    for n in a_faire:
        marque, ambiance, nom, style, bpm, tonalite = MORCEAUX[n - 1]
        for essai in range(ESSAIS):
            graine = 700 + n + 1000 * essai
            brut = generer(style, bpm, tonalite, graine)
            copie = BRUTS / f"{n:02d}_{nom}_graine{graine}{brut.suffix}"
            copie.write_bytes(brut.read_bytes())
            fin = vraie_fin(copie)
            print(f"{n:02d} {marque}/{ambiance} {nom} graine {graine} : fin à {fin:.0f} s", flush=True)
            if fin >= DUREE_MIN:
                candidats[n] = (copie, graine)
                break
        else:
            candidats[n] = (copie, graine)  # garde le dernier essai, signalé par sa durée dans le catalogue
    # 2. Contrôle de voix (Whisper) ; un morceau qui chante est refait avec la graine suivante
    if candidats:
        modele = modele_whisper()
        for n, (copie, graine) in list(candidats.items()):
            marque, ambiance, nom, style, bpm, tonalite = MORCEAUX[n - 1]
            r = chante(modele, copie)
            essai = 0
            while r["voix"] and essai < ESSAIS:
                essai += 1
                print(f"{n:02d} {nom} : VOIX ({r['mots_surs']} mots sûrs : {r['extrait'][:50]}) -> nouvelle graine", flush=True)
                graine += 1000
                demarrer_comfy()
                brut = generer(style, bpm, tonalite, graine)
                copie = BRUTS / f"{n:02d}_{nom}_graine{graine}{brut.suffix}"
                copie.write_bytes(brut.read_bytes())
                r = chante(modele, copie)
            candidats[n] = (copie, graine, r)
    # 3. Finalisation et catalogue
    for n, (copie, graine, voix) in candidats.items():
        marque, ambiance, nom, style, bpm, tonalite = MORCEAUX[n - 1]
        cible = ICI / marque / ambiance / f"{n:02d}_{nom}.mp3"
        d = finaliser(copie, cible)
        catalogue[n] = {"numero": n, "marque": marque, "ambiance": ambiance, "nom": nom,
                        "fichier": cible.relative_to(ICI).as_posix(), "style": f"instrumental, no vocals, {style}",
                        "bpm": bpm, "tonalite": tonalite, "graine": graine, "duree_s": d, "lufs": round(sonie(cible), 1),
                        "voix_detectee": voix["voix"], "mots_surs_whisper": voix["mots_surs"]}
        print(f"{n:02d} -> {cible.relative_to(ICI)}  {d:.0f} s  {catalogue[n]['lufs']} LUFS", flush=True)
    ecoute(ecrire_catalogue(catalogue))
    print(f"terminé : {len(catalogue)} morceaux, écoute dans {TRAVAIL / '_ecoute.mp4'}")


if __name__ == "__main__":
    main()
