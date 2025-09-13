    // Variables globales
let datosProfesores = [];
let semanasUnicas = [];
let semanasDelMes = [];
let mesActual = new Date().getMonth() + 1; // Mes actual (1-12)
let añoActual = new Date().getFullYear();
let tarifasProfesores = {};
let usuarioActual = null;
let profesorEditando = null;
let filtros = {
    ocupacion: '',
    estado: '',
    mes: mesActual + '-' + añoActual
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
    
    // Verificar acceso a cuentas por pagar
    verificarAccesoCuentas();
}

// Verificar acceso a cuentas basado en roles
function verificarAccesoCuentas() {
    // Verificar si el usuario tiene rol de ADMINISTRADOR o SUPER USUARIO
    const tieneAccesoCuentas = usuarioActual.roles && (
        usuarioActual.roles.includes('ADMINISTRADOR') || 
        usuarioActual.roles.includes('SUPER USUARIO')
    );
    
    if (!tieneAccesoCuentas) {
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
        
        // Cargar semanas únicas donde se dieron clases
        semanasUnicas = await DB.obtenerSemanasUnicasClases();
        console.log('Semanas únicas encontradas:', semanasUnicas);
        
        // Cargar datos de profesores con sus clases
        datosProfesores = await DB.obtenerDatosProfesoresParaCuentas();
        console.log('Datos de profesores cargados:', datosProfesores);
        
        // Cargar tarifas de profesores
        tarifasProfesores = await DB.obtenerTodasLasTarifas();
        console.log('Tarifas de profesores cargadas:', tarifasProfesores);
        
        // Mostrar información detallada de las semanas por profesor
        console.log('=== INFORMACIÓN DETALLADA DE SEMANAS POR PROFESOR ===');
        datosProfesores.forEach(profesor => {
            console.log(`Profesor: ${profesor.nombre}`);
            console.log('Materias:', profesor.materias);
            console.log('Semanas por materia:', profesor.semanasPorMateria);
            
            // Mostrar todas las semanas donde este profesor dio clases
            const todasLasSemanas = new Set();
            Object.keys(profesor.semanasPorMateria).forEach(materia => {
                Object.keys(profesor.semanasPorMateria[materia]).forEach(semana => {
                    todasLasSemanas.add(semana);
                });
            });
            console.log(`Semanas donde ${profesor.nombre} dio clases:`, Array.from(todasLasSemanas));
        });
        
        // Inicializar selector de mes
        inicializarSelectorMes();
        
        // Generar semanas del mes actual
        generarSemanasDelMes();
        
        // Generar estructura de tabla dinámica
        generarEstructuraTabla();
        
        // Cargar vista inicial
        cargarTablaCuentas();
        actualizarEstadisticas();
        
        ocultarCargando();
    } catch (error) {
        console.error('Error cargando datos:', error);
        mostrarMensaje('Error al cargar los datos de profesores', 'error');
        datosProfesores = [];
        semanasUnicas = [];
        semanasDelMes = [];
        
        // Inicializar selector de mes
        inicializarSelectorMes();
        
        // Generar semanas del mes actual
        generarSemanasDelMes();
        
        // Cargar vista vacía
        generarEstructuraTabla();
        cargarTablaCuentas();
        actualizarEstadisticas();
        
        ocultarCargando();
    }
}

// Inicializar selector de mes
function inicializarSelectorMes() {
    const selectMes = document.getElementById('filtroMes');
    if (!selectMes) {
        console.error('Elemento filtroMes no encontrado en el DOM');
        return;
    }
    
    selectMes.innerHTML = '';
    
    // Obtener rango de meses basado en las semanas únicas disponibles
    const fechasDisponibles = obtenerFechasDisponibles();
    
    fechasDisponibles.forEach(fecha => {
        const option = document.createElement('option');
        option.value = `${fecha.mes}-${fecha.año}`;
        option.textContent = `${obtenerNombreMes(fecha.mes)} ${fecha.año}`;
        
        // Seleccionar el mes actual por defecto
        if (fecha.mes === mesActual && fecha.año === añoActual) {
            option.selected = true;
        }
        
        selectMes.appendChild(option);
    });
    
    // Si no hay fechas disponibles, agregar el mes actual
    if (fechasDisponibles.length === 0) {
        const option = document.createElement('option');
        option.value = `${mesActual}-${añoActual}`;
        option.textContent = `${obtenerNombreMes(mesActual)} ${añoActual}`;
        option.selected = true;
        selectMes.appendChild(option);
    }
}

// Obtener fechas disponibles basadas en las semanas únicas
function obtenerFechasDisponibles() {
    const fechas = new Set();
    
    // Las semanas únicas vienen en formato "S37-9/2025"
    semanasUnicas.forEach(semana => {
        const match = semana.match(/S(\d+)-(\d+)\/(\d+)/);
        if (match) {
            const [, numeroSemana, mes, año] = match.map(Number);
            fechas.add(`${mes}-${año}`);
        }
    });
    
    // Convertir a array y ordenar
    const fechasArray = Array.from(fechas).map(fechaStr => {
        const [mes, año] = fechaStr.split('-').map(Number);
        return { mes, año };
    });
    
    // Ordenar por año y mes
    fechasArray.sort((a, b) => {
        if (a.año !== b.año) return b.año - a.año; // Más reciente primero
        return b.mes - a.mes; // Más reciente primero
    });
    
    // Si no hay fechas disponibles, agregar el mes actual
    if (fechasArray.length === 0) {
        fechasArray.push({ mes: mesActual, año: añoActual });
    }
    
    console.log('Fechas disponibles:', fechasArray);
    return fechasArray;
}

// Extraer fechas de una semana (formato: "21/27 ABRIL" o "28/4 ABRIL A MAYO")
function extraerFechasDeSemana(semana) {
    const fechas = [];
    const añoActualParaSemana = añoActual; // Asumir año actual
    
    // Mapeo de nombres de meses a números
    const meses = {
        'ENERO': 1, 'FEBRERO': 2, 'MARZO': 3, 'ABRIL': 4, 'MAYO': 5, 'JUNIO': 6,
        'JULIO': 7, 'AGOSTO': 8, 'SEPTIEMBRE': 9, 'OCTUBRE': 10, 'NOVIEMBRE': 11, 'DICIEMBRE': 12
    };
    
    // Patrón para semanas como "21/27 ABRIL"
    const patron1 = /\\d+\/\\d+\\s+(\\w+)/g;
    // Patrón para semanas como "28/4 ABRIL A MAYO"
    const patron2 = /\\d+\/\\d+\\s+(\\w+)\\s+A\\s+(\\w+)/g;
    
    let match;
    
    // Buscar patrón tipo "21/27 ABRIL"
    while ((match = patron1.exec(semana)) !== null) {
        const nombreMes = match[1].toUpperCase();
        if (meses[nombreMes]) {
            fechas.push({ mes: meses[nombreMes], año: añoActualParaSemana });
        }
    }
    
    // Buscar patrón tipo "28/4 ABRIL A MAYO"
    patron2.lastIndex = 0; // Reiniciar el índice
    while ((match = patron2.exec(semana)) !== null) {
        const nombreMes1 = match[1].toUpperCase();
        const nombreMes2 = match[2].toUpperCase();
        
        if (meses[nombreMes1]) {
            fechas.push({ mes: meses[nombreMes1], año: añoActualParaSemana });
        }
        if (meses[nombreMes2]) {
            fechas.push({ mes: meses[nombreMes2], año: añoActualParaSemana });
        }
    }
    
    return fechas;
}

// Obtener nombre del mes
function obtenerNombreMes(numeroMes) {
    const nombres = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    return nombres[numeroMes - 1] || 'Mes desconocido';
}

