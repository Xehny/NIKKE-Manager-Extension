const API_BASE = "https://api.blablalink.com/api/game/proxy/Game";

const SLOTS = [
    { prefix: "head", name: "Helmet" },
    { prefix: "torso", name: "Chest" },
    { prefix: "arm", name: "Gloves" },
    { prefix: "leg", name: "Combat Boots" },
];

const STAT_NAMES = {
    IncElementDmg: "Element DMG",
    StatAccuracyCircle: "Hit Rate",
    StatAtk: "ATK",
    StatChargeDamage: "Charge DMG",
    StatCritical: "Critical Rate",
    StatCriticalDamage: "Critical DMG",
    StatChargeTime: "Charge Speed",
    StatAmmoLoad: "Max Ammo",
    StatDef: "DEF",
};

function setStatus(status, detail) {
    chrome.storage.local.set({ status, statusDetail: detail ?? "" });
}

function buildNameMap(data) {
    const map = {};
    for (const n of data) {
        if (n.name_code && n.name_localkey?.name) {
            map[n.name_code] = { name: n.name_localkey.name, resourceId: n.resource_id };
        }
    }
    return map;
}

function processDetails(details, characters, nameMap) {
    const charLookup = {};
    for (const c of characters) {
        charLookup[c.name_code] = c;
    }

    const effectLookup = {};
    for (const se of details.state_effects) {
        const fd = se.function_details?.[0];
        if (!fd) continue;
        const statName = STAT_NAMES[fd.function_type] ?? fd.function_type;
        const value = parseFloat((Math.abs(fd.function_value) / 100).toFixed(2));
        effectLookup[String(se.id)] = { statName, value, display: `${value}%` };
    }

    const result = {};
    for (const detail of details.character_details) {
        const entry = nameMap[detail.name_code];
        const resourceId = String(entry?.resourceId ?? detail.name_code);
        const nikkeName = entry?.name ?? `Nikke${detail.name_code}`;
        const char = charLookup[detail.name_code] ?? {};
        const nikkeData = {
            name: nikkeName,
            level: char.lv ?? 0,
            power: char.combat ?? 0,
            bond: detail.attractive_lv ?? 0,
            cores: char.core ?? 0,
            limitBreak: char.grade ?? 0,
            skill1: detail.skill1_lv ?? 1,
            skill2: detail.skill2_lv ?? 1,
            ultiSkill: detail.ulti_skill_lv ?? 1,
            cube: detail.harmony_cube_tid ? { tid: detail.harmony_cube_tid, lv: detail.harmony_cube_lv ?? 0 } : null,
            doll: detail.favorite_item_tid ? { tid: detail.favorite_item_tid, lv: detail.favorite_item_lv ?? 0 } : null,
        };

        for (const slot of SLOTS) {
            if (!detail[`${slot.prefix}_equip_tid`]) continue;
            const lines = [null, null, null];
            for (let i = 1; i <= 3; i++) {
                const rawId = detail[`${slot.prefix}_equip_option${i}_id`];
                if (!rawId) continue;
                const effect = effectLookup[String(rawId)];
                if (!effect) continue;
                lines[i - 1] = { stat: effect.statName, value: effect.value, display: effect.display };
            }
            nikkeData[slot.name] = {
                lv: detail[`${slot.prefix}_equip_lv`] ?? 0,
                tier: detail[`${slot.prefix}_equip_tier`] ?? 0,
                lines,
            };
        }

        result[resourceId] = nikkeData;
    }

    return result;
}

