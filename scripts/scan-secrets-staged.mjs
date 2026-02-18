import { execSync } from "node:child_process";

function getStagedFiles() {
    const out = execSync("git diff --cached --name-only --diff-filter=ACMR", {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
    }).trim();

    return out ? out.split(/\r?\n/).filter(Boolean) : [];
}

function getStagedContent(file) {
    try {
        return execSync(`git show :"${file.replaceAll('"', '\\"')}"`, {
            encoding: "utf8",
            stdio: ["ignore", "pipe", "ignore"],
            maxBuffer: 10 * 1024 * 1024,
        });
    } catch {
        return "";
    }
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
];

const files = getStagedFiles();
if (files.length === 0) {
    process.exit(0);
}

const findings = [];

for (const file of files) {
    if (ignoreFilePatterns.some((rx) => rx.test(file))) continue;

    const content = getStagedContent(file);
    if (!content) continue;

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
    console.error("\n❌ Commit blocked: possible secret(s) detected in staged files.\n");
    for (const f of findings) {
        console.error(`- ${f.file} | ${f.rule} | sample: ${f.sample}`);
    }
    console.error("\nPlease remove or move secrets to .env (ignored), then re-stage and commit again.\n");
    process.exit(1);
}

console.log("✅ Secret scan passed (staged files).");