// Generar todas las semanas del mes seleccionado
function generarSemanasDelMes() {
    const [mes, año] = filtros.mes.split('-').map(Number);
    semanasDelMes = [];
    
    // Obtener el primer y último día del mes
    const primerDia = new Date(año, mes - 1, 1);
    const ultimoDia = new Date(año, mes, 0);
    
    // Generar semanas del mes
    let fechaActual = new Date(primerDia);
    
    // Retroceder al lunes de la primera semana
    while (fechaActual.getDay() !== 1) {
        fechaActual.setDate(fechaActual.getDate() - 1);
    }
    
    let numeroSemana = 1;
    
    while (fechaActual <= ultimoDia || (fechaActual.getMonth() === mes - 1 && numeroSemana <= 5)) {
        const inicioSemana = new Date(fechaActual);
        const finSemana = new Date(fechaActual);
        finSemana.setDate(finSemana.getDate() + 6);
        
        // Formatear la semana
        const formatoSemana = formatearSemana(inicioSemana, finSemana, mes);
        if (formatoSemana) {
            semanasDelMes.push(formatoSemana);
        }
        
        // Avanzar a la siguiente semana
        fechaActual.setDate(fechaActual.getDate() + 7);
        numeroSemana++;
        
        // Evitar bucle infinito
        if (numeroSemana > 6) break;
    }
    
    console.log('Semanas generadas para', obtenerNombreMes(mes), año + ':', semanasDelMes);
}

// Formatear semana para que coincida con el formato existente
function formatearSemana(inicio, fin, mesObjetivo) {
    const mesInicio = inicio.getMonth() + 1;
    const mesFin = fin.getMonth() + 1;
    
    const nombreMesInicio = obtenerNombreMes(mesInicio).toUpperCase();
    const nombreMesFin = obtenerNombreMes(mesFin).toUpperCase();
    
    const diaInicio = inicio.getDate();
    const diaFin = fin.getDate();
    
    // Solo incluir semanas que tengan al menos un día del mes objetivo
    const tieneAlgunDiaDelMes = (mesInicio === mesObjetivo) || (mesFin === mesObjetivo) || 
                               (mesInicio < mesObjetivo && mesFin > mesObjetivo);
    
    if (!tieneAlgunDiaDelMes) {
        return null;
    }
    
    if (mesInicio === mesFin) {
        return `${diaInicio}/${diaFin} ${nombreMesInicio}`;
    } else {
        return `${diaInicio}/${diaFin} ${nombreMesInicio} A ${nombreMesFin}`;
    }
}

// Generar estructura de tabla dinámica
function generarEstructuraTabla() {
    const thead = document.querySelector('.tabla-cuentas thead tr');
    if (!thead) {
        console.error('Elemento thead de tabla no encontrado en el DOM');
        return;
    }
    
    // Limpiar encabezados existentes
    thead.innerHTML = '';
    
    // Agregar columnas fijas
    const columnasFijas = [
        { clase: 'col-ocupacion', texto: 'Ocupación en el PRE' },
        { clase: 'col-asignatura', texto: 'Asignatura' },
        { clase: 'col-nombre-recibe', texto: 'Nombre de Quién Recibe' },
        { clase: 'col-tipo-banco', texto: 'Tipo de Banco' },
        { clase: 'col-tipo-id', texto: 'Tipo de ID' },
        { clase: 'col-numero-id', texto: 'Número de ID' },
        { clase: 'col-numero-cuenta', texto: 'Número de Cuenta' },
        { clase: 'col-nombre-cuenta', texto: 'Nombre de Cuenta' }
    ];
    
    // Agregar columnas fijas
    columnasFijas.forEach(columna => {
        const th = document.createElement('th');
        th.className = columna.clase;
        th.textContent = columna.texto;
        thead.appendChild(th);
    });
    
    // Agregar columnas dinámicas de semanas del mes seleccionado
    semanasDelMes.forEach(semana => {
        const th = document.createElement('th');
        th.className = 'col-semana-dinamica';
        th.textContent = semana;
        th.style.minWidth = '120px';
        th.style.textAlign = 'center';
        thead.appendChild(th);
    });
    
    // Agregar columnas finales
    const columnasFinales = [
        { clase: 'col-estado', texto: 'Estado' },
        { clase: 'col-acciones', texto: 'Acciones' }
    ];
    
    columnasFinales.forEach(columna => {
        const th = document.createElement('th');
        th.className = columna.clase;
        th.textContent = columna.texto;
        thead.appendChild(th);
    });
    
    console.log('Estructura de tabla generada con', semanasDelMes.length, 'semanas del mes');
}

// Configurar event listeners
function configurarEventListeners() {
    // Formulario de cuenta
    document.getElementById('formCuenta').addEventListener('submit', function(e) {
        e.preventDefault();
        guardarCuenta();
    });

    // Cerrar modal al hacer clic en el overlay
    document.getElementById('modalOverlay').addEventListener('click', cerrarModalCuenta);

    // Cerrar modal con tecla Escape
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            cerrarModalCuenta();
        }
    });
}

