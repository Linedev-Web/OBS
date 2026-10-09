-- Lance le service des soutiens du live (obs/soutiens.mjs) quand OBS charge une collection des lives : il recueille
-- follows, abonnements et dons (widgets StreamElements, TikFinity) pour les écrans. Sans fenêtre (ShellExecute, caché).
-- S'il tourne déjà, la nouvelle copie s'arrête d'elle-même ; il s'arrête seul deux minutes après la fermeture d'OBS.
-- Ajouté aux trois collections par obs/generer.mjs (liste « scripts-tool »).
local ffi = require("ffi")

ffi.cdef[[
void* ShellExecuteA(void* fenetre, const char* operation, const char* fichier, const char* parametres, const char* dossier, int affichage);
]]
local shell32 = ffi.load("shell32")
local CACHE = 0

function script_description()
	return "Soutiens du live : lance obs/soutiens.mjs (follows, abonnements, dons pour les écrans de fin et les bandeaux)."
end

function script_load(settings)
	local dossier = script_path():gsub("/", "\\")
	shell32.ShellExecuteA(nil, "open", "node.exe", '"' .. dossier .. 'soutiens.mjs"', dossier, CACHE)
end
