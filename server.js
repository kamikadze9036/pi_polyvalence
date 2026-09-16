const express = require('express');
const path = require('path');
const sql = require('mssql');

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.disable('x-powered-by');

function toBoolean(value, defaultValue) {
    if (value === undefined || value === '') return defaultValue;
    return value.toLowerCase() === 'true';
}

function getSqlConfig() {
    if (!process.env.SQL_USER || !process.env.SQL_PASSWORD) {
        throw new Error('SQL_USER and SQL_PASSWORD must be configured');
    }

    const config = {
        server: process.env.SQL_SERVER || 'PLZ-SISE',
        database: process.env.SQL_DATABASE || 'SUIVPRO',
        user: process.env.SQL_USER,
        password: process.env.SQL_PASSWORD,
        options: {
            encrypt: toBoolean(process.env.SQL_ENCRYPT, false),
            trustServerCertificate: toBoolean(process.env.SQL_TRUST_SERVER_CERTIFICATE, true)
        }
    };

    if (process.env.SQL_PORT) {
        const port = Number(process.env.SQL_PORT);
        if (!Number.isInteger(port) || port < 1 || port > 65535) {
            throw new Error('SQL_PORT must be a valid TCP port');
        }
        config.port = port;
    } else {
        config.options.instanceName = process.env.SQL_INSTANCE || 'SQLSISE';
    }

    return config;
}

let poolPromise;

function getPool() {
    if (!poolPromise) {
        poolPromise = sql.connect(getSqlConfig()).catch((err) => {
            poolPromise = undefined;
            throw err;
        });
    }
    return poolPromise;
}

function parseDateParam(value, name) {
    if (value === undefined || value === '') return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw new Error(`${name} must use YYYY-MM-DD format`);
    }

    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
        date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== day
    ) {
        throw new Error(`${name} is not a valid date`);
    }

    return value;
}

// Serves only the application entry point. Backend source and package files are not public.
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.get('/api/polyvalence-data', async (req, res) => {
    try {
        const fromDate = parseDateParam(req.query.from, 'from');
        const toDate = parseDateParam(req.query.to, 'to');

        if (fromDate && toDate && fromDate > toDate) {
            return res.status(400).json({ error: 'from must not be later than to' });
        }

        const pool = await getPool();
        const reqSql = pool.request();

        reqSql.input('fromDate', sql.Date, fromDate);
        reqSql.input('toDate', sql.Date, toDate);

        const result = await reqSql.query(`
            SELECT 
                io.INFOOP_CODEOP AS [op],
                -- Čistá forma jako klíč pro seskupení
                CASE 
                    WHEN CHARINDEX('-', io.INFOOP_REFOUT) > 0 
                    THEN LTRIM(RTRIM(LEFT(io.INFOOP_REFOUT, CHARINDEX('-', io.INFOOP_REFOUT) - 1)))
                    ELSE io.INFOOP_REFOUT 
                END AS [key],
                -- Čistý label: forma + popis (bez lisu a bez duplicity)
                CASE 
                    WHEN MAX(r.LIBOUT) LIKE (CASE WHEN CHARINDEX('-', io.INFOOP_REFOUT) > 0 THEN LTRIM(RTRIM(LEFT(io.INFOOP_REFOUT, CHARINDEX('-', io.INFOOP_REFOUT) - 1))) ELSE io.INFOOP_REFOUT END + '%') 
                    THEN MAX(r.LIBOUT)
                    ELSE (CASE WHEN CHARINDEX('-', io.INFOOP_REFOUT) > 0 THEN LTRIM(RTRIM(LEFT(io.INFOOP_REFOUT, CHARINDEX('-', io.INFOOP_REFOUT) - 1))) ELSE io.INFOOP_REFOUT END) + ISNULL(' - ' + MAX(r.LIBOUT), '')
                END AS [label],
                MAX(io.INFOOP_REFMAC) AS [type],
                MAX(CAST(io.INFOOP_REFEQUIPE AS VARCHAR(50))) AS [shift],
                SUM(ISNULL(io.INFOOP_DUREEPOSTE, 0)) AS [time_seconds]
            FROM INFO_OPERATEUR io
            LEFT JOIN (
                SELECT DISTINCT REFOUT, LIBOUT 
                FROM Resultat_equipe 
                WHERE LIBOUT IS NOT NULL AND LIBOUT != ''
            ) r ON r.REFOUT = io.INFOOP_REFOUT
            WHERE (@fromDate IS NULL OR io.INFOOP_DATE >= @fromDate)
              AND (@toDate IS NULL OR io.INFOOP_DATE <= @toDate)
            GROUP BY 
                io.INFOOP_CODEOP, 
                CASE 
                    WHEN CHARINDEX('-', io.INFOOP_REFOUT) > 0 
                    THEN LTRIM(RTRIM(LEFT(io.INFOOP_REFOUT, CHARINDEX('-', io.INFOOP_REFOUT) - 1)))
                    ELSE io.INFOOP_REFOUT 
                END
        `);

        return res.json({ records: result.recordset });
    } catch (err) {
        console.error('Chyba při komunikaci s SQL:', err);

        if (err.message.includes('must use') || err.message.includes('is not a valid') || err.message.includes('must not be later')) {
            return res.status(400).json({ error: 'Neplatný filtr data.' });
        }

        return res.status(500).json({ error: 'Nepodařilo se načíst data ze SQL serveru.' });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server běží na http://localhost:${PORT}`);
});
