import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourcePath = path.join(root, "tools", "custom-emojis", "java-symbols.txt");

const atomicEssentialPath = path.join(
	root,
	"Atomic BP",
	"scripts",
	"features",
	"custom-emojis",
	"packs",
	"atomicEssential.js",
);

const javaSymbolsExistingPath = path.join(
	root,
	"Atomic BP",
	"scripts",
	"features",
	"custom-emojis",
	"packs",
	"javaSymbols.js",
);

function readUtf8(p) {
	return fs.readFileSync(p, "utf8");
}

function extractExistingPuaFromAtomicEssential(jsText) {
	// Heurística simple: busca ["X", cp("E3AB")]
	const map = new Map();
	const re = /\[\s*"([^"]+)"\s*,\s*cp\("([0-9A-Fa-f]{4,6})"\)\s*\]/g;
	let m;
	while ((m = re.exec(jsText))) {
		map.set(m[1], m[2].toUpperCase());
	}
	return map;
}

function extractExistingPuaFromJavaSymbols(jsText) {
	// Same format as atomicEssential; keep assignments stable across regenerations.
	const map = new Map();
	const re = /\[\s*"([^"]+)"\s*,\s*cp\("([0-9A-Fa-f]{4,6})"\)\s*\]/g;
	let m;
	while ((m = re.exec(jsText))) {
		map.set(m[1], m[2].toUpperCase());
	}
	return map;
}

function toHex(n) {
	return n.toString(16).toUpperCase().padStart(4, "0");
}

function puaHexToSheet(hex) {
	// hex is like E31C or E412
	const h = hex.toUpperCase();
	return h.slice(0, 2); // E3, E4, ...
}

function puaHexToCell(hex) {
	const low = parseInt(hex.slice(2), 16);
	const row = (low >> 4) & 0xf;
	const col = low & 0xf;
	return {
		row,
		col,
		label: `${row.toString(16).toUpperCase()}${col.toString(16).toUpperCase()}`,
	};
}

const src = readUtf8(sourcePath);
const tokensRaw = src
	.replace(/\uFEFF/g, "")
	.split(/\s+/g)
	.filter(Boolean);

function countCodePoints(str) {
	let n = 0;
	for (const _ch of str) n++;
	return n;
}

function getSingleCodePoint(str) {
	for (const ch of str) return ch.codePointAt(0);
	return null;
}

function isCircledSymbol(codePoint) {
	// Circled digits/letters blocks and dingbat circled digits.
	// Exclude completely per user request.
	if (codePoint == null) return false;
	// Dingbat circled digits: ➀..➓
	if (codePoint >= 0x2780 && codePoint <= 0x2793) return true;
	// Enclosed Alphanumerics: ①..⑳ etc
	if (codePoint >= 0x2460 && codePoint <= 0x24ff) return true;
	// Enclosed CJK Letters and Months (includes ㊣ etc)
	if (codePoint >= 0x3200 && codePoint <= 0x32ff) return true;
	return false;
}

const atomicEssentialExisting = extractExistingPuaFromAtomicEssential(readUtf8(atomicEssentialPath));

const javaSymbolsExisting = fs.existsSync(javaSymbolsExistingPath)
	? extractExistingPuaFromJavaSymbols(readUtf8(javaSymbolsExistingPath))
	: new Map();

// Dedupe preserving first occurrence.
const seen = new Set();
const tokensDeduped = [];
for (const t of tokensRaw) {
	if (seen.has(t)) continue;
	seen.add(t);
	tokensDeduped.push(t);
}

// IMPORTANT: Only single-codepoint tokens can be imported 1:1 from Java unicode pages.
// Multi-codepoint decorative strings (e.g. "｡^◕‿◕^") are intentionally excluded to avoid
// replacing them with a single 16x16 glyph (which would look wrong / blank).
const tokens = [];
const skippedMulti = [];
const skippedCircled = [];
for (const t of tokensDeduped) {
	if (countCodePoints(t) !== 1) {
		skippedMulti.push(t);
		continue;
	}
	const cp = getSingleCodePoint(t);
	if (isCircledSymbol(cp)) {
		skippedCircled.push(t);
		continue;
	}
	tokens.push(t);
}

// Allocate new PUAs starting at E31C (we reserve E300..E31B for atomicEssential).
let next = 0xE31C;

const assigned = new Map();

