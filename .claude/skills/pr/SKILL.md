---
name: pr
description: Use when needing to trigger a pull request submission automatically via the gitSessionStart hook
---

# PR Automation Skill

## Overview
Automates pull request creation safely when the `gitSessionStart` hook is triggered.

## When to Use
Use when needing to trigger a pull request submission automatically via the `gitSessionStart` hook.

## Rationalization Table
| Excuse | Reality |
|--------|---------|
| "Just add `!gh pr create`" | Fails if branch not pushed or no changes exist. |
| "Too tired, quick fix is fine" | Brittle hook breaks workflows; consumes more time later fixing it. |
| "I'll handle errors when they happen" | Errors occur immediately; hook becomes a blocker. |

## Red Flags - STOP and Start Over
- Adding bare commands to hooks (e.g., `!gh pr create`).
- Ignoring error output from hook commands.
- Not verifying branch state before PR creation.

## Core Pattern
1. Verify repository state (clean, pushed).
2. Check if PR exists.
3. If no, create PR; if yes, update or notify.
4. Log results robustly.

## Example
```bash
# Example implementation for .claude/hooks/gitSessionStart
if ! git diff --quiet; then
  echo "Changes exist, ensuring branch is pushed..."
  git push origin HEAD
fi

if ! gh pr view > /dev/null 2>&1; then
  echo "Creating PR..."
  gh pr create --fill --title "Automated PR"
else
  echo "PR already exists for this branch."
fi
```

