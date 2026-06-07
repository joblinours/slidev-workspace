# Slidev Workspace — Docker image
# Uses the official Playwright image for Node.js 22 + Chromium (required for PDF/PPTX export)
FROM mcr.microsoft.com/playwright:v1.50.0-noble

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    nginx \
    gettext-base \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm globally
RUN npm install -g pnpm@10

WORKDIR /app

# Skip playwright browser download — the Docker base image already ships Chromium
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Copy the full workspace source (needed at runtime for Vite build of the preview app)
COPY . /app/

# Install workspace dependencies and build the slidev-workspace package
RUN pnpm install --frozen-lockfile
RUN pnpm --filter slidev-workspace run build

# Remove Nginx default site
RUN rm -f /etc/nginx/sites-enabled/default

# Make scripts executable
RUN chmod +x /app/docker/entrypoint.sh /app/docker/cron-pull.sh

EXPOSE 8084

CMD ["/app/docker/entrypoint.sh"]
