# Complete Server Reset

# 1. Kill all node processes
taskkill /F /IM node.exe

# 2. Clear npm cache
npm cache clean --force

# 3. Delete node_modules (if needed)
# rm -rf node_modules

# 4. Reinstall dependencies
# npm install

# 5. Start fresh server
npm run dev
