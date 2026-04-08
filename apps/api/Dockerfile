# Use Node.js 20 slim as the base image
FROM node:20-slim AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy root manifest and lockfile
COPY package.json package-lock.json ./
# Copy the api package manifest
COPY apps/api/package.json ./apps/api/

# Install dependencies for the whole workspace
# Using clean install for reproducibility
RUN npm ci

# Final runner stage
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

# Create a non-privileged user to run the app
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 apiuser

# Copy node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules
# Copy the application code
COPY apps/api ./apps/api
# Copy root package.json for workspace resolution if needed
COPY package.json ./

# Set the correct permissions
RUN chown -R apiuser:nodejs /app

USER apiuser

EXPOSE 4000

# Start the application
CMD ["npm", "start", "--workspace", "@ehms/api"]
