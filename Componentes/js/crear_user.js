// Mostrar/ocultar sección de materias cuando se marca "Es Profesor"
document.getElementById('esProfesor').addEventListener('change', function() {
    const materiasSection = document.getElementById('materiasSection');
    if (this.checked) {
        materiasSection.style.display = 'block';
    } else {
        materiasSection.style.display = 'none';
        // Desmarcar todas las materias si se desmarca "Es Profesor"
        const checkboxesMaterias = document.querySelectorAll('input[name="materias"]');
        checkboxesMaterias.forEach(checkbox => checkbox.checked = false);
    }
});

// Manejar sincronización entre roles y checkbox "Es Profesor"
document.querySelectorAll('input[name="roles"]').forEach(checkbox => {
    checkbox.addEventListener('change', function() {
        const esProfesorCheckbox = document.getElementById('esProfesor');
        const materiasSection = document.getElementById('materiasSection');
        
        if (this.value === 'PROFESOR' && this.checked) {
            // Si se selecciona rol PROFESOR, marcar "Es Profesor"
            esProfesorCheckbox.checked = true;
            materiasSection.style.display = 'block';
        } else if (this.value === 'PROFESOR' && !this.checked) {
            // Si se desmarca rol PROFESOR, desmarcar "Es Profesor" y ocultar materias
            esProfesorCheckbox.checked = false;
            materiasSection.style.display = 'none';
            // Desmarcar todas las materias
            const checkboxesMaterias = document.querySelectorAll('input[name="materias"]');
            checkboxesMaterias.forEach(checkbox => checkbox.checked = false);
        }
    });
});

document.getElementById('registerForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    // Obtener todos los valores del formulario
    const nombre = document.getElementById('nombre').value.trim();
    const usuario = document.getElementById('usuario').value.trim();
    const contraseña = document.getElementById('contraseña').value;
    const confirmarContraseña = document.getElementById('confirmarContraseña').value;
    const ocupacionPre = document.getElementById('ocupacionPre').value;
    const nombreQuienRecibe = document.getElementById('nombreQuienRecibe').value.trim();
    const tipoBanco = document.getElementById('tipoBanco').value;
    const tipoId = document.getElementById('tipoId').value;
    const numeroId = document.getElementById('numeroId').value.trim();
    const numeroCuenta = document.getElementById('numeroCuenta').value.trim();
    const nombreCuenta = document.getElementById('nombreCuenta').value.trim();
    const esProfesor = document.getElementById('esProfesor').checked;
    
    // Obtener roles seleccionados
    const rolesSeleccionados = [];
    const checkboxesRoles = document.querySelectorAll('input[name="roles"]:checked');
    checkboxesRoles.forEach(checkbox => {
        rolesSeleccionados.push(checkbox.value);
    });
    
    // Obtener materias seleccionadas
    const materiasSeleccionadas = [];
    const checkboxesMaterias = document.querySelectorAll('input[name="materias"]:checked');
    checkboxesMaterias.forEach(checkbox => {
        materiasSeleccionadas.push(checkbox.value);
    });

    const errorDiv = document.getElementById('errorMessage');
    const successDiv = document.getElementById('successMessage');

    // Limpiar mensajes
    errorDiv.style.display = 'none';
    successDiv.style.display = 'none';

    // Validaciones básicas
    if (!nombre || !usuario || !contraseña || !confirmarContraseña || 
        !ocupacionPre || !nombreQuienRecibe || !tipoBanco || !tipoId || 
        !numeroId || !numeroCuenta || !nombreCuenta) {
        mostrarError('Por favor, completa todos los campos obligatorios');
        return;
    }

    if (rolesSeleccionados.length === 0) {
        mostrarError('Debe seleccionar al menos un rol para el usuario');
        return;
    }

    if (contraseña.length < 6) {
        mostrarError('La contraseña debe tener al menos 6 caracteres');
        return;
    }

    if (contraseña !== confirmarContraseña) {
        mostrarError('Las contraseñas no coinciden');
        return;
    }

    // Si tiene rol de PROFESOR, debe ser profesor y tener materias
    const esProfesorPorRol = rolesSeleccionados.includes('PROFESOR');
    
    if (esProfesorPorRol && !esProfesor) {
        mostrarError('Si selecciona el rol de PROFESOR, debe marcar "¿Es Profesor?"');
        return;
    }
    
    if (esProfesor && materiasSeleccionadas.length === 0) {
        mostrarError('Si es profesor, debe seleccionar al menos una materia');
        return;
    }

    // Verificar si el usuario ya existe
    try {
        const usuarioExiste = await DB.usuarioExiste(usuario);
        
        if (usuarioExiste) {
            mostrarError('El nombre de usuario ya está en uso');
            return;
        }
    } catch (error) {
        mostrarError('Error verificando usuario. Inténtalo de nuevo.');
        console.error('Error:', error);
        return;
    }

    // Crear objeto con todos los datos del usuario
    const datosUsuario = {
        usuario: usuario,
        contraseña: contraseña,
        nombre: nombre,
        ocupacionPre: ocupacionPre,
        nombreQuienRecibe: nombreQuienRecibe,
        tipoBanco: tipoBanco,
        tipoId: tipoId,
        numeroId: numeroId,
        numeroCuenta: numeroCuenta,
        nombreCuenta: nombreCuenta,
        esProfesor: esProfesor,
        materias: materiasSeleccionadas,
        roles: rolesSeleccionados
    };

    // Crear usuario
    try {
        const nuevoUsuario = await DB.crearUsuario(datosUsuario);
        mostrarExito('Usuario creado exitosamente. Redirigiendo al login...');

        // Limpiar formulario
        document.getElementById('registerForm').reset();
        document.getElementById('materiasSection').style.display = 'none';

        // Redireccionar después de 2 segundos
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);

    } catch (error) {
        mostrarError('Error al crear el usuario. Inténtalo de nuevo.');
        console.error('Error:', error);
    }
});

function mostrarError(mensaje) {
    const errorDiv = document.getElementById('errorMessage');
    errorDiv.textContent = mensaje;
    errorDiv.style.display = 'block';

    // Scroll al mensaje
    errorDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function mostrarExito(mensaje) {
    const successDiv = document.getElementById('successMessage');
    successDiv.textContent = mensaje;
    successDiv.style.display = 'block';

    // Scroll al mensaje
    successDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
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