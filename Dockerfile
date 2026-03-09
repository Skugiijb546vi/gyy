FROM node:18-slim

# دابەزاندنی هەموو ئەو فایلانەی کە ڕۆبۆتەکە پێویستی پێیەتی بۆ کارکردن
RUN apt-get update && apt-get install -y \
    wget gnupg ca-certificates procps libxss1 \
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 \
    libcups2 libdrm2 libxkbcommon0 libxcomposite1 \
    libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 \
    --no-install-recommends && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .

CMD ["node", "index.js"]
