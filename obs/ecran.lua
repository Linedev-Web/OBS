-- Live Roblox (2026-11-03) : fait suivre à la scène « Écran du moment » le dernier écran montré.
-- Quand la scène affichée est une scène d'écran (Roblox, Roblox Studio, BRYX Forge, Page web), seul l'élément
-- « Capture — <nom de la scène> » reste visible dans « Écran du moment » ; le Face à face et l'image TikTok, qui
-- montrent cette scène, suivent donc l'écran choisi au Stream Deck. Une autre scène (Pause, Questions…) ne change rien.
-- Ajouté à la seule collection Live — Roblox par obs/generer.mjs (liste « scripts-tool »).
local obs = obslua

local SCENE_ECRAN = "Écran du moment"
local PREFIXE = "Capture — "

function script_description()
	return "Live Roblox : « Écran du moment » montre le dernier écran choisi (Roblox, Studio, BRYX Forge, page web)."
end

local function suivre()
	local courante = obs.obs_frontend_get_current_scene()
	if courante == nil then return end
	local voulu = PREFIXE .. obs.obs_source_get_name(courante)
	obs.obs_source_release(courante)

	local source = obs.obs_get_source_by_name(SCENE_ECRAN)
	if source == nil then return end
	local scene = obs.obs_scene_from_source(source)
	local elements = obs.obs_scene_enum_items(scene)
	local trouve = false
	for _, el in ipairs(elements) do
		if obs.obs_source_get_name(obs.obs_sceneitem_get_source(el)) == voulu then trouve = true end
	end
	if trouve then
		for _, el in ipairs(elements) do
			obs.obs_sceneitem_set_visible(el, obs.obs_source_get_name(obs.obs_sceneitem_get_source(el)) == voulu)
		end
	end
	obs.sceneitem_list_release(elements)
	obs.obs_source_release(source)
end

local function evenement(ev)
	if ev == obs.OBS_FRONTEND_EVENT_SCENE_CHANGED or ev == obs.OBS_FRONTEND_EVENT_FINISHED_LOADING then suivre() end
end

function script_load(settings)
	obs.obs_frontend_add_event_callback(evenement)
end
