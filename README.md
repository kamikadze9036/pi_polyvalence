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

Na `spc-vm` nastav `SQL_SERVER` na Cyclades SQL host/IP dostupný z VM a
`SQL_PORT=1433`. DNS jméno nemusí být z VM spolehlivě dostupné. `SQL_INSTANCE`
používej jen tehdy, pokud se připojuješ přes SQL Server Browser místo pevného portu.
