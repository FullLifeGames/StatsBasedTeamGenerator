import cors from 'cors';
import express from 'express';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createSmogonRouter} from './smogon/routes';

const app = express();
const port = Number(process.env.PORT ?? 8787);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '..', 'dist');

app.use(cors({origin: ['http://127.0.0.1:5173', 'http://localhost:5173']}));
app.use('/api', createSmogonRouter());
app.use(express.static(distDir));
app.get('*', (_request, response) => {
  response.sendFile(path.join(distDir, 'index.html'));
});

app.listen(port, '127.0.0.1', () => {
  console.log(`Smogon team generator API listening on http://127.0.0.1:${port}`);
});
