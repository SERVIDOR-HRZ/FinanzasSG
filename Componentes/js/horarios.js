// Variables globales
let horarios = [];
let fechaHoy = new Date();
let semanaActual = obtenerNumeroSemana(fechaHoy);
let añoActual = fechaHoy.getFullYear();
let mesActual = fechaHoy.getMonth(); // Mes actual (0-based)
let filtroMateriaActual = '';
let horarioEditando = null;
let usuarioActual = null;
let maestrosDisponibles = [];
let fechaSeleccionadaCalendario = null; // Fecha seleccionada en el calendario

// Colores por materia
const COLORES_MATERIAS = {
    'MTS': 'mts',
    'LC': 'lc', 
    'CS': 'cs',
    'ING': 'ing',
    'CN': 'cn'
};

// Inicialización
document.addEventListener('DOMContentLoaded', function() {
    verificarSesion();
    configurarEventListeners();
    inicializarDatos();
});

// Verificar sesión del usuario
function verificarSesion() {
    const usuarioLogueado = sessionStorage.getItem('usuarioLogueado');
    
    if (!usuarioLogueado) {
        window.location.href = '../index.html';
        return;
    }
    
    usuarioActual = JSON.parse(usuarioLogueado);
    document.getElementById('nombreUsuario').textContent = usuarioActual.nombre;
    
    // Verificar acceso a horarios
    verificarAccesoHorarios();
}

// Verificar acceso a horarios basado en roles
function verificarAccesoHorarios() {
    // Verificar si el usuario tiene rol de PROFESOR o SUPER USUARIO
    const tieneAccesoHorarios = usuarioActual.roles && (
        usuarioActual.roles.includes('PROFESOR') || 
        usuarioActual.roles.includes('SUPER USUARIO')
    );
    
    if (!tieneAccesoHorarios) {
        alert('No tienes permisos para acceder a esta sección.');
        window.location.href = 'Panel_1.html';
        return;
    }
}

// Cerrar sesión
function cerrarSesion() {
    if (confirm('¿Estás seguro de que deseas cerrar sesión?')) {
        sessionStorage.removeItem('usuarioLogueado');
        window.location.href = '../index.html';
    }
}

// Inicializar datos
async function inicializarDatos() {
    try {
        mostrarCargando();
        
        // Esperar a que Firebase esté inicializado
        if (typeof DB === 'undefined') {
            setTimeout(inicializarDatos, 100);
            return;
        }
        
        // Cargar materias del usuario
        cargarMateriasUsuario();
        
        // Si es SUPER USUARIO o ADMINISTRADOR, cargar todos los horarios
        // Si es PROFESOR, cargar solo sus horarios
        if (usuarioActual.roles && (
            usuarioActual.roles.includes('SUPER USUARIO') || 
            usuarioActual.roles.includes('ADMINISTRADOR')
        )) {
            horarios = await DB.obtenerHorarios(); // Sin usuarioId = todos los horarios
            console.log('Cargando todos los horarios para super usuario/administrador');
        } else {
            horarios = await DB.obtenerHorarios(usuarioActual.id); // Solo sus horarios
            console.log('Cargando horarios del usuario:', usuarioActual.nombre);
        }
        
        // Verificar y actualizar estados de pago de horarios
        await verificarEstadosPagoHorarios();
        
        // Cargar vista inicial
        cargarVistaTabla();
        actualizarTituloSemana();
        
        ocultarCargando();
    } catch (error) {
        console.error('Error cargando horarios:', error);
        mostrarMensaje('Error al cargar los horarios', 'error');
        horarios = [];
        
        // Cargar vista vacía
        cargarVistaTabla();
        actualizarTituloSemana();
        
        ocultarCargando();
    }
}

// Cargar materias del usuario en los selects
function cargarMateriasUsuario() {
    const materiasUsuario = obtenerMateriasUsuario();
    
    // Actualizar select de filtro
    const selectFiltro = document.getElementById('filtroMateria');
    selectFiltro.innerHTML = '<option value="">Todas las Materias</option>';
    
    // Actualizar select del modal
    const selectModal = document.getElementById('materia');
    selectModal.innerHTML = '<option value="">Seleccionar materia</option>';
    
    materiasUsuario.forEach(materia => {
        const opcionFiltro = document.createElement('option');
        opcionFiltro.value = materia.codigo;
        opcionFiltro.textContent = `${materia.nombre} (${materia.codigo})`;
        selectFiltro.appendChild(opcionFiltro);
        
        const opcionModal = document.createElement('option');
        opcionModal.value = materia.codigo;
        opcionModal.textContent = `${materia.nombre} (${materia.codigo})`;
        selectModal.appendChild(opcionModal);
    });
}

// Cargar maestros según el rol del usuario
async function cargarMaestros(materiaSeleccionada = null) {
    try {
        const selectTutor = document.getElementById('tutorEncargado');
        selectTutor.innerHTML = '<option value="">Seleccionar tutor</option>';
        
        // Si es SUPER USUARIO o ADMINISTRADOR
        if (usuarioActual.roles && (
            usuarioActual.roles.includes('SUPER USUARIO') || 
            usuarioActual.roles.includes('ADMINISTRADOR')
        )) {
            if (materiaSeleccionada) {
                // Cargar maestros de la materia específica
                maestrosDisponibles = await DB.obtenerMaestrosPorMateria(materiaSeleccionada);
            } else {
                // Cargar todos los maestros
                maestrosDisponibles = await DB.obtenerTodosLosMaestros();
            }
        } else if (usuarioActual.roles && usuarioActual.roles.includes('PROFESOR')) {
            // Si es PROFESOR, solo mostrar su propio nombre
            maestrosDisponibles = [{
                id: usuarioActual.id,
                nombre: usuarioActual.nombre,
                usuario: usuarioActual.usuario
            }];
        }
        
        // Llenar el select con los maestros
        maestrosDisponibles.forEach(maestro => {
            const opcion = document.createElement('option');
            opcion.value = maestro.nombre;
            opcion.textContent = maestro.nombre;
            opcion.dataset.maestroId = maestro.id;
            selectTutor.appendChild(opcion);
        });
        
        // Si es PROFESOR, seleccionar automáticamente su nombre
        if (usuarioActual.roles && usuarioActual.roles.includes('PROFESOR')) {
            selectTutor.value = usuarioActual.nombre;
            selectTutor.disabled = true; // Deshabilitar para que no pueda cambiar
        }
        
    } catch (error) {
        console.error('Error cargando maestros:', error);
        mostrarMensaje('Error al cargar la lista de maestros', 'error');
    }
}

// Verificar y actualizar estados de pago de horarios
async function verificarEstadosPagoHorarios() {
    try {
        console.log('Verificando estados de pago de horarios contra historial de pagos...');

        // Obtener todos los pagos (para admins/super usuarios) o del usuario (profesor)
        let pagos = [];
        if (usuarioActual.roles && (
            usuarioActual.roles.includes('SUPER USUARIO') ||
            usuarioActual.roles.includes('ADMINISTRADOR')
        )) {
            try {
                pagos = await DB.obtenerHistorialPagos();
            } catch (error) {
                console.warn('Error obteniendo historial de pagos para verificación, continuando sin verificación:', error);
                return; // Continuar sin verificar si hay error
            }
        } else {
            try {
                pagos = await DB.obtenerPagosPorProfesor(usuarioActual.id);
            } catch (error) {
                console.warn('Error obteniendo pagos por profesor para verificación, continuando sin verificación:', error);
                return; // Continuar sin verificar si hay error
            }
        }

        // Filtrar solo pagos completados
        const pagosCompletados = pagos.filter(p => p.estado === 'completado' && p.profesorId && p.semana);

        if (pagosCompletados.length === 0) {
            return;
        }

        // Para cada pago, calcular el rango de fechas y marcar horarios de esa semana como pagados
        pagosCompletados.forEach(pago => {
            const rango = DB.obtenerFechasDesdeFormatoSemana(pago.semana);
            if (!rango) return;

            const inicio = new Date(rango.inicio.getFullYear(), rango.inicio.getMonth(), rango.inicio.getDate());
            const fin = new Date(rango.fin.getFullYear(), rango.fin.getMonth(), rango.fin.getDate());

            // Cálculo adicional: semana y año del pago (según inicio del rango)
            const semanaPago = obtenerNumeroSemana(inicio);
            const añoPago = inicio.getFullYear();

            horarios.forEach(horario => {
                if (horario.usuarioId !== pago.profesorId) return;

                let fechaHorario;
                if (horario.fecha && typeof horario.fecha === 'object' && horario.fecha.toDate) {
                    fechaHorario = horario.fecha.toDate();
                } else if (typeof horario.fecha === 'string') {
                    fechaHorario = new Date(horario.fecha);
                } else {
                    fechaHorario = horario.fecha;
                }

                if (!fechaHorario) return;

                const f = new Date(fechaHorario.getFullYear(), fechaHorario.getMonth(), fechaHorario.getDate());

                // Comparación por rango de fechas (inclusivo)
                const dentroDeRango = f >= inicio && f <= fin;

                // Comparación adicional por número de semana y año
                const mismaSemana = obtenerNumeroSemana(f) === semanaPago && f.getFullYear() === añoPago;

                if ((dentroDeRango || mismaSemana) && !horario.pagado) {
                    horario.pagado = true; // Actualizar estado local
                }
            });
        });
    } catch (error) {
        console.error('Error verificando estados de pago:', error);
    }
}