// Cargar tabla de cuentas
function cargarTablaCuentas() {
    const tbody = document.getElementById('tablaCuentasBody');
    if (!tbody) {
        console.error('Elemento tablaCuentasBody no encontrado en el DOM');
        return;
    }
    tbody.innerHTML = '';

    const profesoresFiltrados = filtrarProfesores();

    if (profesoresFiltrados.length === 0) {
        const totalColumnas = 8 + semanasDelMes.length + 2; // columnas fijas + semanas + estado + acciones
        tbody.innerHTML = `
            <tr>
                <td colspan="${totalColumnas}" class="sin-datos">
                    <i class="fas fa-file-invoice-dollar"></i>
                    <h3>No hay profesores con clases dadas para mostrar</h3>
                    <p>No se encontraron profesores para los criterios seleccionados.</p>
                </td>
            </tr>
        `;
        document.getElementById('totalRegistros').textContent = '0 registros';
        return;
    }

    profesoresFiltrados.forEach(profesor => {
        // Crear una sola fila por profesor
        const fila = document.createElement('tr');
        
        // Determinar estado general del profesor basado en pagos
        let totalMontoProfesor = 0;
        let totalPagadoProfesor = 0;
        
        // Calcular total de horas y montos del profesor
        profesor.materias.forEach(materia => {
            const semanasPorMateria = profesor.semanasPorMateria[materia];
            if (!semanasPorMateria) return;
            
            Object.values(semanasPorMateria).forEach(datosSemanMateria => {
                const tarifaProfesor = tarifasProfesores[profesor.id] || 20000;
                const montoSemana = datosSemanMateria.totalHoras * tarifaProfesor;
                totalMontoProfesor += montoSemana;
            });
        });
        
        // Calcular total pagado al profesor
        semanasDelMes.forEach(semana => {
            const semanaCoincidente = encontrarSemanaCoincidente(semana);
            if (semanaCoincidente) {
                let totalHorasSemana = 0;
                profesor.materias.forEach(materia => {
                    const datosSemanMateria = profesor.semanasPorMateria[materia] && 
                                             profesor.semanasPorMateria[materia][semanaCoincidente];
                    if (datosSemanMateria) {
                        totalHorasSemana += datosSemanMateria.totalHoras;
                    }
                });
                
                if (totalHorasSemana > 0) {
                    const tarifaProfesor = tarifasProfesores[profesor.id] || 20000;
                    const montoTotalSemana = totalHorasSemana * tarifaProfesor;
                    
                    const yaEstaPagada = typeof estaSemanasPagada === 'function' ? 
                        estaSemanasPagada(profesor.id, semana) : false;
                    
                    if (yaEstaPagada) {
                        totalPagadoProfesor += montoTotalSemana;
                    }
                }
            }
        });
        
        // Determinar estado general
        let estado = 'pendiente';
        if (totalPagadoProfesor >= totalMontoProfesor && totalMontoProfesor > 0) {
            estado = 'pagado';
        } else if (totalPagadoProfesor > 0) {
            estado = 'parcial';
        }
        
        // Aplicar clase CSS según el estado (fila roja si no pagado)
        if (estado === 'pendiente') {
            fila.classList.add('cuenta-pendiente');
        } else if (estado === 'pagado') {
            fila.classList.add('cuenta-pagada');
        } else if (estado === 'parcial') {
            fila.classList.add('cuenta-parcial');
        }
        
        // Crear badges para todas las materias del profesor
        const materiasHTML = profesor.materias
            .filter(materia => profesor.semanasPorMateria[materia] && 
                              Object.keys(profesor.semanasPorMateria[materia]).length > 0)
            .map(materia => `<span class="asignatura-badge asignatura-${materia.toLowerCase()}">${materia}</span>`)
            .join(' ');
        
        // Construir HTML de la fila - Columnas fijas
        let filaHTML = `
            <td>${profesor.ocupacionPre || 'N/A'}</td>
            <td class="col-asignatura">
                ${materiasHTML}
            </td>
            <td>${profesor.nombreQuienRecibe || profesor.nombre}</td>
            <td>${profesor.tipoBanco || 'N/A'}</td>
            <td>${profesor.tipoId || 'N/A'}</td>
            <td>${profesor.numeroId || 'N/A'}</td>
            <td class="col-numero-cuenta">
                <div class="celda-con-copiar">
                    <span class="texto-celda">${profesor.numeroCuenta || 'N/A'}</span>
                    ${profesor.numeroCuenta && profesor.numeroCuenta !== 'N/A' ? `<button class="btn-copiar" onclick="copiarTexto('${profesor.numeroCuenta}', this)" title="Copiar número de cuenta">
                        <i class="fas fa-copy"></i>
                    </button>` : ''}
                </div>
            </td>
            <td class="col-nombre-cuenta">
                <div class="celda-con-copiar">
                    <span class="texto-celda">${profesor.nombreCuenta || profesor.nombre}</span>
                    ${profesor.nombreCuenta || profesor.nombre ? `<button class="btn-copiar" onclick="copiarTexto('${(profesor.nombreCuenta || profesor.nombre).replace(/'/g, '\\\'').replace(/"/g, '&quot;')}', this)" title="Copiar nombre de cuenta">
                        <i class="fas fa-copy"></i>
                    </button>` : ''}
                </div>
            </td>
        `;
        
        // Obtener tarifa del profesor
        const tarifaProfesor = tarifasProfesores[profesor.id] || 20000;
        
        // Agregar columnas dinámicas de semanas del mes
        semanasDelMes.forEach(semana => {
            let totalHorasSemana = 0;
            let montoTotalSemana = 0;
            
            console.log(`\n=== PROCESANDO SEMANA ${semana} PARA PROFESOR ${profesor.nombre} ===`);
            console.log('Semanas disponibles para el profesor:', Object.keys(profesor.semanasPorMateria));
            
            // En lugar de buscar coincidencia, buscar TODAS las semanas que se superponen
            Object.keys(profesor.semanasPorMateria).forEach(materiaKey => {
                const semanasMateria = profesor.semanasPorMateria[materiaKey];
                
                Object.keys(semanasMateria).forEach(semanaUnica => {
                    // Verificar si esta semana única se superpone con la semana del mes que estamos procesando
                    if (verificarSuperposicionSemanasDetallada(semana, semanaUnica)) {
                        const datosSemanMateria = semanasMateria[semanaUnica];
                        if (datosSemanMateria) {
                            totalHorasSemana += datosSemanMateria.totalHoras;
                            console.log(`✓ ${profesor.nombre} - ${materiaKey} - ${semana} coincide con ${semanaUnica}: ${datosSemanMateria.totalHoras} horas`);
                            console.log('  Clases encontradas:', datosSemanMateria.clases.map(c => `${c.dia} ${c.tema} (${c.cantidadHoras}h)`));
                        }
                    }
                });
            });
            
            console.log(`TOTAL HORAS PARA ${profesor.nombre} EN ${semana}: ${totalHorasSemana}`);
            
            // Calcular monto usando la tarifa individual del profesor
            montoTotalSemana = totalHorasSemana * tarifaProfesor;
            
            if (totalHorasSemana > 0) {
                console.log(`${profesor.nombre} - ${semana}: ${totalHorasSemana}h x $${tarifaProfesor} = $${montoTotalSemana}`);
            }
            
            if (totalHorasSemana > 0) {
                // Verificar si la semana ya está pagada
                const yaEstaPagada = typeof estaSemanasPagada === 'function' ? 
                    estaSemanasPagada(profesor.id, semana) : false;
                
                if (yaEstaPagada) {
                    filaHTML += `
                        <td class="col-semana-dinamica">
                            <div class="info-semana semana-pagada">
                                <span class="monto pagado">${formatearMonto(montoTotalSemana)}</span>
                                <div class="estado-pagado">
                                    <i class="fas fa-check-circle"></i>
                                    <span>PAGADO</span>
                                </div>
                            </div>
                        </td>
                    `;
                } else {
                    filaHTML += `
                        <td class="col-semana-dinamica">
                            <div class="info-semana">
                                <span class="monto ${obtenerClaseMonto(montoTotalSemana)}">${formatearMonto(montoTotalSemana)}</span>
                                <button class="btn-pagar-semana" onclick="abrirModalPago('${profesor.id}', '${semana}', ${montoTotalSemana})" title="Pagar semana ${semana}">
                                    <i class="fas fa-credit-card"></i> PAGAR
                                </button>
                            </div>
                        </td>
                    `;
                }
            } else {
                filaHTML += `
                    <td class="col-semana-dinamica">
                        <span class="monto cero">$0</span>
                    </td>
                `;
            }
        });
        
        // Agregar columnas finales
        filaHTML += `
            <td class="col-estado">
                <span class="estado-pago ${estado}">${capitalizeFirst(estado)}</span>
            </td>
            <td class="col-acciones">
                <button class="btn-accion btn-editar" onclick="editarProfesor('${profesor.id}')" title="Editar datos">
                    <i class="fas fa-edit"></i>
                </button>
            </td>
        `;
        
        fila.innerHTML = filaHTML;
        tbody.appendChild(fila);
    });

    // Actualizar contador de registros
    const totalFilas = tbody.querySelectorAll('tr:not(.sin-datos)').length;
    const totalRegistrosElement = document.getElementById('totalRegistros');
    if (totalRegistrosElement) {
        totalRegistrosElement.textContent = `${totalFilas} registro${totalFilas !== 1 ? 's' : ''}`;
    }
}

// Función para calcular monto por horas usando tarifa individual del profesor
function calcularMontoPorHoras(totalHoras, profesorId) {
    const tarifaProfesor = tarifasProfesores[profesorId] || 20000; // Tarifa por defecto
    return totalHoras * tarifaProfesor;
}

// Filtrar profesores
function filtrarProfesores() {
    let profesoresFiltrados = [...datosProfesores];
    
    // Filtrar por ocupación
    if (filtros.ocupacion) {
        profesoresFiltrados = profesoresFiltrados.filter(profesor => 
            profesor.ocupacionPre === filtros.ocupacion
        );
    }
    
    // El filtro por estado se puede implementar más tarde cuando tengamos esa información
    // if (filtros.estado) {
    //     // Filtrar por estado de pago
    // }

    return profesoresFiltrados.sort((a, b) => a.nombre.localeCompare(b.nombre));
}

