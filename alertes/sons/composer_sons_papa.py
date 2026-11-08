"""Sons d'alerte « papa » (proposition du 2026-11-08 : habillage chaleureux, familial, un peu malicieux ; le client avait
dit des transitions le 2026-10-16 : « ça casse les oreilles »). Sons courts et doux, une idée par alerte, sans impact de
basse. Proposition à écouter : les jingles joués aujourd'hui (alertes\\sons\\*.mp3) ne sont pas touchés.

    D:\\Stream\\Clone\\.venv\\Scripts\\python.exe composer_sons_papa.py           refait tous les sons
    D:\\Stream\\Clone\\.venv\\Scripts\\python.exe composer_sons_papa.py follow    refait seulement celui-là

Fait maison, en synthèse (numpy, scipy ; ni échantillon ni modèle) :
- kalimba, boîte à musique, clochettes, sonnette, vibraphone : synthèse modale (partiels inharmoniques qui décroissent,
  chacun à sa vitesse), petit bruit d'attaque filtré, résonance de la caisse ;
- ukulélé et guitare : corde pincée Karplus-Strong (retard fractionnaire, point de pincement, deux polarisations), caisse
  de résonance par réponse impulsionnelle ;
- piano feutré : synthèse additive (inharmonicité des cordes, trois cordes légèrement désaccordées, double décroissance,
  marteau feutré) ;
- pièce dans la tirelire : modes d'un disque métallique, rebonds de plus en plus rapprochés, résonance creuse de la tirelire ;
- un petit salon : réverbération synthétique (premières réflexions, queue de 0,3 à 0,55 s, plus courte dans les aigus).
Variantes du 2026-11-08 (un son par type d'alerte, table type → son dans ..\\sons-papa.json) : resub, gift, superchat,
yt-abonne, yt-membre et les linedev-* (pièce dans la tasse à café, touches de clavier, cloche de machine à écrire),
décrites en « couches » dans SONS ; les huit premiers sons gardent leur recette (et donc leur rendu) d'origine.
Finition : passe-haut 110 Hz (pas de basse), passe-bas doux 11 kHz, -16 LUFS, crêtes sous -1 dBTP (limiteur doux à
suréchantillonnage si besoin, 4 dB de réduction au plus, sinon le son reste un peu moins fort), mp3 192 k 48 kHz.
Tout est déterministe (graine par son) : catalogue.json garde les réglages pour les refaire à l'identique.
"""
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

import numpy as np
from scipy import signal as sg
from scipy.ndimage import minimum_filter1d

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
ICI = Path(__file__).resolve().parent
SORTIE = ICI / "_propositions_papa"
SR = 48000
LUFS = -16.0
CRETE_MAX = -1.0         # dBTP, mesuré sur le mp3
PLAFOND_LIMITEUR = -1.8  # dBTP visé avant l'encodage
REDUCTION_MAX_DB = 4.0
SALON = {"rt60_s": [0.55, 0.45, 0.28], "bandes_hz": [600, 4000], "predelai_s": 0.008,
         "reflexions": [[0.0045, 0.5], [0.0071, 0.38], [0.0113, 0.3], [0.0157, 0.22], [0.0213, 0.16]]}

# Instruments (rapports des partiels à la fondamentale, amplitudes, constantes de décroissance en s à 523 Hz)
KALIMBA = {"rapports": [1, 2.0, 3.0, 6.27, 17.55], "amps": [1, 0.08, 0.03, 0.22, 0.05], "taus": [0.55, 0.25, 0.12, 0.07, 0.018],
           "attaque_s": 0.0015, "battement_hz": 0.0, "justesse_cents": 3, "clic": {"db": -18, "bande_hz": [1500, 6000], "tau_s": 0.0025},
           "coup": {"db": -14, "modes": [[230, 1.0, 0.03], [480, 0.6, 0.02], [910, 0.3, 0.012]]}, "caisse": [[230, 1.2, 0.03], [480, 0.6, 0.02]]}
BOITE = {"rapports": [1, 2.0, 3.0, 5.93, 15.3], "amps": [1, 0.1, 0.04, 0.3, 0.08], "taus": [0.8, 0.35, 0.2, 0.09, 0.02], "attaque_s": 0.001,
         "battement_hz": 0.7, "justesse_cents": 3, "clic": {"db": -22, "bande_hz": [2000, 8000], "tau_s": 0.002},
         "coup": {"db": -22, "modes": [[520, 1.0, 0.02], [1100, 0.5, 0.015]]}, "caisse": [[520, 0.8, 0.02], [1100, 0.4, 0.015]]}
CLOCHETTE = {"rapports": [1, 2.0, 2.76, 4.07, 5.4], "amps": [1, 0.2, 0.3, 0.12, 0.05], "taus": [0.9, 0.45, 0.3, 0.15, 0.08],
             "attaque_s": 0.001, "battement_hz": 1.3, "justesse_cents": 4, "clic": {"db": -26, "bande_hz": [3000, 9000], "tau_s": 0.0015},
             "caisse": []}
CARILLON = {"rapports": [1, 2.756, 5.404, 8.933], "amps": [1, 0.16, 0.05, 0.015], "taus": [1.4, 0.3, 0.09, 0.04], "attaque_s": 0.0015,
            "battement_hz": 0.8, "justesse_cents": 0, "clic": {"db": -22, "bande_hz": [1500, 5000], "tau_s": 0.004},
            "coup": {"db": -16, "modes": [[300, 1.0, 0.02], [760, 0.4, 0.01]]}, "caisse": [[300, 0.5, 0.02]]}
