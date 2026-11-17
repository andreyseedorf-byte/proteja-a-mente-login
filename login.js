const loginForm = document.querySelector('#loginForm');
const loginFeedback = document.querySelector('#loginFeedback');
const loginSubmit = document.querySelector('#loginSubmit');
const modeToggle = document.querySelector('#modeToggle');
const loginTitle = document.querySelector('#login-title');
const loginIntro = document.querySelector('#login-intro');
const passwordInput = document.querySelector('#senha');
const logoutButton = document.querySelector('#logoutButton');

const getSafeNextPath = () => {
  const requestedPath = new URLSearchParams(window.location.search).get('next');
  if (!requestedPath) return '/index.html';
  try {
    const destination = new URL(requestedPath, window.location.origin);
    if (destination.origin !== window.location.origin || destination.pathname.toLowerCase() === '/login.html') {
      return '/index.html';
    }
    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch (error) {
    return '/index.html';
  }
};

if (loginForm && loginFeedback && loginSubmit && modeToggle) {
  let isSignup = false;

  const showFeedback = (kind, text) => {
    loginFeedback.className = `form-feedback login-feedback${kind ? ` ${kind}` : ''}`;
    loginFeedback.textContent = text;
  };

  const setMode = (signup) => {
    isSignup = signup;
    loginTitle.textContent = signup ? 'Criar conta' : 'Entrar';
    loginIntro.textContent = signup
      ? 'Crie uma conta com um nome de utilizador e uma palavra-passe.'
      : 'Use o seu nome de utilizador e a palavra-passe.';
    loginSubmit.textContent = signup ? 'Criar conta' : 'Entrar';
    modeToggle.textContent = signup ? 'Já tem uma conta? Entrar' : 'Ainda não tem conta? Criar conta';
    modeToggle.setAttribute('aria-pressed', String(signup));
    passwordInput.autocomplete = signup ? 'new-password' : 'current-password';
    showFeedback('', '');
  };

  modeToggle.addEventListener('click', () => setMode(!isSignup));

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    showFeedback('', '');

    if (!loginForm.reportValidity()) return;

    const nome = loginForm.elements.nome.value.trim();
    const senha = loginForm.elements.senha.value;
    if (nome.length < 3 || senha.length < 8) {
      showFeedback('error', 'Confirme o nome de utilizador e use uma palavra-passe com pelo menos 8 caracteres.');
      return;
    }

    loginSubmit.disabled = true;
    loginSubmit.textContent = isSignup ? 'A criar conta…' : 'A entrar…';

    try {
      const response = await fetch(isSignup ? '/api/cadastro' : '/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ nome, senha })
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        showFeedback('error', result.message || 'Não foi possível concluir o pedido. Tente novamente.');
        return;
      }

      if (isSignup) {
        loginForm.elements.senha.value = '';
        setMode(false);
        showFeedback('success', 'Conta criada. Já pode entrar com os seus dados.');
        loginForm.elements.nome.focus();
        return;
      }

      showFeedback('success', `Sessão iniciada. Olá, ${result.user.nome}. A abrir o portal…`);
      window.location.assign(getSafeNextPath());
    } catch (error) {
      showFeedback('error', 'Não foi possível ligar ao servidor. Confirme que o Node.js e a base de dados estão em execução.');
    } finally {
      loginSubmit.disabled = false;
      loginSubmit.textContent = isSignup ? 'Criar conta' : 'Entrar';
    }
  });

  logoutButton?.addEventListener('click', async () => {
    logoutButton.disabled = true;
    try {
      const response = await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' });
      if (!response.ok) throw new Error('logout_failed');
      logoutButton.hidden = true;
      showFeedback('success', 'Sessão terminada.');
    } catch (error) {
      showFeedback('error', 'Não foi possível terminar a sessão. Tente novamente.');
    } finally {
      logoutButton.disabled = false;
    }
  });

  fetch('/api/me', { credentials: 'same-origin' })
    .then((response) => response.ok ? response.json() : null)
    .then((result) => {
      if (result?.user) {
        logoutButton.hidden = false;
        showFeedback('success', `Sessão iniciada. Olá, ${result.user.nome}.`);
      }
    })
    .catch(() => {
      // A tela permanece renderizada mesmo se o servidor não responder.
    });
}