// Obtener materias del usuario basado en sus roles
function obtenerMateriasUsuario() {
    const materiasDisponibles = [
        { codigo: 'MTS', nombre: 'Matemáticas' },
        { codigo: 'LC', nombre: 'Lectura y Comprensión' },
        { codigo: 'CS', nombre: 'Ciencias Sociales' },
        { codigo: 'ING', nombre: 'Inglés' },
        { codigo: 'CN', nombre: 'Ciencias Naturales' }
    ];
    
    // Si es SUPER USUARIO, puede ver todas las materias
    if (usuarioActual.roles && usuarioActual.roles.includes('SUPER USUARIO')) {
        return materiasDisponibles;
    }
    
    // Si es PROFESOR, solo puede ver sus materias asignadas
    if (usuarioActual.roles && usuarioActual.roles.includes('PROFESOR')) {
        if (usuarioActual.materias && usuarioActual.materias.length > 0) {
            return materiasDisponibles.filter(materia => 
                usuarioActual.materias.includes(materia.codigo)
            );
        }
    }
    
    // Si no tiene materias asignadas, retornar array vacío
    return [];
}

// Configurar event listeners
function configurarEventListeners() {
    // Formulario de horario
    document.getElementById('formHorario').addEventListener('submit', function(e) {
        e.preventDefault();
        guardarHorario();
    });

    // Cerrar modal al hacer clic en el overlay
    document.getElementById('modalOverlay').addEventListener('click', cerrarModalHorario);

    // Cerrar modal con tecla Escape
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            cerrarModalHorario();
        }
    });

    // Evento para cambio de día de la semana (fecha automática)
    document.getElementById('diaSemana').addEventListener('change', function() {
        actualizarFechaAutomatica();
    });

    // Evento para cambio de materia (recargar maestros)
    document.getElementById('materia').addEventListener('change', function() {
        const materiaSeleccionada = this.value;
        cargarMaestros(materiaSeleccionada);
    });

    // Evento para cambio de fecha (sincronizar dropdown)
    document.getElementById('fechaSeleccionada').addEventListener('change', function() {
        cargarVistaDia();
    });
}

// Actualizar fecha automáticamente según el día seleccionado
function actualizarFechaAutomatica() {
    const diaSeleccionado = document.getElementById('diaSemana').value;
    if (!diaSeleccionado) return;

    const diasSemana = {
        'Lunes': 1,
        'Martes': 2,
        'Miércoles': 3,
        'Jueves': 4,
        'Viernes': 5,
        'Sábado': 6,
        'Domingo': 0
    };

    const hoy = new Date();
    const diaActual = hoy.getDay();
    const diaObjetivo = diasSemana[diaSeleccionado];
    
    // Calcular días hasta el próximo día objetivo
    let diasHasta = diaObjetivo - diaActual;
    if (diasHasta <= 0) {
        diasHasta += 7; // Próxima semana
    }

    const fechaObjetivo = new Date(hoy);
    fechaObjetivo.setDate(hoy.getDate() + diasHasta);
    
    document.getElementById('fechaClase').value = fechaObjetivo.toISOString().split('T')[0];
}

// Cambiar vista
function cambiarVista(vista) {
    // Actualizar botones
    document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`btnVista${vista.charAt(0).toUpperCase() + vista.slice(1)}`).classList.add('active');

    // Mostrar vista correspondiente
    document.querySelectorAll('.vista-container').forEach(container => container.classList.remove('active'));
    
    if (vista === 'tabla') {
        document.getElementById('vistaTabla').classList.add('active');
        cargarVistaTabla();
    } else if (vista === 'calendario') {
        document.getElementById('vistaCalendario').classList.add('active');
        cargarVistaCalendario();
    } else if (vista === 'dia') {
        document.getElementById('vistaDia').classList.add('active');
        inicializarVistaDia();
    }
}

// Aplicar colores según materia seleccionada
function aplicarColoresMateria() {
    const elementos = [
        '.tabla-horarios',
        '.semana-navigation', 
        '.calendario-header',
        '.calendario-grid',
        '.vista-dia-container'
    ];

    // Remover todas las clases de materia
    elementos.forEach(selector => {
        const elemento = document.querySelector(selector);
        if (elemento) {
            Object.values(COLORES_MATERIAS).forEach(color => {
                elemento.classList.remove(`materia-${color}`);
            });
        }
    });

    // Aplicar color de materia actual si hay filtro
    if (filtroMateriaActual && COLORES_MATERIAS[filtroMateriaActual]) {
        const colorClase = `materia-${COLORES_MATERIAS[filtroMateriaActual]}`;
        elementos.forEach(selector => {
            const elemento = document.querySelector(selector);
            if (elemento) {
                elemento.classList.add(colorClase);
                console.log(`Aplicando color ${colorClase} a ${selector}`);
            }
        });
    } else {
        // Si no hay filtro, aplicar color negro para "Todas las materias"
        const colorDefecto = 'materia-todas';
        elementos.forEach(selector => {
            const elemento = document.querySelector(selector);
            if (elemento) {
                elemento.classList.add(colorDefecto);
            }
        });
        console.log('Aplicando color negro (Todas las materias) - No hay filtro activo:', filtroMateriaActual);
    }
}

// Cargar vista de tabla
function cargarVistaTabla() {
    const tbody = document.getElementById('tablaHorariosBody');
    tbody.innerHTML = '';

    const horariosFiltrados = filtrarHorarios();

    if (horariosFiltrados.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="sin-horarios">
                    <i class="fas fa-calendar-times"></i>
                    <h3>No hay horarios para mostrar</h3>
                    <p>No se encontraron horarios para los criterios seleccionados.</p>
                </td>
            </tr>
        `;
        return;
    }

    horariosFiltrados.forEach(horario => {
        const fila = document.createElement('tr');
        
        // Aplicar clase CSS si la clase ya se dio
        if (horario.dioClase) {
            fila.classList.add('clase-dada');
        }
        
        // Aplicar clase CSS según estado de pago
        if (horario.pagado) {
            fila.classList.add('clase-pagada');
        } else {
            fila.classList.add('clase-no-pagada');
        }
        
        fila.innerHTML = `
            <td>${horario.dia}</td>
            <td class="col-horas">${horario.cantidadHoras}</td>
            <td>${horario.tipologia}</td>
            <td>${horario.unidad}</td>
            <td>${horario.tema}</td>
            <td>${horario.tutor}</td>
            <td>${formatearFecha(horario.fecha)}</td>
            <td class="col-pago">
                <span class="estado-pago ${horario.pagado ? 'pagado' : 'no-pagado'}">
                    ${horario.pagado ? 'Sí' : 'No'}
                </span>
            </td>
            <td class="col-dio-clase">
                <label class="checkbox-tabla">
                    <input type="checkbox" ${horario.dioClase ? 'checked' : ''} 
                           onchange="actualizarDioClase('${horario.id}', this.checked)">
                    <span class="checkmark-tabla"></span>
                </label>
            </td>
            <td class="col-acciones">
                <button class="btn-accion btn-editar" onclick="editarHorario('${horario.id}')" title="Editar">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-accion btn-eliminar" onclick="eliminarHorario('${horario.id}')" title="Eliminar">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(fila);
    });

    // Aplicar colores según materia
    aplicarColoresMateria();
}

// Cargar vista de calendario
function cargarVistaCalendario() {
    const calendarioGrid = document.querySelector('.calendario-grid');
    
    // Limpiar calendario (mantener encabezados)
    const diasSemana = calendarioGrid.querySelectorAll('.dia-semana');
    calendarioGrid.innerHTML = '';
    diasSemana.forEach(dia => calendarioGrid.appendChild(dia));

    // Generar días del mes
    const primerDia = new Date(añoActual, mesActual, 1);
    const ultimoDia = new Date(añoActual, mesActual + 1, 0);
    const primerDiaSemana = primerDia.getDay() === 0 ? 7 : primerDia.getDay(); // Lunes = 1

    // Días del mes anterior
    const mesAnterior = new Date(añoActual, mesActual, 0);
    const mesAnteriorRef = {
        año: mesAnterior.getFullYear(),
        mes: mesAnterior.getMonth()
    };
    for (let i = primerDiaSemana - 1; i > 0; i--) {
        const dia = mesAnterior.getDate() - i + 1;
        const diaElement = crearDiaCalendario(dia, true, mesAnteriorRef);
        calendarioGrid.appendChild(diaElement);
    }

    // Días del mes actual
    for (let dia = 1; dia <= ultimoDia.getDate(); dia++) {
        const diaElement = crearDiaCalendario(dia, false);
        calendarioGrid.appendChild(diaElement);
    }

    // Días del mes siguiente para completar la grilla
    const mesSiguiente = new Date(añoActual, mesActual + 1, 1);
    const mesSiguienteRef = {
        año: mesSiguiente.getFullYear(),
        mes: mesSiguiente.getMonth()
    };
    const diasRestantes = 42 - (primerDiaSemana - 1 + ultimoDia.getDate());
    for (let dia = 1; dia <= diasRestantes; dia++) {
        const diaElement = crearDiaCalendario(dia, true, mesSiguienteRef);
        calendarioGrid.appendChild(diaElement);
    }

    actualizarTituloMes();
    aplicarColoresMateria();
}