VIBRA = {"rapports": [1, 4.0, 10.0], "amps": [1, 0.12, 0.03], "taus": [1.0, 0.18, 0.05], "attaque_s": 0.004, "battement_hz": 0.5,
         "justesse_cents": 2, "clic": {"db": -30, "bande_hz": [800, 3000], "tau_s": 0.004}, "caisse": []}
UKULELE = {"t60_s": 1.6, "douceur_hz": 3500, "pince": 0.2, "caisse": [[280, 1.5, 0.02], [440, 1.0, 0.015], [900, 0.5, 0.01], [2200, 0.3, 0.006]]}
GUITARE = {"t60_s": 3.2, "douceur_hz": 5000, "pince": 0.15, "caisse": [[100, 0.8, 0.04], [205, 1.5, 0.03], [390, 0.8, 0.02], [1500, 0.3, 0.005]]}
PIANO = {"inharmonicite": 0.00025, "frappe": 0.12, "feutre_hz": 2500, "detune_cents": 0.4, "tau_rapide_s": 0.6, "tau_lent_s": 3.5,
         "part_lente": 0.45, "attaque_s": 0.003, "marteau": {"db": -26, "bande_hz": [60, 800], "tau_s": 0.012}}
PIECE = {"modes_hz": [2380, 3910, 5560, 7350, 9100], "amps": [1, 0.7, 0.5, 0.3, 0.15], "taus": [0.22, 0.16, 0.11, 0.07, 0.05],
         "tirelire": [[620, 1.0, 0.05], [1180, 0.6, 0.035], [1900, 0.35, 0.025]]}
# Variantes du 2026-11-08 (types d'alerte restants) : tasse à café en céramique (linedev), petite cloche de machine à
# écrire (retour à la ligne, linedev), touche de clavier mécanique (linedev).
TASSE = [[1450, 1.0, 0.09], [2950, 0.5, 0.06], [4700, 0.3, 0.035]]
TIMBRE = {"rapports": [1, 1.5, 2.24, 2.92, 4.13], "amps": [1, 0.3, 0.4, 0.18, 0.08], "taus": [1.1, 0.6, 0.45, 0.25, 0.12],
          "attaque_s": 0.0008, "battement_hz": 2.5, "justesse_cents": 0, "clic": {"db": -24, "bande_hz": [3000, 9000], "tau_s": 0.0012},
          "caisse": []}
TOUCHE = {"modes": [[420, 1.0, 0.010], [1150, 0.6, 0.006], [2600, 0.35, 0.003]], "clac": 0.6, "bande_hz": [1500, 5500],
          "double_s": 0.016, "double_gain": 0.45}

