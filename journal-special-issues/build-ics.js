// Builds journal-special-issues/deadlines.ics from CALLS and CONFS in journal-special-issues/index.html.
// Run from the repo root after every change: node journal-special-issues/build-ics.js
// Also writes a copy to ../cfp-planner/deadlines.ics so calendar subscriptions made at the old address keep updating.
const fs = require("fs"), path = require("path");
const dir = __dirname;
const html = fs.readFileSync(path.join(dir, "index.html"), "utf8");
const grab = name => {
  const s = html.indexOf(`const ${name} = [`), e = html.indexOf("\n];", s);
  if (s < 0 || e < 0) throw new Error(name + " array not found");
  return Function(html.slice(s, e + 3) + `; return ${name};`)();
};
const CALLS = grab("CALLS"), CONFS = grab("CONFS");
const lc = (html.match(/const LAST_CHECKED = "([\d-]+)"/) || [])[1] || "";
const PAGE = "https://sourabhbhattacharya.github.io/SBT/journal-special-issues/";

const ymd = s => s.replace(/-/g, "");
const addDay = (s, n = 1) => { const d = new Date(s + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10).replace(/-/g, ""); };
const esc = s => String(s ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const fold = line => { const out = []; let b = Buffer.from(line, "utf8"); while (b.length > 73) { let n = 73; while ((b[n] & 0xc0) === 0x80) n--; out.push(b.slice(0, n).toString("utf8")); b = b.slice(n); } out.push(b.toString("utf8")); return out.join("\r\n "); };
const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
const today = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
const keepFrom = (() => { const d = new Date(today + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() - 60); return d.toISOString().slice(0, 10); })();

const ev = [];
function add(uid, start, endExcl, summary, desc, url, alarms) {
  const L = ["BEGIN:VEVENT", "UID:" + uid + "@sbt-cfp-planner" /* keep this UID suffix: existing calendar subscriptions depend on it */, "DTSTAMP:" + stamp,
    "DTSTART;VALUE=DATE:" + ymd(start), "DTEND;VALUE=DATE:" + endExcl,
    "SUMMARY:" + esc(summary), "DESCRIPTION:" + esc(desc), "URL:" + url, "TRANSP:TRANSPARENT"];
  alarms.forEach(([trig, txt]) => L.push("BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + esc(txt), "TRIGGER:" + trig, "END:VALARM"));
  L.push("END:VEVENT"); ev.push(...L);
}
const est = f => (f ? " (estimated)" : "");
const remind = n => [["-P13DT15H", `${n}: deadline in 14 days`], ["-P1DT15H", `${n}: deadline in 2 days`]];

for (const c of CALLS) {
  if (c.close < keepFrom) continue;
  const n = `${c.abbr} special issue`;
  const info = `${c.journal}: ${c.title}\nABDC 2025: ${c.abdc}${c.ft50 === 1 || c.ft50 === 3 ? " · FT50" : ""}\nCall: ${c.url}\n${c.note || ""}\nPlanner: ${PAGE}`;
  add("si-" + c.id + "-close", c.close, addDay(c.close), `DEADLINE: ${c.abbr} SI – ${c.title}${est(c.closeExp)}`, info, c.url, remind(n));
  if (c.open && c.open !== c.close && c.open >= keepFrom)
    add("si-" + c.id + "-open", c.open, addDay(c.open), `Submissions open: ${c.abbr} SI – ${c.title}`, info, c.url, [["-PT15H", `${n} opens tomorrow`]]);
  if (c.step && c.step.date >= keepFrom)
    add("si-" + c.id + "-step", c.step.date, addDay(c.step.date), `${c.step.label}: ${c.abbr} SI – ${c.title}`, info, c.url, [["-P6DT15H", `${n}: ${c.step.label} in 7 days`]]);
}
for (const c of CONFS) {
  if ((c.end || c.start) < keepFrom) continue;
  const info = `${c.full} (${c.type}, ${c.region})\n${c.place}\nCall: ${c.url}\n${c.note || ""}\nPlanner: ${PAGE}`;
  if (c.close >= keepFrom)
    add("cf-" + c.id + "-close", c.close, addDay(c.close), `CFP DEADLINE: ${c.name}${est(c.closeExp)}`, info, c.url, remind(c.name));
  add("cf-" + c.id + "-event", c.start, addDay(c.end || c.start), `${c.name} · ${c.place}${c.eventExp ? " (expected dates)" : ""}`, info, c.url, []);
}
const cal = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//SBT//Journal Special Issues and CFP//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
  "X-WR-CALNAME:Journal Special Issues and CFP", "X-WR-TIMEZONE:Asia/Kolkata",
  "X-WR-CALDESC:" + esc(`FT50 and ABDC 2025 A*/A special-issue and conference call-for-papers deadlines. Last checked ${lc}. ${PAGE}`),
  "REFRESH-INTERVAL;VALUE=DURATION:PT12H", "X-PUBLISHED-TTL:PT12H", ...ev, "END:VCALENDAR"];
const out = cal.map(fold).join("\r\n") + "\r\n";
fs.writeFileSync(path.join(dir, "deadlines.ics"), out);
const legacy = path.join(dir, "..", "cfp-planner");
if (fs.existsSync(legacy)) fs.writeFileSync(path.join(legacy, "deadlines.ics"), out);
console.log(`deadlines.ics written: ${ev.filter(l => l === "BEGIN:VEVENT").length} events`);
