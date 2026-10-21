FROM node:22-alpine
WORKDIR /usr/src/app

# 1. Copy the workspace configuration files from the root
COPY package*.json ./

# 2. Copy both the shared modules and the api modules
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

# 3. Install all project dependencies across the workspace
RUN npm install

# 4. Copy any remaining root files (like tsconfig.json)
COPY . .

EXPOSE 3000

# 5. Run the compiled JavaScript execution entrypoint
CMD ["node", "apps/api/dist/server.js"]