# Une idée par alerte. Notes : (note, départ s, gain, panoramique -1..1).
SONS = {
    "follow": {"idee": "deux notes de kalimba qui montent, un clin d'oeil", "duree_s": 2.2, "graine": 11, "reverb": 0.22,
               "instrument": "kalimba", "notes": [["G5", 0.0, 0.75, -0.15], ["D6", 0.14, 1.0, 0.15]]},
    "abonnement": {"idee": "accord de do majeur au ukulélé, égrené vers l'aigu", "duree_s": 2.8, "graine": 12, "reverb": 0.2,
                   "instrument": "ukulele", "notes": [["C4", 0.0, 0.7, -0.3], ["E4", 0.07, 0.75, -0.15], ["G4", 0.14, 0.8, 0.0],
                                                      ["C5", 0.21, 0.9, 0.15], ["E5", 0.3, 1.0, 0.3]]},
    "don": {"idee": "une pièce tombe dans la tirelire et rebondit, puis une note joyeuse de vibraphone", "duree_s": 2.8, "graine": 13,
            "reverb": 0.2, "instrument": "pièce + vibraphone",
            "rebonds": [[0.0, 0.45, 0.15], [0.1, 1.0, 0.9], [0.24, 0.55, 0.5], [0.33, 0.32, 0.3], [0.39, 0.18, 0.18], [0.43, 0.1, 0.1]],
            "notes": [["C6", 0.62, 0.8, -0.1], ["E6", 0.638, 0.65, 0.1]]},
    "raid": {"idee": "sonnette de porte ding-dong : on a de la visite", "duree_s": 3.4, "graine": 14, "reverb": 0.24,
             "instrument": "carillon de porte", "notes": [["E5", 0.05, 1.0, -0.1], ["C5", 0.62, 0.95, 0.1]]},
    "bits": {"idee": "petites cloches qui montent en cascade", "duree_s": 2.3, "graine": 15, "reverb": 0.22, "instrument": "clochettes",
             "notes": [["C6", 0.0, 0.75, -0.4], ["E6", 0.07, 0.65, 0.3], ["G6", 0.14, 0.55, -0.2], ["A6", 0.21, 0.5, 0.4],
                       ["C7", 0.3, 0.45, 0.0]]},
    "pause": {"idee": "petite phrase de piano feutré « je re-viens », posée sur un accord", "duree_s": 3.6, "graine": 16, "reverb": 0.26,
              "instrument": "piano feutré", "notes": [["G4", 0.0, 0.6, 0.0], ["A4", 0.24, 0.62, 0.05], ["C5", 0.5, 0.75, 0.1],
                                                       ["C3", 0.5, 0.35, -0.2], ["G3", 0.52, 0.3, -0.1], ["E4", 0.54, 0.28, 0.0]]},
    "pause-enfant": {"idee": "trois notes de boîte à musique (mi, ré, do), la dernière avec son accord", "duree_s": 3.0, "graine": 17,
                     "reverb": 0.24, "instrument": "boîte à musique",
                     "notes": [["E6", 0.0, 0.8, -0.1], ["D6", 0.4, 0.75, 0.05], ["C6", 0.82, 0.85, 0.1], ["C5", 0.82, 0.35, -0.1],
                               ["G5", 0.83, 0.3, 0.0]]},
    "fin": {"idee": "petite cadence de guitare (do, ré, sol) qui conclut", "duree_s": 3.8, "graine": 18, "reverb": 0.2,
            "instrument": "guitare folk", "passe_haut_hz": 95,
            "accords": [{"depart": 0.0, "ecart_s": 0.014, "gain": 0.75, "notes": ["C3", "E3", "G3", "C4", "E4"]},
                        {"depart": 0.42, "ecart_s": 0.014, "gain": 0.8, "notes": ["D3", "A3", "D4", "F#4"]},
                        {"depart": 0.95, "ecart_s": 0.022, "gain": 0.95, "notes": ["G2", "B2", "D3", "G3", "D4", "G4"]}]},
    # --- Variantes du 2026-11-08 : un son par type d'alerte (table dans sons-papa.json), décrites en couches ---
    "resub": {"idee": "trois accords de ukulélé (do, fa, do), le dernier sonne longtemps : toujours là", "duree_s": 3.8, "graine": 19,
              "reverb": 0.2, "instrument": "ukulélé",
              "couches": [{"type": "grattes", "instrument": "ukulele", "accords": [
                  {"depart": 0.0, "ecart_s": 0.04, "gain": 0.55, "notes": ["C4", "E4", "G4", "C5"]},
                  {"depart": 0.38, "ecart_s": 0.04, "gain": 0.58, "notes": ["F4", "A4", "C5", "F5"]},
                  {"depart": 0.76, "ecart_s": 0.05, "gain": 0.7, "notes": ["C4", "E4", "G4", "C5", "E5"]}]}]},
    "gift": {"idee": "trois pièces tombent l'une après l'autre dans la tirelire, puis l'accord du ukulélé : des abonnements offerts",
             "duree_s": 3.2, "graine": 20, "reverb": 0.2, "instrument": "pièces + ukulélé",
             "couches": [{"type": "pieces", "corps": "tirelire", "gain": 0.26, "rebonds": [
                             [0.0, 0.2, 0.3], [0.08, 0.5, 1.0], [0.19, 0.22, 0.5],
                             [0.17, 0.2, 0.3], [0.25, 0.45, 0.9], [0.35, 0.2, 0.4],
                             [0.33, 0.2, 0.3], [0.41, 0.45, 0.9], [0.5, 0.2, 0.4]]},
                         {"type": "corde", "instrument": "ukulele", "notes": [["C4", 0.74, 0.65, -0.3], ["E4", 0.8, 0.7, -0.15],
                                                                              ["G4", 0.86, 0.75, 0.0], ["C5", 0.92, 0.85, 0.15],
                                                                              ["E5", 1.0, 0.95, 0.3]]}]},
    "superchat": {"idee": "une poignée de pièces, puis trois notes de vibraphone qui montent (sol, do, mi)", "duree_s": 3.2,
                  "graine": 21, "reverb": 0.22, "instrument": "pièces + vibraphone",
                  "couches": [{"type": "pieces", "corps": "tirelire", "gain": 0.45, "rebonds": [
                                  [0.0, 0.4, 0.15], [0.08, 1.0, 0.9], [0.18, 0.45, 0.4], [0.24, 0.2, 0.18],
                                  [0.12, 0.35, 0.1], [0.2, 0.8, 0.7], [0.3, 0.3, 0.25]]},
                              {"type": "modale", "instrument": "vibraphone", "normaliser": True,
                               "notes": [["G5", 0.5, 0.7, -0.2], ["C6", 0.63, 0.72, 0.0], ["E6", 0.76, 0.8, 0.2], ["C5", 0.76, 0.35, 0.0]]}]},
    "yt-abonne": {"idee": "trois notes de kalimba qui montent (sol, si, ré) : un de plus à table", "duree_s": 2.4, "graine": 22,
                  "reverb": 0.22, "instrument": "kalimba",
                  "couches": [{"type": "modale", "instrument": "kalimba",
                               "notes": [["G5", 0.0, 0.7, -0.2], ["B5", 0.12, 0.8, 0.0], ["D6", 0.24, 1.0, 0.2]]}]},
    "yt-membre": {"idee": "accord de sol au ukulélé, puis une note de kalimba qui pétille", "duree_s": 3.0, "graine": 23,
                  "reverb": 0.2, "instrument": "ukulélé + kalimba",
                  "couches": [{"type": "corde", "instrument": "ukulele", "notes": [["G4", 0.0, 0.7, -0.3], ["B4", 0.07, 0.75, -0.1],
                                                                                   ["D5", 0.14, 0.8, 0.1], ["G5", 0.21, 0.9, 0.3]]},
                              {"type": "modale", "instrument": "kalimba", "normaliser": True, "notes": [["D6", 0.42, 0.7, 0.0]]}]},
    "linedev-abonne": {"idee": "trois touches de clavier, puis la petite cloche du retour à la ligne", "duree_s": 2.4, "graine": 24,
                       "reverb": 0.18, "instrument": "clavier + cloche de machine à écrire",
                       "couches": [{"type": "touches", "frappes": [[0.0, 0.55, -0.2], [0.1, 0.5, 0.0], [0.19, 0.6, 0.15]]},
                                   {"type": "modale", "instrument": "timbre", "normaliser": True, "notes": [["E6", 0.34, 0.8, 0.1]]}]},
    "linedev-membre": {"idee": "accord de do au ukulélé, puis la petite cloche du retour à la ligne", "duree_s": 3.0, "graine": 25,
                       "reverb": 0.2, "instrument": "ukulélé + cloche de machine à écrire",
                       "couches": [{"type": "corde", "instrument": "ukulele", "notes": [["C4", 0.0, 0.7, -0.3], ["E4", 0.07, 0.75, -0.15],
                                                                                        ["G4", 0.14, 0.8, 0.0], ["C5", 0.21, 0.9, 0.15]]},
                                   {"type": "modale", "instrument": "timbre", "normaliser": True, "notes": [["G6", 0.5, 0.55, 0.2]]}]},
    "linedev-tip": {"idee": "une pièce tombe dans la tasse à café, puis une note de vibraphone : le café est offert", "duree_s": 2.8,
                    "graine": 26, "reverb": 0.2, "instrument": "pièce dans une tasse + vibraphone",
                    "couches": [{"type": "pieces", "corps": "tasse", "gain": 0.5, "rebonds": [
                                    [0.0, 0.4, 0.15], [0.09, 1.0, 0.9], [0.2, 0.5, 0.45], [0.28, 0.28, 0.25], [0.33, 0.15, 0.12],
                                    [0.36, 0.08, 0.06]]},
                                {"type": "modale", "instrument": "vibraphone", "normaliser": True,
                                 "notes": [["D6", 0.58, 0.8, -0.1], ["A6", 0.598, 0.55, 0.1]]}]},
    "linedev-superchat": {"idee": "deux pièces dans la tasse, puis trois notes de vibraphone (la, ré, fa dièse)", "duree_s": 3.2,
                          "graine": 27, "reverb": 0.22, "instrument": "pièces dans une tasse + vibraphone",
                          "couches": [{"type": "pieces", "corps": "tasse", "gain": 0.45, "rebonds": [
                                          [0.0, 0.4, 0.15], [0.08, 1.0, 0.9], [0.18, 0.45, 0.4], [0.24, 0.2, 0.18],
                                          [0.12, 0.35, 0.1], [0.2, 0.8, 0.7], [0.3, 0.3, 0.25]]},
                                      {"type": "modale", "instrument": "vibraphone", "normaliser": True,
                                       "notes": [["A5", 0.5, 0.7, -0.2], ["D6", 0.63, 0.72, 0.0], ["F#6", 0.76, 0.8, 0.2]]}]},
}


