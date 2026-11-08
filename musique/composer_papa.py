"""Proposition « papa » pour la musique des écrans de live (demande du client, 2026-11-08 : l'habillage fait trop « gaming
dark », chillwave de nuit et néons ; « je suis plus du style papa qui joue quand il peut et qui aime partager son expérience
de jeu ou de développement »). Chaleureux, familial, un peu malicieux : un salon le soir, du bois, une lampe, du café.
Instruments acoustiques, pas de chillwave, de synthwave, de grosse batterie ni de dubstep. Proposition à écouter : rien
n'est remplacé dans OBS (latshow\\, linedev\\ restent tels quels).

    D:\\Stream\\Clone\\.venv\\Scripts\\python.exe composer_papa.py               compose ce qui manque et l'écoute
    D:\\Stream\\Clone\\.venv\\Scripts\\python.exe composer_papa.py --refaire 3,7 refait ces numéros avec la graine suivante
                                                                              (un défaut entendu à l'écoute ; noté au catalogue,
                                                                              avec --raison "…" pour en dire la cause)
    D:\\Stream\\Clone\\.venv\\Scripts\\python.exe composer_papa.py --extraits    refait seulement les extraits d'écoute

Même chaîne que composer.py (ACE-Step 1.5 dans le ComfyUI du client, workflow officiel, 8 étapes, euler, cfg 1, shift 3),
dont il reprend les fonctions (vraie fin, finalisation à -18 LUFS en mp3 320 k 48 kHz, contrôle de voix Whisper), sans le
modifier. Une différence : le graphe baisse le son de 10 dB avant l'écriture du FLAC (nœud AudioAdjustVolume), car les bruts
d'ACE-Step écrêtaient (crête à 1,0 sur les 27 bruts de composer.py, jusqu'à 0,29 % d'échantillons écrêtés).

Écoute de chaque essai (un essai fautif est refait avec la graine suivante, 4 essais au plus, sinon le moins fautif) :
- voix : Whisper sur le morceau ET sur la voix isolée par Demucs (même règle que Dev\\Assets\\Musique\\detecter_voix.py) ;
- trop court : vraie fin (silence durable) avant 110 s ;
- saturation : plus de 0,02 % d'échantillons écrêtés dans le brut ;
- trou : une fenêtre de 5 s plus de 25 dB sous le niveau médian au milieu du morceau ;
- coupure : un arrêt net d'1 s ou plus (tranches de 250 ms à plus de 18 dB sous la médiane), qui sonne comme une fausse fin ;
- blanc de boucle : plus de 3 s avant le niveau plein, ou plus de 3 s de queue presque muette (blanc à chaque tour d'OBS) ;
- bouillie : platitude spectrale (bruit) d'une fenêtre de 5 s au-dessus de 0,05.
Le niveau de la voix isolée (« voix_isolee_lu », relatif au morceau) et un spectrogramme par essai (_controle\\) servent à
l'écoute humaine.

Sorties (dossier _propositions_papa\\, non versionné) : <univers>\\<ambiance>\\NN_<style>.mp3, catalogue.json,
_extraits\\<univers>-<ambiance>.mp3 (35 s à partir de 15 s, fondus 1 s / 3 s, mono 128 k 44,1 kHz, pour une page web).
"""
import json
import os
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
ICI = Path(__file__).resolve().parent
sys.path.insert(0, str(ICI))
import composer  # noqa: E402  (vraie_fin, finaliser, chante, modele_whisper, duree ; ajoute le chemin de ace.py)
from ace import PORTABLE, appel, demarrer_comfy, sonie  # noqa: E402

SORTIE = ICI / "_propositions_papa"
BRUTS = SORTIE / "_bruts"
CONTROLE = SORTIE / "_controle"
EXTRAITS = SORTIE / "_extraits"
CLONE_PY = Path(r"D:\Stream\Clone\.venv\Scripts\python.exe")
DUREE = composer.DUREE            # 150 s demandées
DUREE_MIN = composer.DUREE_MIN    # 110 s
LUFS = composer.LUFS              # -18
MARGE_DB = -10                    # gain avant l'écriture du FLAC (évite l'écrêtage des bruts)
ESSAIS = 4
GRAINE_BASE = 1300                # graine = 1300 + numéro (+1000 par essai)
ECRETE_MAX_PCT = 0.02
TROU_DB = 25.0
COUPURE_DB, COUPURE_MAX_S = 18.0, 1.0   # arrêt net au milieu (fausse fin) ; les arrêts d'un temps (0,25 à 0,75 s) restent
BLANC_MAX_S = 3.0                       # intro très basse ou queue presque muette : un blanc à chaque tour de boucle dans OBS
PLAT_MAX = 0.05
EXTRAIT_DEBUT, EXTRAIT_DUREE = 15.0, 35.0

