# Login obrigatório — Proteja a Mente (Node.js)

O portal agora exige login para abrir a página inicial e qualquer outra página HTML. Quem tentar acessar uma página diretamente será enviado para `login.html` e, após entrar, voltará ao destino solicitado. CSS, JavaScript e imagens necessários para renderizar o formulário continuam acessíveis. As palavras-passe são armazenadas como hash com bcrypt e as sessões são mantidas no MySQL.

## Requisitos

- Node.js 18 ou superior e npm.
- MySQL Server ativo.
- MySQL Workbench (ou outra ferramenta para executar SQL).

## Instalar e iniciar

1. Abra a pasta principal do projeto no terminal.
2. No MySQL Workbench, execute o ficheiro `server/schema.sql`.
3. Copie `.env.example` para `.env` na raiz do projeto:
   - Windows PowerShell: `Copy-Item .env.example .env`
   - macOS/Linux: `cp .env.example .env`
4. Edite `.env`: preencha `DB_USER` e `DB_PASSWORD`. Gere um segredo de sessão com:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

   Cole o valor produzido em `SESSION_SECRET`.
5. Na pasta principal, execute:

   ```bash
   npm install
   npm start
   ```

6. Abra `http://localhost:3000`. Como ainda não há conta, escolha **Criar conta**. Depois entre com os mesmos dados; o sistema encaminhará para a página inicial ou para a página que tentou abrir.

Para verificar a sintaxe dos ficheiros JavaScript, execute `npm run check`. Para desenvolvimento com reinício automático, use `npm run dev`.

O servidor protege as páginas HTML mesmo quando os endereços são digitados diretamente; não é apenas um redirecionamento visual no navegador. A sessão expira após 8 horas. O servidor aplica consultas parametrizadas, limite de tentativas e cookie `HttpOnly`. A tabela de sessões é criada automaticamente no MySQL. Nunca envie o `.env` ao GitHub. O acesso real depende de MySQL ativo e credenciais válidas.

## Divisão da equipa

| Pessoa | Parte | Ficheiros principais |
|---|---|---|
| Alexander | Estrutura e formulário HTML | `login.html` |
| Andrey | Identidade visual e responsividade | bloco Login em `style.css` |
| Kalil | JavaScript do formulário e redirecionamento | `login.js` |
| PH | Estrutura da base de dados | `server/schema.sql` |
| Vynicius | API, autenticação, sessões e bloqueio das páginas | `server/server.js`, `server/db.js`, `.env.example`, `server/package.json` |
