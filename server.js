require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

const path = require('path');
const express = require('express');
const bcrypt = require('bcrypt');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const pool = require('./db');

const requiredEnv = ['DB_HOST', 'DB_USER', 'DB_NAME', 'SESSION_SECRET'];
const missingEnv = requiredEnv.filter((key) => !process.env[key]);
if (missingEnv.length) {
  console.error(`Configuração em falta no .env: ${missingEnv.join(', ')}`);
  process.exit(1);
}
if (process.env.SESSION_SECRET.length < 32) {
  console.error('SESSION_SECRET deve ter pelo menos 32 caracteres. Gere um segredo aleatório e privado.');
  process.exit(1);
}

const app = express();
const port = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';
const sessionStore = new MySQLStore({
  clearExpired: true,
  checkExpirationInterval: 15 * 60 * 1000,
  expiration: 8 * 60 * 60 * 1000,
  createDatabaseTable: true
}, pool);

if (isProduction) app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet());
app.use(express.json({ limit: '10kb' }));
app.use(session({
  name: 'proteja.sid',
  secret: process.env.SESSION_SECRET,
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000
  }
}));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Demasiadas tentativas. Aguarde alguns minutos e tente novamente.' }
});

const siteRoot = path.resolve(__dirname, '..');
app.use((req, res, next) => {
  if (req.path.startsWith('/server/') || ['/README-LOGIN.md', '/.env.example', '/.gitignore'].includes(req.path)) {
    return res.sendStatus(404);
  }
  next();
});

// Exige sessão ao abrir a raiz ou qualquer página HTML. CSS, JavaScript e imagens
// ficam acessíveis para que a própria tela de login possa ser renderizada.
app.use((req, res, next) => {
  const isPageRequest = req.method === 'GET' || req.method === 'HEAD';
  const isHtmlPage = req.path === '/' || req.path.toLowerCase().endsWith('.html');
  const isLoginPage = req.path.toLowerCase() === '/login.html';

  if (isPageRequest && isHtmlPage) res.set('Cache-Control', 'no-store');
  if (isPageRequest && isHtmlPage && !isLoginPage && !req.session.user) {
    return res.redirect(302, `/login.html?next=${encodeURIComponent(req.originalUrl)}`);
  }
  next();
});

app.use(express.static(siteRoot, { index: 'index.html', dotfiles: 'deny' }));

app.get('/api/me', (req, res) => {
  if (!req.session.user) return res.status(401).json({ message: 'Sessão não iniciada.' });
  res.json({ user: req.session.user });
});

app.post('/api/cadastro', authLimiter, async (req, res) => {
  const nome = typeof req.body?.nome === 'string' ? req.body.nome.trim() : '';
  const senha = typeof req.body?.senha === 'string' ? req.body.senha : '';

  if (nome.length < 3 || nome.length > 100 || senha.length < 8 || Buffer.byteLength(senha, 'utf8') > 72) {
    return res.status(400).json({ message: 'Use um nome de 3 a 100 caracteres e uma palavra-passe com pelo menos 8 caracteres.' });
  }

  try {
    const senhaHash = await bcrypt.hash(senha, 12);
    await pool.promise().execute(
      'INSERT INTO usuarios (nome, senha_hash) VALUES (?, ?)',
      [nome, senhaHash]
    );
    res.status(201).json({ message: 'Conta criada.' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Esse nome de utilizador já está em uso.' });
    }
    console.error('Erro ao criar conta:', error.message);
    res.status(500).json({ message: 'Não foi possível criar a conta neste momento.' });
  }
});

app.post('/api/login', authLimiter, async (req, res) => {
  const nome = typeof req.body?.nome === 'string' ? req.body.nome.trim() : '';
  const senha = typeof req.body?.senha === 'string' ? req.body.senha : '';
  if (!nome || !senha || nome.length > 100 || Buffer.byteLength(senha, 'utf8') > 72) {
    return res.status(400).json({ message: 'Informe um nome de utilizador e uma palavra-passe válidos.' });
  }

  try {
    const [rows] = await pool.promise().execute(
      'SELECT id, nome, senha_hash FROM usuarios WHERE nome = ? LIMIT 1',
      [nome]
    );
    const user = rows[0];
    const passwordMatches = user ? await bcrypt.compare(senha, user.senha_hash) : false;
    if (!passwordMatches) {
      return res.status(401).json({ message: 'Nome de utilizador ou palavra-passe incorretos.' });
    }

    req.session.regenerate((sessionError) => {
      if (sessionError) {
        console.error('Erro ao iniciar sessão:', sessionError.message);
        return res.status(500).json({ message: 'Não foi possível iniciar a sessão.' });
      }
      req.session.user = { id: user.id, nome: user.nome };
      req.session.save((saveError) => {
        if (saveError) {
          console.error('Erro ao guardar sessão:', saveError.message);
          return res.status(500).json({ message: 'Não foi possível iniciar a sessão.' });
        }
        res.json({ message: 'Sessão iniciada.', user: req.session.user });
      });
    });
  } catch (error) {
    console.error('Erro ao autenticar:', error.message);
    res.status(500).json({ message: 'Não foi possível iniciar a sessão neste momento.' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      console.error('Erro ao terminar sessão:', error.message);
      return res.status(500).json({ message: 'Não foi possível terminar a sessão.' });
    }
    res.clearCookie('proteja.sid', { httpOnly: true, secure: isProduction, sameSite: 'lax' });
    res.status(204).end();
  });
});

app.use('/api', (_req, res) => res.status(404).json({ message: 'Rota de API não encontrada.' }));
app.use((error, _req, res, _next) => {
  console.error('Erro no servidor:', error.message);
  res.status(500).json({ message: 'Ocorreu um erro interno.' });
});

const server = app.listen(port, () => console.log(`Proteja a Mente disponível em http://localhost:${port}`));

const shutdown = () => {
  server.close(() => {
    sessionStore.close(() => pool.end(() => process.exit(0)));
  });
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