# (univers, ambiance, nom court, description ACE-Step, BPM, tonalité). Numéro = rang + 1. Aucun nom d'artiste.
MORCEAUX = [
    ("gaming", "demarrage", "folk-souriant", "acoustic folk, smiling fingerpicked acoustic guitar, brushed drums, warm upright bass, "
     "light hand claps, tambourine, cheerful and cozy, warm living room evening, gentle energy, live instruments, background music",
     100, "G major"),
    ("gaming", "pause", "jazz-cafe", "cozy cafe jazz trio, warm Rhodes electric piano, upright double bass, soft brushed snare, "
     "relaxed swing, coffee break, warm and intimate, live instruments, background music", 88, "Bb major"),
    ("gaming", "pause-enfant", "boite-a-musique", "gentle music box melody, soft felt piano, tender and sweet lullaby mood, very calm, "
     "slow, cozy bedtime, warm, no drums", 66, "F major"),
    ("gaming", "fin", "fin-de-soiree", "warm end of the evening, gentle acoustic guitar, soft string pads, mellow cello, slow and "
     "grateful, cozy fireside, peaceful, live instruments, background music", 76, "D major"),
    ("dev", "demarrage", "jazz-hop-doux", "soft jazz hop, mellow jazzy clean electric guitar, gentle brushed drums, warm upright bass, "
     "calm and focused, cozy study room, warm and organic, background music", 84, "F major"),
    ("dev", "pause", "cafe-du-matin", "morning coffee, warm acoustic piano, nylon string guitar, light brushes, gentle and bright, "
     "relaxed sunny kitchen, acoustic, background music", 92, "D major"),
    ("dev", "pause-enfant", "glockenspiel-doux", "soft lullaby mood, gentle glockenspiel melody, warm felt piano, very calm and tender, "
     "slow, cozy, no drums", 64, "C major"),
    ("dev", "fin", "outro-piano-guitare", "calm outro, soft acoustic piano and fingerpicked acoustic guitar, warm, peaceful, slow, "
     "grateful, end of the day, background music", 72, "G major"),
    ("roblox", "demarrage", "marimba-malicieux", "playful and mischievous, bouncy marimba, strummed ukulele, pizzicato strings, light "
     "percussion, shakers, woodblock, cheerful and curious, building something fun, acoustic, background music", 112, "C major"),
    ("roblox", "pause", "ukulele-sifflote", "relaxed ukulele, instrumental whistling melody, light hand percussion, sunny and laid back, "
     "easygoing afternoon, acoustic, background music", 94, "G major"),
    ("roblox", "pause-enfant", "comptine-xylophone", "soft xylophone, gentle nursery rhyme melody, music box, tender and calm, slow, "
     "cozy, no drums", 80, "F major"),
    ("roblox", "fin", "ukulele-cloches", "happy and calm outro, gentle ukulele, soft bells, glockenspiel, light percussion, warm and "
     "cheerful, relaxed, background music", 88, "D major"),
]


def ffmpeg_dans_path() -> None:
    """Le PATH du client pointait encore vers ffmpeg-8.1 après la mise à jour WinGet en 9.0.1 (2026-11-08)."""
    if shutil.which("ffmpeg") and shutil.which("ffprobe"):
        return
    paquets = Path(os.environ.get("LOCALAPPDATA", ""), "Microsoft", "WinGet", "Packages")
    for d in sorted(paquets.glob("Gyan.FFmpeg*/ffmpeg-*/bin"), reverse=True):
        if (d / "ffmpeg.exe").exists():
            os.environ["PATH"] = str(d) + os.pathsep + os.environ["PATH"]
            return
    sys.exit("ffmpeg introuvable")


def graphe(style: str, bpm: int, tonalite: str, graine: int) -> dict:
    """Celui de composer.py, plus un gain de MARGE_DB avant l'écriture."""
    g = composer.graphe(style, bpm, tonalite, graine)
    g["9"] = {"class_type": "AudioAdjustVolume", "inputs": {"audio": ["7", 0], "volume": MARGE_DB}}
    g["8"] = {"class_type": "SaveAudio", "inputs": {"audio": ["9", 0], "filename_prefix": "obs_papa/ace"}}
    return g


