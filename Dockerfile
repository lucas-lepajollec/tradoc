# Stage 1: Build React UI Frontend
FROM node:26-alpine AS ui-builder
WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# Stage 2: Python Backend & Runtime Service
FROM python:3.14-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    DATA_DIR=/app/data

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY . .

# Copy UI build from Stage 1
COPY --from=ui-builder /app/web/dist /app/web/dist

# Create non-root user and persistent data directories
RUN groupadd -g 1000 tradocgroup && \
    useradd -u 1000 -g tradocgroup -s /bin/bash -m tradocuser && \
    mkdir -p /app/data/input /app/data/output /app/data/glossaries /app/data/jobs /app/data/tmp && \
    chown -R tradocuser:tradocgroup /app

USER tradocuser

EXPOSE 8000

CMD ["python", "main.py", "serve", "--host", "0.0.0.0", "--port", "8000"]