// Encontrar semana coincidente entre las semanas generadas y las semanas únicas
function encontrarSemanaCoincidente(semanaGenerada) {
    // Las semanas únicas vienen en formato "S37-9/2025"
    // Las semanas generadas vienen en formato "1/7 SEPTIEMBRE"
    
    console.log('Buscando coincidencia para:', semanaGenerada);
    
    // Convertir la semana generada a datos de fecha para buscar coincidencias
    const datosSemanaGenerada = extraerDatosSemana(semanaGenerada);
    if (!datosSemanaGenerada) {
        console.log('No se pudieron extraer datos de la semana:', semanaGenerada);
        return null;
    }
    
    const [mes, año] = filtros.mes.split('-').map(Number);
    console.log('Mes y año del filtro:', mes, año);
    console.log('Datos semana generada:', datosSemanaGenerada);
    console.log('Semanas únicas disponibles:', semanasUnicas);
    
        // Buscar en las semanas únicas una que coincida con el rango de fechas
        for (const semanaUnica of semanasUnicas) {
            // Parsear formato "S37-9/2025"
            const match = semanaUnica.match(/S(\d+)-(\d+)\/(\d+)/);
            if (!match) continue;
            
            const [, numeroSemana, mesUnica, añoUnica] = match.map(Number);
            
            // Solo considerar semanas del año correcto
            if (añoUnica !== año) continue;
            
            // Verificar si la semana única se superpone con la semana generada
            if (verificarSuperposicionSemanas(datosSemanaGenerada, numeroSemana, mesUnica, añoUnica)) {
                console.log(`Coincidencia encontrada: ${semanaGenerada} -> ${semanaUnica}`);
                return semanaUnica;
            }
        }
        
        // Si no encontramos coincidencia exacta, no devolver nada
        // Esto evita duplicaciones de datos en semanas que no tienen clases
    
    console.log('No se encontró coincidencia para:', semanaGenerada);
    return null;
}

// Verificar si dos semanas son equivalentes
function sonSemanasEquivalentes(semana1, semana2) {
    // Extraer números y meses de ambas semanas
    const datos1 = extraerDatosSemana(semana1);
    const datos2 = extraerDatosSemana(semana2);
    
    if (!datos1 || !datos2) return false;
    
    // Comparar si las fechas se superponen
    return haySuperpocisionFechas(datos1, datos2);
}

// Extraer datos de una semana
function extraerDatosSemana(semana) {
    try {
        // Patrón para "21/27 ABRIL" o "28/4 ABRIL A MAYO"
        const patron1 = /(\d+)\/(\d+)\s+(\w+)/;
        const patron2 = /(\d+)\/(\d+)\s+(\w+)\s+A\s+(\w+)/;
        
        const meses = {
            'ENERO': 1, 'FEBRERO': 2, 'MARZO': 3, 'ABRIL': 4, 'MAYO': 5, 'JUNIO': 6,
            'JULIO': 7, 'AGOSTO': 8, 'SEPTIEMBRE': 9, 'OCTUBRE': 10, 'NOVIEMBRE': 11, 'DICIEMBRE': 12
        };
        
        let match = patron2.exec(semana);
        if (match) {
            return {
                diaInicio: parseInt(match[1]),
                diaFin: parseInt(match[2]),
                mesInicio: meses[match[3].toUpperCase()],
                mesFin: meses[match[4].toUpperCase()]
            };
        }
        
        match = patron1.exec(semana);
        if (match) {
            const mes = meses[match[3].toUpperCase()];
            return {
                diaInicio: parseInt(match[1]),
                diaFin: parseInt(match[2]),
                mesInicio: mes,
                mesFin: mes
            };
        }
        
        return null;
    } catch (error) {
        console.error('Error extrayendo datos de semana:', semana, error);
        return null;
    }
}

// Verificar superposición entre una semana generada y una semana única del sistema
function verificarSuperposicionSemanas(datosSemanaGenerada, numeroSemana, mesUnica, añoUnica) {
    try {
        const [mes, año] = filtros.mes.split('-').map(Number);
        
        // Si los años no coinciden, no hay superposición
        if (añoUnica !== año) {
            return false;
        }
        
        // Calcular las fechas de inicio y fin de la semana única basándose en el número de semana
        const fechaInicioAño = new Date(añoUnica, 0, 1);
        const diasHastaInicio = (numeroSemana - 1) * 7;
        const fechaInicioSemana = new Date(fechaInicioAño);
        fechaInicioSemana.setDate(fechaInicioAño.getDate() + diasHastaInicio);
        
        // Ajustar al lunes de esa semana
        const diaSemana = fechaInicioSemana.getDay();
        const diasParaLunes = diaSemana === 0 ? -6 : 1 - diaSemana;
        fechaInicioSemana.setDate(fechaInicioSemana.getDate() + diasParaLunes);
        
        const fechaFinSemana = new Date(fechaInicioSemana);
        fechaFinSemana.setDate(fechaInicioSemana.getDate() + 6);
        
        // Convertir los datos de la semana generada a fechas
        const fechaInicioGenerada = new Date(año, mes - 1, datosSemanaGenerada.diaInicio);
        const fechaFinGenerada = new Date(año, datosSemanaGenerada.mesFin - 1, datosSemanaGenerada.diaFin);
        
        console.log(`Verificando superposición:
            Semana única: ${fechaInicioSemana.toDateString()} - ${fechaFinSemana.toDateString()}
            Semana generada: ${fechaInicioGenerada.toDateString()} - ${fechaFinGenerada.toDateString()}`);
        
        // Verificar superposición de fechas (requiere al menos 3 días de superposición)
        const inicioSuperposicion = Math.max(fechaInicioSemana.getTime(), fechaInicioGenerada.getTime());
        const finSuperposicion = Math.min(fechaFinSemana.getTime(), fechaFinGenerada.getTime());
        
        const diasSuperposicion = (finSuperposicion - inicioSuperposicion) / (24 * 60 * 60 * 1000) + 1;
        const haySuperposicion = diasSuperposicion >= 3; // Requiere al menos 3 días de superposición
        
        console.log(`Días de superposición: ${diasSuperposicion}, Hay superposición válida: ${haySuperposicion}`);
        
        return haySuperposicion;
    } catch (error) {
        console.error('Error verificando superposición de semanas:', error);
        return false;
    }
}

// Verificar si hay superposición entre fechas
function haySuperpocisionFechas(datos1, datos2) {
    // Simplificado: si coinciden al menos un mes y hay superposición de días
    const mesesCoinciden = datos1.mesInicio === datos2.mesInicio || 
                          datos1.mesInicio === datos2.mesFin ||
                          datos1.mesFin === datos2.mesInicio ||
                          datos1.mesFin === datos2.mesFin;
    
    if (!mesesCoinciden) return false;
    
    // Verificar superposición de días (simplificado)
    const inicio1 = Math.min(datos1.diaInicio, datos1.diaFin);
    const fin1 = Math.max(datos1.diaInicio, datos1.diaFin);
    const inicio2 = Math.min(datos2.diaInicio, datos2.diaFin);
    const fin2 = Math.max(datos2.diaInicio, datos2.diaFin);
    
    return !(fin1 < inicio2 || fin2 < inicio1);
}

// Aplicar filtro de mes
function aplicarFiltroMes() {
    const filtroMesElement = document.getElementById('filtroMes');
    if (!filtroMesElement) {
        console.error('Elemento filtroMes no encontrado');
        return;
    }
    
    const nuevoMes = filtroMesElement.value;
    if (nuevoMes !== filtros.mes) {
        filtros.mes = nuevoMes;
        
        // Regenerar semanas del nuevo mes
        generarSemanasDelMes();
        
        // Regenerar estructura de tabla
        generarEstructuraTabla();
        
        // Recargar datos
        cargarTablaCuentas();
        actualizarEstadisticas();
    }
}