// Runs inside the blablalink.com page context - fetch calls use the page origin
async function scrapeInPage(apiBase) {
    const headers = {
        "content-type": "application/json",
        "x-channel-type": "2",
        "x-language": "en",
        "x-common-params": JSON.stringify({
            game_id: "16",
            area_id: "global",
            source: "pc_web",
            intl_game_id: "29080",
            language: "en",
            env: "prod",
        }),
    };

    async function post(endpoint, body) {
        const resp = await fetch(`${apiBase}/${endpoint}`, {
            method: "POST",
            credentials: "include",
            headers,
            body: JSON.stringify(body),
        });
        return resp.json();
    }

    const info = JSON.parse(localStorage.getItem("lip-user-info") || "{}");
    if (!info.openid) return { error: "not_logged_in" };

    const roleResp = await fetch(`${apiBase}/GetSavedRoleInfo`, { credentials: "include", headers });
    const roleData = await roleResp.json();
    const nikkeAreaId = parseInt(roleData.data?.role_info?.area_id ?? "82", 10);

    // Retry GetUserCharacters - after cookie clearing, CheckLogin may still be in flight.
    // "Inner token is invalid[3]" means cookies aren't ready yet; wait and try again.
    // "request too frequently" is a server-side rate limit hit when the first attempt lands
    // while the page's own CheckLogin request is also in flight; retry clears it.
    let chars;
    for (let attempt = 0; attempt < 6; attempt++) {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 2000));
        chars = await post("GetUserCharacters", {
            intl_open_id: info.openid,
            nikke_area_id: nikkeAreaId,
        });
        const msg = String(chars.msg ?? "").toLowerCase();
        const isTransient = msg.includes("inner token") || msg.includes("too frequent");
        if (chars.code === 0 || !isTransient) break;
    }
    if (chars.code !== 0) {
        const innerTokenFailed = String(chars.msg ?? "").includes("Inner token");
        return { error: innerTokenFailed ? "not_logged_in" : `GetUserCharacters: ${chars.msg}` };
    }

    const details = await post("GetUserCharacterDetails", {
        intl_open_id: info.openid,
        nikke_area_id: nikkeAreaId,
        name_codes: chars.data.characters.map((c) => c.name_code),
    });
    if (details.code !== 0) return { error: `GetUserCharacterDetails: ${details.msg}` };

    // Fetch the CDN name map from within the page context (correct origin, same as Playwright)
    let nameMapData = null;
    const cdnUrls = performance
        .getEntriesByType("resource")
        .map((e) => e.name)
        .filter((u) => u.includes("sg-tools-cdn.blablalink.com"));

    for (const url of cdnUrls) {
        try {
            const resp = await fetch(url);
            if (!resp.ok) continue;
            const data = await resp.json();
            if (Array.isArray(data) && data[0]?.name_code && data[0]?.name_localkey) {
                nameMapData = data;
                break;
            }
        } catch {}
    }

    return { details: details.data, characters: chars.data.characters, nameMapData };
}

async function runFetch() {
    setStatus("fetching", "Starting...");
    let scrapeTabId = null;

    try {
        // Clear stale game auth cookies (use url: to catch parent-domain .blablalink.com cookies too).
        setStatus("fetching", "Clearing session...");
        const cookiesToClear = await chrome.cookies.getAll({ url: "https://api.blablalink.com/" });
        await Promise.all(
            cookiesToClear.map((c) => {
                const cleanDomain = c.domain.startsWith(".") ? c.domain.slice(1) : c.domain;
                return chrome.cookies.remove({ url: `https://${cleanDomain}${c.path}`, name: c.name });
            }),
        );

        // Always open a fresh nikke-list tab - matches Node scraper behavior of always
        // navigating fresh so the page fully initialises its game auth state before we call the API.
        setStatus("fetching", "Loading page...");
        const tab = await chrome.tabs.create({
            url: "https://www.blablalink.com/shiftyspad/nikke-list",
            active: false,
        });
        scrapeTabId = tab.id;
        const tabId = tab.id;

        // Wait for DOM ready
        await new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error("Page load timed out")), 45000);
            function listener(id, info) {
                if (id === tabId && info.status === "complete") {
                    clearTimeout(timer);
                    chrome.tabs.onUpdated.removeListener(listener);
                    resolve();
                }
            }
            chrome.tabs.onUpdated.addListener(listener);
        });

        // Poll until openid appears in localStorage (up to 15s), then wait an extra 5s
        // for the page's own CheckLogin request to complete and write fresh auth cookies.
        // Without the extra wait, openid is already present from the previous session and
        // the poll exits immediately - before CheckLogin runs - causing "Inner token is invalid".
        const deadline = Date.now() + 15000;
        let openidFound = false;
        while (Date.now() < deadline) {
            const [{ result: ready }] = await chrome.scripting.executeScript({
                target: { tabId },
                world: "MAIN",
                func: () => !!JSON.parse(localStorage.getItem("lip-user-info") || "{}").openid,
            });
            if (ready) {
                openidFound = true;
                break;
            }
            await new Promise((r) => setTimeout(r, 500));
        }
        if (!openidFound) throw new Error("not_logged_in");

        // Give CheckLogin time to complete its network round-trip and write fresh cookies.
        setStatus("fetching", "Waiting for session...");
        await new Promise((r) => setTimeout(r, 5000));

        setStatus("fetching", "Fetching character data...");
        const [{ result: pageResult }] = await chrome.scripting.executeScript({
            target: { tabId },
            func: scrapeInPage,
            args: [API_BASE],
            world: "MAIN",
        });

        if (!pageResult) throw new Error("No result returned from page");
        if (pageResult.error === "not_logged_in") throw new Error("not_logged_in");
        if (pageResult.error) throw new Error(pageResult.error);

        // Build name map - prefer live CDN data from page, fall back to bundled file
        setStatus("fetching", "Building name map...");
        let nameMap = {};
        if (pageResult.nameMapData) {
            nameMap = buildNameMap(pageResult.nameMapData);
            await chrome.storage.local.set({ nameMap, nameMapTime: Date.now() });
        } else {
            const stored = await chrome.storage.local.get("nameMap");
            if (stored.nameMap) {
                nameMap = stored.nameMap;
            } else {
                try {
                    const resp = await fetch(chrome.runtime.getURL("nikke-names.json"));
                    const data = await resp.json();
                    nameMap = buildNameMap(data);
                } catch {}
            }
        }

        setStatus("fetching", "Processing...");
        const result = processDetails(pageResult.details, pageResult.characters, nameMap);
        const count = Object.keys(result).length;

        await chrome.storage.local.set({ nikkeEquips: result, lastFetched: Date.now(), nikkeCount: count });
        setStatus("fetching", "Sending to Gear Manager…");
        try {
            await sendToManager();
            setStatus("done", `${count} nikkes sent to Nikke Manager`);
        } catch (_) {
            setStatus("done", `${count} nikkes loaded`);
        }
    } catch (err) {
        setStatus("error", err.message === "not_logged_in" ? "not_logged_in" : err.message);
    } finally {
        if (scrapeTabId) chrome.tabs.remove(scrapeTabId).catch(() => {});
    }
}

