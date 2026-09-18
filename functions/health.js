export function onRequestGet() {
    return json({ status: "ok" },
        {headers: { "Cache-Control": "no-store" }});
}