// Aplicar filtros
function aplicarFiltros() {
    const filtroOcupacionElement = document.getElementById('filtroOcupacion');
    const filtroEstadoElement = document.getElementById('filtroEstado');
    
    if (filtroOcupacionElement) {
        filtros.ocupacion = filtroOcupacionElement.value;
    }
    if (filtroEstadoElement) {
        filtros.estado = filtroEstadoElement.value;
    }
    
    cargarTablaCuentas();
    actualizarEstadisticas();
}

// Limpiar filtros
function limpiarFiltros() {
    document.getElementById('filtroOcupacion').value = '';
    document.getElementById('filtroEstado').value = '';
    
    // Resetear al mes actual
    document.getElementById('filtroMes').value = `${mesActual}-${añoActual}`;
    
    filtros = {
        ocupacion: '',
        estado: '',
        mes: `${mesActual}-${añoActual}`
    };
    
    // Regenerar semanas del mes actual
    generarSemanasDelMes();
    
    // Regenerar estructura de tabla
    generarEstructuraTabla();
    
    cargarTablaCuentas();
    actualizarEstadisticas();
}

// Actualizar estadísticas
function actualizarEstadisticas() {
    const profesoresFiltrados = filtrarProfesores();
    
    let totalPendiente = 0;
    let totalPagado = 0;
    
    profesoresFiltrados.forEach(profesor => {
        const tarifaProfesor = tarifasProfesores[profesor.id] || 20000;
        
        // Calcular total por semanas del mes actual (no todas las semanas)
        semanasDelMes.forEach(semana => {
            let totalHorasSemana = 0;
            
            // Usar la misma lógica mejorada para encontrar todas las clases de la semana
            Object.keys(profesor.semanasPorMateria).forEach(materiaKey => {
                const semanasMateria = profesor.semanasPorMateria[materiaKey];
                
                Object.keys(semanasMateria).forEach(semanaUnica => {
                    if (verificarSuperposicionSemanasDetallada(semana, semanaUnica)) {
                        const datosSemanMateria = semanasMateria[semanaUnica];
                        if (datosSemanMateria) {
                            totalHorasSemana += datosSemanMateria.totalHoras;
                        }
                    }
                });
            });
            
            if (totalHorasSemana > 0) {
                const montoSemana = totalHorasSemana * tarifaProfesor;
                
                // Verificar si esta semana está pagada
                const yaEstaPagada = typeof estaSemanasPagada === 'function' ? 
                    estaSemanasPagada(profesor.id, semana) : false;
                
                if (yaEstaPagada) {
                    totalPagado += montoSemana;
                } else {
                    totalPendiente += montoSemana;
                }
            }
        });
    });
    
    const totalPendienteElement = document.getElementById('totalPendiente');
    const totalPagadoElement = document.getElementById('totalPagado');
    
    if (totalPendienteElement) {
        totalPendienteElement.textContent = formatearMonto(totalPendiente);
    }
    if (totalPagadoElement) {
        totalPagadoElement.textContent = formatearMonto(totalPagado);
    }
}

// Abrir modal para nueva cuenta
function abrirModalCuenta() {
    cuentaEditando = null;
    document.getElementById('tituloModalCuenta').textContent = 'Nueva Cuenta por Pagar';
    document.getElementById('formCuenta').reset();
    
    // Establecer estado por defecto
    document.getElementById('estadoPago').value = 'pendiente';
    
    mostrarModal();
}

// Editar cuenta
async function editarCuenta(id) {
    const cuenta = cuentas.find(c => c.id === id);
    if (!cuenta) return;

    cuentaEditando = cuenta;
    document.getElementById('tituloModalCuenta').textContent = 'Editar Cuenta por Pagar';
    
    // Llenar formulario con datos de la cuenta
    document.getElementById('ocupacionPre').value = cuenta.ocupacionPre;
    document.getElementById('asignaturaCuenta').value = cuenta.asignatura;
    document.getElementById('nombreQuienRecibeCuenta').value = cuenta.nombreQuienRecibe;
    document.getElementById('tipoBancoCuenta').value = cuenta.tipoBanco;
    document.getElementById('tipoIdCuenta').value = cuenta.tipoId;
    document.getElementById('numeroIdCuenta').value = cuenta.numeroId;
    document.getElementById('numeroCuentaCuenta').value = cuenta.numeroCuenta;
    document.getElementById('nombreCuentaCuenta').value = cuenta.nombreCuenta;
    document.getElementById('montoS1').value = cuenta.montoS1 || '';
    document.getElementById('montoS2').value = cuenta.montoS2 || '';
    document.getElementById('estadoPago').value = cuenta.estado;
    document.getElementById('fechaVencimiento').value = cuenta.fechaVencimiento || '';
    document.getElementById('observaciones').value = cuenta.observaciones || '';
    
    mostrarModal();
}

// Eliminar cuenta
async function eliminarCuenta(id) {
    if (confirm('¿Estás seguro de que deseas eliminar esta cuenta por pagar?')) {
        try {
            mostrarCargando();
            await DB.eliminarCuentaPorPagar(id);
            
            // Actualizar lista local
            cuentas = cuentas.filter(c => c.id !== id);
            
            // Actualizar vista
            cargarTablaCuentas();
            actualizarEstadisticas();
            
            ocultarCargando();
            mostrarMensaje('Cuenta eliminada exitosamente', 'exito');
        } catch (error) {
            console.error('Error eliminando cuenta:', error);
            ocultarCargando();
            mostrarMensaje('Error al eliminar la cuenta', 'error');
        }
    }
}

// Editar profesor (nueva función)
async function editarProfesor(profesorId, materia) {
    const profesor = datosProfesores.find(p => p.id === profesorId);
    if (!profesor) return;

    profesorEditando = { profesor, materia };
    document.getElementById('tituloModalCuenta').textContent = `Editar Datos de Pago - ${profesor.nombre} (${materia})`;
    
    // Pre-llenar formulario con datos del profesor
    document.getElementById('ocupacionPre').value = profesor.ocupacionPre || '';
    document.getElementById('asignaturaCuenta').value = materia;
    document.getElementById('nombreQuienRecibeCuenta').value = profesor.nombreQuienRecibe || profesor.nombre;
    document.getElementById('tipoBancoCuenta').value = profesor.tipoBanco || '';
    document.getElementById('tipoIdCuenta').value = profesor.tipoId || '';
    document.getElementById('numeroIdCuenta').value = profesor.numeroId || '';
    document.getElementById('numeroCuentaCuenta').value = profesor.numeroCuenta || '';
    document.getElementById('nombreCuentaCuenta').value = profesor.nombreCuenta || profesor.nombre;
    
    // Los montos se pueden calcular automáticamente o permitir edición manual
    // Por ahora, mostrar los montos calculados
    const semanasPorMateria = profesor.semanasPorMateria[materia] || {};
    let montoTotal = 0;
    
    Object.values(semanasPorMateria).forEach(datosSemanMateria => {
        montoTotal += calcularMontoPorHoras(datosSemanMateria.totalHoras, materia);
    });
    
    // Deshabilitar campos que no deberían editarse
    document.getElementById('asignaturaCuenta').disabled = true;
    
    mostrarModal();
}

