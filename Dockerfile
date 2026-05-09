FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src/ ./src/
COPY prisma/ ./prisma/

# Generate Prisma client
RUN npx prisma generate

# Build the application
RUN npm run build

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S guardian -u 1001

# Create directories for plugins and logs
RUN mkdir -p /app/plugins /app/logs
RUN chown -R guardian:nodejs /app

USER guardian

EXPOSE 3000

CMD ["npm", "start"]