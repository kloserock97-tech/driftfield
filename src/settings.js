/* Defaults, presets, and the address bar.
 *
 * Every setting that changes the picture is a plain number or string here, so a look can travel:
 * the panel writes the ones that differ from the defaults into the URL hash, and opening that link
 * reproduces the cloud exactly. Short keys keep the link readable. */

export const DEFAULTS = {
    count: 80000,
    spread: 128,
    radius: 1,
    curl: 0.45,
    speed: 9.8,
    dissolve: 0.25,
    octaves: 5,
    probes: 6,
    focus: 5.1,
    aperture: 3,
    pointScale: 2.4,
    opacity: 1,
    color: "#ffffff",
    background: "#06070a",
    autoRotate: true,
    rotateSpeed: 0.35,
    paused: false,
};

/* Four looks the field can take without touching anything else. They are not modes: each one is
   just a handful of the same sliders in a different place. */
export const PRESETS = {
    bubble: {},
    nebula: { curl: 0.24, dissolve: 0.55, aperture: 2.6, speed: 4.5, opacity: 0.85, count: 70000, color: "#cfe3ff" },
    /* Threads come from a small seed spread, not from a high frequency: neighbours start close in the
       noise, so they follow each other through every fold and draw a line together. */
    threads: { curl: 0.3, dissolve: 0.7, aperture: 4.4, speed: 8, pointScale: 1.5, count: 120000, spread: 40 },
    ember: { curl: 0.6, dissolve: 0.2, aperture: 2, speed: 6, color: "#ffb47a", background: "#140b06", pointScale: 1.6 },
    ink: { curl: 0.35, dissolve: -0.25, aperture: 3.4, speed: 3, color: "#101014", background: "#f1f0ea", opacity: 0.55 },
};

const KEYS = {
    count: "n", spread: "sp", radius: "r", curl: "c", speed: "s", dissolve: "d", octaves: "o",
    probes: "p", focus: "f", aperture: "a", pointScale: "ps", opacity: "op", color: "col",
    background: "bg", autoRotate: "ar", rotateSpeed: "rs", paused: "pa",
};

const FROM_KEY = Object.fromEntries(Object.entries(KEYS).map(([name, key]) => [key, name]));

export function readUrl()
{
    const out = {};
    const params = new URLSearchParams(location.hash.replace(/^#/, ""));

    for(const [key, raw] of params)
    {
        const name = FROM_KEY[key];
        if(name === undefined) continue;

        const fallback = DEFAULTS[name];

        if(typeof fallback === "number") { const value = Number(raw); if(Number.isFinite(value)) out[name] = value; }
        else if(typeof fallback === "boolean") out[name] = raw === "1";
        else if(/^#?[0-9a-f]{3,8}$/i.test(raw)) out[name] = raw.startsWith("#") ? raw : `#${raw}`;
    }

    return out;
}

export function writeUrl(settings)
{
    const params = new URLSearchParams();

    for(const [name, key] of Object.entries(KEYS))
    {
        const value = settings[name];
        if(value === DEFAULTS[name]) continue;

        if(typeof value === "boolean") params.set(key, value ? "1" : "0");
        else if(typeof value === "number") params.set(key, String(Math.round(value * 1000) / 1000));
        else params.set(key, String(value).replace(/^#/, ""));
    }

    const hash = params.toString();
    history.replaceState(null, "", hash ? `#${hash}` : location.pathname + location.search);
}
