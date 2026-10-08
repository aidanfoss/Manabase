---
name: test
description: Use when the user types /test or asks to run tests with Playwright visually so they can watch the app being tested in real-time.
---

# Test with Playwright (Visual UI / Headed Mode)

## Overview
Links local Scryfall bulk data and parsed caches from the main repository (preventing massive dataset re-downloads), and launches Playwright Test UI (`npm run test:e2e:ui`) or headed test execution so you can see the E2E test suite execute visually in real-time.

## Implementation

When you are invoked via `/test` or asked to run tests with Playwright:

1. **Link Scryfall bulk data/caches and launch Playwright Test UI:**
   Use the `PowerShell` tool to link Scryfall bulk datasets/caches if running inside a worktree, and launch Playwright Test UI (`npm run test:e2e:ui`) in a new detached terminal window.

   **Run this exact PowerShell snippet in ONE tool call:**

   ```powershell
   # 1. Link Scryfall bulk data and caches from main repo if in an isolated worktree
   $gitCommon = git rev-parse --git-common-dir 2>$null
   if ($gitCommon) {
       $mainRepo = (Split-Path (Resolve-Path $gitCommon) -Parent)
       $mainData = Join-Path $mainRepo "backend\data"
       $targetData = if (Test-Path "backend\data") { (Resolve-Path "backend\data").Path } else { (New-Item -ItemType Directory -Path "backend\data" -Force).FullName }
       if ((Test-Path $mainData) -and ($mainData -ne $targetData)) {
           $filesToLink = @("scryfall-default-cards.jsonl.gz", "scryfall-parsed-cache.json", "strictly_better_cache.json", "cardPrices.json", "landcycles.json")
           foreach ($file in $filesToLink) {
               $src = Join-Path $mainData $file
               $dest = Join-Path $targetData $file
               if ((Test-Path $src) -and (-not (Test-Path $dest))) {
                   try {
                       New-Item -ItemType SymbolicLink -Path $dest -Target $src -Force -ErrorAction Stop | Out-Null
                       Write-Host "Linked $file (symlink)"
                   } catch {
                       try {
                           New-Item -ItemType HardLink -Path $dest -Target $src -Force -ErrorAction Stop | Out-Null
                           Write-Host "Linked $file (hardlink)"
                       } catch {
                       	Write-Warning "Could not link $file`: $($_.Exception.Message)"
                       }
                   }
               }
           }
       }
   }

   # 2. Launch Playwright Test UI (interactive dashboard where you can see tests run, watch browser actions, inspect state, etc.)
   Start-Process cmd -ArgumentList "/k", "title Playwright Test UI && npm.cmd run test:e2e:ui"
   ```

2. **Wait for confirmation:**
   Tell the user that Scryfall data has been linked (if applicable) and Playwright Test UI has been launched in a new terminal window so they can watch the E2E tests run visually.

## Red Flags
- **DO NOT** skip linking Scryfall bulk data/caches in worktrees; without it, the backend will attempt a ~550MB download on boot during test runs.
- **DO NOT** run tests blindly without UI or headed mode when the user wants to see it test. Use `npm run test:e2e:ui` (`playwright test --ui`) so the test execution is fully visual and interactive.
