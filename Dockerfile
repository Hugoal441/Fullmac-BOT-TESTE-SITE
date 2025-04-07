FROM node:18-bullseye

# Atualiza e instala as dependências necessárias para o Chromium/Puppeteer, incluindo libgbm1
RUN apt-get update && apt-get install -y \
  gconf-service \
  libasound2 \
  libatk1.0-0 \
  libcairo2 \
  libcups2 \
  libdbus-1-3 \
  libexpat1 \
  libfontconfig1 \
  libgconf-2-4 \
  libgdk-pixbuf2.0-0 \
  libglib2.0-0 \
  libgtk-3-0 \
  libnspr4 \
  libnss3 \
  libpango-1.0-0 \
  libpangocairo-1.0-0 \
  libstdc++6 \
  libx11-6 \
  libx11-xcb1 \
  libxcb1 \
  libxcomposite1 \
  libxcursor1 \
  libxdamage1 \
  libxext6 \
  libxfixes3 \
  libxi6 \
  libxrandr2 \
  libxrender1 \
  libxss1 \
  libxtst6 \
  ca-certificates \
  fonts-liberation \
  libappindicator1 \
  lsb-release \
  xdg-utils \
  wget \
  libdrm2 \
  libgbm1 \
  --no-install-recommends && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copia os arquivos de configuração e instala as dependências do projeto
COPY package*.json ./
RUN npm install

# Copia o restante dos arquivos do projeto
COPY . .

# (Opcional) Lista os arquivos para confirmar que o index.js está presente
RUN ls -al /app

CMD ["npm", "start"]
