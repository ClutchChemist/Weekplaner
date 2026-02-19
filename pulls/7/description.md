Thanks for asking me to work on this. I will get started on it and keep this PR's description up to date as I form a plan and make progress.

<!-- START COPILOT ORIGINAL PROMPT -->

<details>
<summary>Original prompt</summary>

> 1. Fix the TypeScript parsing error TS1128 in src/App.tsx, caused by a likely unterminated template literal when building the label variable (found near the onDeleteSession handler):
> - Replace the template literal used to build label with a non-template string (array join or string concatenation).
> - Replace the `${label}` argument passed to askConfirm with String(label).
> - Search for a second similar `const label = s ? ...` (with backticks) later in the file and apply the same fix.
> - Run a quick scan in src/App.tsx for further unterminated template literals and unbalanced `${...}` blocks, especially near delete/confirm code paths, and ensure parsing is sound.
> - Ensure npm run build (and formatting tools like prettier/eslint) succeed without parsing errors.
> 
> 2. Harden package.json:
> - Update the prepare script in package.json so that husky only runs if the .git directory exists, to prevent npm ci failures in environments without .git. (E.g., use a conditional that runs husky solely if .git is detected.)

</details>

<!-- START COPILOT CODING AGENT SUFFIX -->

*This pull request was created from Copilot chat.*
