// Builds exam-planner/deadlines.ics from the EXAMS list in exam-planner/index.html.
// Run: node exam-planner/build-ics.js   (re-run after every change to EXAMS)
const fs = require("fs"), path = require("path");
const dir = __dirname;
const html = fs.readFileSync(path.join(dir, "index.html"), "utf8");
const start = html.indexOf("const EXAMS = [");
const end = html.indexOf("];", start);
if (start < 0 || end < 0) throw new Error("EXAMS array not found");
const EXAMS = Function(html.slice(start, end + 2) + "; return EXAMS;")();
const lc = (html.match(/const LAST_CHECKED = "([\d-]+)"/) || [])[1] || "";

const ymd = s => s.replace(/-/g, "");
const nextDay = s => { const d = new Date(s + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10).replace(/-/g, ""); };
const esc = s => String(s).replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const fold = line => { const out = []; let b = Buffer.from(line, "utf8"); while (b.length > 73) { let n = 73; while ((b[n] & 0xc0) === 0x80) n--; out.push(b.slice(0, n).toString("utf8")); b = b.slice(n); } out.push(b.toString("utf8")); return out.join("\r\n "); };
const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
const PAGE = "https://sourabhbhattacharya.github.io/SBT/exam-planner/";

const ev = [];
function add(uid, date, summary, desc, url, alarms) {
  const L = ["BEGIN:VEVENT", "UID:" + uid + "@sbt-exam-planner", "DTSTAMP:" + stamp,
    "DTSTART;VALUE=DATE:" + ymd(date), "DTEND;VALUE=DATE:" + nextDay(date),
    "SUMMARY:" + esc(summary), "DESCRIPTION:" + esc(desc), "URL:" + url, "TRANSP:TRANSPARENT"];
  alarms.forEach(([trig, txt]) => L.push("BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + esc(txt), "TRIGGER:" + trig, "END:VALARM"));
  L.push("END:VEVENT"); ev.push(...L);
}
for (const e of EXAMS) {
  const est = f => (f ? " (expected date)" : "");
  const info = `Official site: ${e.url}\nEligibility: ${e.elig}\nPlanner: ${PAGE}`;
  if (e.open) add(e.id + "-open", e.open, `Form opens: ${e.name}${est(e.closeExp)}`, info, e.url, [["-PT15H", `${e.name} application opens tomorrow`]]);
  if (e.close) add(e.id + "-close", e.close, `LAST DATE to apply: ${e.name}${est(e.closeExp)}`, `${e.note}\n${info}`, e.url,
    [["-P6DT15H", `${e.name}: application closes in 7 days`], ["-PT15H", `${e.name}: application closes TOMORROW`]]);
  if (e.exam) add(e.id + "-exam", e.exam, `${(e.examTitle || "Exam").toUpperCase()}: ${e.name} (${e.examLbl})${est(e.examExp)}`, info, e.url, [["-P2DT15H", `${e.name}: ${(e.examTitle || "exam").toLowerCase()} in 3 days`]]);
}
const cal = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//SBT//Undergraduate Entrance Exam Planner//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
  "X-WR-CALNAME:Undergraduate Entrance Exam Planner", "X-WR-TIMEZONE:Asia/Kolkata",
  "X-WR-CALDESC:" + esc(`Application deadlines and exam dates for Class 12 PCMB students. Dates last checked ${lc}. ${PAGE}`),
  "REFRESH-INTERVAL;VALUE=DURATION:PT12H", "X-PUBLISHED-TTL:PT12H", ...ev, "END:VCALENDAR"];
fs.writeFileSync(path.join(dir, "deadlines.ics"), cal.map(fold).join("\r\n") + "\r\n");
console.log(`deadlines.ics written: ${ev.filter(l => l === "BEGIN:VEVENT").length} events`);
