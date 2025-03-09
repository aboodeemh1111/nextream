#!/bin/bash

# Nextream Development Startup Script

echo "Nextream Development Startup"
echo "============================"
echo ""

# Check if tmux is installed
if ! command -v tmux &> /dev/null; then
    echo "This script uses tmux to run multiple processes. Please install tmux first."
    echo "On Ubuntu/Debian: sudo apt-get install tmux"
    echo "On macOS with Homebrew: brew install tmux"
    exit 1
fi

# Create a new tmux session
tmux new-session -d -s nextream

# Split the window into three panes
tmux split-window -h -t nextream
tmux split-window -v -t nextream:0.1

# Start the backend in the first pane
tmux send-keys -t nextream:0.0 "cd onstream/api && npm run dev" C-m

# Start the client in the second pane
tmux send-keys -t nextream:0.1 "cd nextream-client && npm run dev" C-m

# Start the admin in the third pane
tmux send-keys -t nextream:0.2 "cd nextream-admin && npm run dev" C-m

# Attach to the tmux session
tmux attach-session -t nextream

echo "All components started in development mode."
echo "Press Ctrl+B then D to detach from tmux session without stopping the servers."
echo "To reattach later, run: tmux attach-session -t nextream" 