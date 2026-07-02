FROM node:20.11-alpine3.19

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Source code is bind-mounted at runtime for hot reload
# Expose port
EXPOSE 5173

# Command to run the vite dev server bound to all interfaces
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
