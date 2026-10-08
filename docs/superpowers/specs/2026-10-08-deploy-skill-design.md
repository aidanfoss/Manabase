# Deploy Skill & Pipeline Design

## Overview
Design for a custom `/deploy` skill in Claude Code that deploys the Manabase application directly from your local development environment to your remote Docker stack at `192.168.1.223` (Portainer Community Edition environment).

## Clarification: Dockerfile & Docker Compose
- **Does this move away from the Dockerfile?** No! Your existing `Dockerfile` and `docker-compose.yml` remain fully intact. 
- When deploying, the script syncs the codebase to the remote server and runs `docker compose up -d --build`, which builds the exact same Docker image locally on `192.168.1.223` using your `Dockerfile`.

## Architecture & Workflow (Approach C)

1. **Pre-flight Checks (Local):**
   - Run backend test suite (`npm test -- --run`).
   - Run frontend production build check (`npm run build`).

2. **File Synchronization:**
   - Use `rsync` over SSH to sync project files (excluding `node_modules`, `.git`, `.db`, etc.) from local workspace to `DEPLOY_USER@192.168.1.223:/opt/manabase` (or configured remote path).

3. **Remote Build & Restart:**
   - Execute remote SSH command:
     ```bash
     cd /opt/manabase && docker compose up -d --build
     ```

4. **Health Check:**
   - Ping remote health endpoint (`http://192.168.1.223:8080/` or api health check) to confirm successful deployment.

## Configuration File (`.deploy.env`)
Stored locally (git-ignored):
```env
DEPLOY_HOST=192.168.1.223
DEPLOY_USER=root
DEPLOY_PATH=/opt/manabase
DEPLOY_PORT=8080
```

## Claude Code Skill Definition (`.claude/skills/deploy/index.md`)
Defines the slash command `/deploy` instructing Claude Code on executing the pre-flight checks, rsync sync, remote docker compose restart, and verification.
