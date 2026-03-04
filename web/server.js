const express = require("express");
const mysql = require("mysql2/promise");

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const PORT = 3000;

// En Docker Compose, el host es el nombre del servicio: "db"
const pool = mysql.createPool({
  host: process.env.DB_HOST || "db",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASS || "1234",
  database: process.env.DB_NAME || "transporte",
  waitForConnections: true,
  connectionLimit: 10,
});

// Home: “visualizar la imagen creada en el servidor vía web”
// (muestra que esta app corre desde la imagen Docker servidor-node)
app.get("/", (req, res) => {
  res.send(`
    <h2>App Transporte (Servicio público con conductor) 🚕</h2>
    <p>Servidor Node corriendo en contenedor Docker ✅</p>
    <ul>
      <li><a href="/reservas/nueva">Crear reserva (form)</a></li>
      <li><a href="/reservas">Ver reservas guardadas</a></li>
      <li><a href="/seed">Insertar 15 datos de prueba</a></li>
      <li><a href="/health">Health check</a></li>
    </ul>
  `);
});

app.get("/health", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT 1 AS ok");
    res.json({ status: "ok", db: rows[0].ok });
  } catch (e) {
    res.status(500).json({ status: "error", message: e.message });
  }
});

// Form para crear reserva
app.get("/reservas/nueva", (req, res) => {
  res.send(`
    <h2>Nueva reserva</h2>
    <form method="POST" action="/reservas">
      <h3>Cliente</h3>
      <label>Nombre:</label><br/>
      <input name="nombre" required /><br/><br/>

      <label>Cédula:</label><br/>
      <input name="cedula" required /><br/><br/>

      <label>Teléfono:</label><br/>
      <input name="telefono" required /><br/><br/>

      <label>Email (opcional):</label><br/>
      <input name="email" /><br/><br/>

      <label>¿Es frecuente?</label>
      <input type="checkbox" name="es_frecuente" value="1" /><br/><br/>

      <h3>Reserva</h3>
      <label>Fecha y hora (YYYY-MM-DD HH:MM:SS):</label><br/>
      <input name="fecha_servicio" placeholder="2026-03-04 08:00:00" required /><br/><br/>

      <label>Origen:</label><br/>
      <input name="origen" required /><br/><br/>

      <label>Destino:</label><br/>
      <input name="destino" required /><br/><br/>

      <label>Valor (COP):</label><br/>
      <input name="valor_cop" type="number" required /><br/><br/>

      <label>Confirmada</label>
      <input type="checkbox" name="confirmada" value="1" /><br/><br/>

      <button type="submit">Guardar</button>
    </form>
    <p><a href="/">Volver</a></p>
  `);
});

// Inserta cliente (si no existe) + reserva
app.post("/reservas", async (req, res) => {
  const {
    nombre, cedula, telefono, email,
    fecha_servicio, origen, destino, valor_cop,
  } = req.body;

  const es_frecuente = req.body.es_frecuente ? 1 : 0;
  const confirmada = req.body.confirmada ? 1 : 0;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Buscar cliente por cédula
    const [crows] = await conn.query(
      "SELECT id FROM clientes WHERE cedula = ?",
      [cedula]
    );

    let clienteId;
    if (crows.length > 0) {
      clienteId = crows[0].id;
    } else {
      const hoy = new Date().toISOString().slice(0, 10);
      const [ins] = await conn.query(
        `INSERT INTO clientes (nombre, cedula, telefono, fecha_registro, es_frecuente, email)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [nombre, cedula, telefono, hoy, es_frecuente, email || null]
      );
      clienteId = ins.insertId;
    }

    await conn.query(
      `INSERT INTO reservas (cliente_id, fecha_servicio, origen, destino, valor_cop, confirmada)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [clienteId, fecha_servicio, origen, destino, parseInt(valor_cop, 10), confirmada]
    );

    await conn.commit();
    res.redirect("/reservas");
  } catch (e) {
    await conn.rollback();
    res.status(500).send(`<pre>Error: ${e.message}</pre><p><a href="/">Volver</a></p>`);
  } finally {
    conn.release();
  }
});