// Crear elemento día del calendario
function crearDiaCalendario(numeroDia, otroMes, mesReferencia = null) {
    const diaElement = document.createElement('div');
    diaElement.className = 'dia-calendario';
    
    if (otroMes) {
        diaElement.classList.add('otro-mes');
    }

    // Calcular la fecha correcta según el mes de referencia
    let fechaDia;
    if (otroMes && mesReferencia !== null) {
        // Para días de otros meses, usar el mes de referencia correcto
        fechaDia = new Date(mesReferencia.año, mesReferencia.mes, numeroDia);
    } else {
        // Para días del mes actual
        fechaDia = new Date(añoActual, mesActual, numeroDia);
    }

    // Verificar si es hoy
    const hoy = new Date();
    if (!otroMes && 
        fechaDia.getDate() === hoy.getDate() && 
        fechaDia.getMonth() === hoy.getMonth() && 
        fechaDia.getFullYear() === hoy.getFullYear()) {
        diaElement.classList.add('hoy');
    }

    // Crear ID único para evitar duplicaciones
    const idUnico = `eventos-${fechaDia.getFullYear()}-${fechaDia.getMonth()}-${numeroDia}-${otroMes ? 'otro' : 'actual'}`;
    
    diaElement.innerHTML = `
        <div class="numero-dia">
            ${numeroDia}
            <i class="fas fa-plus-circle click-indicator" title="Hacer clic para crear horario"></i>
        </div>
        <div class="eventos-dia" id="${idUnico}">
            ${obtenerEventosDia(fechaDia)}
        </div>
    `;

    // Agregar funcionalidad de clic para seleccionar día y mostrar clases
    diaElement.addEventListener('click', function() {
        seleccionarDiaCalendario(fechaDia);
    });

    return diaElement;
}

// Obtener eventos del día
function obtenerEventosDia(fecha) {
    const fechaStr = fecha.toISOString().split('T')[0];
    
    const eventosDelDia = horarios.filter(horario => {
        // Manejar diferentes formatos de fecha
        let fechaHorario = horario.fecha;
        if (fechaHorario && typeof fechaHorario === 'object' && fechaHorario.toDate) {
            fechaHorario = fechaHorario.toDate().toISOString().split('T')[0];
        } else if (typeof fechaHorario === 'string') {
            // Normalizar fecha string para comparación
            fechaHorario = fechaHorario;
        }
        
        // Filtrar por fecha
        if (fechaHorario !== fechaStr) return false;
        
        // Si es SUPER USUARIO o ADMINISTRADOR, puede ver todos los eventos
        // Si es PROFESOR, solo puede ver eventos de sus materias
        if (usuarioActual.roles && (
            usuarioActual.roles.includes('SUPER USUARIO') || 
            usuarioActual.roles.includes('ADMINISTRADOR')
        )) {
            return true; // Puede ver todos los eventos
        } else {
            // Solo puede ver eventos de sus materias
            const materiasUsuario = obtenerMateriasUsuario().map(m => m.codigo);
            return materiasUsuario.includes(horario.materia);
        }
    });
    
    // Eliminar duplicados basándose en ID único
    const eventosUnicos = eventosDelDia.filter((horario, index, self) => 
        index === self.findIndex(h => h.id === horario.id)
    );
    
    if (filtroMateriaActual) {
        return eventosUnicos
            .filter(horario => horario.materia === filtroMateriaActual)
            .map(horario => {
                const colorClase = COLORES_MATERIAS[horario.materia] || 'mts';
                return `<div class="evento materia-${colorClase}">${horario.materia} - ${horario.tema}</div>`;
            })
            .join('');
    }
    
    return eventosUnicos
        .map(horario => {
            const colorClase = COLORES_MATERIAS[horario.materia] || 'todas';
            return `<div class="evento materia-${colorClase}">${horario.materia} - ${horario.tema}</div>`;
        })
        .join('');
}

// Filtrar horarios
function filtrarHorarios() {
    let horariosFiltrados = [...horarios];
    
    // Si es SUPER USUARIO o ADMINISTRADOR, puede ver todos los horarios
    // Si es PROFESOR, solo puede ver horarios de sus materias
    if (!(usuarioActual.roles && (
        usuarioActual.roles.includes('SUPER USUARIO') || 
        usuarioActual.roles.includes('ADMINISTRADOR')
    ))) {
        // Filtrar por materias del usuario (solo para profesores)
        const materiasUsuario = obtenerMateriasUsuario().map(m => m.codigo);
        horariosFiltrados = horariosFiltrados.filter(horario => 
            materiasUsuario.includes(horario.materia)
        );
    }

    // Aplicar filtro adicional por materia si está seleccionada
    if (filtroMateriaActual) {
        horariosFiltrados = horariosFiltrados.filter(horario => 
            horario.materia === filtroMateriaActual
        );
    }

    return horariosFiltrados.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
}

// Filtrar por materia
function filtrarPorMateria() {
    const select = document.getElementById('filtroMateria');
    filtroMateriaActual = select.value;
    
    console.log('Filtro de materia cambiado a:', filtroMateriaActual);
    
    // Aplicar colores primero
    aplicarColoresMateria();
    
    // Actualizar todas las vistas para mantener sincronización
    cargarVistaTabla();
    if (document.getElementById('vistaCalendario').classList.contains('active')) {
        cargarVistaCalendario();
        // También actualizar el panel lateral si hay una fecha seleccionada
        if (fechaSeleccionadaCalendario) {
            const clasesDelDia = obtenerClasesDelDiaCalendario(fechaSeleccionadaCalendario);
            mostrarClasesEnPanelCalendario(clasesDelDia);
        }
    }
    if (document.getElementById('vistaDia').classList.contains('active')) {
        cargarVistaDia();
    }
}

// Cambiar semana
function cambiarSemana(direccion) {
    semanaActual += direccion;
    actualizarTituloSemana();
    cargarVistaTabla();
}

// Cambiar mes
function cambiarMes(direccion) {
    mesActual += direccion;
    
    if (mesActual > 11) {
        mesActual = 0;
        añoActual++;
    } else if (mesActual < 0) {
        mesActual = 11;
        añoActual--;
    }
    
    cargarVistaCalendario();
}

// Actualizar título de semana
function actualizarTituloSemana() {
    const tituloElement = document.getElementById('tituloSemana');
    const fechasSemanales = obtenerFechasSemana(semanaActual, añoActual);
    const fechaInicio = formatearFechaCompleta(fechasSemanales.inicio);
    const fechaFin = formatearFechaCompleta(fechasSemanales.fin);
    tituloElement.textContent = `Semana ${semanaActual} (${fechaInicio} - ${fechaFin})`;
}

// Actualizar título de mes
function actualizarTituloMes() {
    const meses = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    
    const tituloElement = document.getElementById('tituloMes');
    tituloElement.textContent = `${meses[mesActual]} ${añoActual}`;
}

// Abrir modal para nuevo horario
async function abrirModalHorario() {
    horarioEditando = null;
    document.getElementById('tituloModal').textContent = 'Nuevo Horario';
    document.getElementById('formHorario').reset();
    
    // Habilitar el campo de materia
    const selectMateria = document.getElementById('materia');
    selectMateria.disabled = false;
    
    // Si hay filtro de materia activo, pre-llenar la materia
    if (filtroMateriaActual) {
        selectMateria.value = filtroMateriaActual;
        selectMateria.disabled = true; // Deshabilitar para que no pueda cambiar
    }
    
    // Cargar maestros según la materia seleccionada (o todas si no hay filtro)
    await cargarMaestros(filtroMateriaActual);
    
    // No establecer fecha por defecto, se hará automáticamente al seleccionar día
    mostrarModal();
}

// Crear horario desde calendario
async function crearHorarioDesdeCalendario(fecha) {
    horarioEditando = null;
    document.getElementById('tituloModal').textContent = 'Nuevo Horario';
    document.getElementById('formHorario').reset();
    
    // Establecer la fecha seleccionada (normalizada para evitar problemas de zona horaria)
    const año = fecha.getFullYear();
    const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
    const dia = fecha.getDate().toString().padStart(2, '0');
    const fechaStr = `${año}-${mes}-${dia}`;
    document.getElementById('fechaClase').value = fechaStr;
    
    // Establecer el día de la semana automáticamente
    const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const diaSemana = diasSemana[fecha.getDay()];
    document.getElementById('diaSemana').value = diaSemana;
    
    // Habilitar el campo de materia
    const selectMateria = document.getElementById('materia');
    selectMateria.disabled = false;
    
    // Si hay filtro de materia activo, pre-llenar la materia
    if (filtroMateriaActual) {
        selectMateria.value = filtroMateriaActual;
        selectMateria.disabled = true; // Deshabilitar para que no pueda cambiar
    }
    
    // Cargar maestros según la materia seleccionada (o todas si no hay filtro)
    await cargarMaestros(filtroMateriaActual);
    
    mostrarModal();
}

