---
name: deploy
description: Deploys Manabase application directly to the remote Docker stack at 192.168.1.223 via SSH and Docker Compose.
---

# Deploy Manabase to Remote Stack (192.168.1.223)

## Overview
Deploys the current working state or branch to your remote Docker stack at `192.168.1.223`. It performs local pre-flight validation (tests and build), syncs the repository files via `rsync`, rebuilds and restarts the stack on the remote server using Docker Compose, and verifies health.

## Configuration
Deployment settings can be customized in `.deploy.env` at the root of the repository (git-ignored):
- `DEPLOY_HOST`: `192.168.1.223` (default)
- `DEPLOY_USER`: `root` (or configured SSH user)
- `DEPLOY_PATH`: `/opt/manabase` (remote repository/stack directory)

## Execution Steps

When invoked via `/deploy` (or asked to deploy):

1. **Pre-flight Validation (Local):**
   - Run backend tests: `cd backend && npm test -- --run`
   - Run frontend build: `cd frontend && npm run build`
   - If tests fail, abort deployment and report errors.

2. **File Synchronization (rsync over SSH):**
   - Sync working directory to the remote server, ignoring `node_modules`, `.git`, `backend/data/*.db`, and logs.
   - Command:
     ```powershell
     # Load .deploy.env if exists, otherwise defaults
     $hostIp = "192.168.1.223"
     $user = "root"
     $remotePath = "/opt/manabase"
     if (Test-Path ".deploy.env") {
         Get-Content ".deploy.env" | ForEach-Object {
             if ($_ -match '^\s*([^#\s]+)=(.*)$') {
                 [Environment]::SetEnvironmentVariable($matches[1], $matches[2].Trim('"'''))
             }
         }
         if ($env:DEPLOY_HOST) { $hostIp = $env:DEPLOY_HOST }
         if ($env:DEPLOY_USER) { $user = $env:DEPLOY_USER }
         if ($env:DEPLOY_PATH) { $remotePath = $env:DEPLOY_PATH }
     }

     Write-Host "Syncing files to $user@$hostIp`:$remotePath..."
     # Ensure remote directory exists
     ssh "$user@$hostIp" "mkdir -p $remotePath"

     # Rsync workspace (excluding ignored items)
     rsync -avz --exclude 'node_modules' --exclude '.git' --exclude '.claude' --exclude 'backend/data/*.db' --exclude 'frontend/dist' ./ "$user@$hostIp`:$remotePath/"
     ```

3. **Remote Build & Restart (Docker Compose):**
   - SSH into the remote host, enter `DEPLOY_PATH`, and run `docker compose up -d --build`:
     ```powershell
     Write-Host "Building and restarting containers on remote stack..."
     ssh "$user@$hostIp" "cd $remotePath && docker compose up -d --build"
     ```

4. **Health Check & Verification:**
   - Wait 5 seconds, then test remote health / HTTP response:
     ```powershell
     Start-Sleep -Seconds 5
     try {
         $response = Invoke-WebRequest -Uri "http://$hostIp:8080" -UseBasicParsing -TimeoutSec 10
         if ($response.StatusCode -eq 200) {
             Write-Host "Deployment successful! Manabase is running at http://$hostIp:8080" -ForegroundColor Green
         } else {
             Write-Warning "Deployment completed, but HTTP status code was $($response.StatusCode)"
         }
     } catch {
         Write-Warning "Could not reach http://$hostIp:8080 immediately: $_"
     }
     ```

## Red Flags
- **DO NOT** deploy if local backend unit tests fail.
- **DO NOT** sync `.git` or `node_modules` over rsync (let remote node install/rebuild if needed, or rely on container build).
- **DO NOT** overwrite remote production SQLite databases (`backend/data/*.db`).