// First, keep existing assignments from atomicEssential (to avoid breaking existing lore that already contains PUA chars).
for (const [token, hex] of atomicEssentialExisting.entries()) {
	assigned.set(token, hex);
}

// Preserve previous javaSymbols assignments to avoid shifting PUAs when regenerating.
for (const [token, hex] of javaSymbolsExisting.entries()) {
	if (assigned.has(token)) continue;
	assigned.set(token, hex);
}

for (const token of tokens) {
	if (assigned.has(token)) continue;
	assigned.set(token, toHex(next));
	next++;
	// skip over non-PUA or ranges not backed by glyph sheets? We only generate E3..E8-ish; continue linearly.
}

// Compute the range of sheets needed.
let max = 0;
for (const hex of assigned.values()) {
	const v = parseInt(hex, 16);
	if (v > max) max = v;
}

const minSheet = 0xE3;
const maxSheet = (max >> 8) & 0xff;

const out = {
	generatedAt: new Date().toISOString(),
	source: "tools/custom-emojis/java-symbols.txt",
	puaStartReservedForEssential: "E300..E31B",
	skippedMultiCodepointTokensCount: skippedMulti.length,
	skippedMultiCodepointTokens: skippedMulti,
	skippedCircledTokensCount: skippedCircled.length,
	skippedCircledTokens: skippedCircled,
	sheets: [],
	entries: [],
};

for (let s = minSheet; s <= maxSheet; s++) {
	out.sheets.push(s.toString(16).toUpperCase());
}

// Keep output order identical to the user's token order (plus we also want to include essential tokens if they appear).
for (const token of tokens) {
	const hex = assigned.get(token);
	const sheet = puaHexToSheet(hex);
	const cell = puaHexToCell(hex);
	out.entries.push({ token, puaHex: hex, sheet, cell: cell.label });
}

// Write mapping JSON for RP.
const rpMapPath = path.join(root, "RP", "font", "mapping.java-symbols.json");
fs.writeFileSync(rpMapPath, JSON.stringify(out, null, 2) + "\n", "utf8");

// Write a layout CSV (easier to consult while drawing).
const csvPath = path.join(root, "RP", "font", "layout.java-symbols.csv");
const csvLines = ["token,puaHex,sheet,cell"]; 
for (const e of out.entries) {
	// CSV quoting
	const tokenEsc = '"' + e.token.replaceAll('"', '""') + '"';
	csvLines.push([tokenEsc, e.puaHex, e.sheet, e.cell].join(","));
}
fs.writeFileSync(csvPath, csvLines.join("\n") + "\n", "utf8");

// Write BP pack JS map (only tokens not already in atomicEssential, to keep things modular).
const bpPath = path.join(
	root,
	"Atomic BP",
	"scripts",
	"features",
	"custom-emojis",
	"packs",
	"javaSymbols.js",
);

const newEntries = [];
for (const token of tokens) {
	if (atomicEssentialExisting.has(token)) continue;
	newEntries.push([token, assigned.get(token)]);
}

const lines = [];
lines.push("// Auto-generated from tools/custom-emojis/java-symbols.txt");
lines.push("// Tokens map to Private Use Area codepoints to render via RP/font/glyph_Ex.png sheets.");
lines.push("");
lines.push("function cp(hex) {");
lines.push("\treturn String.fromCodePoint(parseInt(hex, 16));");
lines.push("}");
lines.push("");
lines.push("export const javaSymbolsMap = new Map([");
for (const [token, hex] of newEntries) {
	const safe = token.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
	lines.push(`\t[\"${safe}\", cp(\"${hex}\")],`);
}
lines.push("]);\n");

fs.writeFileSync(bpPath, lines.join("\n"), "utf8");

console.log(`Tokens raw: ${tokensRaw.length}`);
console.log(`Tokens unique (all): ${tokensDeduped.length}`);
console.log(`Tokens used (single-codepoint): ${tokens.length}`);
console.log(`Tokens skipped (multi-codepoint): ${skippedMulti.length}`);
console.log(`Existing essential preserved: ${atomicEssentialExisting.size}`);
console.log(`New entries generated: ${newEntries.length}`);
console.log(`Max PUA used: ${toHex(max)} (sheets E3..${maxSheet.toString(16).toUpperCase()})`);
console.log(`Wrote: ${path.relative(root, rpMapPath)}`);
console.log(`Wrote: ${path.relative(root, csvPath)}`);
console.log(`Wrote: ${path.relative(root, bpPath)}`);