def hz(nom: str) -> float:
    m = re.fullmatch(r"([A-G])([#b]?)(-?\d)", nom)
    demi = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}[m[1]] + {"#": 1, "b": -1, "": 0}[m[2]]
    return 440.0 * 2 ** ((demi + 12 * (int(m[3]) + 1) - 69) / 12)


def axe(duree: float) -> np.ndarray:
    return np.arange(int(duree * SR)) / SR


def souffle(duree: float, tau: float, bande: list, rng) -> np.ndarray:
    """Petit bruit filtré qui décroît vite (doigt, marteau, picot) ; crête 1."""
    t = axe(duree)
    x = sg.sosfilt(sg.butter(2, bande, btype="band", fs=SR, output="sos"), rng.standard_normal(len(t)) * np.exp(-t / tau))
    return x / (np.abs(x).max() + 1e-12)


def caisse(x: np.ndarray, modes: list) -> np.ndarray:
    """Résonances d'une caisse : chemin direct + sinusoïdes amorties (gain au pic ≈ amplitude donnée)."""
    if not modes:
        return x
    t = axe(0.3)
    ri = np.zeros_like(t)
    ri[0] = 1.0
    for f, a, tau in modes:
        ri += (2 * a / (tau * SR)) * np.exp(-t / tau) * np.sin(2 * np.pi * f * t)
    return sg.fftconvolve(x, ri)[: len(x)]