// Configurar tarifa de profesor
async function configurarTarifaProfesor(profesorId) {
    const profesor = datosProfesores.find(p => p.id === profesorId);
    if (!profesor) return;

    const tarifaActual = tarifasProfesores[profesorId] || 20000;
    
    const nuevaTarifa = prompt(
        `Configurar tarifa por hora para ${profesor.nombre}\n\nTarifa actual: $${tarifaActual.toLocaleString('es-CO')}\n\nIngresa la nueva tarifa por hora:`,
        tarifaActual
    );
    
    if (nuevaTarifa === null) return; // Usuario canceló
    
    const tarifaNumerica = parseFloat(nuevaTarifa);
    
    if (isNaN(tarifaNumerica) || tarifaNumerica <= 0) {
        mostrarMensaje('Por favor ingresa una tarifa válida mayor a 0', 'error');
        return;
    }
    
    try {
        mostrarCargando();
        
        // Actualizar tarifa en la base de datos
        await DB.actualizarTarifaProfesor(profesorId, tarifaNumerica);
        
        // Actualizar tarifa en cache local
        tarifasProfesores[profesorId] = tarifaNumerica;
        
        mostrarMensaje(`Tarifa de ${profesor.nombre} actualizada a $${tarifaNumerica.toLocaleString('es-CO')} por hora`, 'exito');
        
        // Actualizar vista para reflejar los nuevos montos
        cargarTablaCuentas();
        actualizarEstadisticas();
        
        ocultarCargando();
    } catch (error) {
        console.error('Error actualizando tarifa del profesor:', error);
        ocultarCargando();
        mostrarMensaje('Error al actualizar la tarifa del profesor', 'error');
    }
}

// Marcar como pagado por semana específica
async function marcarComoPagadoSemana(profesorId, semana) {
    const profesor = datosProfesores.find(p => p.id === profesorId);
    if (!profesor) return;
    
    if (confirm(`¿Estás seguro de que deseas marcar como pagada la semana ${semana} de ${profesor.nombre}?`)) {
        try {
            mostrarCargando();
            
            // Aquí puedes implementar la lógica para marcar como pagado por semana
            // Por ejemplo, crear un registro en la base de datos con profesorId + semana
            
            mostrarMensaje(`Semana ${semana} de ${profesor.nombre} marcada como pagada`, 'exito');
            
            // Actualizar vista
            cargarTablaCuentas();
            actualizarEstadisticas();
            
            ocultarCargando();
        } catch (error) {
            console.error('Error actualizando estado de pago:', error);
            ocultarCargando();
            mostrarMensaje('Error al actualizar el estado de pago', 'error');
        }
    }
}

// Guardar cuenta
async function guardarCuenta() {
    const datosCuenta = {
        ocupacionPre: document.getElementById('ocupacionPre').value,
        asignatura: document.getElementById('asignaturaCuenta').value,
        nombreQuienRecibe: document.getElementById('nombreQuienRecibeCuenta').value,
        tipoBanco: document.getElementById('tipoBancoCuenta').value,
        tipoId: document.getElementById('tipoIdCuenta').value,
        numeroId: document.getElementById('numeroIdCuenta').value,
        numeroCuenta: document.getElementById('numeroCuentaCuenta').value,
        nombreCuenta: document.getElementById('nombreCuentaCuenta').value,
        montoS1: parseFloat(document.getElementById('montoS1').value) || 0,
        montoS2: parseFloat(document.getElementById('montoS2').value) || 0,
        estado: document.getElementById('estadoPago').value,
        fechaVencimiento: document.getElementById('fechaVencimiento').value,
        observaciones: document.getElementById('observaciones').value,
        usuarioCreador: usuarioActual.id
    };

    // Validar datos
    if (!validarDatosCuenta(datosCuenta)) {
        return;
    }

    try {
        mostrarCargando();

        if (cuentaEditando) {
            // Editar cuenta existente
            await DB.actualizarCuentaPorPagar(cuentaEditando.id, datosCuenta);
            
            // Actualizar en lista local
            const index = cuentas.findIndex(c => c.id === cuentaEditando.id);
            cuentas[index] = { ...cuentaEditando, ...datosCuenta };
            
            mostrarMensaje('Cuenta actualizada exitosamente', 'exito');
        } else {
            // Crear nueva cuenta
            const nuevaCuenta = await DB.crearCuentaPorPagar(datosCuenta);
            cuentas.push(nuevaCuenta);
            mostrarMensaje('Cuenta creada exitosamente', 'exito');
        }

        ocultarCargando();
        cerrarModalCuenta();
        
        // Actualizar vista
        cargarTablaCuentas();
        actualizarEstadisticas();
    } catch (error) {
        console.error('Error guardando cuenta:', error);
        ocultarCargando();
        mostrarMensaje('Error al guardar la cuenta', 'error');
    }
}

// Validar datos de la cuenta
function validarDatosCuenta(datos) {
    if (!datos.ocupacionPre || !datos.asignatura || !datos.nombreQuienRecibe || 
        !datos.tipoBanco || !datos.tipoId || !datos.numeroId || 
        !datos.numeroCuenta || !datos.nombreCuenta) {
        mostrarMensaje('Por favor, completa todos los campos obligatorios', 'error');
        return false;
    }

    if (datos.montoS1 < 0 || datos.montoS2 < 0) {
        mostrarMensaje('Los montos no pueden ser negativos', 'error');
        return false;
    }

    return true;
}

// Función mejorada para verificar superposición de semanas con más detalle
function verificarSuperposicionSemanasDetallada(semanaGenerada, semanaUnica) {
    try {
        console.log(`Verificando superposición: ${semanaGenerada} vs ${semanaUnica}`);
        
        // Extraer datos de la semana generada (ej: "1/7 SEPTIEMBRE")
        const datosSemanaGenerada = extraerDatosSemana(semanaGenerada);
        if (!datosSemanaGenerada) {
            console.log('No se pudieron extraer datos de la semana generada');
            return false;
        }
        
        // Extraer datos de la semana única (ej: "S37-9/2025")
        const match = semanaUnica.match(/S(\d+)-(\d+)\/(\d+)/);
        if (!match) {
            console.log('No se pudo parsear la semana única');
            return false;
        }
        
        const [, numeroSemana, mesUnica, añoUnica] = match.map(Number);
        const [mes, año] = filtros.mes.split('-').map(Number);
        
        // Solo considerar semanas del año correcto
        if (añoUnica !== año) {
            console.log(`Año diferente: ${añoUnica} vs ${año}`);
            return false;
        }
        
        // Calcular las fechas reales de la semana única basándose en el número de semana
        const fechaInicioAño = new Date(añoUnica, 0, 1);
        const diasHastaInicio = (numeroSemana - 1) * 7;
        const fechaInicioSemana = new Date(fechaInicioAño);
        fechaInicioSemana.setDate(fechaInicioAño.getDate() + diasHastaInicio);
        
        // Ajustar al lunes de esa semana
        const diaSemana = fechaInicioSemana.getDay();
        const diasParaLunes = diaSemana === 0 ? -6 : 1 - diaSemana;
        fechaInicioSemana.setDate(fechaInicioSemana.getDate() + diasParaLunes);
        
        const fechaFinSemana = new Date(fechaInicioSemana);
        fechaFinSemana.setDate(fechaInicioSemana.getDate() + 6);
        
        // Convertir los datos de la semana generada a fechas
        const fechaInicioGenerada = new Date(año, datosSemanaGenerada.mesInicio - 1, datosSemanaGenerada.diaInicio);
        const fechaFinGenerada = new Date(año, datosSemanaGenerada.mesFin - 1, datosSemanaGenerada.diaFin);
        
        console.log(`Semana única: ${fechaInicioSemana.toDateString()} - ${fechaFinSemana.toDateString()}`);
        console.log(`Semana generada: ${fechaInicioGenerada.toDateString()} - ${fechaFinGenerada.toDateString()}`);
        
        // Verificar superposición de fechas (requiere al menos 1 día de superposición)
        const inicioSuperposicion = Math.max(fechaInicioSemana.getTime(), fechaInicioGenerada.getTime());
        const finSuperposicion = Math.min(fechaFinSemana.getTime(), fechaFinGenerada.getTime());
        
        const diasSuperposicion = (finSuperposicion - inicioSuperposicion) / (24 * 60 * 60 * 1000) + 1;
        const haySuperposicion = diasSuperposicion >= 1; // Al menos 1 día de superposición
        
        console.log(`Días de superposición: ${diasSuperposicion}, Hay superposición: ${haySuperposicion}`);
        
        return haySuperposicion;
    } catch (error) {
        console.error('Error verificando superposición detallada:', error);
        return false;
    }
}