const MANAGER_URLS = [
    "http://localhost:3000",
    "http://localhost:8080",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:8080",
    "https://nikke-overload-gear-manager.web.app",
    "https://nikke-overload-gear-manager.firebaseapp.com",
];

async function resolveManagerUrl() {
    for (const url of MANAGER_URLS) {
        try {
            const resp = await fetch(`${url}/nikke-manager-ping.json`, { signal: AbortSignal.timeout(2000) });
            if (!resp.ok) continue;
            const json = await resp.json();
            if (json?.app === "nikke-manager") return url;
        } catch {}
    }
    return null;
}

function waitForTabComplete(tabId, timeout = 30000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Tab load timed out")), timeout);
        function listener(id, info) {
            if (id === tabId && info.status === "complete") {
                clearTimeout(timer);
                chrome.tabs.onUpdated.removeListener(listener);
                resolve();
            }
        }
        chrome.tabs.onUpdated.addListener(listener);
    });
}

async function sendToManager() {
    const { nikkeEquips } = await chrome.storage.local.get("nikkeEquips");
    if (!nikkeEquips) throw new Error("No data - fetch first");

    // Find an already-open Gear Manager tab, or open the first reachable URL
    const allTabs = await chrome.tabs.query({});
    let tab = allTabs.find((t) => t.url && MANAGER_URLS.some((u) => t.url.startsWith(u)));

    if (tab) {
        await chrome.tabs.update(tab.id, { active: true });
        if (tab.status !== "complete") await waitForTabComplete(tab.id);
    } else {
        const url = await resolveManagerUrl();
        if (!url) throw new Error("Nikke Manager app not found - is it running?");
        tab = await chrome.tabs.create({ url, active: true });
        await waitForTabComplete(tab.id);
    }

    // Brief pause so page scripts finish initialising after DOM-complete
    await new Promise((r) => setTimeout(r, 400));

    const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: "MAIN",
        func: (data) => {
            if (typeof window._nikkeExtImport === "function") {
                window._nikkeExtImport(data);
                return "injected";
            }
            // Fallback: stash in localStorage and fire an event so the page picks it up
            try {
                localStorage.setItem("_nikke_ext_pending", JSON.stringify(data));
            } catch (_) {}
            window.dispatchEvent(new CustomEvent("_nikke_ext_pending"));
            return "pending";
        },
        args: [nikkeEquips],
    });

    return { ok: true, method: result };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === "FETCH") {
        runFetch();
        sendResponse({ ok: true });
    }
    return false;
});
