# frontend/Dockerfile
FROM node:18

WORKDIR /app

# Install deps using the lockfile only
COPY package*.json ./
RUN npm ci

# Now copy the rest of the app
COPY . .

CMD ["npm", "run", "dev"]
