// Variables globales
let movimientos = [];
let bancoDinero = {};
let usuarioActual = null;
let filtrosFecha = {
    fechaInicio: '',
    fechaFin: '',
    banco: ''
};
let tabActiva = 'todos';

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
    
    // Verificar acceso a gestión de ingresos
    verificarAccesoIngresos();
}

// Verificar acceso a gestión de ingresos basado en roles
function verificarAccesoIngresos() {
    // Verificar si el usuario tiene rol de ADMINISTRADOR o SUPER USUARIO
    const tieneAccesoIngresos = usuarioActual.roles && (
        usuarioActual.roles.includes('ADMINISTRADOR') || 
        usuarioActual.roles.includes('SUPER USUARIO')
    );
    
    if (!tieneAccesoIngresos) {
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
        
        // Inicializar fechas por defecto
        inicializarFechas();
        
        // Cargar bancos disponibles
        await cargarBancosDisponibles();
        await cargarBancosDisponiblesGastos();
        
        // Cargar datos de banco de dinero
        let bancoDineroRaw = await DB.obtenerBancoDinero();
        console.log('Banco de dinero raw cargado:', bancoDineroRaw);
        
        // Convertir estructura de BD a estructura local
        bancoDinero = {};
        if (bancoDineroRaw && typeof bancoDineroRaw === 'object') {
            // Filtrar propiedades que no son bancos
            const bancosExcluidos = ['fechaCreacion', 'fechaModificacion', 'id'];
            
            Object.keys(bancoDineroRaw).forEach(banco => {
                if (!bancosExcluidos.includes(banco)) {
                    // Manejar tanto estructura simple (number) como compleja (object)
                    if (typeof bancoDineroRaw[banco] === 'object' && bancoDineroRaw[banco].saldo !== undefined) {
                        bancoDinero[banco] = bancoDineroRaw[banco].saldo;
                    } else if (typeof bancoDineroRaw[banco] === 'number') {
                        bancoDinero[banco] = bancoDineroRaw[banco];
                    } else {
                        bancoDinero[banco] = 0;
                    }
                }
            });
        }
        
        // Si no hay datos de banco, inicializar con estructura básica
        if (Object.keys(bancoDinero).length === 0) {
            console.log('No hay datos de banco, inicializando...');
            bancoDinero = {
                'NEQUI': 0,
                'DAVIPLATA': 0,
                'BANCOLOMBIA': 0,
                'EFECTIVO': 0
            };
        }
        
        console.log('Banco de dinero procesado:', bancoDinero);
        
        // Cargar movimientos (ingresos y gastos de pagos)
        await cargarMovimientos();
        
    // Actualizar estadísticas y vistas
    actualizarEstadisticasGenerales();
    actualizarResumenBancos();
    cargarTablaMovimientos();
    
        
        ocultarCargando();
    } catch (error) {
        console.error('Error cargando datos:', error);
        mostrarMensaje('Error al cargar los datos de ingresos', 'error');
        ocultarCargando();
    }
}

// Inicializar fechas por defecto (sin filtros - mostrar todo)
function inicializarFechas() {
    const hoy = new Date();
    
    console.log('=== INICIALIZANDO FECHAS (SIN FILTROS) ===');
    console.log('Configurando para mostrar TODOS los movimientos por defecto');
    
    // Actualizar inputs (dejarlos vacíos por defecto)
    const inputFechaInicio = document.getElementById('fechaInicio');
    const inputFechaFin = document.getElementById('fechaFin');
    const inputFechaIngreso = document.getElementById('fechaIngreso');
    
    if (inputFechaInicio) {
        inputFechaInicio.value = '';
    }
    if (inputFechaFin) {
        inputFechaFin.value = '';
    }
    if (inputFechaIngreso) {
        inputFechaIngreso.value = hoy.toISOString().slice(0, 16);
    }
    
    // Filtros globales vacíos = mostrar todo
    filtrosFecha.fechaInicio = '';
    filtrosFecha.fechaFin = '';
    filtrosFecha.banco = '';
    
    console.log('Filtros configurados para mostrar todo:', filtrosFecha);
    console.log('=== FIN INICIALIZACIÓN FECHAS ===');
}

// Cargar bancos disponibles desde la base de datos
async function cargarBancosDisponibles() {
    try {
        // Obtener bancos configurados desde la BD
        let bancosConfigurados = await DB.obtenerBancoDinero();
        console.log('Bancos configurados desde BD:', bancosConfigurados);
        
        let bancosDisponibles = [];
        
        if (bancosConfigurados && typeof bancosConfigurados === 'object') {
            // Filtrar propiedades que no son bancos
            const bancosExcluidos = ['fechaCreacion', 'fechaModificacion', 'id'];
            
            Object.keys(bancosConfigurados).forEach(banco => {
                if (!bancosExcluidos.includes(banco)) {
                    bancosDisponibles.push(banco);
                }
            });
        }
        
        // Si no hay bancos configurados, usar lista por defecto
        if (bancosDisponibles.length === 0) {
            bancosDisponibles = [
                'NEQUI',
                'DAVIPLATA', 
                'BANCOLOMBIA',
                'EFECTIVO'
            ];
        }
        
        console.log('Bancos disponibles para seleccionar:', bancosDisponibles);
        
        // Poblar select de banco destino en modal de ingreso
        const selectBancoDestino = document.getElementById('bancoDestino');
        if (selectBancoDestino) {
            selectBancoDestino.innerHTML = '<option value="">Seleccionar banco</option>';
            bancosDisponibles.forEach(banco => {
                const option = document.createElement('option');
                option.value = banco;
                option.textContent = banco;
                selectBancoDestino.appendChild(option);
            });
        }
        
    } catch (error) {
        console.error('Error cargando bancos disponibles:', error);
        // Fallback en caso de error
        const selectBancoDestino = document.getElementById('bancoDestino');
        if (selectBancoDestino) {
            selectBancoDestino.innerHTML = '<option value="">Error cargando bancos</option>';
        }
    }
}

// Cargar bancos disponibles para gastos desde la base de datos
async function cargarBancosDisponiblesGastos() {
    try {
        // Obtener bancos configurados desde la BD
        let bancosConfigurados = await DB.obtenerBancoDinero();
        console.log('Bancos configurados para gastos desde BD:', bancosConfigurados);
        
        let bancosDisponibles = [];
        
        if (bancosConfigurados && typeof bancosConfigurados === 'object') {
            // Filtrar propiedades que no son bancos
            const bancosExcluidos = ['fechaCreacion', 'fechaModificacion', 'id'];
            
            Object.keys(bancosConfigurados).forEach(banco => {
                if (!bancosExcluidos.includes(banco)) {
                    bancosDisponibles.push(banco);
                }
            });
        }
        
        // Si no hay bancos configurados, usar lista por defecto
        if (bancosDisponibles.length === 0) {
            bancosDisponibles = [
                'NEQUI',
                'DAVIPLATA', 
                'BANCOLOMBIA',
                'EFECTIVO'
            ];
        }
        
        console.log('Bancos disponibles para gastos:', bancosDisponibles);
        
        // Poblar select de banco origen en modal de gasto
        const selectBancoOrigen = document.getElementById('bancoOrigen');
        if (selectBancoOrigen) {
            selectBancoOrigen.innerHTML = '<option value="">Seleccionar banco</option>';
            bancosDisponibles.forEach(banco => {
                const option = document.createElement('option');
                option.value = banco;
                option.textContent = banco;
                selectBancoOrigen.appendChild(option);
            });
        }
        
    } catch (error) {
        console.error('Error cargando bancos disponibles para gastos:', error);
        // Fallback en caso de error
        const selectBancoOrigen = document.getElementById('bancoOrigen');
        if (selectBancoOrigen) {
            selectBancoOrigen.innerHTML = '<option value="">Error cargando bancos</option>';
        }
    }
}

