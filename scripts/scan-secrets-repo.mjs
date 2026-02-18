import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

function getTrackedFiles() {
    const out = execSync("git ls-files", {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
    }).trim();

    return out ? out.split(/\r?\n/).filter(Boolean) : [];
}

const ignoreFilePatterns = [
    /^\.env(?:\..+)?$/i,
    /^dist\//i,
    /^node_modules\//i,
    /^\.git\//i,
    /^package-lock\.json$/i,
    /^pnpm-lock\.yaml$/i,
    /^yarn\.lock$/i,
    /^\.husky\//i,
];

const secretRules = [
    { name: "Google API key", pattern: /AIza[0-9A-Za-z\-_]{35}/g },
    { name: "Supabase anon/service JWT", pattern: /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g },
    { name: "OpenAI key", pattern: /sk-[A-Za-z0-9]{20,}/g },
    { name: "AWS access key", pattern: /AKIA[0-9A-Z]{16}/g },
    { name: "Private key block", pattern: /-----BEGIN (?:RSA|EC|OPENSSH|PGP|DSA)? ?PRIVATE KEY-----/g },
    {
        name: "Inline env assignment with long token",
        pattern: /(?:GOOGLE_MAPS_KEY|VITE_SUPABASE_ANON_KEY|SUPABASE_SERVICE_ROLE_KEY)\s*=\s*[^\s#]{20,}/g,
    },
];

const files = getTrackedFiles();
if (files.length === 0) process.exit(0);

const findings = [];

for (const file of files) {
    if (ignoreFilePatterns.some((rx) => rx.test(file))) continue;

    let content = "";
    try {
        content = readFileSync(file, "utf8");
    } catch {
        continue;
    }

    for (const rule of secretRules) {
        const matches = content.match(rule.pattern);
        if (matches && matches.length > 0) {
            findings.push({
                file,
                rule: rule.name,
                sample: matches[0].slice(0, 12) + "...",
            });
        }
    }
}

if (findings.length > 0) {
    console.error("\n❌ Push blocked: possible secret(s) detected in tracked files.\n");
    for (const f of findings) {
        console.error(`- ${f.file} | ${f.rule} | sample: ${f.sample}`);
    }
    console.error("\nPlease remove secrets from tracked files, commit, and push again.\n");
    process.exit(1);
}

console.log("✅ Secret scan passed (tracked files).");
