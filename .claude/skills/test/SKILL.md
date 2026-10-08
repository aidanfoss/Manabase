---
name: test
description: Use when the user types /test or asks to spin up a bounded backend and frontend to test manually in the browser.
---

# Test Local Branch Safely

## Overview
Spins up an isolated instance of the backend and frontend on fresh ports without colliding with existing development servers, links local Scryfall bulk data and parsed caches from the main repository (preventing massive dataset re-downloads), and launches the browser to test the active branch or worktree.

## Implementation

When you are invoked via `/test` or asked to spin up the servers:

1. **Find available ports, link Scryfall data, and launch both servers:**
   Use the `PowerShell` tool to link Scryfall bulk datasets/caches if running inside a worktree, choose random free ports, start the backend and frontend in detached `cmd` windows, and launch the browser.

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

   # 2. Find Random Free Ports
   $backPort = Get-Random -Minimum 8000 -Maximum 9000
   $frontPort = Get-Random -Minimum 5000 -Maximum 6000

   Write-Host "Chosen Backend Port: $backPort"
   Write-Host "Chosen Frontend Port: $frontPort"

   # 3. Launch Backend
   $env:PORT = $backPort
   $env:NODE_ENV = "development"
   $env:ENABLE_DEV_LOGIN = "true"
   # Start the backend in a new detached terminal 
   Start-Process cmd -ArgumentList "/k", "title Backend (Port $backPort) && cd backend && npm.cmd start"

   # 4. Launch Frontend
   $env:VITE_API_BASE = "http://localhost:$backPort"
   # Start the frontend in a new detached terminal
   Start-Process cmd -ArgumentList "/k", "title Frontend (Port $frontPort) && cd frontend && npm.cmd run dev -- --port $frontPort"

   # 5. Give the frontend a few seconds to start, then open the browser
   Start-Sleep -Seconds 3
   Start-Process "http://localhost:$frontPort"
   ```

2. **Wait for confirmation:**
   The servers will launch in new detached terminal windows. Tell the user the servers are running on the chosen ports, Scryfall data is linked, and the browser has been opened.

## Red Flags
- **DO NOT** skip linking Scryfall bulk data/caches in worktrees; without it, the backend will attempt a ~550MB download on boot.
- **DO NOT** use default ports 8080 and 5173, as they will collide if the user has the main branch running.
- **DO NOT** run the servers in the foreground or background inside the Claude process itself via `monitor` or `run_in_background` with `npm`—use `Start-Process cmd` so they have their own command prompt windows that the user can close manually.
- **DO NOT** skip `$env:ENABLE_DEV_LOGIN = "true"`; it is required for local dev login capability.
