#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  ".next",
  ".cache",
  ".venv",
  "__pycache__",
]);

const SKIP_EXTENSIONS = new Set([
  ".7z",
  ".avif",
  ".bin",
  ".bmp",
  ".class",
  ".db",
  ".dll",
  ".exe",
  ".gif",
  ".gz",
  ".ico",
  ".jar",
  ".jpeg",
  ".jpg",
  ".lock",
  ".mp3",
  ".mp4",
  ".o",
  ".pdf",
  ".png",
  ".sqlite",
  ".tar",
  ".webp",
  ".woff",
  ".woff2",
  ".zip",
]);

const REPLACEMENTS = new Map([
  ["Ä", "Ae"],
  ["Ö", "Oe"],
  ["Ü", "Ue"],
  ["ä", "ae"],
  ["ö", "oe"],
  ["ü", "ue"],
  ["ẞ", "SS"],
  ["ß", "ss"],
  ["é", "e"],
  ["è", "e"],
  ["ê", "e"],
  ["á", "a"],
  ["à", "a"],
  ["â", "a"],
  ["ó", "o"],
  ["ò", "o"],
  ["ô", "o"],
  ["í", "i"],
  ["ì", "i"],
  ["î", "i"],
  ["ú", "u"],
  ["ù", "u"],
  ["û", "u"],
  ["É", "E"],
  ["È", "E"],
  ["Ê", "E"],
  ["Á", "A"],
  ["À", "A"],
  ["Â", "A"],
  ["Ó", "O"],
  ["Ò", "O"],
  ["Ô", "O"],
  ["Í", "I"],
  ["Ì", "I"],
  ["Î", "I"],
  ["Ú", "U"],
  ["Ù", "U"],
  ["Û", "U"],
]);

function usage() {
  console.log([
    "Usage: node tools/normalize-german.js [path] [--write] [--include-unknown]",
    "",
    "Recursively replaces German umlauts and common non-ASCII punctuation in text files.",
    "Default mode is a dry run. Add --write to modify files.",
    "",
    "Options:",
    "  --write             rewrite changed files",
    "  --include-unknown   replace any remaining non-ASCII character with ?",
    "  --help              show this help",
  ].join("\n"));
}

const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
  usage();
  process.exit(0);
}

const write = args.includes("--write");
const includeUnknown = args.includes("--include-unknown");
const targetArg = args.find((arg) => !arg.startsWith("--")) || ".";
const root = path.resolve(process.cwd(), targetArg);
const scriptPath = fs.realpathSync(__filename);

function isBinary(buffer) {
  if (buffer.includes(0)) return true;

  const sampleLength = Math.min(buffer.length, 4096);
  if (sampleLength === 0) return false;

  let suspicious = 0;
  for (let index = 0; index < sampleLength; index += 1) {
    const byte = buffer[index];
    if (byte < 7 || (byte > 14 && byte < 32)) suspicious += 1;
  }

  return suspicious / sampleLength > 0.1;
}

function normalizeText(input) {
  let output = "";
  const unknown = new Set();

  for (const char of input) {
    if (REPLACEMENTS.has(char)) {
      output += REPLACEMENTS.get(char);
    } else if (includeUnknown && /[^\x00-\x7F]/u.test(char)) {
      output += "?";
    } else {
      output += char;
      if (/[^\x00-\x7F]/u.test(char)) unknown.add(char);
    }
  }

  return { output, unknown };
}

function* walk(currentPath) {
  const stat = fs.statSync(currentPath);

  if (stat.isDirectory()) {
    const base = path.basename(currentPath);
    if (SKIP_DIRS.has(base)) return;

    for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
      yield* walk(path.join(currentPath, entry.name));
    }
    return;
  }

  if (!stat.isFile()) return;
  if (fs.realpathSync(currentPath) === scriptPath) return;
  if (SKIP_EXTENSIONS.has(path.extname(currentPath).toLowerCase())) return;

  yield currentPath;
}

if (!fs.existsSync(root)) {
  console.error(`Path does not exist: ${root}`);
  process.exit(1);
}

let checked = 0;
let changed = 0;
let skippedBinary = 0;
const unknownByFile = [];

for (const filePath of walk(root)) {
  const buffer = fs.readFileSync(filePath);
  if (isBinary(buffer)) {
    skippedBinary += 1;
    continue;
  }

  checked += 1;
  const input = buffer.toString("utf8");
  const { output, unknown } = normalizeText(input);

  if (output !== input) {
    changed += 1;
    console.log(`${write ? "changed" : "would change"} ${path.relative(process.cwd(), filePath)}`);
    if (write) fs.writeFileSync(filePath, output, "utf8");
  }

  if (unknown.size > 0) {
    unknownByFile.push({
      filePath,
      chars: Array.from(unknown).sort().join(" "),
    });
  }
}

console.log("");
console.log(`checked: ${checked}`);
console.log(`changed: ${changed}`);
console.log(`skipped binary: ${skippedBinary}`);

if (unknownByFile.length > 0) {
  console.log("");
  console.log("remaining non-ASCII characters:");
  for (const item of unknownByFile) {
    console.log(`${path.relative(process.cwd(), item.filePath)}: ${item.chars}`);
  }
  console.log("");
  console.log("Use --include-unknown to replace remaining non-ASCII characters with ?.");
}