def modale(f0: float, inst: dict, duree: float, rng) -> np.ndarray:
    """Barre, lame, cloche : partiels inharmoniques amortis, les aigus et les notes hautes s'éteignent plus vite."""
    t = axe(duree)
    x = np.zeros_like(t)
    echelle = (523.25 / f0) ** 0.4
    f0 = f0 * 2 ** (rng.uniform(-1, 1) * inst["justesse_cents"] / 1200)   # pas deux notes exactement pareilles
    for r, a, tau in zip(inst["rapports"], inst["amps"], inst["taus"]):
        f = f0 * r
        if f > 0.42 * SR:
            continue
        x += a * np.exp(-t / (tau * echelle)) * np.sin(2 * np.pi * f * t)
        if inst["battement_hz"]:
            x += 0.3 * a * np.exp(-t / (tau * echelle * 0.9)) * np.sin(2 * np.pi * (f + inst["battement_hz"]) * t + rng.uniform(0, 6.28))
    x *= 1 - np.exp(-t / inst["attaque_s"])
    crete = np.abs(x).max()
    c = inst["clic"]
    x += 10 ** (c["db"] / 20) * souffle(duree, c["tau_s"], c["bande_hz"], rng) * crete
    if "coup" in inst:      # petit coup sourd du bois (ou du poussoir de la sonnette) au moment où l'on frappe
        coup = sum(a * np.exp(-t / tau) * np.sin(2 * np.pi * f * t) for f, a, tau in inst["coup"]["modes"]) * (1 - np.exp(-t / 0.0006))
        x += 10 ** (inst["coup"]["db"] / 20) * crete * coup / (np.abs(coup).max() + 1e-12)
    return caisse(x, inst["caisse"])


def corde_ks(f0: float, duree: float, t60: float, douceur: float, pince: float, rng) -> np.ndarray:
    """Karplus-Strong : retard M + filtre à 3 coefficients (moyenne + interpolation fractionnaire), calculé par blocs de M."""
    n = int(duree * SR)
    d = SR / f0
    m = int(np.floor(d - 0.5))
    frac = d - 0.5 - m
    c = np.array([0.5 * (1 - frac), 0.5, 0.5 * frac])
    w = 2 * np.pi * f0 / SR
    perte = abs(c[0] + c[1] * np.exp(-1j * w) + c[2] * np.exp(-2j * w))
    rho = min(10 ** (-3 / (t60 * f0)) / perte, 0.99995)
    e = sg.sosfilt(sg.butter(1, douceur, fs=SR, output="sos"), rng.uniform(-1, 1, m + 3))
    k = max(1, int(pince * m))
    e = e - np.concatenate([np.zeros(k), e[:-k]])
    e -= e.mean()
    p = m + 2
    y = np.zeros(p + n)
    x = np.zeros(p + n)
    x[p:p + len(e)] = e[: n]
    s = p
    while s < p + n:
        lg = min(m, p + n - s)
        y[s:s + lg] = x[s:s + lg] + rho * (c[0] * y[s - m:s - m + lg] + c[1] * y[s - m - 1:s - m - 1 + lg] + c[2] * y[s - m - 2:s - m - 2 + lg])
        s += lg
    return y[p:]


def corde(f0: float, inst: dict, duree: float, rng) -> np.ndarray:
    """Deux polarisations légèrement désaccordées, les cordes graves sonnent plus longtemps, puis la caisse."""
    t60 = inst["t60_s"] * (261.63 / f0) ** 0.3
    a = corde_ks(f0 * 0.9996, duree, t60, inst["douceur_hz"], inst["pince"], rng)
    b = corde_ks(f0 * 1.0004, duree, t60 * 0.8, inst["douceur_hz"], inst["pince"], rng)
    x = a + 0.6 * b
    return caisse(x / (np.abs(x).max() + 1e-12), inst["caisse"])


def piano(f0: float, duree: float, rng) -> np.ndarray:
    """Piano feutré : partiels f_n = n f0 √(1 + B n²), point de frappe à 1/8, feutre (aigus atténués), trois cordes."""
    pr, t = PIANO, axe(duree)
    b = pr["inharmonicite"] * (f0 / 261.63) ** 0.5
    hauteur = (261.63 / f0) ** 0.5
    x = np.zeros_like(t)
    for n in range(1, 24):
        fn = n * f0 * np.sqrt(1 + b * n * n)
        if fn > 9000:
            break
        a = abs(np.sin(np.pi * n * pr["frappe"])) / n ** 1.6 * np.exp(-fn / pr["feutre_hz"])
        env = (1 - pr["part_lente"]) * np.exp(-t / (pr["tau_rapide_s"] * hauteur / (1 + 0.25 * n))) + \
            pr["part_lente"] * np.exp(-t / (pr["tau_lent_s"] * hauteur / (1 + 0.4 * n)))
        for cents in (-pr["detune_cents"], 0.0, pr["detune_cents"]):
            x += a / 3 * env * np.sin(2 * np.pi * fn * 2 ** (cents / 1200) * t + rng.uniform(0, 2 * np.pi))
    x *= 1 - np.exp(-t / pr["attaque_s"])
    mt = pr["marteau"]
    x += 10 ** (mt["db"] / 20) * np.abs(x).max() * souffle(duree, mt["tau_s"], mt["bande_hz"], rng)
    return x


def piece(force: float, corps: float, duree: float, rng, resonance: list | None = None) -> np.ndarray:
    """Un choc de la pièce : ses modes (un peu différents à chaque rebond) + la résonance creuse de la tirelire
    (ou de la tasse à café, `resonance=TASSE`)."""
    t = axe(duree)
    x = np.zeros_like(t)
    for f, a, tau in zip(PIECE["modes_hz"], PIECE["amps"], PIECE["taus"]):
        x += a * rng.uniform(0.7, 1.0) * np.exp(-t / tau) * np.sin(2 * np.pi * f * rng.uniform(0.99, 1.01) * t)
    x *= 1 - np.exp(-t / 0.0004)
    x += 0.25 * souffle(duree, 0.0015, [2000, 8000], rng)
    x = force * x
    for f, a, tau in (resonance or PIECE["tirelire"]):     # « tonk » creux, seulement quand la pièce touche le fond
        x += corps * 0.6 * a * np.exp(-t / tau) * np.sin(2 * np.pi * f * rng.uniform(0.98, 1.02) * t) * (1 - np.exp(-t / 0.0008))
    return x


