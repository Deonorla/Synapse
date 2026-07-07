FROM node:20.11-alpine3.19

# Install sqlite3 dependencies natively required by alpine
RUN apk add --no-cache python3 make g++ 

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Create data directory for SQLite
RUN mkdir -p /app/data

# Expose port
EXPOSE 3002

# Command to run the server
CMD ["npx", "tsx", "src/index.ts"]
