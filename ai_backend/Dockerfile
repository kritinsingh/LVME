FROM python:3.9-slim

WORKDIR /app

# Install system dependencies needed for MediaPipe, OpenCV, etc.
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

# Explicitly install uvicorn if not in requirements
RUN pip install uvicorn python-multipart

COPY . .

# Expose port (will be overridden by $PORT on cloud hosts like Heroku/Render)
ENV PORT=8000
EXPOSE $PORT

# Start command
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port $PORT"]