// Exportar datos a Excel
function exportarDatos() {
    const profesoresFiltrados = filtrarProfesores();
    
    if (profesoresFiltrados.length === 0) {
        mostrarMensaje('No hay datos para exportar', 'info');
        return;
    }
    
    try {
        // Crear datos para Excel
        const datosExcel = [];
        
        // Encabezados dinámicos
        const encabezados = [
            'Ocupación en el PRE',
            'Asignatura(s)',
            'Nombre de Quién Recibe',
            'Tipo de Banco',
            'Tipo de ID',
            'Número de ID',
            'Número de Cuenta',
            'Nombre de Cuenta'
        ];
        
        // Agregar encabezados de semanas del mes
        semanasDelMes.forEach(semana => {
            encabezados.push(`Semana: ${semana}`);
        });
        
        encabezados.push('Estado de Pago', 'Total a Pagar');
        datosExcel.push(encabezados);
        
        // Procesar cada profesor
        profesoresFiltrados.forEach(profesor => {
            // Determinar estado general del profesor
            let totalMontoProfesor = 0;
            let totalPagadoProfesor = 0;
            
            const fila = [
                profesor.ocupacionPre || 'N/A',
                profesor.materias.join(', '),
                profesor.nombreQuienRecibe || profesor.nombre,
                profesor.tipoBanco || 'N/A',
                profesor.tipoId || 'N/A',
                profesor.numeroId || 'N/A',
                profesor.numeroCuenta || 'N/A',
                profesor.nombreCuenta || profesor.nombre
            ];
            
            // Obtener tarifa del profesor
            const tarifaProfesor = tarifasProfesores[profesor.id] || 20000;
            
            // Procesar cada semana del mes
            semanasDelMes.forEach(semana => {
                let totalHorasSemana = 0;
                let montoTotalSemana = 0;
                
                // Usar la misma lógica mejorada para encontrar todas las clases de la semana
                Object.keys(profesor.semanasPorMateria).forEach(materiaKey => {
                    const semanasMateria = profesor.semanasPorMateria[materiaKey];
                    
                    Object.keys(semanasMateria).forEach(semanaUnica => {
                        if (verificarSuperposicionSemanasDetallada(semana, semanaUnica)) {
                            const datosSemanMateria = semanasMateria[semanaUnica];
                            if (datosSemanMateria) {
                                totalHorasSemana += datosSemanMateria.totalHoras;
                            }
                        }
                    });
                });
                
                // Calcular monto usando la tarifa individual del profesor
                montoTotalSemana = totalHorasSemana * tarifaProfesor;
                totalMontoProfesor += montoTotalSemana;
                
                // Verificar si la semana ya está pagada
                const yaEstaPagada = typeof estaSemanasPagada === 'function' ? 
                    estaSemanasPagada(profesor.id, semana) : false;
                
                if (yaEstaPagada) {
                    totalPagadoProfesor += montoTotalSemana;
                    fila.push(`$${montoTotalSemana.toLocaleString('es-CO')} (PAGADO)`);
                } else if (montoTotalSemana > 0) {
                    fila.push(`$${montoTotalSemana.toLocaleString('es-CO')} (PENDIENTE)`);
                } else {
                    fila.push('$0');
                }
            });
            
            // Determinar estado general
            let estado = 'PENDIENTE';
            if (totalPagadoProfesor >= totalMontoProfesor && totalMontoProfesor > 0) {
                estado = 'PAGADO';
            } else if (totalPagadoProfesor > 0) {
                estado = 'PARCIAL';
            }
            
            fila.push(estado);
            fila.push(`$${totalMontoProfesor.toLocaleString('es-CO')}`);
            
            datosExcel.push(fila);
        });
        
        // Crear hoja de cálculo
        const worksheet = XLSX.utils.aoa_to_sheet(datosExcel);
        
        // Configurar anchos de columna
        const columnWidths = [
            { wch: 25 }, // Ocupación
            { wch: 20 }, // Asignaturas
            { wch: 25 }, // Nombre quien recibe
            { wch: 15 }, // Tipo banco
            { wch: 15 }, // Tipo ID
            { wch: 15 }, // Número ID
            { wch: 20 }, // Número cuenta
            { wch: 25 }  // Nombre cuenta
        ];
        
        // Agregar anchos para semanas
        semanasDelMes.forEach(() => {
            columnWidths.push({ wch: 18 });
        });
        
        columnWidths.push({ wch: 15 }); // Estado
        columnWidths.push({ wch: 15 }); // Total
        
        worksheet['!cols'] = columnWidths;
        
        // Crear libro de trabajo
        const workbook = XLSX.utils.book_new();
        
        // Obtener fecha actual para el nombre de la hoja
        const [mes, año] = filtros.mes.split('-').map(Number);
        const nombreHoja = `${obtenerNombreMes(mes)} ${año}`;
        
        XLSX.utils.book_append_sheet(workbook, worksheet, nombreHoja);
        
        // Crear hoja de resumen
        const datosResumen = [
            ['RESUMEN DE CUENTAS POR PAGAR'],
            [''],
            ['Mes:', nombreHoja],
            ['Fecha de exportación:', new Date().toLocaleDateString('es-ES')],
            ['Total de profesores:', profesoresFiltrados.length],
            [''],
            ['ESTADÍSTICAS:'],
            ['Total pendiente de pago:', document.getElementById('totalPendiente')?.textContent || '$0'],
            ['Total ya pagado:', document.getElementById('totalPagado')?.textContent || '$0'],
            [''],
            ['FILTROS APLICADOS:'],
            ['Ocupación:', filtros.ocupacion || 'Todas'],
            ['Estado:', filtros.estado || 'Todos'],
            ['Mes:', nombreHoja]
        ];
        
        const worksheetResumen = XLSX.utils.aoa_to_sheet(datosResumen);
        
        // Configurar anchos para la hoja de resumen
        worksheetResumen['!cols'] = [
            { wch: 25 },
            { wch: 20 }
        ];
        
        XLSX.utils.book_append_sheet(workbook, worksheetResumen, 'Resumen');
        
        // Generar y descargar archivo
        const fechaActual = new Date().toISOString().split('T')[0];
        const nombreArchivo = `Cuentas_por_Pagar_${nombreHoja.replace(' ', '_')}_${fechaActual}.xlsx`;
        
        XLSX.writeFile(workbook, nombreArchivo);
        
        mostrarMensaje(`Archivo Excel exportado exitosamente: ${nombreArchivo}`, 'exito');
        
    } catch (error) {
        console.error('Error exportando a Excel:', error);
        mostrarMensaje('Error al exportar los datos a Excel', 'error');
    }
}

// Mostrar modal
function mostrarModal() {
    document.getElementById('modalCuenta').classList.add('active');
    document.getElementById('modalOverlay').classList.add('active');
    document.body.style.overflow = 'hidden';
}

// Cerrar modal
function cerrarModalCuenta() {
    document.getElementById('modalCuenta').classList.remove('active');
    document.getElementById('modalOverlay').classList.remove('active');
    document.body.style.overflow = '';
    
    cuentaEditando = null;
}

// Abrir modal de gestión de tarifas
function abrirGestionTarifas() {
    cargarListaTarifas();
    document.getElementById('modalTarifas').classList.add('active');
    document.getElementById('modalOverlay').classList.add('active');
    document.body.style.overflow = 'hidden';
}

// Cerrar modal de tarifas
function cerrarModalTarifas() {
    document.getElementById('modalTarifas').classList.remove('active');
    document.getElementById('modalOverlay').classList.remove('active');
    document.body.style.overflow = '';
}

