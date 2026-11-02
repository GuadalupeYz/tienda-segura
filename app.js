const express = require("express");
const helmet = require("helmet");

// API sin cookies ni sesiones y solo con rutas GET: CSRF no aplica.
const app = express(); // nosemgrep: javascript.express.security.audit.express-check-csurf-middleware-usage.express-check-csurf-middleware-usage

// Headers de seguridad (corrige los avisos de OWASP ZAP).
// helmet quita X-Powered-By y agrega X-Content-Type-Options, CSP, CORP, etc.
// Como es una API que solo devuelve JSON, la CSP no permite cargar nada.
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
  }),
);
app.use((req, res, next) => {
  res.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.set("Cache-Control", "no-store");
  next();
});

const total = (precio, cant, desc) =>
  precio * cant * (1 - desc);

app.get("/total", (req, res) => {
  const { p, c } = req.query;
  res.json({ total: total(p, c, 0) });
});

app.get("/calcular", (req, res) => {
  const resultado = Number(req.query.a) + Number(req.query.b);
  res.json({ resultado });
});

// 404 propio en JSON, para que también lleve los headers de seguridad
app.use((req, res) => {
  res.status(404).json({ error: "No encontrado" });
});

// Levantar el servidor solo si se ejecuta directamente (node app.js),
// no cuando los tests importan el módulo.
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`tienda-segura escuchando en el puerto ${PORT}`));
}

module.exports = { app, total };
