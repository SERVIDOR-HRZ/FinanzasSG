document.getElementById('loginForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const usuario = document.getElementById('usuario').value;
    const contraseña = document.getElementById('contraseña').value;
    const errorDiv = document.getElementById('errorMessage');
    const successDiv = document.getElementById('successMessage');

    // Limpiar mensajes
    errorDiv.style.display = 'none';
    successDiv.style.display = 'none';

    // Validar campos
    if (!usuario || !contraseña) {
        mostrarError('Por favor, completa todos los campos');
        return;
    }

    // Validar login
    try {
        const usuarioValido = await DB.validarLogin(usuario, contraseña);

        if (usuarioValido) {
            // Guardar sesión
            sessionStorage.setItem('usuarioLogueado', JSON.stringify(usuarioValido));

            mostrarExito('Login exitoso. Redirigiendo...');

            // Redireccionar después de 1 segundo
            setTimeout(() => {
                window.location.href = 'Secciones/Panel_1.html';
            }, 1000);
        } else {
            mostrarError('Usuario o contraseña incorrectos');
        }
    } catch (error) {
        mostrarError('Error de conexión. Inténtalo de nuevo.');
        console.error('Error:', error);
    }
});

function mostrarError(mensaje) {
    const errorDiv = document.getElementById('errorMessage');
    errorDiv.textContent = mensaje;
    errorDiv.style.display = 'block';
}

function mostrarExito(mensaje) {
    const successDiv = document.getElementById('successMessage');
    successDiv.textContent = mensaje;
    successDiv.style.display = 'block';
}

function togglePassword(inputId) {
    const passwordInput = document.getElementById(inputId);
    const toggleButton = passwordInput.nextElementSibling;
    const icon = toggleButton.querySelector('i');

    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        icon.className = 'fas fa-eye-slash';
    } else {
        passwordInput.type = 'password';
        icon.className = 'fas fa-eye';
    }
}