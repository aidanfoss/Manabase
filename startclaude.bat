@echo off
title OmniRoute + Claude Code

echo Starting OmniRoute backend...
call omniroute serve --tray

echo Launching Claude Code with auto-coding profile...
call omniroute launch --profile auto-coding