def touche(duree: float, rng) -> np.ndarray:
    """Touche de clavier mécanique : petit « clac » de bruit filtré + corps de la touche, puis le fond de course juste après."""
    t = axe(duree)
    corps = sum(a * np.exp(-t / tau) * np.sin(2 * np.pi * f * rng.uniform(0.97, 1.03) * t) for f, a, tau in TOUCHE["modes"])
    corps = corps * (1 - np.exp(-t / 0.0004))
    x = corps / (np.abs(corps).max() + 1e-12) + TOUCHE["clac"] * souffle(duree, 0.0035, TOUCHE["bande_hz"], rng)
    d = int(TOUCHE["double_s"] * SR)
    x[d:] += TOUCHE["double_gain"] * x[:-d].copy()
    return x / (np.abs(x).max() + 1e-12)


def poser(buf: np.ndarray, x: np.ndarray, t: float, gain: float = 1.0, pan: float = 0.0) -> None:
    i = int(t * SR)
    n = min(len(x), buf.shape[1] - i)
    angle = (pan + 1) * np.pi / 4
    buf[0, i:i + n] += gain * np.cos(angle) * x[:n]
    buf[1, i:i + n] += gain * np.sin(angle) * x[:n]


def salon(rng) -> np.ndarray:
    """Réponse impulsionnelle stéréo d'un petit salon, énergie unité."""
    t = axe(1.0)
    ri = np.zeros((2, len(t)))
    bas, haut = SALON["bandes_hz"]
    filtres = [sg.butter(2, bas, "low", fs=SR, output="sos"), sg.butter(2, [bas, haut], "band", fs=SR, output="sos"),
               sg.butter(2, haut, "high", fs=SR, output="sos")]
    for k in range(2):
        for sos, rt in zip(filtres, SALON["rt60_s"]):
            ri[k] += sg.sosfilt(sos, rng.standard_normal(len(t))) * 10 ** (-3 * t / rt)
        ri[k] *= np.clip((t - SALON["predelai_s"]) / 0.02, 0, 1)
        for d, g in SALON["reflexions"]:
            ri[k, int((d + 0.0007 * k) * SR)] += g * rng.choice([-1.0, 1.0]) * 6
    return ri / np.sqrt((ri ** 2).sum() / 2)


def reverberer(buf: np.ndarray, part: float, rng) -> np.ndarray:
    ri = salon(rng)
    mono = buf.mean(0)
    mouille = np.stack([sg.fftconvolve(mono, ri[k])[: buf.shape[1]] for k in range(2)])
    seche = np.sqrt((buf ** 2).mean()) + 1e-12
    return buf + part * mouille * seche / (np.sqrt((mouille ** 2).mean()) + 1e-12)


# --- Les sons ------------------------------------------------------------------------------------------------------

def jouer_modale(r: dict, inst: dict, buf: np.ndarray, rng) -> None:
    for note, t0, g, pan in r["notes"]:
        poser(buf, modale(hz(note), inst, r["duree_s"] - t0, rng), t0, g, pan)


MODALES = {"kalimba": KALIMBA, "boite": BOITE, "clochette": CLOCHETTE, "carillon": CARILLON, "vibraphone": VIBRA, "timbre": TIMBRE}
CORDES = {"ukulele": UKULELE, "guitare": GUITARE}
CORPS = {"tirelire": PIECE["tirelire"], "tasse": TASSE}


def grattes(r: dict, accords: list, inst: dict, buf: np.ndarray, rng) -> None:
    """Accords grattés : chaque corde à son tour, la main étouffe l'accord précédent quand le suivant part."""
    for i, a in enumerate(accords):
        fin_accord = accords[i + 1]["depart"] + 0.02 if i + 1 < len(accords) else r["duree_s"]
        for j, note in enumerate(a["notes"]):
            t0 = a["depart"] + j * a["ecart_s"]
            x = corde(hz(note), inst, r["duree_s"] - t0, rng)
            t = axe(len(x) / SR) + t0
            x = x * np.clip(1 - (t - fin_accord) / 0.04, 0, 1)
            poser(buf, x, t0, a["gain"] * (0.7 + 0.3 * j / len(a["notes"])), -0.35 + 0.7 * j / len(a["notes"]))


def couches(r: dict, buf: np.ndarray, rng) -> None:
    """Variantes du 2026-11-08 : le son est une suite de couches (notes, cordes, accords, pièces, touches)."""
    for c in r["couches"]:
        reste = lambda t0: r["duree_s"] - t0   # noqa: E731
        if c["type"] == "modale":
            for note, t0, g, pan in c["notes"]:
                x = modale(hz(note), MODALES[c["instrument"]], reste(t0), rng)
                poser(buf, x / (np.abs(x).max() + 1e-12) if c.get("normaliser") else x, t0, g, pan)
        elif c["type"] == "corde":
            for note, t0, g, pan in c["notes"]:
                poser(buf, corde(hz(note), CORDES[c["instrument"]], reste(t0), rng), t0, g, pan)
        elif c["type"] == "grattes":
            grattes(r, c["accords"], CORDES[c["instrument"]], buf, rng)
        elif c["type"] == "pieces":
            for t0, force, corps in c["rebonds"]:
                poser(buf, piece(force, corps, reste(t0), rng, CORPS[c["corps"]]), t0, c.get("gain", 0.5), rng.uniform(-0.15, 0.15))
        elif c["type"] == "touches":
            for t0, g, pan in c["frappes"]:
                poser(buf, touche(reste(t0), rng), t0, g, pan)
        else:
            sys.exit(f"couche inconnue : {c['type']}")


