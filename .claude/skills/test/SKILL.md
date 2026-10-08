---
name: test
description: Use when the user types /test or asks to run tests with Playwright visually so they can watch the app being tested in real-time.
---

# Test with Playwright (Visual UI / Headed Mode)

## Overview
Links local `node_modules`, Scryfall bulk data, and parsed caches from the main repository (preventing massive dataset re-downloads and npm installs), and launches Playwright Test UI (`npm run test:e2e:ui`) so you can see the E2E test suite execute visually in real-time.

## Implementation

When you are invoked via `/test` or asked to run tests with Playwright:

1. **Link `node_modules`, Scryfall bulk data/caches, and launch Playwright Test UI:**
   Use the `PowerShell` tool to link `node_modules` and Scryfall bulk datasets/caches if running inside a worktree, and launch Playwright Test UI (`npm run test:e2e:ui`) in a new detached terminal window.

   **Run this exact PowerShell snippet in ONE tool call:**

   ```powershell
   # 1. Link node_modules and Scryfall data from main repo if in an isolated worktree
   $gitCommon = git rev-parse --git-common-dir 2>$null
   if ($gitCommon) {
       $mainRepo = (Split-Path (Resolve-Path $gitCommon) -Parent)
       
       # Link backend node_modules
       $mainBackMod = Join-Path $mainRepo "backend\node_modules"
       $targetBackMod = Join-Path (Get-Location) "backend\node_modules"
       if ((Test-Path $mainBackMod) -and (-not (Test-Path $targetBackMod))) {
           try {
               New-Item -ItemType SymbolicLink -Path $targetBackMod -Target $mainBackMod -Force -ErrorAction Stop | Out-Null
               Write-Host "Linked backend\node_modules"
           } catch {
               Write-Warning "Could not link backend\node_modules`: $($_.Exception.Message)"
           }
       }

       # Link frontend node_modules
       $mainFrontMod = Join-Path $mainRepo "frontend\node_modules"
       $targetFrontMod = Join-Path (Get-Location) "frontend\node_modules"
       if ((Test-Path $mainFrontMod) -and (-not (Test-Path $targetFrontMod))) {
           try {
               New-Item -ItemType SymbolicLink -Path $targetFrontMod -Target $mainFrontMod -Force -ErrorAction Stop | Out-Null
               Write-Host "Linked frontend\node_modules"
           } catch {
               Write-Warning "Could not link frontend\node_modules`: $($_.Exception.Message)"
           }
       }

       # Link Scryfall bulk data and caches
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
   Tell the user that `node_modules` and Scryfall data have been linked (if applicable) and Playwright Test UI has been launched in a new terminal window so they can watch the E2E tests run visually.

## Red Flags
- **DO NOT** skip linking `node_modules` and Scryfall bulk data/caches in worktrees; without them, backend/frontend startup fails or attempts massive downloads/installs.
- **DO NOT** run tests blindly without UI or headed mode when the user wants to see it test. Use `npm run test:e2e:ui` (`playwright test --ui`) so the test execution is fully visual and interactive.