// Actualizar campo dioClase desde la tabla
async function actualizarDioClase(horarioId, dioClase) {
    try {
        // Actualizar en la base de datos
        await DB.actualizarHorario(horarioId, { dioClase: dioClase });
        
        // Actualizar en la lista local
        const horario = horarios.find(h => h.id === horarioId);
        if (horario) {
            horario.dioClase = dioClase;
        }
        
        // Actualizar la fila visualmente en la vista de tabla
        const checkbox = document.querySelector(`input[onchange*="${horarioId}"]`);
        if (checkbox) {
            const fila = checkbox.closest('tr');
            if (dioClase) {
                fila.classList.add('clase-dada');
            } else {
                fila.classList.remove('clase-dada');
            }
        }
        
        // Actualizar la vista por día si está activa
        if (document.getElementById('vistaDia').classList.contains('active')) {
            actualizarClaseEnVistaDia(horarioId, dioClase);
        }
        
        // Actualizar la vista de calendario si está activa
        if (document.getElementById('vistaCalendario').classList.contains('active')) {
            cargarVistaCalendario();
            // También actualizar el panel lateral si hay una fecha seleccionada
            if (fechaSeleccionadaCalendario) {
                actualizarClaseEnPanelCalendario(horarioId, dioClase);
            }
        }
        
        // Mostrar mensaje de confirmación
        mostrarMensaje(`Clase marcada como ${dioClase ? 'dada' : 'no dada'}`, 'exito');
        
    } catch (error) {
        console.error('Error actualizando estado de clase:', error);
        mostrarMensaje('Error al actualizar el estado de la clase', 'error');
        
        // Revertir el checkbox en caso de error
        const checkbox = document.querySelector(`input[onchange*="${horarioId}"]`);
        if (checkbox) {
            checkbox.checked = !dioClase;
        }
    }
}

// Editar horario
async function editarHorario(id) {
    const horario = horarios.find(h => h.id === id);
    if (!horario) return;

    horarioEditando = horario;
    document.getElementById('tituloModal').textContent = 'Editar Horario';
    
    // Habilitar el campo de materia
    const selectMateria = document.getElementById('materia');
    selectMateria.disabled = false;
    
    // Llenar formulario con datos del horario
    document.getElementById('diaSemana').value = horario.dia;
    document.getElementById('cantidadHoras').value = horario.cantidadHoras;
    document.getElementById('tipologiaClase').value = horario.tipologia;
    document.getElementById('unidadClase').value = horario.unidad;
    document.getElementById('temaClase').value = horario.tema;
    document.getElementById('fechaClase').value = horario.fecha;
    document.getElementById('materia').value = horario.materia;
    document.getElementById('sePago').checked = horario.pagado;
    
    // Cargar maestros según la materia del horario
    await cargarMaestros(horario.materia);
    
    // Establecer el tutor después de cargar los maestros
    document.getElementById('tutorEncargado').value = horario.tutor;
    
    mostrarModal();
}

// Eliminar horario
async function eliminarHorario(id) {
    if (confirm('¿Estás seguro de que deseas eliminar este horario?')) {
        try {
            mostrarCargando();
            await DB.eliminarHorario(id);
            
            // Actualizar lista local
            horarios = horarios.filter(h => h.id !== id);
            
            // Actualizar todas las vistas
            cargarVistaTabla();
            if (document.getElementById('vistaCalendario').classList.contains('active')) {
                cargarVistaCalendario();
                // También actualizar el panel lateral si hay una fecha seleccionada
                if (fechaSeleccionadaCalendario) {
                    const clasesDelDia = obtenerClasesDelDiaCalendario(fechaSeleccionadaCalendario);
                    mostrarClasesEnPanelCalendario(clasesDelDia);
                }
            }
            if (document.getElementById('vistaDia').classList.contains('active')) {
                cargarVistaDia();
            }
            
            ocultarCargando();
            mostrarMensaje('Horario eliminado exitosamente', 'exito');
        } catch (error) {
            console.error('Error eliminando horario:', error);
            ocultarCargando();
            mostrarMensaje('Error al eliminar el horario', 'error');
        }
    }
}

// Guardar horario
async function guardarHorario() {
    // Determinar el usuarioId correcto
    let usuarioIdAsignado = usuarioActual.id; // Por defecto, el usuario actual
    
    // Si es SUPER USUARIO o ADMINISTRADOR, usar el ID del maestro seleccionado
    if (usuarioActual.roles && (
        usuarioActual.roles.includes('SUPER USUARIO') || 
        usuarioActual.roles.includes('ADMINISTRADOR')
    )) {
        const selectTutor = document.getElementById('tutorEncargado');
        const opcionSeleccionada = selectTutor.options[selectTutor.selectedIndex];
        if (opcionSeleccionada && opcionSeleccionada.dataset.maestroId) {
            usuarioIdAsignado = opcionSeleccionada.dataset.maestroId;
            console.log('Asignando horario al maestro:', opcionSeleccionada.textContent, 'ID:', usuarioIdAsignado);
        }
    }
    
    console.log('Usuario actual:', usuarioActual.nombre, 'ID:', usuarioActual.id);
    console.log('UsuarioId asignado al horario:', usuarioIdAsignado);

    // Obtener y normalizar la fecha para evitar problemas de zona horaria
    const fechaInput = document.getElementById('fechaClase').value;
    const fechaNormalizada = new Date(fechaInput + 'T12:00:00'); // Agregar hora del mediodía para evitar problemas de zona horaria
    
    const datosHorario = {
        dia: document.getElementById('diaSemana').value,
        cantidadHoras: parseInt(document.getElementById('cantidadHoras').value),
        tipologia: document.getElementById('tipologiaClase').value,
        unidad: document.getElementById('unidadClase').value,
        tema: document.getElementById('temaClase').value,
        tutor: document.getElementById('tutorEncargado').value,
        fecha: fechaNormalizada.toISOString().split('T')[0], // Guardar solo la fecha en formato YYYY-MM-DD
        materia: document.getElementById('materia').value,
        pagado: document.getElementById('sePago').checked,
        dioClase: false, // Por defecto no se dio la clase, se puede marcar después en la tabla
        usuarioId: usuarioIdAsignado
    };

    // Validar datos
    if (!validarDatosHorario(datosHorario)) {
        return;
    }

    try {
        mostrarCargando();

        if (horarioEditando) {
            // Editar horario existente
            await DB.actualizarHorario(horarioEditando.id, datosHorario);
            
            // Actualizar en lista local
            const index = horarios.findIndex(h => h.id === horarioEditando.id);
            horarios[index] = { ...horarioEditando, ...datosHorario };
            
            mostrarMensaje('Horario actualizado exitosamente', 'exito');
        } else {
            // Crear nuevo horario
            const nuevoHorario = await DB.crearHorario(datosHorario);
            horarios.push(nuevoHorario);
            mostrarMensaje('Horario creado exitosamente', 'exito');
        }

        ocultarCargando();
        cerrarModalHorario();
        
        // Actualizar todas las vistas
        cargarVistaTabla();
        if (document.getElementById('vistaCalendario').classList.contains('active')) {
            cargarVistaCalendario();
            // También actualizar el panel lateral si hay una fecha seleccionada
            if (fechaSeleccionadaCalendario) {
                const clasesDelDia = obtenerClasesDelDiaCalendario(fechaSeleccionadaCalendario);
                mostrarClasesEnPanelCalendario(clasesDelDia);
            }
        }
        if (document.getElementById('vistaDia').classList.contains('active')) {
            cargarVistaDia();
        }
    } catch (error) {
        console.error('Error guardando horario:', error);
        ocultarCargando();
        mostrarMensaje('Error al guardar el horario', 'error');
    }
}

// Validar datos del horario
function validarDatosHorario(datos) {
    if (!datos.dia || !datos.cantidadHoras || !datos.tipologia || 
        !datos.unidad || !datos.tema || !datos.tutor || 
        !datos.fecha || !datos.materia) {
        mostrarMensaje('Por favor, completa todos los campos obligatorios', 'error');
        return false;
    }

    if (datos.cantidadHoras < 1 || datos.cantidadHoras > 8) {
        mostrarMensaje('La cantidad de horas debe estar entre 1 y 8', 'error');
        return false;
    }

    return true;
}

// Mostrar modal
function mostrarModal() {
    document.getElementById('modalHorario').classList.add('active');
    document.getElementById('modalOverlay').classList.add('active');
    document.body.style.overflow = 'hidden';
}

// Cerrar modal
function cerrarModalHorario() {
    document.getElementById('modalHorario').classList.remove('active');
    document.getElementById('modalOverlay').classList.remove('active');
    document.body.style.overflow = '';
    
    // Resetear estado de campos
    const selectTutor = document.getElementById('tutorEncargado');
    const selectMateria = document.getElementById('materia');
    
    selectTutor.disabled = false;
    selectMateria.disabled = false;
    
    horarioEditando = null;
}

