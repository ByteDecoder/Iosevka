"use strict";

const path = require("path");
const fs = require("fs-extra");
const semver = require("semver");

const ChangeFileDir = path.join(__dirname, "../../changes");
const ModifiedSinceVersion = "2.x";
const Version = process.argv[2];
const outputPath = process.argv[3];

class Output {
	constructor() {
		this.buffer = "";
	}
	log(...s) {
		this.buffer += s.join("") + "\n";
	}
}

async function main() {
	const out = new Output();

	await CopyMarkdown(out, "packages-desc.md");
	await GeneratePackageList(out);
	await CopyMarkdown(out, "package-reorg.md");
	await GenerateChangeList(out);

	await fs.ensureDir(path.join(__dirname, `../../release-archives/`));
	await fs.writeFile(outputPath, out.buffer);
}

main().catch(e => {
	console.error(e);
	process.exit(1);
});

///////////////////////////////////////////////////////////////////////////////////////////////////
// Copy Markdown

async function CopyMarkdown(out, name) {
	const content = await fs.readFile(
		path.resolve(__dirname, `release-note-fragments/${name}`),
		"utf8"
	);
	out.log(content);
}

///////////////////////////////////////////////////////////////////////////////////////////////////
// CHANGE LIST

async function GenerateChangeList(out) {
	const changeFiles = await fs.readdir(ChangeFileDir);
	const fragments = new Map();
	for (const file of changeFiles) {
		const filePath = path.join(ChangeFileDir, file);
		const fileParts = path.parse(filePath);
		if (fileParts.ext !== ".md") continue;
		if (!semver.valid(fileParts.name) || semver.lt(Version, fileParts.name)) continue;
		fragments.set(fileParts.name, await fs.readFile(filePath, "utf8"));
	}
	const sortedFragments = Array.from(fragments).sort((a, b) => semver.compare(b[0], a[0]));

	out.log(`## Modifications since version ${ModifiedSinceVersion}`);
	for (const [version, notes] of sortedFragments) {
		out.log(` * **${version}**`);
		out.log((notes.trimEnd() + "\n").replace(/^/gm, "   "));
	}
}

///////////////////////////////////////////////////////////////////////////////////////////////////
// PACKAGE LIST

const PackageShapes = {
	// shapeDesc, shapeNameSuffix, slab, count, nospace
	"": ["Monospace, Default", "", false, true],
	slab: ["Monospace, Slab", "Slab", true, true],
	curly: ["Monospace, Curly", "Curly", false, true],
	"curly-slab": ["Monospace, Curly Slab", "Curly Slab", true, true],
	ss01: ["Monospace, Andale Mono Style", "SS01"],
	ss02: ["Monospace, Anonymous Pro Style", "SS02"],
	ss03: ["Monospace, Consolas Style", "SS03"],
	ss04: ["Monospace, Menlo Style", "SS04"],
	ss05: ["Monospace, Fira Mono Style", "SS05"],
	ss06: ["Monospace, Liberation Mono Style", "SS06"],
	ss07: ["Monospace, Monaco Style", "SS07"],
	ss08: ["Monospace, Pragmata Pro Style", "SS08"],
	ss09: ["Monospace, Source Code Pro Style", "SS09"],
	ss10: ["Monospace, Envy Code R Style", "SS10"],
	ss11: ["Monospace, X Windows Fixed Style", "SS11"],
	ss12: ["Monospace, Ubuntu Mono Style", "SS12"],
	ss13: ["Monospace, Lucida Style", "SS13"],
	ss14: ["Monospace, JetBrains Mono Style", "SS14"],
	aile: ["Quasi-proportional, Sans-serif", "Aile", false, false, true],
	etoile: ["Quasi-proportional, Slab-serif", "Etoile", false, false, true],
	sparkle: ["Quasi-proportional Hybrid, like iA Writer’s Duo.", "Sparkle", false, false, true]
};

const PackageSpacings = {
	// spacingDesc, ligation, spacingNameSuffix
	"": ["Default", true, ""],
	term: ["Terminal", true, "Term"],
	fixed: ["Fixed", false, "Fixed"]
};

const imagePrefix = `https://raw.githubusercontent.com/be5invis/Iosevka/v${Version}/images`;

async function GeneratePackageList(out) {
	const packageSpacingKeys = Object.keys(PackageSpacings);
	out.log(`<table>`);
	for (let shape in PackageShapes) {
		const [shapeDesc, shapeNameSuffix, , count, nospace] = PackageShapes[shape];
		const familyName = buildName("\u00a0", "Iosevka", shapeNameSuffix);
		const imageName = buildName("-", "iosevka", shape);
		const fileName = buildName("-", "pkg", "iosevka", shape, Version);
		const downloadLink = `https://github.com/be5invis/Iosevka/releases/download/v${Version}/${fileName}.zip`;

		const desc = `<i>${shapeDesc}</i>`;
		const img = `<img src="${imagePrefix}/${imageName}.png" width="540"/>`;
		const ttfPackageCount = packageSpacingKeys.length;
		out.log(
			`<tr>`,
			`<td colspan="3"><b><a href="${downloadLink}">📦 ${familyName}</a></b> — ${desc}</td>`,
			`<td rowspan="${nospace ? 2 : 3 + ttfPackageCount}">${img}<br/></td>`,
			`</tr>`
		);

		if (!nospace) {
			out.log(
				`<tr>`,
				`<td><b>\u2002└ TTF Package</b></td>`,
				`<td><b>Spacing</b></td>`,
				`<td><b>Ligatures</b></td>`,
				`</tr>`
			);
			for (let spacing of packageSpacingKeys) {
				const [spacingDesc, ligation, spacingNameSuffix] = PackageSpacings[spacing];
				const fileName = buildName("-", "ttf", "iosevka", spacing, shape, Version);
				const familyName = buildName(" ", "Iosevka", spacingNameSuffix, shapeNameSuffix);
				const downloadLink = `https://github.com/be5invis/Iosevka/releases/download/v${Version}/${fileName}.zip`;
				const download = `<b><a href="${downloadLink}">${noBreak(familyName)}</a></b>`;
				const leader =
					"\u2002\u2002" +
					(spacing === packageSpacingKeys[packageSpacingKeys.length - 1] ? "└" : "├");
				out.log(
					`<tr>`,
					`<td>${leader} ${download}</td>`,
					`<td>${spacingDesc}</td>`,
					`<td>${flag(ligation)}</td>`,
					`</tr>`
				);
			}
		}
		out.log(`<tr>`, `<td colspan="3"> </td>`, `<tr/>`);
	}
	out.log(`</table>\n`);
}

function noBreak(s) {
	return s.replace(/ /g, "\u00a0");
}

function buildName(j, ...parts) {
	return parts.filter(x => !!x).join(j);
}

function flag(f) {
	return f ? "<b>Yes</b>" : "No";
}