def son(nom: str) -> np.ndarray:
    r = SONS[nom]
    rng = np.random.default_rng(r["graine"])
    buf = np.zeros((2, int(r["duree_s"] * SR)))
    if "couches" in r:
        couches(r, buf, rng)
    elif nom == "follow":
        jouer_modale(r, KALIMBA, buf, rng)
    elif nom == "pause-enfant":
        jouer_modale(r, BOITE, buf, rng)
    elif nom == "bits":
        jouer_modale(r, CLOCHETTE, buf, rng)
    elif nom == "raid":
        jouer_modale(r, CARILLON, buf, rng)
    elif nom == "abonnement":
        for note, t0, g, pan in r["notes"]:
            poser(buf, corde(hz(note), UKULELE, r["duree_s"] - t0, rng), t0, g, pan)
    elif nom == "pause":
        for note, t0, g, pan in r["notes"]:
            x = piano(hz(note), r["duree_s"] - t0, rng)
            poser(buf, x / (np.abs(x).max() + 1e-12), t0, g, pan)
    elif nom == "don":
        for t0, force, corps in r["rebonds"]:
            poser(buf, piece(force, corps, r["duree_s"] - t0, rng), t0, 0.5, rng.uniform(-0.15, 0.15))
        for note, t0, g, pan in r["notes"]:
            x = modale(hz(note), VIBRA, r["duree_s"] - t0, rng)
            poser(buf, x / (np.abs(x).max() + 1e-12), t0, g, pan)
    elif nom == "fin":
        accords = r["accords"]
        for i, a in enumerate(accords):
            fin_accord = accords[i + 1]["depart"] + 0.02 if i + 1 < len(accords) else r["duree_s"]
            for j, note in enumerate(a["notes"]):
                t0 = a["depart"] + j * a["ecart_s"]
                x = corde(hz(note), GUITARE, r["duree_s"] - t0, rng)
                t = axe(len(x) / SR) + t0
                x = x * np.clip(1 - (t - fin_accord) / 0.04, 0, 1)   # la main gauche étouffe l'accord précédent
                poser(buf, x, t0, a["gain"] * (0.7 + 0.3 * j / len(a["notes"])), -0.35 + 0.7 * j / len(a["notes"]))
    return reverberer(buf, r["reverb"], rng)


# --- Finition -------------------------------------------------------------------------------------------------------

def ffmpeg_dans_path() -> None:
    """Le PATH du client pointait encore vers ffmpeg-8.1 après la mise à jour WinGet en 9.0.1 (2026-11-08)."""
    if shutil.which("ffmpeg"):
        return
    for d in sorted(Path(os.environ.get("LOCALAPPDATA", ""), "Microsoft", "WinGet", "Packages").glob("Gyan.FFmpeg*/ffmpeg-*/bin"), reverse=True):
        if (d / "ffmpeg.exe").exists():
            os.environ["PATH"] = str(d) + os.pathsep + os.environ["PATH"]
            return
    sys.exit("ffmpeg introuvable")


def mesurer(f: Path) -> tuple[float, float]:
    """Sonie intégrée (LUFS) et crête vraie (dBTP), par ffmpeg ebur128."""
    sortie = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(f), "-af", "ebur128=peak=true", "-f", "null", "-"],
                            capture_output=True, text=True, encoding="utf-8", errors="replace").stderr
    return float(re.findall(r"I:\s+(-?[\d.]+) LUFS", sortie)[-1]), float(re.findall(r"Peak:\s+(-?[\d.]+|-inf) dBFS", sortie)[-1])


def ecrire(st: np.ndarray, cible: Path, options: list) -> None:
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", "-"] + options + [str(cible)],
                   input=np.ascontiguousarray(st.T, dtype=np.float32).tobytes(), check=True)


def crete_db(st: np.ndarray) -> float:
    return float(20 * np.log10(np.abs(sg.resample_poly(st, 4, 1, axis=1)).max() + 1e-12))


def limiter(st: np.ndarray, plafond_db: float) -> tuple[np.ndarray, float]:
    """Limiteur doux : crêtes suréchantillonnées x4, anticipation 2 ms, relâche 80 ms. Rend aussi la réduction maximale."""
    seuil = 10 ** (plafond_db / 20)
    sur = np.abs(sg.resample_poly(st, 4, 1, axis=1)).max(0)
    pic = sur[: 4 * st.shape[1]].reshape(-1, 4).max(1)
    g = np.minimum(1.0, seuil / np.maximum(pic, 1e-12))
    a = int(0.002 * SR)
    g = minimum_filter1d(g, 2 * a + 1)
    g = np.convolve(g, np.ones(a + 1) / (a + 1), mode="same")
    coef = np.exp(-1 / (0.08 * SR))
    for i in range(1, len(g)):
        if g[i] > g[i - 1]:
            g[i] = g[i - 1] * coef + g[i] * (1 - coef)
    return st * g, float(-20 * np.log10(g.min()))