// Cargar movimientos desde la base de datos
async function cargarMovimientos() {
    try {
        movimientos = [];
        
        // Cargar ingresos registrados
        const ingresos = await DB.obtenerIngresos();
        console.log('Ingresos obtenidos:', ingresos);
        
        // Agregar ingresos a movimientos
        console.log('=== PROCESANDO INGRESOS ===');
        ingresos.forEach((ingreso, index) => {
            console.log(`Ingreso ${index + 1}:`, {
                id: ingreso.id,
                fecha: ingreso.fecha,
                fechaTipo: typeof ingreso.fecha,
                banco: ingreso.banco,
                monto: ingreso.monto,
                descripcion: ingreso.descripcion
            });
            
            movimientos.push({
                id: ingreso.id,
                fecha: ingreso.fecha,
                tipo: 'ingreso',
                banco: ingreso.banco,
                descripcion: ingreso.descripcion,
                monto: ingreso.monto,
                estado: 'completado',
                categoria: ingreso.categoria || 'general',
                tipoIngreso: ingreso.tipoIngreso || 'manual',
                comprobante: ingreso.comprobante || null
            });
        });
        console.log('=== FIN PROCESAMIENTO INGRESOS ===');
        
        // Cargar gastos (pagos realizados a profesores)
        const pagos = await DB.obtenerHistorialPagos();
        console.log('Pagos obtenidos:', pagos);
        
        // Debug de comprobantes
        pagos.forEach((pago, index) => {
            console.log(`Pago ${index}:`, {
                id: pago.id,
                profesorNombre: pago.profesorNombre,
                comprobante: pago.comprobante,
                archivoComprobante: pago.archivoComprobante,
                tieneComprobante: !!(pago.comprobante || pago.archivoComprobante)
            });
        });
        
        // Agregar pagos como gastos a movimientos
        pagos.forEach(pago => {
            const fechaPago = pago.fechaPago || pago.fecha || new Date().toISOString();
            
            // Manejar comprobante correctamente
            let comprobanteUrl = null;
            if (pago.comprobante) {
                if (typeof pago.comprobante === 'object' && pago.comprobante.url) {
                    comprobanteUrl = pago.comprobante.url;
                } else if (typeof pago.comprobante === 'string' && pago.comprobante !== 'null') {
                    comprobanteUrl = pago.comprobante;
                }
            } else if (pago.archivoComprobante && pago.archivoComprobante !== 'null') {
                comprobanteUrl = pago.archivoComprobante;
            }
            
            movimientos.push({
                id: 'pago_' + pago.id,
                fecha: fechaPago,
                tipo: 'gasto',
                banco: pago.bancoOrigen,
                descripcion: `Pago a ${pago.profesorNombre} - ${pago.semana}`,
                monto: pago.monto,
                estado: 'completado',
                categoria: 'pago_profesor',
                profesorId: pago.profesorId,
                profesorNombre: pago.profesorNombre,
                semana: pago.semana,
                comprobante: comprobanteUrl,
                metodoPago: pago.metodoPago || 'transferencia'
            });
        });
        
        // Cargar gastos manuales registrados
        const gastos = await DB.obtenerGastos();
        console.log('Gastos manuales obtenidos:', gastos);
        
        // Agregar gastos manuales a movimientos
        gastos.forEach(gasto => {
            movimientos.push({
                id: 'gasto_' + gasto.id,
                fecha: gasto.fecha,
                tipo: 'gasto',
                banco: gasto.banco,
                descripcion: gasto.descripcion,
                monto: gasto.monto,
                estado: 'completado',
                categoria: gasto.categoria || 'general',
                tipoGasto: gasto.tipoGasto || 'manual',
                comprobante: gasto.comprobante || null
            });
        });
        
        // Ordenar movimientos por fecha (más recientes primero)
        movimientos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        
        console.log('Movimientos cargados:', movimientos);
    } catch (error) {
        console.error('Error cargando movimientos:', error);
        movimientos = [];
    }
}

// Configurar event listeners
function configurarEventListeners() {
    // Formulario de ingreso
    document.getElementById('formIngreso').addEventListener('submit', function(e) {
        e.preventDefault();
        guardarIngreso();
    });

    // Formulario de gasto
    document.getElementById('formGasto').addEventListener('submit', function(e) {
        e.preventDefault();
        guardarGasto();
    });

    // Cerrar modales al hacer clic en el overlay
    document.getElementById('modalOverlay').addEventListener('click', function() {
        cerrarModalIngreso();
        cerrarModalGasto();
        cerrarModalBancoDinero();
        cerrarModalDetalleMovimiento();
        cerrarModalExportar();
    });

    // Cerrar modales con tecla Escape
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            cerrarModalIngreso();
            cerrarModalGasto();
            cerrarModalBancoDinero();
            cerrarModalDetalleMovimiento();
            cerrarModalExportar();
        }
    });
}

// Aplicar filtros de fecha
function aplicarFiltrosFecha() {
    filtrosFecha.fechaInicio = document.getElementById('fechaInicio').value;
    filtrosFecha.fechaFin = document.getElementById('fechaFin').value;
    
    actualizarEstadisticasGenerales();
    actualizarResumenBancos();
    cargarTablaMovimientos();
}

// Limpiar filtros de fecha (mostrar todos los movimientos)
function limpiarFiltrosFecha() {
    console.log('=== LIMPIANDO FILTROS ===');
    
    // Limpiar filtros para mostrar todo
    filtrosFecha.fechaInicio = '';
    filtrosFecha.fechaFin = '';
    filtrosFecha.banco = '';
    
    // Limpiar inputs de fecha
    const inputFechaInicio = document.getElementById('fechaInicio');
    const inputFechaFin = document.getElementById('fechaFin');
    
    if (inputFechaInicio) {
        inputFechaInicio.value = '';
    }
    if (inputFechaFin) {
        inputFechaFin.value = '';
    }
    
    console.log('Filtros limpiados - mostrando todos los movimientos');
    
    // Actualizar vista
    actualizarEstadisticasGenerales();
    actualizarResumenBancos();
    cargarTablaMovimientos();
    
    console.log('=== FIN LIMPIAR FILTROS ===');
}

