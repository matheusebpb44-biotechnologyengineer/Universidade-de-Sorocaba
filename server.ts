import express from 'express';
import { PrismaClient } from '@prisma/client';
import { createServer as createViteServer } from 'vite';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import nodemailer from 'nodemailer';

const prisma = new PrismaClient();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // MOCK TRANSPORT for simulating email since we don't have real credentials
  const transporter = nodemailer.createTransport({
    streamTransport: true,
    newline: 'windows'
  });

  // API Routes
  app.post('/api/occurrences', async (req, res) => {
    try {
      const { titulo, descricao, categoria, latitude, longitude, cpf } = req.body;
      const protocolo = Math.random().toString(36).substring(2, 10).toUpperCase();

      const occurrence = await prisma.occurrence.create({
        data: {
          titulo,
          descricao,
          categoria,
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          cpf: cpf || '',
          protocolo,
        },
      });

      // After creating, check count
      const total = await prisma.occurrence.count();
      if (total > 0 && total % 10 === 0) {
        const last10 = await prisma.occurrence.findMany({
          take: 10,
          orderBy: { createdAt: 'desc' }
        });
        
        const txtData = last10.map(o => `Protocolo: ${o.protocolo}\nTítulo: ${o.titulo}\nCategoria: ${o.categoria}\nDescrição: ${o.descricao}\nLatitude: ${o.latitude}\nLongitude: ${o.longitude}\nData: ${o.createdAt}\n-----------------------------`).join('\n');
        
        const filename = `relatorio-${Date.now()}.txt`;
        fs.writeFileSync(filename, txtData);
        
        const mailOptions = {
          from: '"Cidadão Conectado" <no-reply@cidadaoconectado.local>',
          to: 'perissiojoao@gmail.com',
          subject: 'Relatório a cada 10 registros',
          text: 'Seguem em anexo os últimos 10 registros.',
          attachments: [
            {
              filename,
              path: filename
            }
          ]
        };
        
        transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            console.log('Error sending mock email:', error);
          } else {
            console.log('Mock email sent to perissiojoao@gmail.com! Content stream:', info.message.toString());
          }
        });
      }

      res.status(201).json(occurrence);
    } catch (error) {
      console.error('Error creating occurrence:', error);
      res.status(500).json({ error: 'Erro ao criar ocorrência.' });
    }
  });

  app.put('/api/occurrences/resolve/:protocolo', async (req, res) => {
    try {
      const { protocolo } = req.params;
      const updated = await prisma.occurrence.update({
        where: { protocolo },
        data: { resolvido: true }
      });
      res.json(updated);
    } catch (error) {
      console.error('Error resolving occurrence:', error);
      res.status(500).json({ error: 'Erro ao resolver ocorrência. Verifique o protocolo.' });
    }
  });

  app.get('/api/occurrences', async (req, res) => {
    try {
      const occurrences = await prisma.occurrence.findMany({
        orderBy: { createdAt: 'desc' }
      });
      res.json(occurrences);
    } catch (error) {
      console.error('Error fetching occurrences:', error);
      res.status(500).json({ error: 'Erro ao buscar ocorrências.' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