def generer(style: str, bpm: int, tonalite: str, graine: int) -> Path:
    ident = appel("/prompt", json.dumps({"prompt": graphe(style, bpm, tonalite, graine), "client_id": "obs-papa"}).encode())["prompt_id"]
    while True:
        time.sleep(2)
        histo = appel(f"/history/{ident}")
        if ident in histo:
            etat = histo[ident]["status"]
            if etat.get("status_str") == "error":
                sys.exit(f"échec ComfyUI : {json.dumps(etat.get('messages', [])[-1:], ensure_ascii=False)[:800]}")
            f = [f for n in histo[ident]["outputs"].values() for f in n.get("audio", [])][0]
            return PORTABLE / "ComfyUI" / "output" / f.get("subfolder", "") / f["filename"]


def lire(f: Path, canaux: int, sr: int):
    import numpy as np
    brut = subprocess.run(["ffmpeg", "-v", "error", "-i", str(f), "-ac", str(canaux), "-ar", str(sr), "-f", "f32le", "-"],
                          capture_output=True, check=True).stdout
    return np.frombuffer(brut, dtype=np.float32)


def signal(brut: Path, fin: float) -> dict:
    """Écrêtage, trou de niveau et platitude spectrale (bruit) par fenêtres de 5 s, sur la partie jouée."""
    import librosa
    import numpy as np
    st = lire(brut, 2, 48000)
    ecrete = float((np.abs(st) > 0.985).mean()) * 100
    sr, saut = 24000, 1024
    x = lire(brut, 1, sr)[: int(fin * sr)]
    plat = librosa.feature.spectral_flatness(y=x, n_fft=2048, hop_length=saut)[0]
    rms = librosa.feature.rms(y=x, frame_length=2048, hop_length=saut)[0]
    fen = int(5 * sr / saut)
    bornes = range(0, len(rms) - fen, fen)
    p5 = [float(np.median(plat[i:i + fen])) for i in bornes]
    r5 = [float(20 * np.log10(np.mean(rms[i:i + fen]) + 1e-9)) for i in bornes]
    milieu = r5[2:-3] if len(r5) > 6 else r5      # ni l'attaque (10 s) ni la fin (15 s)
    mediane = float(np.median(r5))
    # coupure : plus longue suite de tranches de 250 ms à plus de COUPURE_DB sous la médiane, entre 10 s et la fin - 10 s
    n = int(0.25 * sr)
    r = np.array([20 * np.log10(np.sqrt((x[i:i + n] ** 2).mean()) + 1e-9) for i in range(0, len(x) - n, n)])
    plus_longue = suite = 0
    for bas in r[40:-40] < np.median(r) - COUPURE_DB:
        suite = suite + 1 if bas else 0
        plus_longue = max(plus_longue, suite)
    # blanc de boucle : temps avant le niveau plein (médiane - 12 dB) et queue sous médiane - 30 dB, en tranches de 50 ms
    n = int(0.05 * sr)
    r = np.array([20 * np.log10(np.sqrt((x[i:i + n] ** 2).mean()) + 1e-9) for i in range(0, len(x) - n, n)])
    intro = float(np.argmax(r > np.median(r) - 12)) * 0.05
    queue = float(np.argmax(r[::-1] > np.median(r) - 30)) * 0.05
    return {"ecrete_pct": round(ecrete, 4), "plat_med": round(float(np.median(p5)), 4), "plat_max": round(max(p5), 4),
            "trou_db": round(mediane - min(milieu), 1), "coupure_s": plus_longue * 0.25, "intro_s": round(intro, 2),
            "queue_s": round(queue, 2), "crete_brut": round(float(np.abs(st).max()), 3)}


def voix_isolee(modele, brut: Path) -> dict:
    """Demucs (deux pistes) : niveau de la voix isolée relatif au morceau, et Whisper sur cette voix seule."""
    dossier = BRUTS / "_demucs"
    subprocess.run([str(CLONE_PY), "-m", "demucs", "--two-stems=vocals", "-n", "htdemucs", "-o", str(dossier), str(brut)],
                   check=True, capture_output=True)
    voix = dossier / "htdemucs" / brut.stem / "vocals.wav"
    try:
        relatif = round(sonie(voix) - sonie(brut), 1)
        w = composer.chante(modele, voix)
    finally:
        shutil.rmtree(dossier / "htdemucs" / brut.stem, ignore_errors=True)
    return {"voix_isolee_lu": relatif, "voix_isolee": w["voix"], "mots_surs_isolee": w["mots_surs"], "extrait_isolee": w["extrait"][:80]}