// Mostrar todos los movimientos sin filtro de fecha
function mostrarTodosLosMovimientos() {
    console.log('=== MOSTRANDO TODOS LOS MOVIMIENTOS ===');
    
    // Limpiar filtros de fecha
    filtrosFecha.fechaInicio = '';
    filtrosFecha.fechaFin = '';
    filtrosFecha.banco = '';
    
    // Limpiar inputs de fecha
    const inputFechaInicio = document.getElementById('fechaInicio');
    const inputFechaFin = document.getElementById('fechaFin');
    
    if (inputFechaInicio) {
        inputFechaInicio.value = '';
    }
    if (inputFechaFin) {
        inputFechaFin.value = '';
    }
    
    console.log('Filtros limpiados, mostrando todos los movimientos');
    
    // Actualizar vista
    actualizarEstadisticasGenerales();
    actualizarResumenBancos();
    cargarTablaMovimientos();
    
    console.log('=== FIN MOSTRAR TODOS ===');
}

// Filtrar movimientos según criterios actuales
function filtrarMovimientos() {
    let movimientosFiltrados = [...movimientos];
    
    // Mostrar información de filtrado solo si hay filtros activos
    if (filtrosFecha.fechaInicio || filtrosFecha.fechaFin || tabActiva !== 'todos') {
        console.log('=== FILTRADO DE MOVIMIENTOS ===');
        console.log('Total movimientos:', movimientos.length);
        console.log('Filtros fecha:', filtrosFecha);
    }
    
    // Filtrar por fechas de manera más inclusiva
    if (filtrosFecha.fechaInicio && filtrosFecha.fechaInicio.trim() !== '') {
        const fechaInicio = new Date(filtrosFecha.fechaInicio);
        fechaInicio.setHours(0, 0, 0, 0); // Inicio del día
        console.log('Fecha inicio ajustada:', fechaInicio);
        
        movimientosFiltrados = movimientosFiltrados.filter(mov => {
            const fechaMovimiento = new Date(mov.fecha);
            const pasa = fechaMovimiento >= fechaInicio;
            if (!pasa) {
                console.log(`Movimiento filtrado por fecha inicio: ${mov.fecha} < ${fechaInicio}`);
            }
            return pasa;
        });
    } else {
        console.log('Sin filtro de fecha inicio - mostrando todos');
    }
    
    if (filtrosFecha.fechaFin && filtrosFecha.fechaFin.trim() !== '') {
        const fechaFin = new Date(filtrosFecha.fechaFin);
        fechaFin.setHours(23, 59, 59, 999); // Final del día
        console.log('Fecha fin ajustada:', fechaFin);
        
        movimientosFiltrados = movimientosFiltrados.filter(mov => {
            const fechaMovimiento = new Date(mov.fecha);
            const pasa = fechaMovimiento <= fechaFin;
            if (!pasa) {
                console.log(`Movimiento filtrado por fecha fin: ${mov.fecha} > ${fechaFin}`);
            }
            return pasa;
        });
    } else {
        console.log('Sin filtro de fecha fin - mostrando todos');
    }
    
    // Solo mostrar logs si hay filtros activos
    if (filtrosFecha.fechaInicio || filtrosFecha.fechaFin || tabActiva !== 'todos') {
        console.log('Movimientos después de filtro de fechas:', movimientosFiltrados.length);
    }
    
    // Filtrar por tab activa
    if (tabActiva === 'ingresos') {
        movimientosFiltrados = movimientosFiltrados.filter(mov => mov.tipo === 'ingreso');
        if (filtrosFecha.fechaInicio || filtrosFecha.fechaFin) {
            console.log('Movimientos después de filtrar solo ingresos:', movimientosFiltrados.length);
        }
    } else if (tabActiva === 'gastos') {
        movimientosFiltrados = movimientosFiltrados.filter(mov => mov.tipo === 'gasto');
        if (filtrosFecha.fechaInicio || filtrosFecha.fechaFin) {
            console.log('Movimientos después de filtrar solo gastos:', movimientosFiltrados.length);
        }
    }
    
    if (filtrosFecha.fechaInicio || filtrosFecha.fechaFin || tabActiva !== 'todos') {
        console.log('=== FIN FILTRADO ===');
    }
    
    return movimientosFiltrados;
}

// Actualizar estadísticas generales
function actualizarEstadisticasGenerales() {
    const movimientosFiltrados = filtrarMovimientos();
    
    let totalIngresos = 0;
    let totalGastos = 0;
    let cantidadIngresos = 0;
    let cantidadGastos = 0;
    
    movimientosFiltrados.forEach(mov => {
        if (mov.tipo === 'ingreso') {
            totalIngresos += mov.monto;
            cantidadIngresos++;
        } else if (mov.tipo === 'gasto') {
            totalGastos += mov.monto;
            cantidadGastos++;
        }
    });
    
    const balanceNeto = totalIngresos - totalGastos;
    
    // Calcular total de dinero en todas las cuentas
    let totalDineroGeneral = 0;
    let cantidadCuentasConDinero = 0;
    let totalCuentas = 0;
    
    // Excluir propiedades que no son bancos
    const bancosExcluidos = ['fechaCreacion', 'fechaModificacion'];
    
    console.log('Calculando total de dinero, bancoDinero:', bancoDinero);
    
    Object.keys(bancoDinero).forEach(banco => {
        if (!bancosExcluidos.includes(banco)) {
            const saldo = parseFloat(bancoDinero[banco]) || 0;
            console.log(`Banco ${banco}: saldo = ${saldo}`);
            
            totalCuentas++;
            totalDineroGeneral += saldo;
            
            if (saldo > 0) {
                cantidadCuentasConDinero++;
            }
        }
    });
    
    console.log(`Total dinero general: ${totalDineroGeneral}, Cuentas con dinero: ${cantidadCuentasConDinero}`);
    
    // Actualizar DOM
    document.getElementById('totalIngresos').textContent = formatearMonto(totalIngresos);
    document.getElementById('totalGastos').textContent = formatearMonto(totalGastos);
    document.getElementById('balanceNeto').textContent = formatearMonto(balanceNeto);
    
    // Actualizar total general si el elemento existe
    const totalGeneralElement = document.getElementById('totalDineroGeneral');
    if (totalGeneralElement) {
        totalGeneralElement.textContent = formatearMonto(totalDineroGeneral);
    }
    
    document.getElementById('cantidadIngresos').textContent = `${cantidadIngresos} transacciones`;
    document.getElementById('cantidadGastos').textContent = `${cantidadGastos} transacciones`;
    
    // Actualizar cantidad de cuentas si el elemento existe
    const cantidadCuentasElement = document.getElementById('cantidadCuentas');
    if (cantidadCuentasElement) {
        cantidadCuentasElement.textContent = totalCuentas > 0 ? `${cantidadCuentasConDinero} de ${totalCuentas} cuentas` : '0 cuentas configuradas';
    }
    
    // Actualizar tendencia
    const elementoTendencia = document.getElementById('tendenciaBalance');
    if (balanceNeto > 0) {
        elementoTendencia.textContent = 'Positivo';
        elementoTendencia.className = 'stat-trend positivo';
    } else if (balanceNeto < 0) {
        elementoTendencia.textContent = 'Negativo';
        elementoTendencia.className = 'stat-trend negativo';
    } else {
        elementoTendencia.textContent = 'Equilibrado';
        elementoTendencia.className = 'stat-trend equilibrado';
    }
}