def finir(st: np.ndarray, r: dict, travail: Path) -> tuple[np.ndarray, float]:
    st = sg.sosfilt(sg.butter(2, r.get("passe_haut_hz", 110), "high", fs=SR, output="sos"), st, axis=1)
    st = sg.sosfilt(sg.butter(2, 11000, "low", fs=SR, output="sos"), st, axis=1)
    n = st.shape[1]
    fondu = int(0.3 * SR)
    st[:, n - fondu:] *= 0.5 * (1 + np.cos(np.linspace(0, np.pi, fondu)))
    st[:, : int(0.002 * SR)] *= np.linspace(0, 1, int(0.002 * SR))
    cible, reduction = LUFS, 0.0
    for _ in range(4):
        ecrire(st, travail, ["-c:a", "pcm_f32le"])   # flottant : le son brut dépasse 1,0 avant normalisation
        lufs, _ = mesurer(travail)
        st = st * 10 ** ((cible - lufs) / 20)
        if crete_db(st) <= PLAFOND_LIMITEUR:
            break
        st_lim, reduction = limiter(st, PLAFOND_LIMITEUR)
        if reduction > REDUCTION_MAX_DB:     # trop de crête pour ce son : on le laisse un peu moins fort plutôt que l'écraser
            cible -= reduction - REDUCTION_MAX_DB
            continue
        st = st_lim
        ecrire(st, travail, ["-c:a", "pcm_f32le"])   # flottant : le son brut dépasse 1,0 avant normalisation
        if abs(mesurer(travail)[0] - cible) < 0.3:
            break
    return st, reduction


def analyser(st: np.ndarray) -> dict:
    """Ce qui compte pour les oreilles : part d'énergie sous 150 Hz, centre de gravité du spectre."""
    mono = st.mean(0)
    spectre = np.abs(np.fft.rfft(mono)) ** 2
    f = np.fft.rfftfreq(len(mono), 1 / SR)
    return {"part_sous_150hz_pct": round(100 * float(spectre[f < 150].sum() / spectre.sum()), 2),
            "centroide_hz": round(float((f * spectre).sum() / spectre.sum()))}


def main() -> None:
    ffmpeg_dans_path()
    SORTIE.mkdir(parents=True, exist_ok=True)
    travail = SORTIE / "_travail.wav"
    noms = [a for a in sys.argv[1:] if a in SONS] or list(SONS)
    fichier_cat = SORTIE / "catalogue.json"
    catalogue = {s["nom"]: s for s in json.loads(fichier_cat.read_text(encoding="utf-8"))["sons"]} if fichier_cat.exists() else {}
    for nom in noms:
        r = SONS[nom]
        st, reduction = finir(son(nom), r, travail)
        cible = SORTIE / f"{nom}.mp3"
        ecrire(st, cible, ["-ar", str(SR), "-b:a", "192k"])
        lufs, tp = mesurer(cible)
        if tp > CRETE_MAX:                    # l'encodage mp3 a fait monter une crête : on baisse d'autant
            st = st * 10 ** ((CRETE_MAX - 0.3 - tp) / 20)
            ecrire(st, cible, ["-ar", str(SR), "-b:a", "192k"])
            lufs, tp = mesurer(cible)
        duree = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(cible)],
                                     capture_output=True, text=True).stdout)
        catalogue[nom] = {"nom": nom, "fichier": cible.name, "idee": r["idee"], "methode": f"synthèse ({r.get('instrument', '')})",
                          "duree_s": round(duree, 2), "lufs": round(lufs, 1), "crete_dbtp": round(tp, 1),
                          "reduction_limiteur_db": round(reduction, 1), **analyser(st), "reglages": r}
        print(f"{nom:13s} {duree:.2f} s  {lufs:.1f} LUFS  {tp:.1f} dBTP  limiteur {reduction:.1f} dB  "
              f"grave {catalogue[nom]['part_sous_150hz_pct']} %  centroïde {catalogue[nom]['centroide_hz']} Hz", flush=True)
    travail.unlink(missing_ok=True)
    instruments = {"kalimba": KALIMBA, "boite_a_musique": BOITE, "clochette": CLOCHETTE, "carillon": CARILLON, "vibraphone": VIBRA,
                   "ukulele": UKULELE, "guitare": GUITARE, "piano_feutre": PIANO, "piece_tirelire": PIECE, "tasse": TASSE,
                   "cloche_machine_a_ecrire": TIMBRE, "touche_clavier": TOUCHE, "salon": SALON}
    fichier_cat.write_text(json.dumps({
        "_note": "Sons d'alerte « papa » (proposition, 2026-11-08), faits par composer_sons_papa.py, en synthèse, sans échantillon "
                 "ni modèle : déterministes (graine par son), refaits à l'identique avec les réglages ci-dessous.",
        "licence": "Synthèse maison, aucun élément tiers : libre de tout usage.",
        "lufs_cible": LUFS, "crete_max_dbtp": CRETE_MAX, "format": "mp3 192 k, 48 kHz, stéréo", "instruments": instruments,
        "sons": [catalogue[n] for n in SONS if n in catalogue]}, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"catalogue : {fichier_cat}")


if __name__ == "__main__":
    main()
