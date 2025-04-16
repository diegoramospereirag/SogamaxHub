const firebaseConfig = {
  apiKey: 'AIzaSyDZrv5oWMFIAxENJNDQ955p7Qd6emAucZ8',
  authDomain: 'visita-hub.firebaseapp.com',
  projectId: 'visita-hub',
  storageBucket: 'visita-hub.appspot.com',
  messagingSenderId: '822877939306',
  appId: '1:822877939306:web:c5f51e535c16e9996acc13',
}

firebase.initializeApp(firebaseConfig)
const auth = firebase.auth()

document.querySelector('.toggle-password').addEventListener('click', function () {
  const passwordInput = document.getElementById('password')
  const icon = this.querySelector('i')

  if (passwordInput.type === 'password') {
    passwordInput.type = 'text'
    icon.classList.replace('ri-eye-line', 'ri-eye-off-line')
  } else {
    passwordInput.type = 'password'
    icon.classList.replace('ri-eye-off-line', 'ri-eye-line')
  }
})

function showError(message) {
  const existingError = document.querySelector('.error-message')
  if (existingError) {
    existingError.remove()
  }

  const errorElement = document.createElement('div')
  errorElement.className = 'error-message'
  errorElement.innerHTML = `
          <i class="ri-error-warning-line"></i>
          <span>${message}</span>
        `

  const form = document.getElementById('login')
  form.insertBefore(errorElement, form.firstChild)
}

function setLoading(button, isLoading) {
  const buttonText = button.querySelector('.button-text')
  if (isLoading) {
    button.disabled = true
    buttonText.innerHTML = '<i class="ri-loader-4-line spin"></i> Entrando...'
  } else {
    button.disabled = false
    buttonText.textContent = 'Entrar'
  }
}

function redirectAfterLogin() {
  window.location.href = '/src/app.html'
}

document.getElementById('login').addEventListener('submit', async (e) => {
  e.preventDefault()

  const email = document.getElementById('email').value
  const password = document.getElementById('password').value
  const submitButton = e.target.querySelector('button[type="submit"]')

  try {
    setLoading(submitButton, true)

    await auth.signInWithEmailAndPassword(email, password)

    redirectAfterLogin()
  } catch (error) {
    setLoading(submitButton, false)

    let errorMessage = 'Erro ao fazer login. Tente novamente.'

    switch (error.code) {
      case 'auth/invalid-email':
        errorMessage = 'Email inválido.'
        break
      case 'auth/user-disabled':
        errorMessage = 'Esta conta foi desativada.'
        break
      case 'auth/user-not-found':
        errorMessage = 'Nenhuma conta encontrada com este email.'
        break
      case 'auth/wrong-password':
        errorMessage = 'Senha incorreta.'
        break
      case 'auth/too-many-requests':
        errorMessage = 'Muitas tentativas. Tente novamente mais tarde.'
        break
    }

    showError(errorMessage)
  }
})

const style = document.createElement('style')
style.textContent = `
        .error-message {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px;
          margin-bottom: 16px;
          background-color: #fee2e2;
          color: #b91c1c;
          border-radius: 6px;
          font-size: 14px;
        }
        .error-message i {
          font-size: 18px;
        }
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `
document.head.appendChild(style)
