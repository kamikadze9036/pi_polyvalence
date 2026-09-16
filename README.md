# Polyvalence Tracker

Jednoduchá Node.js/Express aplikace s frontendem v `index.html` a API pro načítání dat z Microsoft SQL Serveru.

## Spuštění v Dockeru

1. Zkopíruj `.env.example` do `.env` a doplň SQL přístupové údaje.
2. Sestav image:

   ```bash
   docker build -t polyvalence:secure .
   ```

3. Spusť kontejner:

   ```bash
   docker run -d \
     --restart unless-stopped \
     --name polyvalence \
     --env-file .env \
     --publish 3000:3000 \
     polyvalence:secure
   ```

Aplikace je dostupná na `http://localhost:3000`. Stav kontejneru lze ověřit na `/health`.

Pro SQL Server s pevně nastaveným TCP portem použij `SQL_PORT` místo `SQL_INSTANCE`.