// Actualizar resumen por bancos
function actualizarResumenBancos() {
    const movimientosFiltrados = filtrarMovimientos();
    const resumenPorBanco = {};
    
    // Filtrar propiedades que no son bancos
    const bancosExcluidos = ['fechaCreacion', 'fechaModificacion'];
    
    console.log('Banco dinero actual:', bancoDinero);
    
    // Inicializar con todos los bancos del sistema
    Object.keys(bancoDinero).forEach(banco => {
        if (!bancosExcluidos.includes(banco)) {
            const saldo = parseFloat(bancoDinero[banco]) || 0;
            resumenPorBanco[banco] = {
                saldoActual: saldo,
                ingresos: 0,
                gastos: 0,
                neto: 0,
                cantidadMovimientos: 0
            };
        }
    });
    
    // Procesar movimientos y agregar bancos que no estén en el sistema
    movimientosFiltrados.forEach(mov => {
        if (!resumenPorBanco[mov.banco]) {
            resumenPorBanco[mov.banco] = {
                saldoActual: 0,
                ingresos: 0,
                gastos: 0,
                neto: 0,
                cantidadMovimientos: 0
            };
        }
        
        const banco = resumenPorBanco[mov.banco];
        banco.cantidadMovimientos++;
        
        if (mov.tipo === 'ingreso') {
            banco.ingresos += mov.monto;
        } else if (mov.tipo === 'gasto') {
            banco.gastos += mov.monto;
        }
        
        banco.neto = banco.ingresos - banco.gastos;
    });
    
    // Generar HTML
    const grid = document.getElementById('resumenBancosGrid');
    grid.innerHTML = '';
    
    if (Object.keys(resumenPorBanco).length === 0) {
        grid.innerHTML = `
            <div class="sin-datos">
                <i class="fas fa-university"></i>
                <h3>No hay bancos configurados</h3>
                <p>Configura los bancos en la gestión de banco de dinero.</p>
            </div>
        `;
        return;
    }
    
    Object.entries(resumenPorBanco).forEach(([banco, datos]) => {
        const bancoCard = document.createElement('div');
        bancoCard.className = 'banco-card';
        bancoCard.innerHTML = `
            <div class="banco-header">
                <h4 class="banco-nombre">${banco}</h4>
                <div class="banco-saldo ${datos.saldoActual > 0 ? 'saldo-positivo' : datos.saldoActual < 0 ? 'saldo-negativo' : 'saldo-cero'}">
                    ${formatearMonto(datos.saldoActual)}
                </div>
            </div>
            <div class="banco-movimientos">
                <div class="movimiento-item">
                    <div class="movimiento-valor ingreso">${formatearMonto(datos.ingresos)}</div>
                    <div class="movimiento-label">Ingresos</div>
                </div>
                <div class="movimiento-item">
                    <div class="movimiento-valor gasto">${formatearMonto(datos.gastos)}</div>
                    <div class="movimiento-label">Gastos</div>
                </div>
                <div class="movimiento-item">
                    <div class="movimiento-valor neto">${formatearMonto(datos.neto)}</div>
                    <div class="movimiento-label">Neto</div>
                </div>
            </div>
            <div class="banco-acciones">
                <button class="btn-banco ver-detalle" onclick="verDetallesBanco('${banco}')">
                    <i class="fas fa-eye"></i> Ver Detalle
                </button>
            </div>
        `;
        grid.appendChild(bancoCard);
    });
}

// Cambiar tab activa
function cambiarTab(nuevaTab) {
    tabActiva = nuevaTab;
    
    // Actualizar clases de botones
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Recargar tabla
    cargarTablaMovimientos();
}