def spectre(brut: Path, fin: float) -> None:
    CONTROLE.mkdir(parents=True, exist_ok=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-t", f"{fin:.2f}", "-i", str(brut), "-lavfi",
                    "showspectrumpic=s=1600x420:legend=1:fscale=log:scale=log:stop=12000", str(CONTROLE / f"{brut.stem}.png")], check=True)


def ecouter(modele, brut: Path) -> dict:
    fin = composer.vraie_fin(brut)
    m = {"fin_ace_s": round(fin, 1), **signal(brut, fin)}
    w = composer.chante(modele, brut)
    m.update({"voix": w["voix"], "mots_surs": w["mots_surs"], "extrait_whisper": w["extrait"][:80]})
    m.update(voix_isolee(modele, brut))
    spectre(brut, fin)
    defauts = []
    if m["voix"] or m["voix_isolee"]:
        defauts.append("voix")
    if fin < DUREE_MIN:
        defauts.append("trop court")
    if m["ecrete_pct"] > ECRETE_MAX_PCT:
        defauts.append("saturation")
    if m["trou_db"] > TROU_DB:
        defauts.append("trou")
    if m["coupure_s"] >= COUPURE_MAX_S:
        defauts.append("coupure")
    if m["intro_s"] > BLANC_MAX_S or m["queue_s"] > BLANC_MAX_S:
        defauts.append("blanc de boucle")
    if m["plat_max"] > PLAT_MAX:
        defauts.append("bouillie")
    m["defauts"] = defauts
    return m


def gravite(m: dict) -> tuple:
    """Pour garder le moins fautif quand aucun essai n'est propre : la voix d'abord, puis le nombre de défauts."""
    return ("voix" in m["defauts"], len(m["defauts"]), -m["fin_ace_s"])


def extrait(source: Path, cible: Path) -> None:
    cible.parent.mkdir(parents=True, exist_ok=True)
    fin_fondu = EXTRAIT_DUREE - 3.0
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{EXTRAIT_DEBUT}", "-t", f"{EXTRAIT_DUREE}", "-i", str(source),
                    "-af", f"afade=t=in:d=1,afade=t=out:st={fin_fondu}:d=3", "-ac", "1", "-ar", "44100", "-b:a", "128k", str(cible)], check=True)


def crete_vraie(f: Path) -> float:
    sortie = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(f), "-af", "ebur128=peak=true", "-f", "null", "-"],
                            capture_output=True, text=True, encoding="utf-8", errors="replace").stderr
    return float(re.findall(r"Peak:\s+(-?[\d.]+|-inf) dBFS", sortie)[-1])


def charger() -> dict:
    f = SORTIE / "catalogue.json"
    return {m["numero"]: m for m in json.loads(f.read_text(encoding="utf-8"))["morceaux"]} if f.exists() else {}


def ecrire(par_numero: dict) -> list:
    morceaux = [par_numero[n] for n in sorted(par_numero)]
    SORTIE.mkdir(parents=True, exist_ok=True)
    (SORTIE / "catalogue.json").write_text(json.dumps({
        "_note": "Proposition « papa » de musique des écrans de live, composée par composer_papa.py. Régénérable à l'identique "
                 "(style, BPM, tonalité, graine, durée demandée, marge). Rien n'est joué par OBS tant que le client n'a pas choisi.",
        "licence": composer.LICENCE, "duree_demandee_s": DUREE, "lufs_cible": LUFS, "marge_ace_db": MARGE_DB,
        "morceaux": morceaux}, ensure_ascii=False, indent=1), encoding="utf-8")
    return morceaux


