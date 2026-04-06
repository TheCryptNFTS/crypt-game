#!/bin/bash
echo "Killing ALL node processes..."
pkill -9 -f "node" 2>/dev/null || true
sleep 1
echo "Checking remaining processes on ports 3000-5200..."
for port in 3000 5173 5174 5175 5176 5177 5178 5179 5180 5181; do
  pid=$(lsof -ti :$port 2>/dev/null)
  if [ -n "$pid" ]; then
    echo "Killing PID $pid on port $port"
    kill -9 $pid 2>/dev/null || true
  fi
done
sleep 1
echo "Done. All zombie processes killed."
echo "Remaining node processes:"
ps aux | grep node | grep -v grep || echo "None"
