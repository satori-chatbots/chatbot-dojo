#!/bin/bash


SESSION_NAME="sensei-dev"

# Check if tmux session already exists
if tmux has-session -t $SESSION_NAME 2>/dev/null; then
    echo "Session '$SESSION_NAME' already exists. Attaching..."
    tmux attach-session -t $SESSION_NAME
    exit 0
fi

# Create new tmux session
echo "Creating new tmux session: $SESSION_NAME"

# Start tmux session with first window (backend)
tmux new-session -d -s $SESSION_NAME -n "backend"

# Setup backend window
tmux send-keys -t $SESSION_NAME:backend "cd backend" Enter
tmux send-keys -t $SESSION_NAME:backend "source ../.venv/bin/activate" Enter
tmux send-keys -t $SESSION_NAME:backend "python manage.py runserver" Enter

# Create second window for frontend
tmux new-window -t $SESSION_NAME -n "frontend"

# Setup frontend window
tmux send-keys -t $SESSION_NAME:frontend "cd frontend" Enter
tmux send-keys -t $SESSION_NAME:frontend "pnpm run dev" Enter

# Create third window for editor/general terminal (in root)
tmux new-window -t $SESSION_NAME -n "editor"

# Setup editor window (stays in root directory)
# Uncomment one of these lines based on your preferred editor:
# tmux send-keys -t $SESSION_NAME:editor "nvim ." Enter
# tmux send-keys -t $SESSION_NAME:editor "code ." Enter

# Select the dev window as default
tmux select-window -t $SESSION_NAME:editor

# Attach to the session
tmux attach-session -t $SESSION_NAME
