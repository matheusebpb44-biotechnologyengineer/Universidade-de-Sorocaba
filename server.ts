import express from 'express';
import { PrismaClient } from '@prisma/client';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import nodemailer from 'nodemailer';

let dbUrl = process.env.DATABASE_URL || 'file:./dev.db';
if (process.env.VERCEL) {
  const tmpDbPath = '/tmp/dev.db';
  if (!fs.existsSync(tmpDbPath)) {
    try {
      fs.copyFileSync(path.join(process.cwd(), 'prisma', 'dev.db'), tmpDbPath);
    } catch (e) {
      console.log('Error copying DB on Vercel:', e);
    }
  }
  dbUrl = `file:${tmpDbPath}`;
}

const prisma = new PrismaClient({
  datasources: {
    db: { url: dbUrl }
  }
});
const app = express();
const PORT = process.env.PORT || 3000;

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
    const { titulo, descricao, categoria, latitude, longitude, cpf, prioridade } = req.body;
    const protocolo = Math.random().toString(36).substring(2, 10).toUpperCase();

    const occurrence = await prisma.occurrence.create({
      data: {
        titulo,
        descricao,
        categoria,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        cpf: cpf || '',
        prioridade: prioridade || 'Normal',
        protocolo,
      },
      include: {
        comments: true
      }
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
    const { cpf } = req.body;
    
    if (!cpf) {
      return res.status(400).json({ error: 'CPF é obrigatório para resolver a queixa.' });
    }

    const updated = await prisma.occurrence.update({
      where: { protocolo },
      data: { 
        resolvido: true,
        status: 'Resolvida',
        resolvedAt: new Date()
      }
    });
    res.json(updated);
  } catch (error) {
    console.error('Error resolving occurrence:', error);
    res.status(500).json({ error: 'Erro ao resolver ocorrência. Verifique o protocolo.' });
  }
});

app.get('/api/occurrences/history/:cpf', async (req, res) => {
  try {
    const { cpf } = req.params;
    const occurrences = await prisma.occurrence.findMany({
      where: { cpf },
      orderBy: { createdAt: 'desc' },
      include: { comments: true }
    });
    res.json(occurrences);
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ error: 'Erro ao buscar histórico.' });
  }
});

app.get('/api/occurrences', async (req, res) => {
  try {
    const occurrences = await prisma.occurrence.findMany({
      orderBy: { createdAt: 'desc' },
      include: { comments: true }
    });
    res.json(occurrences);
  } catch (error) {
    console.error('Error fetching occurrences:', error);
    res.status(500).json({ error: 'Erro ao buscar ocorrências.' });
  }
});

// Endpoints for likes and comments
app.put('/api/occurrences/:id/like', async (req, res) => {
  try {
    const { id } = req.params;
    const { cpf } = req.body;
    
    if (!cpf) {
      return res.status(400).json({ error: 'CPF é obrigatório para apoiar.' });
    }

    const updated = await prisma.occurrence.update({
      where: { id: Number(id) },
      data: { likes: { increment: 1 } },
      include: { comments: true }
    });
    res.json(updated);
  } catch (error) {
    console.error('Error liking occurrence:', error);
    res.status(500).json({ error: 'Erro ao curtir ocorrência.' });
  }
});

app.post('/api/occurrences/:id/comments', async (req, res) => {
  try {
    const { id } = req.params;
    const { texto, autorCpf } = req.body;
    
    if (!texto) return res.status(400).json({ error: 'Texto do comentário vazio.' });
    if (!autorCpf) return res.status(400).json({ error: 'CPF é obrigatório para comentar.' });

    const comment = await prisma.comment.create({
      data: {
        texto,
        autorCpf: autorCpf,
        occurrenceId: Number(id)
      }
    });
    res.status(201).json(comment);
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ error: 'Erro ao adicionar comentário.' });
  }
});

// Start Server Setup (Export app for Vercel, listen for local dev)
async function startServer() {
  if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // In standard production (like Cloud Run or standard VPS), serve static files.
    // For Vercel Serverless, this might not be hit if vercel.json routes differently, 
    // but works perfectly for general Node.js environments.
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Only listen if not running in a serverless environment (like Vercel)
  // Vercel sets typically process.env.VERCEL
  if (!process.env.VERCEL) {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

startServer();

export default app;