// Cargar tabla de movimientos
function cargarTablaMovimientos() {
    const tbody = document.getElementById('tablaMovimientosBody');
    tbody.innerHTML = '';
    
    const movimientosFiltrados = filtrarMovimientos();
    
    if (movimientosFiltrados.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="sin-datos">
                    <i class="fas fa-file-invoice"></i>
                    <h3>No hay movimientos para mostrar</h3>
                    <p>No se encontraron movimientos para los criterios seleccionados.</p>
                </td>
            </tr>
        `;
        return;
    }
    
    movimientosFiltrados.forEach(mov => {
        const fila = document.createElement('tr');
        fila.innerHTML = `
            <td>${formatearFecha(mov.fecha)}</td>
            <td>
                <span class="tipo-movimiento ${mov.tipo}">
                    <i class="fas fa-${mov.tipo === 'ingreso' ? 'arrow-up' : 'arrow-down'}"></i>
                    ${capitalizeFirst(mov.tipo)}
                </span>
            </td>
            <td>${mov.banco}</td>
            <td class="descripcion-movimiento">${mov.descripcion}</td>
            <td>
                <span class="monto-movimiento ${mov.tipo}">${formatearMonto(mov.monto)}</span>
            </td>
            <td>
                <span class="estado-movimiento ${mov.estado}">${capitalizeFirst(mov.estado)}</span>
            </td>
            <td>
                <button class="btn-accion btn-ver" onclick="verDetalleMovimiento('${mov.id}')" title="Ver detalles">
                    <i class="fas fa-eye"></i>
                </button>
            </td>
        `;
        tbody.appendChild(fila);
    });
}

// Abrir modal para nuevo ingreso
function abrirModalIngreso() {
    document.getElementById('tituloModalIngreso').textContent = 'Nuevo Ingreso';
    document.getElementById('formIngreso').reset();
    
    // Establecer fecha actual
    const ahora = new Date();
    document.getElementById('fechaIngreso').value = ahora.toISOString().slice(0, 16);
    
    mostrarModal('modalIngreso');
}

// Abrir modal para nuevo gasto
function abrirModalGasto() {
    document.getElementById('tituloModalGasto').textContent = 'Nuevo Gasto';
    document.getElementById('formGasto').reset();
    
    // Establecer fecha actual
    const ahora = new Date();
    document.getElementById('fechaGasto').value = ahora.toISOString().slice(0, 16);
    
    mostrarModal('modalGasto');
}

// Guardar ingreso
async function guardarIngreso() {
    const datosIngreso = {
        banco: document.getElementById('bancoDestino').value,
        monto: parseFloat(document.getElementById('montoIngreso').value),
        tipoIngreso: document.getElementById('tipoIngreso').value,
        categoria: document.getElementById('categoriaIngreso').value,
        fecha: new Date(document.getElementById('fechaIngreso').value).toISOString(),
        descripcion: document.getElementById('descripcionIngreso').value,
        usuarioCreador: usuarioActual.id
    };
    
    // Validar datos
    if (!validarDatosIngreso(datosIngreso)) {
        return;
    }
    
    try {
        mostrarCargando();
        
        // Procesar comprobante si existe
        const archivoComprobante = document.getElementById('comprobanteIngreso').files[0];
        if (archivoComprobante) {
            datosIngreso.comprobante = await procesarArchivoComprobante(archivoComprobante);
        }
        
        // Guardar ingreso
        const nuevoIngreso = await DB.crearIngreso(datosIngreso);
        
        // Actualizar saldo del banco (aumentar)
        const saldoActual = bancoDinero[datosIngreso.banco] || 0;
        const nuevoSaldo = saldoActual + datosIngreso.monto;
        await DB.actualizarSaldoBanco(datosIngreso.banco, nuevoSaldo);
        
        mostrarMensaje('Ingreso registrado exitosamente', 'exito');
        
        // Recargar datos
        await cargarMovimientos();
        
        // Recargar y procesar banco de dinero
        let bancoDineroRaw = await DB.obtenerBancoDinero();
        bancoDinero = {};
        if (bancoDineroRaw && typeof bancoDineroRaw === 'object') {
            const bancosExcluidos = ['fechaCreacion', 'fechaModificacion', 'id'];
            Object.keys(bancoDineroRaw).forEach(banco => {
                if (!bancosExcluidos.includes(banco)) {
                    if (typeof bancoDineroRaw[banco] === 'object' && bancoDineroRaw[banco].saldo !== undefined) {
                        bancoDinero[banco] = bancoDineroRaw[banco].saldo;
                    } else if (typeof bancoDineroRaw[banco] === 'number') {
                        bancoDinero[banco] = bancoDineroRaw[banco];
                    } else {
                        bancoDinero[banco] = 0;
                    }
                }
            });
        }
        
        actualizarEstadisticasGenerales();
        actualizarResumenBancos();
        cargarTablaMovimientos();
        
        // Actualizar estadísticas de cuentas por pagar
        
        cerrarModalIngreso();
        ocultarCargando();
    } catch (error) {
        console.error('Error guardando ingreso:', error);
        ocultarCargando();
        mostrarMensaje('Error al registrar el ingreso', 'error');
    }
}

// Guardar gasto
async function guardarGasto() {
    const datosGasto = {
        banco: document.getElementById('bancoOrigen').value,
        monto: parseFloat(document.getElementById('montoGasto').value),
        tipoGasto: document.getElementById('tipoGasto').value,
        categoria: document.getElementById('categoriaGasto').value,
        fecha: new Date(document.getElementById('fechaGasto').value).toISOString(),
        descripcion: document.getElementById('descripcionGasto').value,
        usuarioCreador: usuarioActual.id
    };
    
    // Validar datos
    if (!validarDatosGasto(datosGasto)) {
        return;
    }
    
    try {
        mostrarCargando();
        
        // Procesar comprobante si existe
        const archivoComprobante = document.getElementById('comprobanteGasto').files[0];
        if (archivoComprobante) {
            datosGasto.comprobante = await procesarArchivoComprobante(archivoComprobante);
        }
        
        // Guardar gasto
        const nuevoGasto = await DB.crearGasto(datosGasto);
        
        // Actualizar saldo del banco (disminuir)
        const saldoActual = bancoDinero[datosGasto.banco] || 0;
        const nuevoSaldo = saldoActual - datosGasto.monto;
        await DB.actualizarSaldoBanco(datosGasto.banco, nuevoSaldo);
        
        mostrarMensaje('Gasto registrado exitosamente', 'exito');
        
        // Recargar datos
        await cargarMovimientos();
        
        // Recargar y procesar banco de dinero
        let bancoDineroRaw = await DB.obtenerBancoDinero();
        bancoDinero = {};
        if (bancoDineroRaw && typeof bancoDineroRaw === 'object') {
            const bancosExcluidos = ['fechaCreacion', 'fechaModificacion', 'id'];
            Object.keys(bancoDineroRaw).forEach(banco => {
                if (!bancosExcluidos.includes(banco)) {
                    if (typeof bancoDineroRaw[banco] === 'object' && bancoDineroRaw[banco].saldo !== undefined) {
                        bancoDinero[banco] = bancoDineroRaw[banco].saldo;
                    } else if (typeof bancoDineroRaw[banco] === 'number') {
                        bancoDinero[banco] = bancoDineroRaw[banco];
                    } else {
                        bancoDinero[banco] = 0;
                    }
                }
            });
        }
        
        actualizarEstadisticasGenerales();
        actualizarResumenBancos();
        cargarTablaMovimientos();
        
        // Actualizar estadísticas de cuentas por pagar
        
        cerrarModalGasto();
        ocultarCargando();
    } catch (error) {
        console.error('Error guardando gasto:', error);
        ocultarCargando();
        mostrarMensaje('Error al registrar el gasto', 'error');
    }
}

// Validar datos del gasto
function validarDatosGasto(datos) {
    if (!datos.banco || !datos.monto || !datos.descripcion || !datos.fecha) {
        mostrarMensaje('Por favor, completa todos los campos obligatorios', 'error');
        return false;
    }
    
    if (datos.monto <= 0) {
        mostrarMensaje('El monto debe ser mayor a 0', 'error');
        return false;
    }
    
    // Verificar si hay saldo suficiente
    const saldoActual = bancoDinero[datos.banco] || 0;
    if (saldoActual < datos.monto) {
        mostrarMensaje(`Saldo insuficiente en ${datos.banco}. Saldo actual: ${formatearMonto(saldoActual)}`, 'error');
        return false;
    }
    
    return true;
}

// Validar datos del ingreso
function validarDatosIngreso(datos) {
    if (!datos.banco || !datos.monto || !datos.descripcion || !datos.fecha) {
        mostrarMensaje('Por favor, completa todos los campos obligatorios', 'error');
        return false;
    }
    
    if (datos.monto <= 0) {
        mostrarMensaje('El monto debe ser mayor a 0', 'error');
        return false;
    }
    
    return true;
}

// Procesar archivo de comprobante
async function procesarArchivoComprobante(archivo) {
    return new Promise((resolve, reject) => {
        if (archivo.size > 5 * 1024 * 1024) { // 5MB
            reject(new Error('El archivo es demasiado grande. Máximo 5MB.'));
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(e) {
            resolve(e.target.result);
        };
        reader.onerror = function() {
            reject(new Error('Error al leer el archivo'));
        };
        reader.readAsDataURL(archivo);
    });
}

// Manejar cambio de archivo de comprobante
function manejarComprobanteIngreso(input) {
    const preview = document.getElementById('previewComprobanteIngreso');
    const archivo = input.files[0];
    
    if (archivo) {
        if (archivo.size > 5 * 1024 * 1024) {
            mostrarMensaje('El archivo es demasiado grande. Máximo 5MB.', 'error');
            input.value = '';
            preview.style.display = 'none';
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.querySelector('img').src = e.target.result;
            preview.style.display = 'block';
        };
        reader.readAsDataURL(archivo);
    } else {
        preview.style.display = 'none';
    }
}

// Ver detalles de un movimiento
function verDetalleMovimiento(movimientoId) {
    const movimiento = movimientos.find(m => m.id === movimientoId);
    if (!movimiento) return;
    
    const contenido = document.getElementById('contenidoDetalleMovimiento');
    
    let detalleHTML = `
        <div class="detalle-movimiento">
            <div class="detalle-item">
                <span class="detalle-label">Fecha:</span>
                <span class="detalle-valor">${formatearFechaCompleta(movimiento.fecha)}</span>
            </div>
            <div class="detalle-item">
                <span class="detalle-label">Tipo:</span>
                <span class="detalle-valor">
                    <span class="tipo-movimiento ${movimiento.tipo}">
                        <i class="fas fa-${movimiento.tipo === 'ingreso' ? 'arrow-up' : 'arrow-down'}"></i>
                        ${capitalizeFirst(movimiento.tipo)}
                    </span>
                </span>
            </div>
            <div class="detalle-item">
                <span class="detalle-label">Banco:</span>
                <span class="detalle-valor">${movimiento.banco}</span>
            </div>
            <div class="detalle-item">
                <span class="detalle-label">Monto:</span>
                <span class="detalle-valor">
                    <span class="monto-movimiento ${movimiento.tipo}">${formatearMonto(movimiento.monto)}</span>
                </span>
            </div>
            <div class="detalle-item">
                <span class="detalle-label">Descripción:</span>
                <span class="detalle-valor">${movimiento.descripcion}</span>
            </div>
            <div class="detalle-item">
                <span class="detalle-label">Estado:</span>
                <span class="detalle-valor">
                    <span class="estado-movimiento ${movimiento.estado}">${capitalizeFirst(movimiento.estado)}</span>
                </span>
            </div>
    `;
    
    // Agregar campos específicos según el tipo
    if (movimiento.tipo === 'ingreso') {
        detalleHTML += `
            <div class="detalle-item">
                <span class="detalle-label">Tipo de Ingreso:</span>
                <span class="detalle-valor">${capitalizeFirst(movimiento.tipoIngreso || 'No especificado')}</span>
            </div>
            <div class="detalle-item">
                <span class="detalle-label">Categoría:</span>
                <span class="detalle-valor">${capitalizeFirst(movimiento.categoria || 'General')}</span>
            </div>
        `;
    } else if (movimiento.tipo === 'gasto' && movimiento.profesorNombre) {
        detalleHTML += `
            <div class="detalle-item">
                <span class="detalle-label">Profesor:</span>
                <span class="detalle-valor">${movimiento.profesorNombre}</span>
            </div>
            <div class="detalle-item">
                <span class="detalle-label">Semana:</span>
                <span class="detalle-valor">${movimiento.semana}</span>
            </div>
        `;
    }
    
    detalleHTML += '</div>';
    
    // Agregar comprobante si existe
    if (movimiento.comprobante && movimiento.comprobante !== 'null' && movimiento.comprobante.trim() !== '') {
        console.log('Mostrando comprobante:', movimiento.comprobante);
        
        // Verificar si es una URL válida de imagen
        let comprobanteUrl = movimiento.comprobante;
        if (!comprobanteUrl.startsWith('http')) {
            // Si no es una URL completa, asumir que es data URL o necesita prefijo
            if (comprobanteUrl.startsWith('data:image')) {
                // Es una imagen en base64, usar directamente
            } else {
                // Podría ser una URL relativa o necesitar manejo especial
                console.warn('URL de comprobante no reconocida:', comprobanteUrl);
            }
        }
        
        detalleHTML += `
            <div class="detalle-comprobante">
                <h5>Comprobante:</h5>
                <div class="comprobante-container">
                    <img src="${comprobanteUrl}" 
                         alt="Comprobante" 
                         style="max-width: 100%; max-height: 300px; cursor: pointer; border-radius: 8px; border: 1px solid #e5e7eb; object-fit: contain;" 
                         onclick="abrirImagenCompleta('${comprobanteUrl}')"
                         onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                    <div style="display: none; padding: 20px; text-align: center; color: #9ca3af; border: 1px dashed #d1d5db; border-radius: 8px;">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>Error al cargar la imagen del comprobante</p>
                        <small>URL: ${comprobanteUrl}</small>
                    </div>
                </div>
            </div>
        `;
    } else {
        detalleHTML += `
            <div class="detalle-item">
                <span class="detalle-label">Comprobante:</span>
                <span class="detalle-valor" style="color: #9ca3af;">No disponible</span>
            </div>
        `;
    }
    
    // Agregar información adicional para pagos de profesores
    if (movimiento.tipo === 'gasto' && movimiento.categoria === 'pago_profesor') {
        detalleHTML += `
            <div class="detalle-item">
                <span class="detalle-label">Método de Pago:</span>
                <span class="detalle-valor">${capitalizeFirst(movimiento.metodoPago || 'No especificado')}</span>
            </div>
        `;
    }
    
    contenido.innerHTML = detalleHTML;
    mostrarModal('modalDetalleMovimiento');
}

// Ver detalles de un banco específico
function verDetallesBanco(banco) {
    // Filtrar movimientos por banco
    const movimientosBanco = movimientos.filter(m => m.banco === banco);
    
    if (movimientosBanco.length === 0) {
        mostrarMensaje(`No hay movimientos registrados para ${banco}`, 'info');
        return;
    }
    
    // Aplicar filtro de banco y actualizar vista
    filtrosFecha.banco = banco;
    
    aplicarFiltrosFecha();
    
    // Scroll a la tabla de movimientos
    document.querySelector('.historial-container').scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
    });
}

// Actualizar resumen completo
function actualizarResumen() {
    mostrarCargando();
    
    setTimeout(async () => {
        try {
            await cargarMovimientos();
            
            // Recargar y procesar banco de dinero
            let bancoDineroRaw = await DB.obtenerBancoDinero();
            bancoDinero = {};
            if (bancoDineroRaw && typeof bancoDineroRaw === 'object') {
                const bancosExcluidos = ['fechaCreacion', 'fechaModificacion', 'id'];
                Object.keys(bancoDineroRaw).forEach(banco => {
                    if (!bancosExcluidos.includes(banco)) {
                        if (typeof bancoDineroRaw[banco] === 'object' && bancoDineroRaw[banco].saldo !== undefined) {
                            bancoDinero[banco] = bancoDineroRaw[banco].saldo;
                        } else if (typeof bancoDineroRaw[banco] === 'number') {
                            bancoDinero[banco] = bancoDineroRaw[banco];
                        } else {
                            bancoDinero[banco] = 0;
                        }
                    }
                });
            }
            
            actualizarEstadisticasGenerales();
            actualizarResumenBancos();
            cargarTablaMovimientos();
            
            mostrarMensaje('Resumen actualizado exitosamente', 'exito');
        } catch (error) {
            console.error('Error actualizando resumen:', error);
            mostrarMensaje('Error al actualizar el resumen', 'error');
        } finally {
            ocultarCargando();
        }
    }, 500);
}

// Exportar reporte
function exportarReporte() {
    abrirModalExportar();
}

// Abrir modal de exportar
function abrirModalExportar() {
    mostrarModal('modalExportar');
}

// Cerrar modal de exportar
function cerrarModalExportar() {
    document.getElementById('modalExportar').classList.remove('active');
    document.getElementById('modalOverlay').classList.remove('active');
    document.body.style.overflow = '';
}

// Ejecutar exportación según el tipo seleccionado
function ejecutarExportacion() {
    const tipoExportacion = document.querySelector('input[name="tipoExportacion"]:checked').value;
    
    let movimientosParaExportar = [];
    let nombreArchivo = '';
    let tituloHoja = '';
    
    // Obtener todos los movimientos sin filtros de tab
    const todosLosMovimientos = [...movimientos];
    
    // Aplicar solo filtros de fecha si existen
    if (filtrosFecha.fechaInicio || filtrosFecha.fechaFin) {
        movimientosParaExportar = todosLosMovimientos.filter(mov => {
            let pasa = true;
            
            if (filtrosFecha.fechaInicio && filtrosFecha.fechaInicio.trim() !== '') {
                const fechaInicio = new Date(filtrosFecha.fechaInicio);
                fechaInicio.setHours(0, 0, 0, 0);
                const fechaMovimiento = new Date(mov.fecha);
                pasa = pasa && fechaMovimiento >= fechaInicio;
            }
            
            if (filtrosFecha.fechaFin && filtrosFecha.fechaFin.trim() !== '') {
                const fechaFin = new Date(filtrosFecha.fechaFin);
                fechaFin.setHours(23, 59, 59, 999);
                const fechaMovimiento = new Date(mov.fecha);
                pasa = pasa && fechaMovimiento <= fechaFin;
            }
            
            return pasa;
        });
    } else {
        movimientosParaExportar = todosLosMovimientos;
    }
    
    // Filtrar según el tipo seleccionado
    switch (tipoExportacion) {
        case 'todos':
            nombreArchivo = 'Reporte_Completo_FinanzasSG';
            tituloHoja = 'Todos los Movimientos';
            break;
        case 'ingresos':
            movimientosParaExportar = movimientosParaExportar.filter(mov => mov.tipo === 'ingreso');
            nombreArchivo = 'Reporte_Ingresos_FinanzasSG';
            tituloHoja = 'Ingresos';
            break;
        case 'gastos':
            movimientosParaExportar = movimientosParaExportar.filter(mov => mov.tipo === 'gasto');
            nombreArchivo = 'Reporte_Gastos_FinanzasSG';
            tituloHoja = 'Gastos';
            break;
    }
    
    if (movimientosParaExportar.length === 0) {
        mostrarMensaje('No hay datos para exportar con los criterios seleccionados', 'info');
        return;
    }
    
    // Ordenar por fecha (más recientes primero)
    movimientosParaExportar.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    
    // Preparar datos para Excel
    const datosExcel = [];
    
    // Agregar encabezados
    datosExcel.push([
        'Fecha',
        'Tipo',
        'Banco',
        'Descripción',
        'Monto',
        'Estado',
        'Categoría'
    ]);
    
    // Agregar datos de movimientos
    movimientosParaExportar.forEach(mov => {
        datosExcel.push([
            formatearFecha(mov.fecha),
            mov.tipo.toUpperCase(),
            mov.banco,
            mov.descripcion,
            mov.monto,
            mov.estado.toUpperCase(),
            (mov.categoria || mov.tipoIngreso || 'GENERAL').toUpperCase()
        ]);
    });
    
    // Crear libro de Excel
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(datosExcel);
    
    // Configurar ancho de columnas
    const columnWidths = [
        { wch: 12 }, // Fecha
        { wch: 10 }, // Tipo
        { wch: 15 }, // Banco
        { wch: 40 }, // Descripción
        { wch: 15 }, // Monto
        { wch: 12 }, // Estado
        { wch: 15 }  // Categoría
    ];
    worksheet['!cols'] = columnWidths;
    
    // Aplicar estilos a los encabezados
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
        if (!worksheet[cellAddress]) continue;
        
        worksheet[cellAddress].s = {
            font: { bold: true, color: { rgb: "FFFFFF" } },
            fill: { fgColor: { rgb: "059669" } },
            alignment: { horizontal: "center" }
        };
    }
    
    // Aplicar formato de moneda a la columna de monto
    for (let row = 1; row <= range.e.r; row++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: 4 }); // Columna de monto
        if (worksheet[cellAddress]) {
            worksheet[cellAddress].z = '"$"#,##0';
        }
    }
    
    // Agregar la hoja al libro
    XLSX.utils.book_append_sheet(workbook, worksheet, tituloHoja);
    
    // Generar el archivo
    const fechaHoy = new Date().toISOString().split('T')[0];
    const nombreCompleto = `${nombreArchivo}_${fechaHoy}.xlsx`;
    
    // Descargar archivo Excel
    XLSX.writeFile(workbook, nombreCompleto);
    
    cerrarModalExportar();
    mostrarMensaje(`Archivo Excel exportado exitosamente: ${nombreCompleto} (${movimientosParaExportar.length} registros)`, 'exito');
}

// Funciones de modal
function mostrarModal(modalId) {
    document.getElementById(modalId).classList.add('active');
    document.getElementById('modalOverlay').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function cerrarModalIngreso() {
    document.getElementById('modalIngreso').classList.remove('active');
    document.getElementById('modalOverlay').classList.remove('active');
    document.body.style.overflow = '';
}

function cerrarModalBancoDinero() {
    document.getElementById('modalBancoDinero').classList.remove('active');
    document.getElementById('modalOverlay').classList.remove('active');
    document.body.style.overflow = '';
}

function cerrarModalGasto() {
    document.getElementById('modalGasto').classList.remove('active');
    document.getElementById('modalOverlay').classList.remove('active');
    document.body.style.overflow = '';
}

function cerrarModalDetalleMovimiento() {
    document.getElementById('modalDetalleMovimiento').classList.remove('active');
    document.getElementById('modalOverlay').classList.remove('active');
    document.body.style.overflow = '';
}

// Manejar cambio de archivo de comprobante para gastos
function manejarComprobanteGasto(input) {
    const preview = document.getElementById('previewComprobanteGasto');
    const archivo = input.files[0];
    
    if (archivo) {
        if (archivo.size > 5 * 1024 * 1024) {
            mostrarMensaje('El archivo es demasiado grande. Máximo 5MB.', 'error');
            input.value = '';
            preview.style.display = 'none';
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.querySelector('img').src = e.target.result;
            preview.style.display = 'block';
        };
        reader.readAsDataURL(archivo);
    } else {
        preview.style.display = 'none';
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

function formatearFecha(fecha) {
    return new Date(fecha).toLocaleDateString('es-CO');
}

function formatearFechaCompleta(fecha) {
    return new Date(fecha).toLocaleString('es-CO');
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

// Exportar funciones para uso global
window.abrirModalIngreso = abrirModalIngreso;
window.cerrarModalIngreso = cerrarModalIngreso;
window.cerrarModalBancoDinero = cerrarModalBancoDinero;
window.cerrarModalDetalleMovimiento = cerrarModalDetalleMovimiento;
window.aplicarFiltrosFecha = aplicarFiltrosFecha;
window.limpiarFiltrosFecha = limpiarFiltrosFecha;
window.mostrarTodosLosMovimientos = mostrarTodosLosMovimientos;
window.cambiarTab = cambiarTab;
window.verDetalleMovimiento = verDetalleMovimiento;
window.verDetallesBanco = verDetallesBanco;
window.actualizarResumen = actualizarResumen;
window.exportarReporte = exportarReporte;
window.manejarComprobanteIngreso = manejarComprobanteIngreso;
window.abrirModalGasto = abrirModalGasto;
window.cerrarModalGasto = cerrarModalGasto;
window.manejarComprobanteGasto = manejarComprobanteGasto;
window.abrirGestionBancoDinero = abrirGestionBancoDinero;
window.guardarBancoDinero = guardarBancoDinero;
window.abrirImagenCompleta = abrirImagenCompleta;
window.cerrarSesion = cerrarSesion;
window.abrirModalExportar = abrirModalExportar;
window.cerrarModalExportar = cerrarModalExportar;
window.ejecutarExportacion = ejecutarExportacion;


// Función para abrir imagen en tamaño completo
function abrirImagenCompleta(urlImagen) {
    // Crear modal para mostrar imagen completa
    const modalImagen = document.createElement('div');
    modalImagen.className = 'modal active';
    modalImagen.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.8);
    `;
    
    modalImagen.innerHTML = `
        <div class="modal-content" style="
            background: white;
            border-radius: 12px;
            max-width: 95%;
            max-height: 95%;
            padding: 0;
            text-align: center;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
            position: relative;
            overflow: hidden;
        ">
            <div class="modal-header" style="
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 15px 20px;
                border-bottom: 1px solid #e5e7eb;
                background: #f9fafb;
            ">
                <h3 style="margin: 0; color: #333; font-size: 18px;">Comprobante</h3>
                <button class="close-btn" onclick="this.closest('.modal').remove(); document.body.style.overflow = '';" style="
                    background: none;
                    border: none;
                    font-size: 20px;
                    cursor: pointer;
                    color: #6b7280;
                    padding: 5px;
                    border-radius: 4px;
                    transition: all 0.3s ease;
                " onmouseover="this.style.background='#f3f4f6'; this.style.color='#333';" onmouseout="this.style.background='none'; this.style.color='#6b7280';">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div style="
                padding: 20px;
                text-align: center;
                background: white;
                max-height: 70vh;
                overflow: auto;
            ">
                <img src="${urlImagen}" 
                     alt="Comprobante" 
                     style="
                        max-width: 100%;
                        max-height: 65vh;
                        border-radius: 8px;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                        object-fit: contain;
                        background: white;
                     "
                     onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                <div style="
                    display: none;
                    padding: 40px;
                    color: #9ca3af;
                    border: 2px dashed #d1d5db;
                    border-radius: 8px;
                    margin: 20px 0;
                ">
                    <i class="fas fa-exclamation-triangle" style="font-size: 24px; margin-bottom: 10px;"></i>
                    <p style="margin: 0;">Error al cargar la imagen del comprobante</p>
                </div>
            </div>
            <div class="modal-footer" style="
                display: flex;
                justify-content: center;
                gap: 15px;
                padding: 15px 20px;
                border-top: 1px solid #e5e7eb;
                background: #f9fafb;
            ">
                <button class="btn btn-secondary" onclick="this.closest('.modal').remove(); document.body.style.overflow = '';" style="
                    background: #f3f4f6;
                    color: #374151;
                    border: 1px solid #d1d5db;
                    padding: 8px 16px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 14px;
                    transition: all 0.3s ease;
                " onmouseover="this.style.background='#e5e7eb';" onmouseout="this.style.background='#f3f4f6';">
                    Cerrar
                </button>
                <a href="${urlImagen}" target="_blank" class="btn btn-primary" style="
                    background: linear-gradient(135deg, #059669 0%, #047857 100%);
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 6px;
                    text-decoration: none;
                    font-size: 14px;
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    transition: all 0.3s ease;
                " onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 5px 15px rgba(5, 150, 105, 0.3)';" onmouseout="this.style.transform='none'; this.style.boxShadow='none';">
                    <i class="fas fa-external-link-alt"></i> Abrir en Nueva Pestaña
                </a>
            </div>
        </div>
    `;
    
    // Agregar evento para cerrar con clic en el fondo
    modalImagen.addEventListener('click', function(e) {
        if (e.target === modalImagen) {
            modalImagen.remove();
            document.body.style.overflow = '';
        }
    });
    
    // Agregar evento para cerrar con tecla Escape
    const cerrarConEscape = function(e) {
        if (e.key === 'Escape') {
            modalImagen.remove();
            document.body.style.overflow = '';
            document.removeEventListener('keydown', cerrarConEscape);
        }
    };
    document.addEventListener('keydown', cerrarConEscape);
    
    document.body.appendChild(modalImagen);
    document.body.style.overflow = 'hidden';
}

// Función para abrir gestión de banco de dinero (implementación básica)
function abrirGestionBancoDinero() {
    // Verificar si el modal existe y abrirlo
    const modalBanco = document.getElementById('modalBancoDinero');
    if (modalBanco) {
        cargarFormularioBancoDinero();
        mostrarModal('modalBancoDinero');
    } else {
        mostrarMensaje('Modal de gestión de bancos no encontrado', 'error');
    }
}

// Cargar formulario de banco de dinero
async function cargarFormularioBancoDinero() {
    try {
        const formulario = document.getElementById('formularioBancoDinero');
        if (!formulario) return;
        
        // Obtener datos de bancos con la estructura correcta
        let bancosRaw = await DB.obtenerBancoDinero();
        let bancosData = {};
        
        if (bancosRaw && typeof bancosRaw === 'object') {
            const bancosExcluidos = ['fechaCreacion', 'fechaModificacion', 'id'];
            Object.keys(bancosRaw).forEach(banco => {
                if (!bancosExcluidos.includes(banco)) {
                    if (typeof bancosRaw[banco] === 'object' && bancosRaw[banco].saldo !== undefined) {
                        bancosData[banco] = bancosRaw[banco].saldo;
                    } else if (typeof bancosRaw[banco] === 'number') {
                        bancosData[banco] = bancosRaw[banco];
                    } else {
                        bancosData[banco] = 0;
                    }
                }
            });
        }
        
        let html = '';
        
        // Solo mostrar bancos que ya están configurados
        const bancosDisponibles = Object.keys(bancosData);
        
        bancosDisponibles.forEach(banco => {
            const saldo = bancosData[banco] || 0;
            html += `
                <div class="form-group">
                    <label for="saldo_${banco}">${banco}:</label>
                    <div class="input-group">
                        <span class="input-prefix">$</span>
                        <input type="number" id="saldo_${banco}" name="${banco}" value="${saldo}" min="0" step="1000">
                    </div>
                </div>
            `;
        });
        
        formulario.innerHTML = html;
    } catch (error) {
        console.error('Error cargando formulario de banco:', error);
    }
}

// Guardar banco de dinero
async function guardarBancoDinero() {
    try {
        mostrarCargando();
        
        const formulario = document.getElementById('formularioBancoDinero');
        const formData = new FormData(formulario);
        const nuevosBancos = {};
        
        for (const [banco, saldo] of formData.entries()) {
            nuevosBancos[banco] = parseFloat(saldo) || 0;
        }
        
        await DB.actualizarBancoDinero(nuevosBancos);
        bancoDinero = nuevosBancos;
        
        mostrarMensaje('Bancos actualizados exitosamente', 'exito');
        actualizarResumenBancos();
        cerrarModalBancoDinero();
        
        ocultarCargando();
    } catch (error) {
        console.error('Error guardando bancos:', error);
        ocultarCargando();
        mostrarMensaje('Error al actualizar los bancos', 'error');
    }
}