// Formatear fecha para mostrar
function formatearFecha(fechaInput) {
    let fecha;
    
    // Manejar diferentes tipos de fecha
    if (fechaInput && typeof fechaInput === 'object' && fechaInput.toDate) {
        fecha = fechaInput.toDate();
    } else if (typeof fechaInput === 'string') {
        // Para strings de fecha, crear con hora del mediodía para evitar problemas de zona horaria
        fecha = new Date(fechaInput + 'T12:00:00');
    } else {
        fecha = fechaInput;
    }
    
    if (!fecha || isNaN(fecha.getTime())) {
        return 'Fecha inválida';
    }
    
    const opciones = { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric',
        timeZone: 'UTC' // Usar UTC para evitar problemas de zona horaria
    };
    return fecha.toLocaleDateString('es-ES', opciones);
}

// Mostrar mensaje
function mostrarMensaje(mensaje, tipo) {
    // Remover mensajes existentes
    const mensajesExistentes = document.querySelectorAll('.mensaje');
    mensajesExistentes.forEach(msg => msg.remove());

    const mensajeElement = document.createElement('div');
    mensajeElement.className = `mensaje ${tipo}`;
    mensajeElement.textContent = mensaje;

    // Insertar al inicio del contenido principal
    const mainContent = document.querySelector('.main-content');
    mainContent.insertBefore(mensajeElement, mainContent.firstChild);

    // Auto-remover después de 5 segundos
    setTimeout(() => {
        if (mensajeElement.parentNode) {
            mensajeElement.remove();
        }
    }, 5000);

    // Scroll al mensaje
    mensajeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// Funciones de carga
function mostrarCargando() {
    const cargando = document.createElement('div');
    cargando.className = 'loading';
    cargando.id = 'loading';
    cargando.textContent = 'Cargando...';
    
    const mainContent = document.querySelector('.main-content');
    mainContent.appendChild(cargando);
}

function ocultarCargando() {
    const cargando = document.getElementById('loading');
    if (cargando) {
        cargando.remove();
    }
}

// Funciones de utilidad para fechas
function obtenerNombreMes(numeroMes) {
    const meses = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    return meses[numeroMes];
}

// Función para normalizar fechas y evitar problemas de zona horaria
function normalizarFecha(fechaInput) {
    let fecha;
    
    if (fechaInput && typeof fechaInput === 'object' && fechaInput.toDate) {
        // Firestore Timestamp
        fecha = fechaInput.toDate();
    } else if (typeof fechaInput === 'string') {
        // String de fecha - agregar hora del mediodía para evitar problemas de zona horaria
        if (fechaInput.includes('T')) {
            fecha = new Date(fechaInput);
        } else {
            fecha = new Date(fechaInput + 'T12:00:00');
        }
    } else if (fechaInput instanceof Date) {
        fecha = fechaInput;
    } else {
        return null;
    }
    
    if (isNaN(fecha.getTime())) {
        return null;
    }
    
    return fecha;
}

// Función para obtener string de fecha normalizada (YYYY-MM-DD)
function obtenerFechaString(fechaInput) {
    const fecha = normalizarFecha(fechaInput);
    if (!fecha) return null;
    
    const año = fecha.getFullYear();
    const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
    const dia = fecha.getDate().toString().padStart(2, '0');
    
    return `${año}-${mes}-${dia}`;
}

function obtenerNombreDia(numeroDia) {
    const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    return dias[numeroDia];
}

// Obtener número de semana del año
function obtenerNumeroSemana(fecha) {
    const primerDiaAño = new Date(fecha.getFullYear(), 0, 1);
    const diasTranscurridos = Math.floor((fecha - primerDiaAño) / (24 * 60 * 60 * 1000));
    return Math.ceil((diasTranscurridos + primerDiaAño.getDay() + 1) / 7);
}

// Obtener fechas de inicio y fin de una semana
function obtenerFechasSemana(numeroSemana, año) {
    const primerDiaAño = new Date(año, 0, 1);
    const diasHastaSemana = (numeroSemana - 1) * 7;
    const inicioSemana = new Date(primerDiaAño.getTime() + diasHastaSemana * 24 * 60 * 60 * 1000);
    
    // Ajustar al lunes de esa semana
    const diaSemanaPrimero = inicioSemana.getDay();
    const diasHastaLunes = diaSemanaPrimero === 0 ? -6 : 1 - diaSemanaPrimero;
    inicioSemana.setDate(inicioSemana.getDate() + diasHastaLunes);
    
    const finSemana = new Date(inicioSemana);
    finSemana.setDate(inicioSemana.getDate() + 6);
    
    return {
        inicio: inicioSemana,
        fin: finSemana
    };
}

// Formatear fecha corta (DD/MM)
function formatearFechaCorta(fecha) {
    const dia = fecha.getDate().toString().padStart(2, '0');
    const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
    return `${dia}/${mes}`;
}

// Formatear fecha completa (DD/MM/YYYY)
function formatearFechaCompleta(fecha) {
    const dia = fecha.getDate().toString().padStart(2, '0');
    const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
    const año = fecha.getFullYear();
    return `${dia}/${mes}/${año}`;
}

// ===== FUNCIONES PARA VISTA POR DÍA =====

// Inicializar vista por día
function inicializarVistaDia() {
    // Establecer fecha actual por defecto
    const hoy = new Date();
    const año = hoy.getFullYear();
    const mes = (hoy.getMonth() + 1).toString().padStart(2, '0');
    const dia = hoy.getDate().toString().padStart(2, '0');
    const fechaHoy = `${año}-${mes}-${dia}`;
    
    document.getElementById('fechaSeleccionada').value = fechaHoy;
    
    // Cargar vista con fecha actual
    cargarVistaDia();
}

// Cargar vista por día
function cargarVistaDia() {
    const fechaSeleccionada = document.getElementById('fechaSeleccionada').value;
    
    if (!fechaSeleccionada) {
        mostrarVistaSinFecha();
        return;
    }
    
    // Crear fecha sin problemas de zona horaria
    const fecha = new Date(fechaSeleccionada + 'T00:00:00');
    const fechaStr = fechaSeleccionada; // Usar directamente el valor del input
    
    // Actualizar título
    const nombreDia = obtenerNombreDia(fecha.getDay());
    const fechaFormateada = formatearFechaCompleta(fecha);
    document.getElementById('tituloDia').textContent = `${nombreDia}, ${fechaFormateada}`;
    
    // Sincronizar el dropdown de día de la semana
    sincronizarDropdownDiaSemana(fecha);
    
    // Obtener clases del día
    const clasesDelDia = obtenerClasesDelDia(fechaStr);
    
    // Actualizar estadísticas
    actualizarEstadisticasDia(clasesDelDia);
    
    // Mostrar clases
    mostrarClasesDelDia(clasesDelDia);
    
    // Aplicar colores según materia
    aplicarColoresMateria();
}

// Mostrar vista sin fecha seleccionada
function mostrarVistaSinFecha() {
    document.getElementById('tituloDia').textContent = 'Selecciona una fecha';
    document.getElementById('clasesDiaContainer').innerHTML = `
        <div class="sin-clases">
            <i class="fas fa-calendar-day"></i>
            <h3>Selecciona una fecha para ver las clases</h3>
            <p>Usa el selector de fecha o elige un día de la semana para ver las clases programadas.</p>
        </div>
    `;
    
    // Resetear estadísticas
    document.getElementById('totalClases').textContent = '0';
    document.getElementById('totalHoras').textContent = '0';
    document.getElementById('clasesDadas').textContent = '0';
    document.getElementById('clasesPagadas').textContent = '0';
}

// Obtener clases del día específico
function obtenerClasesDelDia(fechaStr) {
    let horariosFiltrados = [...horarios];
    
    // Si es SUPER USUARIO o ADMINISTRADOR, puede ver todos los horarios
    // Si es PROFESOR, solo puede ver horarios de sus materias
    if (!(usuarioActual.roles && (
        usuarioActual.roles.includes('SUPER USUARIO') || 
        usuarioActual.roles.includes('ADMINISTRADOR')
    ))) {
        // Filtrar por materias del usuario (solo para profesores)
        const materiasUsuario = obtenerMateriasUsuario().map(m => m.codigo);
        horariosFiltrados = horariosFiltrados.filter(horario => 
            materiasUsuario.includes(horario.materia)
        );
    }

    // Aplicar filtro adicional por materia si está seleccionada
    if (filtroMateriaActual) {
        horariosFiltrados = horariosFiltrados.filter(horario => 
            horario.materia === filtroMateriaActual
        );
    }
    
    // Filtrar por fecha usando la función de normalización
    const clasesDelDia = horariosFiltrados.filter(horario => {
        const fechaHorarioStr = obtenerFechaString(horario.fecha);
        return fechaHorarioStr === fechaStr;
    });
    
    // Ordenar por hora (si tuviera) o por materia
    return clasesDelDia.sort((a, b) => {
        // Primero por materia
        if (a.materia !== b.materia) {
            return a.materia.localeCompare(b.materia);
        }
        // Luego por tema
        return a.tema.localeCompare(b.tema);
    });
}

// Actualizar estadísticas del día
function actualizarEstadisticasDia(clases) {
    const totalClases = clases.length;
    const totalHoras = clases.reduce((sum, clase) => sum + (clase.cantidadHoras || 0), 0);
    const clasesDadas = clases.filter(clase => clase.dioClase).length;
    const clasesPagadas = clases.filter(clase => clase.pagado).length;
    
    document.getElementById('totalClases').textContent = totalClases;
    document.getElementById('totalHoras').textContent = totalHoras;
    document.getElementById('clasesDadas').textContent = clasesDadas;
    document.getElementById('clasesPagadas').textContent = clasesPagadas;
}

// Mostrar clases del día
function mostrarClasesDelDia(clases) {
    const container = document.getElementById('clasesDiaContainer');
    
    if (clases.length === 0) {
        container.innerHTML = `
            <div class="sin-clases">
                <i class="fas fa-calendar-times"></i>
                <h3>No hay clases programadas</h3>
                <p>No se encontraron clases para esta fecha con los criterios seleccionados.</p>
            </div>
        `;
        return;
    }
    
    const listaClases = document.createElement('div');
    listaClases.className = 'lista-clases-dia';
    
    clases.forEach(clase => {
        const claseElement = crearElementoClaseDia(clase);
        listaClases.appendChild(claseElement);
    });
    
    container.innerHTML = '';
    container.appendChild(listaClases);
}

// Crear elemento de clase para la vista por día
function crearElementoClaseDia(clase) {
    const claseElement = document.createElement('div');
    claseElement.className = 'clase-dia-item';
    claseElement.setAttribute('data-horario-id', clase.id);
    
    // Aplicar clase CSS si la clase ya se dio
    if (clase.dioClase) {
        claseElement.classList.add('clase-dada');
    }
    
    const colorClase = COLORES_MATERIAS[clase.materia] || 'todas';
    
    claseElement.innerHTML = `
        <div class="clase-header">
            <div class="clase-info-principal">
                <div class="clase-titulo">
                    <span class="clase-materia materia-${colorClase}">${clase.materia}</span>
                    ${clase.tema}
                </div>
                <div class="clase-datos">
                    <div class="clase-dato">
                        <div class="clase-dato-label">Día</div>
                        <div class="clase-dato-valor">${clase.dia}</div>
                    </div>
                    <div class="clase-dato">
                        <div class="clase-dato-label">Horas</div>
                        <div class="clase-dato-valor">${clase.cantidadHoras}</div>
                    </div>
                    <div class="clase-dato">
                        <div class="clase-dato-label">Tipología</div>
                        <div class="clase-dato-valor">${clase.tipologia}</div>
                    </div>
                    <div class="clase-dato">
                        <div class="clase-dato-label">Unidad</div>
                        <div class="clase-dato-valor">${clase.unidad}</div>
                    </div>
                    <div class="clase-dato">
                        <div class="clase-dato-label">Tutor</div>
                        <div class="clase-dato-valor">${clase.tutor}</div>
                    </div>
                    <div class="clase-dato">
                        <div class="clase-dato-label">Fecha</div>
                        <div class="clase-dato-valor">${formatearFecha(clase.fecha)}</div>
                    </div>
                </div>
            </div>
            <div class="clase-acciones">
                <button class="btn-accion-dia btn-editar-dia" onclick="editarHorario('${clase.id}')" title="Editar">
                    <i class="fas fa-edit"></i> Editar
                </button>
                <button class="btn-accion-dia btn-eliminar-dia" onclick="eliminarHorario('${clase.id}')" title="Eliminar">
                    <i class="fas fa-trash"></i> Eliminar
                </button>
            </div>
        </div>
        <div class="clase-estados">
            <div class="estado-item ${clase.pagado ? 'pagado' : 'no-pagado'}">
                <i class="fas fa-${clase.pagado ? 'check' : 'times'}-circle"></i>
                ${clase.pagado ? 'Pagado' : 'No Pagado'}
            </div>
            <div class="estado-item ${clase.dioClase ? 'dada' : 'no-dada'}">
                <i class="fas fa-${clase.dioClase ? 'check' : 'times'}-circle"></i>
                ${clase.dioClase ? 'Dada' : 'No Dada'}
            </div>
            <label class="checkbox-dia">
                <input type="checkbox" ${clase.dioClase ? 'checked' : ''} 
                       onchange="actualizarDioClase('${clase.id}', this.checked)">
                <span>Marcar como dada</span>
            </label>
        </div>
    `;
    
    return claseElement;
}

// Actualizar clase específica en la vista por día
function actualizarClaseEnVistaDia(horarioId, dioClase) {
    // Buscar el elemento de la clase en la vista por día
    const claseElement = document.querySelector(`[data-horario-id="${horarioId}"]`);
    if (!claseElement) return;
    
    // Actualizar la clase CSS
    if (dioClase) {
        claseElement.classList.add('clase-dada');
    } else {
        claseElement.classList.remove('clase-dada');
    }
    
    // Actualizar el estado visual en la tarjeta
    const estadoDada = claseElement.querySelector('.estado-item.dada, .estado-item.no-dada');
    if (estadoDada) {
        estadoDada.className = `estado-item ${dioClase ? 'dada' : 'no-dada'}`;
        estadoDada.innerHTML = `
            <i class="fas fa-${dioClase ? 'check' : 'times'}-circle"></i>
            ${dioClase ? 'Dada' : 'No Dada'}
        `;
    }
    
    // Actualizar el checkbox
    const checkbox = claseElement.querySelector('input[type="checkbox"]');
    if (checkbox) {
        checkbox.checked = dioClase;
    }
    
    // Actualizar las estadísticas del día
    const fechaSeleccionada = document.getElementById('fechaSeleccionada').value;
    if (fechaSeleccionada) {
        const clasesDelDia = obtenerClasesDelDia(fechaSeleccionada);
        actualizarEstadisticasDia(clasesDelDia);
    }
}

// Sincronizar dropdown de día de la semana con la fecha seleccionada
function sincronizarDropdownDiaSemana(fecha) {
    const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const nombreDia = diasSemana[fecha.getDay()];
    document.getElementById('diaSemanaSeleccionado').value = nombreDia;
}

// Seleccionar día de la semana
function seleccionarDiaSemana() {
    const diaSeleccionado = document.getElementById('diaSemanaSeleccionado').value;
    if (!diaSeleccionado) return;

    const diasSemana = {
        'Lunes': 1,
        'Martes': 2,
        'Miércoles': 3,
        'Jueves': 4,
        'Viernes': 5,
        'Sábado': 6,
        'Domingo': 0
    };

    const hoy = new Date();
    const diaActual = hoy.getDay();
    const diaObjetivo = diasSemana[diaSeleccionado];
    
    // Calcular días hasta el próximo día objetivo
    let diasHasta = diaObjetivo - diaActual;
    if (diasHasta <= 0) {
        diasHasta += 7; // Próxima semana
    }

    const fechaObjetivo = new Date(hoy);
    fechaObjetivo.setDate(hoy.getDate() + diasHasta);
    
    // Formatear fecha correctamente (YYYY-MM-DD)
    const año = fechaObjetivo.getFullYear();
    const mes = (fechaObjetivo.getMonth() + 1).toString().padStart(2, '0');
    const dia = fechaObjetivo.getDate().toString().padStart(2, '0');
    const fechaFormateada = `${año}-${mes}-${dia}`;
    
    // Establecer la fecha en el input
    document.getElementById('fechaSeleccionada').value = fechaFormateada;
    
    // Cargar vista con la nueva fecha
    cargarVistaDia();
}

// ===== FUNCIONES PARA CALENDARIO CON PANEL LATERAL =====

// Seleccionar día en el calendario y mostrar sus clases
function seleccionarDiaCalendario(fecha) {
    fechaSeleccionadaCalendario = fecha;
    
    // Actualizar título del panel
    const nombreDia = obtenerNombreDia(fecha.getDay());
    const fechaFormateada = formatearFechaCompleta(fecha);
    document.getElementById('tituloDiaSeleccionado').textContent = `${nombreDia}, ${fechaFormateada}`;
    
    // Mostrar botón de nuevo horario
    document.getElementById('btnNuevoHorarioDia').style.display = 'flex';
    
    // Obtener clases del día
    const clasesDelDia = obtenerClasesDelDiaCalendario(fecha);
    
    // Mostrar clases en el panel
    mostrarClasesEnPanelCalendario(clasesDelDia);
    
    // Aplicar colores según materia
    aplicarColoresMateria();
}

// Obtener clases del día específico para el calendario
function obtenerClasesDelDiaCalendario(fecha) {
    const fechaStr = obtenerFechaString(fecha);
    let horariosFiltrados = [...horarios];
    
    // Si es SUPER USUARIO o ADMINISTRADOR, puede ver todos los horarios
    // Si es PROFESOR, solo puede ver horarios de sus materias
    if (!(usuarioActual.roles && (
        usuarioActual.roles.includes('SUPER USUARIO') || 
        usuarioActual.roles.includes('ADMINISTRADOR')
    ))) {
        // Filtrar por materias del usuario (solo para profesores)
        const materiasUsuario = obtenerMateriasUsuario().map(m => m.codigo);
        horariosFiltrados = horariosFiltrados.filter(horario => 
            materiasUsuario.includes(horario.materia)
        );
    }

    // Aplicar filtro adicional por materia si está seleccionada
    if (filtroMateriaActual) {
        horariosFiltrados = horariosFiltrados.filter(horario => 
            horario.materia === filtroMateriaActual
        );
    }
    
    // Filtrar por fecha usando la función de normalización
    const clasesDelDia = horariosFiltrados.filter(horario => {
        const fechaHorarioStr = obtenerFechaString(horario.fecha);
        return fechaHorarioStr === fechaStr;
    });
    
    // Ordenar por materia y tema
    return clasesDelDia.sort((a, b) => {
        if (a.materia !== b.materia) {
            return a.materia.localeCompare(b.materia);
        }
        return a.tema.localeCompare(b.tema);
    });
}

// Mostrar clases en el panel del calendario
function mostrarClasesEnPanelCalendario(clases) {
    const container = document.getElementById('contenidoClasesDia');
    
    if (clases.length === 0) {
        container.innerHTML = `
            <div class="sin-clases-seleccion">
                <i class="fas fa-calendar-times"></i>
                <h4>No hay clases programadas</h4>
                <p>No se encontraron clases para este día con los criterios seleccionados.</p>
            </div>
        `;
        return;
    }
    
    const listaClases = document.createElement('div');
    listaClases.className = 'lista-clases-calendario';
    
    clases.forEach(clase => {
        const claseElement = crearElementoClaseCalendario(clase);
        listaClases.appendChild(claseElement);
    });
    
    container.innerHTML = '';
    container.appendChild(listaClases);
}

// Crear elemento de clase para el panel del calendario
function crearElementoClaseCalendario(clase) {
    const claseElement = document.createElement('div');
    claseElement.className = 'clase-calendario-item';
    claseElement.setAttribute('data-horario-id', clase.id);
    
    // Aplicar clase CSS si la clase ya se dio
    if (clase.dioClase) {
        claseElement.classList.add('clase-dada');
    }
    
    const colorClase = COLORES_MATERIAS[clase.materia] || 'todas';
    
    claseElement.innerHTML = `
        <div class="clase-info">
            <div class="clase-titulo-calendario">
                <span class="clase-materia-calendario materia-${colorClase}">${clase.materia}</span>
                ${clase.tema}
            </div>
            <div class="clase-datos-calendario">
                <div class="clase-dato-calendario">
                    <div class="clase-dato-label-calendario">Día</div>
                    <div class="clase-dato-valor-calendario">${clase.dia}</div>
                </div>
                <div class="clase-dato-calendario">
                    <div class="clase-dato-label-calendario">Horas</div>
                    <div class="clase-dato-valor-calendario">${clase.cantidadHoras}</div>
                </div>
                <div class="clase-dato-calendario">
                    <div class="clase-dato-label-calendario">Tipología</div>
                    <div class="clase-dato-valor-calendario">${clase.tipologia}</div>
                </div>
                <div class="clase-dato-calendario">
                    <div class="clase-dato-label-calendario">Tutor</div>
                    <div class="clase-dato-valor-calendario">${clase.tutor}</div>
                </div>
            </div>
        </div>
        <div class="clase-estados-calendario">
            <div class="estado-item-calendario ${clase.pagado ? 'pagado' : 'no-pagado'}">
                <i class="fas fa-${clase.pagado ? 'check' : 'times'}-circle"></i>
                ${clase.pagado ? 'Pagado' : 'No Pagado'}
            </div>
            <div class="estado-item-calendario ${clase.dioClase ? 'dada' : 'no-dada'}">
                <i class="fas fa-${clase.dioClase ? 'check' : 'times'}-circle"></i>
                ${clase.dioClase ? 'Dada' : 'No Dada'}
            </div>
        </div>
        <div class="clase-acciones-calendario">
            <button class="btn-accion-calendario btn-editar-calendario" onclick="editarHorario('${clase.id}')" title="Editar">
                <i class="fas fa-edit"></i> Editar
            </button>
            <button class="btn-accion-calendario btn-eliminar-calendario" onclick="eliminarHorario('${clase.id}')" title="Eliminar">
                <i class="fas fa-trash"></i> Eliminar
            </button>
            <label class="checkbox-calendario">
                <input type="checkbox" ${clase.dioClase ? 'checked' : ''} 
                       onchange="actualizarDioClase('${clase.id}', this.checked)">
                <span>Marcar como dada</span>
            </label>
        </div>
    `;
    
    return claseElement;
}

// Actualizar clase específica en el panel del calendario
function actualizarClaseEnPanelCalendario(horarioId, dioClase) {
    // Buscar el elemento de la clase en el panel del calendario
    const claseElement = document.querySelector(`[data-horario-id="${horarioId}"]`);
    if (!claseElement) return;
    
    // Actualizar la clase CSS
    if (dioClase) {
        claseElement.classList.add('clase-dada');
    } else {
        claseElement.classList.remove('clase-dada');
    }
    
    // Actualizar el estado visual en la tarjeta
    const estadoDada = claseElement.querySelector('.estado-item-calendario.dada, .estado-item-calendario.no-dada');
    if (estadoDada) {
        estadoDada.className = `estado-item-calendario ${dioClase ? 'dada' : 'no-dada'}`;
        estadoDada.innerHTML = `
            <i class="fas fa-${dioClase ? 'check' : 'times'}-circle"></i>
            ${dioClase ? 'Dada' : 'No Dada'}
        `;
    }
    
    // Actualizar el checkbox
    const checkbox = claseElement.querySelector('input[type="checkbox"]');
    if (checkbox) {
        checkbox.checked = dioClase;
    }
}

// ===== FUNCIONES PARA COMPROBANTES DE PAGO =====

// Abrir modal de comprobantes
function abrirModalComprobantes() {
    mostrarModalComprobantes();
    cargarMesesDisponibles();
}

// Cerrar modal de comprobantes
function cerrarModalComprobantes() {
    document.getElementById('modalComprobantes').classList.remove('active');
    document.getElementById('modalOverlay').classList.remove('active');
    document.body.style.overflow = '';
}

// Mostrar modal de comprobantes
function mostrarModalComprobantes() {
    document.getElementById('modalComprobantes').classList.add('active');
    document.getElementById('modalOverlay').classList.add('active');
    document.body.style.overflow = 'hidden';
}

// Cargar meses disponibles con comprobantes
async function cargarMesesDisponibles() {
    try {
        const selectMes = document.getElementById('mesComprobantes');
        selectMes.innerHTML = '<option value="">Seleccionar mes</option>';
        
        // Obtener historial de pagos
        let pagos = [];
        if (usuarioActual.roles && (
            usuarioActual.roles.includes('SUPER USUARIO') ||
            usuarioActual.roles.includes('ADMINISTRADOR')
        )) {
            try {
                pagos = await DB.obtenerHistorialPagos();
            } catch (error) {
                console.warn('Error obteniendo historial de pagos, intentando con pagos por profesor:', error);
                // Fallback: intentar obtener pagos por profesor
                pagos = await DB.obtenerPagosPorProfesor(usuarioActual.id);
            }
        } else {
            pagos = await DB.obtenerPagosPorProfesor(usuarioActual.id);
        }
        
        // Filtrar solo pagos con comprobantes
        const pagosConComprobantes = pagos.filter(pago => 
            pago.estado === 'completado' && 
            pago.comprobante && 
            pago.comprobante.url
        );
        
        if (pagosConComprobantes.length === 0) {
            mostrarSinComprobantes('No hay comprobantes disponibles');
            return;
        }
        
        // Agrupar por mes y año
        const mesesUnicos = new Set();
        pagosConComprobantes.forEach(pago => {
            const fecha = pago.fechaPago ? new Date(pago.fechaPago) : new Date();
            const mesAño = `${fecha.getFullYear()}-${fecha.getMonth()}`;
            mesesUnicos.add(mesAño);
        });
        
        // Crear opciones de meses
        const mesesArray = Array.from(mesesUnicos).sort().reverse();
        mesesArray.forEach(mesAño => {
            const [año, mes] = mesAño.split('-');
            const nombreMes = obtenerNombreMes(parseInt(mes));
            const opcion = document.createElement('option');
            opcion.value = mesAño;
            opcion.textContent = `${nombreMes} ${año}`;
            selectMes.appendChild(opcion);
        });
        
    } catch (error) {
        console.error('Error cargando meses disponibles:', error);
        mostrarSinComprobantes('Error al cargar los comprobantes. Verifique su conexión.');
    }
}

// Cargar comprobantes por mes seleccionado
async function cargarComprobantesPorMes() {
    const mesSeleccionado = document.getElementById('mesComprobantes').value;
    
    if (!mesSeleccionado) {
        mostrarSinComprobantes();
        return;
    }
    
    try {
        mostrarCargandoComprobantes();
        
        // Obtener historial de pagos
        let pagos = [];
        if (usuarioActual.roles && (
            usuarioActual.roles.includes('SUPER USUARIO') ||
            usuarioActual.roles.includes('ADMINISTRADOR')
        )) {
            pagos = await DB.obtenerHistorialPagos();
        } else {
            pagos = await DB.obtenerPagosPorProfesor(usuarioActual.id);
        }
        
        // Filtrar pagos del mes seleccionado con comprobantes
        const [año, mes] = mesSeleccionado.split('-');
        const pagosDelMes = pagos.filter(pago => {
            if (pago.estado !== 'completado' || !pago.comprobante || !pago.comprobante.url) {
                return false;
            }
            
            const fecha = pago.fechaPago ? new Date(pago.fechaPago) : new Date();
            return fecha.getFullYear() == año && fecha.getMonth() == mes;
        });
        
        if (pagosDelMes.length === 0) {
            mostrarSinComprobantes('No hay comprobantes para este mes');
            return;
        }
        
        // Agrupar por semana
        const comprobantesPorSemana = agruparComprobantesPorSemana(pagosDelMes);
        
        // Mostrar comprobantes
        mostrarComprobantesPorSemana(comprobantesPorSemana);
        
    } catch (error) {
        console.error('Error cargando comprobantes:', error);
        mostrarMensaje('Error al cargar los comprobantes', 'error');
        mostrarSinComprobantes('Error al cargar los comprobantes');
    }
}

// Agrupar comprobantes por semana
function agruparComprobantesPorSemana(pagos) {
    const semanas = {};
    
    pagos.forEach(pago => {
        const semana = pago.semana || 'Semana no especificada';
        if (!semanas[semana]) {
            semanas[semana] = [];
        }
        semanas[semana].push(pago);
    });
    
    return semanas;
}

// Mostrar comprobantes agrupados por semana
function mostrarComprobantesPorSemana(comprobantesPorSemana) {
    const container = document.getElementById('listaComprobantes');
    
    let html = '';
    
    Object.keys(comprobantesPorSemana).sort().forEach(semana => {
        const comprobantes = comprobantesPorSemana[semana];
        
        // Obtener rango de fechas de la semana
        const rangoFechas = obtenerRangoFechasSemana(semana);
        
        html += `
            <div class="semana-comprobantes">
                <div class="semana-header">
                    <div class="semana-titulo">${semana}</div>
                    <div class="semana-fecha">${rangoFechas}</div>
                </div>
                <div class="comprobantes-grid">
        `;
        
        comprobantes.forEach(pago => {
            const fechaFormateada = pago.fechaPago ? 
                new Date(pago.fechaPago).toLocaleDateString('es-ES') : 
                'Fecha no disponible';
            
            html += `
                <div class="comprobante-item">
                    <div class="comprobante-header">
                        <div class="comprobante-profesor">${pago.profesorNombre}</div>
                        <div class="comprobante-monto">${formatearMonto(pago.monto)}</div>
                    </div>
                    <div class="comprobante-detalles">
                        <div class="comprobante-dato">
                            <span class="dato-label">Banco origen:</span>
                            <span class="dato-valor">${obtenerNombreBanco(pago.bancoOrigen)}</span>
                        </div>
                        <div class="comprobante-dato">
                            <span class="dato-label">Fecha:</span>
                            <span class="dato-valor">${fechaFormateada}</span>
                        </div>
                        <div class="comprobante-dato">
                            <span class="dato-label">Pagado por:</span>
                            <span class="dato-valor">${pago.nombreUsuarioQuePago || 'N/A'}</span>
                        </div>
                        ${pago.descripcion ? `
                            <div class="comprobante-dato">
                                <span class="dato-label">Descripción:</span>
                                <span class="dato-valor">${pago.descripcion}</span>
                            </div>
                        ` : ''}
                    </div>
                    <div class="comprobante-acciones">
                        <button class="btn-ver-comprobante" onclick="verComprobanteHorarios('${pago.comprobante.url}')">
                            <i class="fas fa-image"></i> Ver Comprobante
                        </button>
                    </div>
                </div>
            `;
        });
        
        html += `
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// Obtener rango de fechas de una semana
function obtenerRangoFechasSemana(semana) {
    // Intentar extraer fechas del formato de semana
    const match = semana.match(/(\d{1,2})\s*-\s*(\d{1,2})\s*(\w+)/i);
    if (match) {
        return `${match[1]} - ${match[2]} ${match[3]}`;
    }
    return semana;
}

// Obtener nombre del banco
function obtenerNombreBanco(bancoId) {
    const bancos = {
        'bancolombia': 'Bancolombia',
        'bbva': 'BBVA',
        'davivienda': 'Davivienda',
        'nequi': 'Nequi',
        'daviplata': 'Daviplata',
        'efectivo': 'Efectivo'
    };
    return bancos[bancoId] || bancoId || 'N/A';
}

// Formatear monto
function formatearMonto(monto) {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0
    }).format(monto);
}

// Mostrar estado sin comprobantes
function mostrarSinComprobantes(mensaje = 'Selecciona un mes para ver los comprobantes') {
    const container = document.getElementById('listaComprobantes');
    container.innerHTML = `
        <div class="sin-comprobantes">
            <i class="fas fa-receipt"></i>
            <h4>${mensaje}</h4>
            <p>Los comprobantes se organizan por semana dentro del mes seleccionado.</p>
        </div>
    `;
}

// Mostrar cargando comprobantes
function mostrarCargandoComprobantes() {
    const container = document.getElementById('listaComprobantes');
    container.innerHTML = `
        <div class="sin-comprobantes">
            <div class="loading-comprobante">
                <div class="spinner"></div>
                <p>Cargando comprobantes...</p>
            </div>
        </div>
    `;
}

// Ver comprobante específico (reutilizar función de pagos-sistema.js)
function verComprobanteHorarios(urlComprobante) {
    // Crear modal de comprobante si no existe
    let modalComprobante = document.getElementById('modalComprobanteViewer');
    if (!modalComprobante) {
        modalComprobante = document.createElement('div');
        modalComprobante.id = 'modalComprobanteViewer';
        modalComprobante.className = 'modal modal-comprobante-viewer';
        modalComprobante.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Comprobante de Pago</h3>
                    <button class="close-btn" onclick="cerrarModalComprobanteViewer()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="comprobante-viewer">
                        <div class="loading-comprobante" id="loadingComprobanteViewer">
                            <div class="spinner"></div>
                            <p>Cargando comprobante...</p>
                        </div>
                        <img id="imagenComprobanteViewer" 
                             src="" 
                             alt="Comprobante de pago" 
                             style="display: none;" 
                             onload="comprobanteViewerCargado()" 
                             onerror="errorCargandoComprobanteViewer()">
                        <div id="errorComprobanteViewer" style="display: none;">
                            <i class="fas fa-exclamation-triangle"></i>
                            <h4>Error al cargar el comprobante</h4>
                            <p>No se pudo cargar la imagen del comprobante.</p>
                            <button class="btn btn-outline" onclick="abrirComprobanteEnNuevaVentana('${urlComprobante}')">
                                <i class="fas fa-external-link-alt"></i> Abrir en nueva ventana
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modalComprobante);
    }
    
    // Mostrar modal
    modalComprobante.classList.add('active');
    document.getElementById('modalOverlay').classList.add('active');
    document.body.style.overflow = 'hidden';
    
    // Mostrar loading
    document.getElementById('loadingComprobanteViewer').style.display = 'block';
    document.getElementById('imagenComprobanteViewer').style.display = 'none';
    document.getElementById('errorComprobanteViewer').style.display = 'none';
    
    // Cargar imagen
    const img = document.getElementById('imagenComprobanteViewer');
    img.src = urlComprobante;
}

// Cerrar modal de comprobante viewer
function cerrarModalComprobanteViewer() {
    const modal = document.getElementById('modalComprobanteViewer');
    if (modal) {
        modal.classList.remove('active');
    }
    document.getElementById('modalOverlay').classList.remove('active');
    document.body.style.overflow = '';
}

// Comprobante cargado exitosamente
function comprobanteViewerCargado() {
    document.getElementById('loadingComprobanteViewer').style.display = 'none';
    document.getElementById('imagenComprobanteViewer').style.display = 'block';
    document.getElementById('errorComprobanteViewer').style.display = 'none';
}

// Error cargando comprobante
function errorCargandoComprobanteViewer() {
    document.getElementById('loadingComprobanteViewer').style.display = 'none';
    document.getElementById('imagenComprobanteViewer').style.display = 'none';
    document.getElementById('errorComprobanteViewer').style.display = 'block';
}

// Abrir comprobante en nueva ventana
function abrirComprobanteEnNuevaVentana(url) {
    window.open(url, '_blank');
}

// Exportar funciones para uso global
window.cambiarVista = cambiarVista;
window.cambiarSemana = cambiarSemana;
window.cambiarMes = cambiarMes;
window.filtrarPorMateria = filtrarPorMateria;
window.abrirModalHorario = abrirModalHorario;
window.cerrarModalHorario = cerrarModalHorario;
window.editarHorario = editarHorario;
window.eliminarHorario = eliminarHorario;
window.cerrarSesion = cerrarSesion;
window.crearHorarioDesdeCalendario = crearHorarioDesdeCalendario;
window.actualizarDioClase = actualizarDioClase;
window.cargarVistaDia = cargarVistaDia;
window.seleccionarDiaSemana = seleccionarDiaSemana;
window.abrirModalComprobantes = abrirModalComprobantes;
window.cerrarModalComprobantes = cerrarModalComprobantes;
window.cargarComprobantesPorMes = cargarComprobantesPorMes;
window.verComprobanteHorarios = verComprobanteHorarios;
window.cerrarModalComprobanteViewer = cerrarModalComprobanteViewer;
window.comprobanteViewerCargado = comprobanteViewerCargado;
window.errorCargandoComprobanteViewer = errorCargandoComprobanteViewer;
window.abrirComprobanteEnNuevaVentana = abrirComprobanteEnNuevaVentana;