// Listar reservas (enlace diferente)
app.get("/reservas", async (req, res) => {
  const [rows] = await pool.query(`
    SELECT r.id, c.nombre, c.cedula, r.fecha_servicio, r.origen, r.destino, r.valor_cop, r.confirmada
    FROM reservas r
    JOIN clientes c ON c.id = r.cliente_id
    ORDER BY r.id DESC
  `);

  const htmlRows = rows.map(r => `
    <tr>
      <td>${r.id}</td>
      <td>${r.nombre}</td>
      <td>${r.cedula}</td>
      <td>${r.fecha_servicio}</td>
      <td>${r.origen}</td>
      <td>${r.destino}</td>
      <td>${r.valor_cop}</td>
      <td>${r.confirmada ? "Sí" : "No"}</td>
    </tr>
  `).join("");

  res.send(`
    <h2>Reservas guardadas</h2>
    <table border="1" cellpadding="6">
      <tr>
        <th>ID</th><th>Cliente</th><th>Cédula</th><th>Fecha</th>
        <th>Origen</th><th>Destino</th><th>Valor</th><th>Confirmada</th>
      </tr>
      ${htmlRows}
    </table>
    <p><a href="/reservas/nueva">Crear otra</a> | <a href="/">Inicio</a></p>
  `);
});

// Cargar 15 datos automáticamente (para cumplir punto 5 rápido)
app.get("/seed", async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Crear 5 clientes (reutilizados)
    const clientes = [
      ["Ana Pérez", "10101010", "3001112233", "ana@mail.com", 1],
      ["Luis Gómez", "20202020", "3002223344", "luis@mail.com", 0],
      ["Carla Ruiz", "30303030", "3003334455", "carla@mail.com", 1],
      ["Juan Díaz", "40404040", "3004445566", null, 0],
      ["Sofía Mora", "50505050", "3005556677", "sofia@mail.com", 0],
    ];

    const hoy = new Date().toISOString().slice(0, 10);

    // Upsert simple por cédula
    const ids = {};
    for (const [nombre, cedula, tel, email, frecuente] of clientes) {
      const [found] = await conn.query("SELECT id FROM clientes WHERE cedula=?", [cedula]);
      if (found.length) {
        ids[cedula] = found[0].id;
      } else {
        const [ins] = await conn.query(
          `INSERT INTO clientes (nombre, cedula, telefono, fecha_registro, es_frecuente, email)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [nombre, cedula, tel, hoy, frecuente, email]
        );
        ids[cedula] = ins.insertId;
      }
    }

    // 15 reservas
    const reservas = [
      ["10101010","2026-03-10 07:00:00","Aeropuerto El Dorado","Chapinero",55000,1],
      ["10101010","2026-03-11 18:30:00","Chapinero","Terminal Salitre",42000,0],
      ["20202020","2026-03-12 06:15:00","Hotel Centro","Aeropuerto El Dorado",60000,1],
      ["20202020","2026-03-12 20:00:00","Centro","Teusaquillo",30000,0],
      ["30303030","2026-03-13 08:00:00","Portal 80","Zona T",65000,1],
      ["30303030","2026-03-13 12:10:00","Zona T","Parque 93",25000,1],
      ["40404040","2026-03-14 05:30:00","Suba","Aeropuerto El Dorado",70000,1],
      ["40404040","2026-03-14 19:45:00","Aeropuerto El Dorado","Suba",70000,0],
      ["50505050","2026-03-15 09:20:00","Engativá","Centro",38000,1],
      ["50505050","2026-03-15 22:00:00","Centro","Engativá",38000,0],
      ["10101010","2026-03-16 10:00:00","Parque 93","Usaquén",22000,1],
      ["20202020","2026-03-16 13:30:00","Teusaquillo","Chapinero",19000,1],
      ["30303030","2026-03-17 16:00:00","Chapinero","Salitre",28000,0],
      ["40404040","2026-03-18 07:40:00","Suba","Zona T",52000,1],
      ["50505050","2026-03-19 11:15:00","Centro","Aeropuerto El Dorado",60000,1],
    ];

    for (const [cedula, fecha, origen, destino, valor, conf] of reservas) {
      await conn.query(
        `INSERT INTO reservas (cliente_id, fecha_servicio, origen, destino, valor_cop, confirmada)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [ids[cedula], fecha, origen, destino, valor, conf]
      );
    }

    await conn.commit();
    res.send(`<p>✅ Se insertaron 15 reservas.</p><p><a href="/reservas">Ver reservas</a> | <a href="/">Inicio</a></p>`);
  } catch (e) {
    await conn.rollback();
    res.status(500).send(`<pre>Error: ${e.message}</pre><p><a href="/">Volver</a></p>`);
  } finally {
    conn.release();
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Web corriendo en puerto ${PORT}`);
});