# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY tsconfig.json ./
COPY src ./src

# Build the application
RUN npm run build

# Runtime stage
FROM node:20-alpine

WORKDIR /app

# Copy package files and install production dependencies only
COPY package*.json ./
RUN npm ci --only=production

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Create a non-root user to run the application
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set ownership
RUN chown -R nodejs:nodejs /app

USER nodejs

# The RimWorld path will be mounted as a volume
VOLUME ["/rimworld"]

# Default environment variables
ENV NODE_ENV=production

# The server uses stdio for MCP communication
ENTRYPOINT ["node", "dist/index.js"]

# Default CMD can be overridden with runtime arguments
CMD ["--rimworld-path=/rimworld"]