// Cargar lista de tarifas en el modal
function cargarListaTarifas() {
    const listaTarifas = document.getElementById('listaTarifas');
    listaTarifas.innerHTML = '';
    
    if (datosProfesores.length === 0) {
        listaTarifas.innerHTML = `
            <div class="sin-datos">
                <p>No hay profesores para configurar tarifas.</p>
            </div>
        `;
        return;
    }
    
    datosProfesores.forEach(profesor => {
        const tarifaActual = tarifasProfesores[profesor.id] || 20000;
        const totalHoras = calcularTotalHorasProfesor(profesor);
        const montoTotal = totalHoras * tarifaActual;
        
        const itemTarifa = document.createElement('div');
        itemTarifa.className = 'tarifa-item';
        itemTarifa.innerHTML = `
            <div class="tarifa-info">
                <div class="profesor-info">
                    <h4>${profesor.nombre}</h4>
                    <div class="materias-profesor">
                        ${profesor.materias.map(materia => 
                            `<span class="asignatura-badge asignatura-${materia.toLowerCase()}">${materia}</span>`
                        ).join(' ')}
                    </div>
                    <small class="horas-total">${totalHoras} horas trabajadas - Monto total: ${formatearMonto(montoTotal)}</small>
                </div>
                <div class="tarifa-control">
                    <label for="tarifa-${profesor.id}">Tarifa por hora:</label>
                    <div class="input-group">
                        <span class="input-prefix">$</span>
                        <input type="number" 
                               id="tarifa-${profesor.id}" 
                               class="tarifa-input" 
                               value="${tarifaActual}" 
                               min="1000" 
                               step="1000"
                               onchange="actualizarMontoEnTiempoReal('${profesor.id}')">
                    </div>
                    <div class="monto-calculado" id="monto-${profesor.id}">
                        Monto: ${formatearMonto(montoTotal)}
                    </div>
                </div>
            </div>
        `;
        
        listaTarifas.appendChild(itemTarifa);
    });
}

// Calcular total de horas de un profesor
function calcularTotalHorasProfesor(profesor) {
    let totalHoras = 0;
    
    profesor.materias.forEach(materia => {
        const semanasPorMateria = profesor.semanasPorMateria[materia];
        if (!semanasPorMateria) return;
        
        Object.values(semanasPorMateria).forEach(datosSemanMateria => {
            totalHoras += datosSemanMateria.totalHoras;
        });
    });
    
    return totalHoras;
}

// Actualizar monto en tiempo real mientras se edita la tarifa
function actualizarMontoEnTiempoReal(profesorId) {
    const inputTarifa = document.getElementById(`tarifa-${profesorId}`);
    const montoElement = document.getElementById(`monto-${profesorId}`);
    
    const nuevaTarifa = parseFloat(inputTarifa.value) || 0;
    const profesor = datosProfesores.find(p => p.id === profesorId);
    
    if (profesor) {
        const totalHoras = calcularTotalHorasProfesor(profesor);
        const nuevoMonto = totalHoras * nuevaTarifa;
        montoElement.textContent = `Monto: ${formatearMonto(nuevoMonto)}`;
    }
}

// Guardar todas las tarifas
async function guardarTodasLasTarifas() {
    try {
        mostrarCargando();
        
        const promesasActualizacion = [];
        
        datosProfesores.forEach(profesor => {
            const inputTarifa = document.getElementById(`tarifa-${profesor.id}`);
            const nuevaTarifa = parseFloat(inputTarifa.value);
            
            if (!isNaN(nuevaTarifa) && nuevaTarifa > 0) {
                // Actualizar en cache local
                tarifasProfesores[profesor.id] = nuevaTarifa;
                
                // Agregar promesa de actualización en BD
                promesasActualizacion.push(
                    DB.actualizarTarifaProfesor(profesor.id, nuevaTarifa)
                );
            }
        });
        
        // Ejecutar todas las actualizaciones
        await Promise.all(promesasActualizacion);
        
        mostrarMensaje('Todas las tarifas han sido actualizadas exitosamente', 'exito');
        
        // Actualizar vista
        cargarTablaCuentas();
        actualizarEstadisticas();
        cerrarModalTarifas();
        
        ocultarCargando();
    } catch (error) {
        console.error('Error guardando tarifas:', error);
        ocultarCargando();
        mostrarMensaje('Error al guardar las tarifas', 'error');
    }
}

// Funciones de utilidad
function formatearMonto(monto) {
    if (monto === 0 || monto === null || monto === undefined) {
        return '$0';
    }
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(monto);
}

function obtenerClaseMonto(monto) {
    if (monto === 0 || monto === null || monto === undefined) {
        return 'cero';
    }
    return monto > 0 ? '' : 'negativo';
}

function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
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

// Función para copiar texto al portapapeles
async function copiarTexto(texto, boton) {
    try {
        // Intentar usar la API moderna del portapapeles
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(texto);
        } else {
            // Fallback para navegadores más antiguos
            const textArea = document.createElement('textarea');
            textArea.value = texto;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            document.execCommand('copy');
            textArea.remove();
        }
        
        // Feedback visual
        const iconoOriginal = boton.innerHTML;
        boton.classList.add('copiado');
        boton.innerHTML = '<i class="fas fa-check"></i>';
        
        // Restaurar después de 1.5 segundos
        setTimeout(() => {
            boton.classList.remove('copiado');
            boton.innerHTML = iconoOriginal;
        }, 1500);
        
        // Mostrar mensaje de éxito breve
        mostrarMensajeBreve('Texto copiado al portapapeles');
        
    } catch (error) {
        console.error('Error al copiar texto:', error);
        mostrarMensaje('Error al copiar el texto', 'error');
    }
}

// Función para mostrar mensajes breves (no persistentes)
function mostrarMensajeBreve(mensaje) {
    // Crear elemento de mensaje breve
    const mensajeElement = document.createElement('div');
    mensajeElement.className = 'mensaje-breve';
    mensajeElement.textContent = mensaje;
    mensajeElement.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #16a34a;
        color: white;
        padding: 10px 20px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 9999;
        animation: slideInRight 0.3s ease, slideOutRight 0.3s ease 1.2s;
        pointer-events: none;
    `;
    
    // Agregar estilos de animación si no existen
    if (!document.querySelector('#animaciones-mensaje-breve')) {
        const style = document.createElement('style');
        style.id = 'animaciones-mensaje-breve';
        style.textContent = `
            @keyframes slideInRight {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            @keyframes slideOutRight {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(100%);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(mensajeElement);
    
    // Remover después de la animación
    setTimeout(() => {
        if (mensajeElement.parentNode) {
            mensajeElement.remove();
        }
    }, 1500);
}

// Abrir gestión de ingresos
function abrirGestionIngresos() {
    window.location.href = 'GestionIngresos.html';
}

// Exportar funciones para uso global
window.abrirModalCuenta = abrirModalCuenta;
window.cerrarModalCuenta = cerrarModalCuenta;
window.abrirGestionTarifas = abrirGestionTarifas;
window.cerrarModalTarifas = cerrarModalTarifas;
window.abrirGestionIngresos = abrirGestionIngresos;
window.actualizarMontoEnTiempoReal = actualizarMontoEnTiempoReal;
window.guardarTodasLasTarifas = guardarTodasLasTarifas;
window.editarCuenta = editarCuenta;
window.editarProfesor = editarProfesor;
window.configurarTarifaProfesor = configurarTarifaProfesor;
window.eliminarCuenta = eliminarCuenta;
window.marcarComoPagadoSemana = marcarComoPagadoSemana;
window.aplicarFiltros = aplicarFiltros;
window.aplicarFiltroMes = aplicarFiltroMes;
window.limpiarFiltros = limpiarFiltros;
window.exportarDatos = exportarDatos;
window.cerrarSesion = cerrarSesion;
window.copiarTexto = copiarTexto;
