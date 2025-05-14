const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
  let file = req.url === '/' ? 'index.html' : req.url;
  const filePath = path.join(__dirname, 'public', file);
  const ext = path.extname(filePath).toLowerCase();

  const contentTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
  };

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404);
      res.end('Archivo no encontrado');
    } else {
      res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'text/plain' });
      res.end(content);
    }
  });
});

const wss = new WebSocket.Server({ server });
const salas = {};

wss.on('connection', (ws) => {
  ws.on('message', (msg) => {
    const data = JSON.parse(msg);

    if (data.tipo === 'join') {
      ws.idioma = data.idioma;
      ws.nombre = data.nombre || `Usuario${Math.floor(Math.random() * 1000)}`;
      if (!salas[ws.idioma]) salas[ws.idioma] = new Set();
      salas[ws.idioma].add(ws);

      const nombres = Array.from(salas[ws.idioma]).map(c => c.nombre);
      const payload = JSON.stringify({ tipo: 'usuarios', lista: nombres });
      salas[ws.idioma].forEach(cliente => {
        if (cliente.readyState === WebSocket.OPEN) cliente.send(payload);
      });
    }

    if (data.tipo === 'mensaje') {
      const mensaje = JSON.stringify({ tipo: 'mensaje', texto: data.texto , nombre:ws.nombre});
      if (salas[ws.idioma]) {
        salas[ws.idioma].forEach(cliente => {
          if (cliente.readyState === WebSocket.OPEN) cliente.send(mensaje);
        });
      }
    }

    if (['oferta', 'respuesta', 'ice'].includes(data.tipo)) {
      if (salas[ws.idioma]) {
        salas[ws.idioma].forEach(cliente => {
          if (cliente !== ws && cliente.readyState === WebSocket.OPEN) {
            cliente.send(JSON.stringify(data));
          }
        });
      }
    }

    if (data.tipo === 'invitar') {
      const destino = Array.from(salas[ws.idioma]).find(c => c.nombre === data.para);
      if (destino && destino.readyState === WebSocket.OPEN) {
        destino.send(JSON.stringify({ tipo: 'invitacion', de: ws.nombre }));
      }
    }

    if (data.tipo === 'respuesta-invitacion') {
      const origen = Array.from(salas[ws.idioma]).find(c => c.nombre === data.para);
      if (origen && origen.readyState === WebSocket.OPEN) {
        origen.send(JSON.stringify({
          tipo: 'respuesta-invitacion',
          aceptada: data.aceptada,
          de: ws.nombre
        }));
      }
    }
  });

  ws.on('close', () => {
    if (ws.idioma && salas[ws.idioma]) {
      salas[ws.idioma].delete(ws);
      const nombres = Array.from(salas[ws.idioma]).map(c => c.nombre);
      const payload = JSON.stringify({ tipo: 'usuarios', lista: nombres });
      salas[ws.idioma].forEach(cliente => {
        if (cliente.readyState === WebSocket.OPEN) cliente.send(payload);
      });
    }
  });
});

server.listen(3000, () => {
  console.log('Servidor en http://localhost:3000');
});