def composer_morceau(modele, n: int, ecartees: list) -> tuple:
    """Essaie les graines suivantes jusqu'à un essai sans défaut ; rend (brut, graine, mesures, graines écartées)."""
    univers, ambiance, nom, style, bpm, tonalite = MORCEAUX[n - 1]
    deja = {e["graine"] for e in ecartees}
    essais = []
    for k in range(ESSAIS + len(deja)):
        graine = GRAINE_BASE + n + 1000 * k
        if graine in deja:
            continue
        if len(essais) >= ESSAIS:
            break
        sortie = generer(style, bpm, tonalite, graine)
        brut = BRUTS / f"{n:02d}_{nom}_graine{graine}{sortie.suffix}"
        brut.write_bytes(sortie.read_bytes())
        m = ecouter(modele, brut)
        print(f"{n:02d} {univers}/{ambiance} {nom} graine {graine} : fin {m['fin_ace_s']:.0f} s, écrêtage {m['ecrete_pct']} %, "
              f"platitude max {m['plat_max']}, trou {m['trou_db']} dB, voix {m['mots_surs']}/{m['mots_surs_isolee']} mots "
              f"(isolée {m['voix_isolee_lu']} LU) -> {', '.join(m['defauts']) or 'propre'}", flush=True)
        essais.append((brut, graine, m))
        if not m["defauts"]:
            break
        ecartees.append({"graine": graine, "raisons": m["defauts"]})
    brut, graine, m = min(essais, key=lambda e: gravite(e[2]))
    ecartees = [e for e in ecartees if e["graine"] != graine]
    return brut, graine, m, ecartees


def main() -> None:
    ffmpeg_dans_path()
    catalogue = charger()
    if "--extraits" in sys.argv:
        for m in catalogue.values():
            extrait(SORTIE / m["fichier"], SORTIE / m["extrait"])
        print(f"{len(catalogue)} extraits refaits dans {EXTRAITS}")
        return
    refaire = set()
    if "--refaire" in sys.argv:
        refaire = {int(x) for x in sys.argv[sys.argv.index("--refaire") + 1].split(",")}
    a_faire = [n for n in range(1, len(MORCEAUX) + 1) if n in refaire or n not in catalogue
               or catalogue[n]["nom"] != MORCEAUX[n - 1][2] or not (SORTIE / catalogue[n]["fichier"]).exists()]
    if not a_faire:
        print("rien à composer")
        return
    BRUTS.mkdir(parents=True, exist_ok=True)
    demarrer_comfy()
    modele = composer.modele_whisper()
    for n in a_faire:
        univers, ambiance, nom, style, bpm, tonalite = MORCEAUX[n - 1]
        ecartees = list(catalogue.get(n, {}).get("graines_ecartees", [])) if catalogue.get(n, {}).get("nom") == nom else []
        if n in refaire and n in catalogue:
            raison = sys.argv[sys.argv.index("--raison") + 1] if "--raison" in sys.argv else "écoute"
            ecartees.append({"graine": catalogue[n]["graine"], "raisons": [raison]})
        brut, graine, m, ecartees = composer_morceau(modele, n, ecartees)
        cible = SORTIE / univers / ambiance / f"{n:02d}_{nom}.mp3"
        d = composer.finaliser(brut, cible)
        ext = EXTRAITS / f"{univers}-{ambiance}.mp3"
        extrait(cible, ext)
        catalogue[n] = {"numero": n, "univers": univers, "ambiance": ambiance, "nom": nom,
                        "fichier": cible.relative_to(SORTIE).as_posix(), "extrait": ext.relative_to(SORTIE).as_posix(),
                        "style": f"instrumental, no vocals, {style}", "bpm": bpm, "tonalite": tonalite, "graine": graine,
                        "duree_s": d, "lufs": round(sonie(cible), 1), "crete_dbtp": round(crete_vraie(cible), 1),
                        "voix_detectee": m["voix"] or m["voix_isolee"], "mots_surs_whisper": m["mots_surs"],
                        "mots_surs_voix_isolee": m["mots_surs_isolee"], "voix_isolee_lu": m["voix_isolee_lu"],
                        "mesures_brut": {k: m[k] for k in ("fin_ace_s", "crete_brut", "ecrete_pct", "plat_med", "plat_max", "trou_db",
                                                           "coupure_s", "intro_s", "queue_s")},
                        "defauts": m["defauts"], "graines_ecartees": ecartees}
        print(f"  -> {cible.relative_to(SORTIE)}  {d:.0f} s  {catalogue[n]['lufs']} LUFS  {catalogue[n]['crete_dbtp']} dBTP", flush=True)
        ecrire(catalogue)
    print(f"terminé : {len(catalogue)} morceaux dans {SORTIE}")


if __name__ == "__main__":
    main()
