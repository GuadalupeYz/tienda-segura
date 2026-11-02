const TOKEN = "ghp_aB3dE6gH9jK2mN5pQ8sT1vW4yZ7cF0hJ3kL6";
const express = require("express");

// API sin cookies ni sesiones y solo con rutas GET: CSRF no aplica.
const app = express(); // nosemgrep: javascript.express.security.audit.express-check-csurf-middleware-usage.express-check-csurf-middleware-usage

const total = (precio, cant, desc) =>
  precio * cant * (1 - desc);

app.get("/total", (req, res) => {
  const { p, c } = req.query;
  res.json({ total: total(p, c, 0) });
});

module.exports = { app, total };
