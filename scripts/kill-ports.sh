#!/bin/bash
# Kill all zombie vite/node processes on ports 5173-5200
for port in $(seq 5173 5200); do
  pid=$(lsof -ti :$port 2>/dev/null)
  if [ -n "$pid" ]; then
    echo "Killing process $pid on port $port"
    kill -9 $pid 2>/dev/null
  fi
done
echo "All zombie Vite processes killed"
