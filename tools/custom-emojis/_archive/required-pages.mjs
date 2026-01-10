import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const srcPath = path.join(root, "tools", "custom-emojis", "java-symbols.txt");

const text = fs.readFileSync(srcPath, "utf8").replace(/\uFEFF/g, "");
const tokens = text.split(/\s+/g).filter(Boolean);

function codePoints(str) {
	const cps = [];
	for (const ch of str) cps.push(ch.codePointAt(0));
	return cps;
}

const pages = new Map(); // hiByte -> Set of codepoints
const multi = [];
const singles = [];

for (const tok of tokens) {
	const cps = codePoints(tok);
	if (cps.length !== 1) {
		multi.push({ token: tok, codePoints: cps.map((c) => c.toString(16).toUpperCase()) });
		continue;
	}
	const cp = cps[0];
	singles.push({ token: tok, cp });
	const hi = (cp >> 8) & 0xff;
	if (!pages.has(hi)) pages.set(hi, new Set());
	pages.get(hi).add(cp);
}

const his = [...pages.keys()].sort((a, b) => a - b);
console.log(`Tokens total: ${tokens.length}`);
console.log(`Single-codepoint tokens: ${singles.length}`);
console.log(`Multi-codepoint tokens (will NOT be auto-importable as 16x16 glyph): ${multi.length}`);
console.log("");
console.log("Required unicode pages (hi-byte) for single-codepoint tokens:");
console.log(his.map((h) => h.toString(16).toUpperCase().padStart(2, "0")).join(" "));

// Write a helper json
const out = {
	requiredPages: his.map((h) => h.toString(16).toUpperCase().padStart(2, "0")),
	multiCodepointTokens: multi,
};
const outPath = path.join(root, "tools", "custom-emojis", "required-pages.json");
fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n", "utf8");
console.log(`\nWrote: ${path.relative(root, outPath)}`);
