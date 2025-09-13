// Sistema de Gestión de Pagos con Banco de Dinero
// API Key para ImgBB
const IMGBB_API_KEY = '31d404c5b858689b8dc3103bf0ade0c3';

// Variables globales para el sistema de pagos
let bancoDinero = {}; // Ahora será dinámico
let pagosRealizados = [];
let pagoEditando = null;

// Inicialización del sistema de pagos
document.addEventListener('DOMContentLoaded', function() {
    if (window.location.pathname.includes('CuentasPorPagar')) {
        inicializarSistemaPagos();
    }
});

// Inicializar sistema de pagos
async function inicializarSistemaPagos() {
    try {
        // Cargar datos del banco de dinero desde Firebase
        await cargarBancoDinero();
        
        // Cargar historial de pagos
        await cargarHistorialPagos();
        
        console.log('Sistema de pagos inicializado correctamente');
    } catch (error) {
        console.error('Error inicializando sistema de pagos:', error);
    }
}

// Cargar banco de dinero desde Firebase
async function cargarBancoDinero() {
    try {
        const bancoDatos = await DB.obtenerBancoDinero();
        console.log('Datos raw del banco:', bancoDatos);
        
        if (bancoDatos) {
            // Filtrar campos de metadatos para obtener solo los bancos
            const { fechaCreacion, fechaModificacion, ...bancos } = bancoDatos;
            
            // Normalizar la estructura de datos
            bancoDinero = {};
            Object.keys(bancos).forEach(bancoKey => {
                const bancoData = bancos[bancoKey];
                
                // Manejar diferentes estructuras de datos
                if (typeof bancoData === 'object' && bancoData.saldo !== undefined) {
                    // Estructura compleja: { nombre: 'NEQUI', saldo: 50000 }
                    bancoDinero[bancoKey] = {
                        nombre: bancoData.nombre || bancoKey.toUpperCase(),
                        saldo: parseFloat(bancoData.saldo) || 0
                    };
                } else if (typeof bancoData === 'number') {
                    // Estructura simple: solo el saldo como número
                    bancoDinero[bancoKey] = {
                        nombre: bancoKey.toUpperCase(),
                        saldo: parseFloat(bancoData) || 0
                    };
                } else {
                    // Estructura desconocida, inicializar con valores por defecto
                    bancoDinero[bancoKey] = {
                        nombre: bancoKey.toUpperCase(),
                        saldo: 0
                    };
                }
            });
        }
        
        console.log('Banco de dinero procesado:', bancoDinero);
        
        // Si no hay bancos, inicializar con estructura básica
        if (Object.keys(bancoDinero).length === 0) {
            console.log('No hay bancos configurados, inicializando estructura básica');
            bancoDinero = {
                'nequi': { nombre: 'NEQUI', saldo: 0 },
                'daviplata': { nombre: 'DAVIPLATA', saldo: 0 },
                'bancolombia': { nombre: 'BANCOLOMBIA', saldo: 0 },
                'efectivo': { nombre: 'EFECTIVO', saldo: 0 }
            };
        }
        
    } catch (error) {
        console.error('Error cargando banco de dinero:', error);
        // Usar valores por defecto si hay error
        bancoDinero = {
            'nequi': { nombre: 'NEQUI', saldo: 0 },
            'daviplata': { nombre: 'DAVIPLATA', saldo: 0 },
            'bancolombia': { nombre: 'BANCOLOMBIA', saldo: 0 },
            'efectivo': { nombre: 'EFECTIVO', saldo: 0 }
        };
    }
}

// Cargar historial de pagos
async function cargarHistorialPagos() {
    try {
        pagosRealizados = await DB.obtenerHistorialPagos();
        console.log('Historial de pagos cargado:', pagosRealizados);
    } catch (error) {
        console.error('Error cargando historial de pagos:', error);
        pagosRealizados = [];
    }
}

// Abrir modal de pago
function abrirModalPago(profesorId, semana, monto) {
    const profesor = datosProfesores.find(p => p.id === profesorId);
    if (!profesor) {
        mostrarMensaje('No se encontró información del profesor', 'error');
        return;
    }

    // Llenar información del modal
    document.getElementById('pagoProfesorNombre').textContent = profesor.nombre;
    document.getElementById('pagoSemana').textContent = semana;
    document.getElementById('pagoMonto').textContent = formatearMonto(monto);
    
    // Cargar opciones de bancos con saldos disponibles
    cargarOpcionesBancos(monto);
    
    // Limpiar formulario
    document.getElementById('formPago').reset();
    document.getElementById('previewComprobante').style.display = 'none';
    document.getElementById('comprobanteSubido').style.display = 'none';
    
    // Guardar datos del pago
    window.datosPagoActual = {
        profesorId,
        profesorNombre: profesor.nombre,
        semana,
        monto
    };
    
    // Mostrar modal
    document.getElementById('modalPago').classList.add('active');
    document.getElementById('modalOverlay').classList.add('active');
    document.body.style.overflow = 'hidden';
}

// Cargar opciones de bancos con saldos
function cargarOpcionesBancos(montoRequerido) {
    const selectBanco = document.getElementById('bancoOrigen');
    selectBanco.innerHTML = '<option value="">Seleccionar banco de origen</option>';
    
    // Usar los bancos dinámicos creados por el usuario
    Object.keys(bancoDinero).forEach(bancoKey => {
        const saldo = bancoDinero[bancoKey].saldo || 0;
        const nombreBanco = bancoDinero[bancoKey].nombre || bancoKey;
        const tienesSaldo = saldo >= montoRequerido;
        
        const option = document.createElement('option');
        option.value = bancoKey;
        option.textContent = `${nombreBanco} - Saldo: ${formatearMonto(saldo)}`;
        
        if (!tienesSaldo) {
            option.disabled = true;
            option.textContent += ' (Saldo insuficiente)';
            option.style.color = '#dc2626';
        }
        
        selectBanco.appendChild(option);
    });
    
    // Si no hay bancos creados, mostrar mensaje
    if (Object.keys(bancoDinero).length === 0) {
        const option = document.createElement('option');
        option.disabled = true;
        option.textContent = 'No hay bancos configurados - Ir a Banco de Dinero';
        selectBanco.appendChild(option);
    }
    
    // Actualizar información de saldo cuando se seleccione un banco
    selectBanco.addEventListener('change', function() {
        actualizarInfoSaldo(this.value, montoRequerido);
    });
}

// Actualizar información de saldo seleccionado
function actualizarInfoSaldo(bancoKey, montoRequerido) {
    const infoSaldo = document.getElementById('infoSaldoSeleccionado');
    
    if (!bancoKey || !bancoDinero[bancoKey]) {
        infoSaldo.style.display = 'none';
        return;
    }
    
    const saldoActual = bancoDinero[bancoKey].saldo || 0;
    const saldoRestante = saldoActual - montoRequerido;
    
    infoSaldo.innerHTML = `
        <div class="saldo-info">
            <div class="saldo-item">
                <span class="saldo-label">Saldo actual:</span>
                <span class="saldo-valor ${saldoActual >= montoRequerido ? 'suficiente' : 'insuficiente'}">
                    ${formatearMonto(saldoActual)}
                </span>
            </div>
            <div class="saldo-item">
                <span class="saldo-label">Monto a pagar:</span>
                <span class="saldo-valor">${formatearMonto(montoRequerido)}</span>
            </div>
            <div class="saldo-item">
                <span class="saldo-label">Saldo restante:</span>
                <span class="saldo-valor ${saldoRestante >= 0 ? 'positivo' : 'negativo'}">
                    ${formatearMonto(saldoRestante)}
                </span>
            </div>
        </div>
    `;
    infoSaldo.style.display = 'block';
}

// Manejar selección de archivo de comprobante
function manejarArchivoComprobante(input) {
    const archivo = input.files[0];
    if (!archivo) {
        document.getElementById('previewComprobante').style.display = 'none';
        return;
    }
    
    // Validar tipo de archivo
    if (!archivo.type.startsWith('image/')) {
        mostrarMensaje('Por favor selecciona un archivo de imagen válido', 'error');
        input.value = '';
        return;
    }
    
    // Validar tamaño (máximo 5MB)
    if (archivo.size > 5 * 1024 * 1024) {
        mostrarMensaje('El archivo es demasiado grande. Máximo 5MB permitido', 'error');
        input.value = '';
        return;
    }
    
    // Mostrar preview
    const reader = new FileReader();
    reader.onload = function(e) {
        const preview = document.getElementById('previewComprobante');
        const img = preview.querySelector('img');
        img.src = e.target.result;
        preview.style.display = 'block';
    };
    reader.readAsDataURL(archivo);
}

// Subir imagen a ImgBB
async function subirImagenImgBB(archivo) {
    try {
        mostrarCargandoPago('Subiendo comprobante...');
        
        const formData = new FormData();
        formData.append('image', archivo);
        formData.append('key', IMGBB_API_KEY);
        
        const response = await fetch('https://api.imgbb.com/1/upload', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error('Error en la respuesta del servidor');
        }
        
        const result = await response.json();
        
        if (result.success) {
            return {
                url: result.data.url,
                deleteUrl: result.data.delete_url,
                thumbnailUrl: result.data.thumb.url
            };
        } else {
            throw new Error('Error subiendo imagen: ' + (result.error?.message || 'Error desconocido'));
        }
    } catch (error) {
        console.error('Error subiendo imagen a ImgBB:', error);
        throw error;
    }
}

// Procesar pago
async function procesarPago() {
    try {
        const formData = new FormData(document.getElementById('formPago'));
        const bancoOrigen = formData.get('bancoOrigen');
        const descripcion = formData.get('descripcionPago');
        const archivoComprobante = document.getElementById('archivoComprobante').files[0];
        
        // Validaciones
        if (!bancoOrigen) {
            mostrarMensaje('Debe seleccionar un banco de origen', 'error');
            return;
        }
        
        if (!archivoComprobante) {
            mostrarMensaje('Debe subir un comprobante de pago', 'error');
            return;
        }
        
        const { profesorId, profesorNombre, semana, monto } = window.datosPagoActual;
        
        // Verificar saldo suficiente
        if (!bancoDinero[bancoOrigen] || bancoDinero[bancoOrigen].saldo < monto) {
            mostrarMensaje('Saldo insuficiente en el banco seleccionado', 'error');
            return;
        }
        
        mostrarCargandoPago('Procesando pago...');
        
        // Subir comprobante
        const comprobante = await subirImagenImgBB(archivoComprobante);
        
        // Crear registro de pago
        const datosPago = {
            profesorId,
            profesorNombre,
            semana,
            monto,
            bancoOrigen,
            descripcion: descripcion || '',
            comprobante: {
                url: comprobante.url,
                thumbnailUrl: comprobante.thumbnailUrl,
                deleteUrl: comprobante.deleteUrl
            },
            fechaPago: new Date(),
            usuarioQuePago: usuarioActual.id,
            nombreUsuarioQuePago: usuarioActual.nombre,
            estado: 'completado'
        };
        
        // Guardar en base de datos
        await DB.registrarPago(datosPago);
        
        // Actualizar estado de pago de los horarios de esa semana
        await DB.actualizarHorariosPagadosPorSemana(profesorId, semana);
        
        // Actualizar banco de dinero
        bancoDinero[bancoOrigen].saldo -= monto;
        await DB.actualizarBancoDinero(bancoDinero);
        
        // Actualizar lista local de pagos
        pagosRealizados.push(datosPago);
        
        // Recargar historial de pagos desde la base de datos para asegurar consistencia
        await cargarHistorialPagos();
        
        ocultarCargandoPago();
        cerrarModalPago();
        
        mostrarMensaje(`Pago de ${formatearMonto(monto)} realizado exitosamente a ${profesorNombre}`, 'exito');
        
        // Actualizar vista de cuentas por pagar
        if (typeof cargarTablaCuentas === 'function') {
            cargarTablaCuentas();
        }
        
        // Actualizar estadísticas
        if (typeof actualizarEstadisticas === 'function') {
            actualizarEstadisticas();
        }
        
        // Actualizar vista de horarios si está disponible
        if (typeof inicializarDatos === 'function') {
            // Recargar horarios para reflejar el cambio de estado de pago
            await inicializarDatos();
        }
        
    } catch (error) {
        console.error('Error procesando pago:', error);
        ocultarCargandoPago();
        mostrarMensaje('Error al procesar el pago: ' + error.message, 'error');
    }
}

// Verificar si una semana ya está pagada
function estaSemanasPagada(profesorId, semana) {
    return pagosRealizados.some(pago => 
        pago.profesorId === profesorId && 
        pago.semana === semana && 
        pago.estado === 'completado'
    );
}

// Obtener información de pago de una semana
function obtenerInfoPagoSemana(profesorId, semana) {
    return pagosRealizados.find(pago => 
        pago.profesorId === profesorId && 
        pago.semana === semana && 
        pago.estado === 'completado'
    );
}

// Cerrar modal de pago
function cerrarModalPago() {
    document.getElementById('modalPago').classList.remove('active');
    document.getElementById('modalOverlay').classList.remove('active');
    document.body.style.overflow = '';
    
    // Limpiar datos temporales
    window.datosPagoActual = null;
}

// Mostrar modal de gestión de banco de dinero
function abrirGestionBancoDinero() {
    cargarFormularioBancoDinero();
    document.getElementById('modalBancoDinero').classList.add('active');
    document.getElementById('modalOverlay').classList.add('active');
    document.body.style.overflow = 'hidden';
}

// Cargar formulario de banco de dinero
function cargarFormularioBancoDinero() {
    const container = document.getElementById('formularioBancoDinero');
    
    let html = `
        <div class="nuevo-banco-section">
            <h4>Agregar Nuevo Banco</h4>
            <div class="nuevo-banco-form">
                <div class="input-group-nuevo">
                    <input type="text" 
                           id="nombreNuevoBanco" 
                           placeholder="Nombre del banco (ej: NEQUI, BANCOLOMBIA)" 
                           class="banco-nombre-input">
                    <div class="input-group">
                        <span class="input-prefix">$</span>
                        <input type="number" 
                               id="saldoNuevoBanco" 
                               placeholder="0" 
                               min="0" 
                               step="1000"
                               class="saldo-input">
                    </div>
                    <button type="button" class="btn-agregar-banco" onclick="agregarNuevoBanco()">
                        <i class="fas fa-plus"></i> Agregar
                    </button>
                </div>
            </div>
        </div>
        <div class="bancos-existentes">
            <h4>Bancos Configurados</h4>
            <div class="bancos-grid" id="bancosGrid">
    `;
    
    // Mostrar bancos existentes
    if (Object.keys(bancoDinero).length === 0) {
        html += `
            <div class="sin-bancos">
                <i class="fas fa-university"></i>
                <p>No hay bancos configurados. Agrega tu primer banco arriba.</p>
            </div>
        `;
    } else {
        Object.keys(bancoDinero).forEach(bancoKey => {
            const banco = bancoDinero[bancoKey];
            const saldo = banco.saldo || 0;
            const nombre = banco.nombre || bancoKey;
            
            html += `
                <div class="banco-item" data-banco-key="${bancoKey}">
                    <div class="banco-info">
                        <label for="saldo-${bancoKey}">${nombre}</label>
                        <div class="saldo-actual">Saldo actual: ${formatearMonto(saldo)}</div>
                    </div>
                    <div class="banco-input">
                        <div class="input-group">
                            <span class="input-prefix">$</span>
                            <input type="number" 
                                   id="saldo-${bancoKey}" 
                                   name="${bancoKey}" 
                                   value="${saldo}" 
                                   min="0" 
                                   step="1000"
                                   class="saldo-input">
                        </div>
                    </div>
                    <div class="banco-acciones">
                        <button type="button" class="btn-eliminar-banco" onclick="eliminarBanco('${bancoKey}')" title="Eliminar banco">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        });
    }
    
    html += `
            </div>
        </div>
    `;
    
    container.innerHTML = html;
}

// Agregar nuevo banco
function agregarNuevoBanco() {
    const nombreInput = document.getElementById('nombreNuevoBanco');
    const saldoInput = document.getElementById('saldoNuevoBanco');
    
    const nombre = nombreInput.value.trim().toUpperCase();
    const saldo = parseFloat(saldoInput.value) || 0;
    
    if (!nombre) {
        mostrarMensaje('Debe ingresar el nombre del banco', 'error');
        return;
    }
    
    // Crear clave única para el banco
    const bancoKey = nombre.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    
    if (bancoDinero[bancoKey]) {
        mostrarMensaje('Ya existe un banco con ese nombre', 'error');
        return;
    }
    
    // Agregar el banco
    bancoDinero[bancoKey] = {
        nombre: nombre,
        saldo: saldo
    };
    
    // Limpiar campos
    nombreInput.value = '';
    saldoInput.value = '';
    
    // Recargar formulario
    cargarFormularioBancoDinero();
    
    mostrarMensaje(`Banco ${nombre} agregado exitosamente`, 'exito');
}

// Eliminar banco
async function eliminarBanco(bancoKey) {
    const banco = bancoDinero[bancoKey];
    if (!banco) return;
    
    if (confirm(`¿Estás seguro de que deseas eliminar el banco ${banco.nombre}?`)) {
        delete bancoDinero[bancoKey];
        
        // Recargar formulario
        cargarFormularioBancoDinero();
        
        mostrarMensaje(`Banco ${banco.nombre} eliminado exitosamente`, 'exito');
    }
}

// Guardar cambios en banco de dinero
async function guardarBancoDinero() {
    try {
        mostrarCargandoBanco('Guardando cambios...');
        
        // Actualizar saldos de bancos existentes
        Object.keys(bancoDinero).forEach(bancoKey => {
            const input = document.getElementById(`saldo-${bancoKey}`);
            if (input) {
                bancoDinero[bancoKey].saldo = parseFloat(input.value) || 0;
            }
        });
        
        // Guardar en base de datos
        await DB.actualizarBancoDinero(bancoDinero);
        
        ocultarCargandoBanco();
        cerrarModalBancoDinero();
        
        mostrarMensaje('Banco de dinero actualizado exitosamente', 'exito');
        
    } catch (error) {
        console.error('Error guardando banco de dinero:', error);
        ocultarCargandoBanco();
        mostrarMensaje('Error al guardar los cambios', 'error');
    }
}

// Cerrar modal de banco de dinero
function cerrarModalBancoDinero() {
    document.getElementById('modalBancoDinero').classList.remove('active');
    document.getElementById('modalOverlay').classList.remove('active');
    document.body.style.overflow = '';
}

// Ver historial de pagos
function verHistorialPagos() {
    cargarHistorialPagosModal();
    document.getElementById('modalHistorialPagos').classList.add('active');
    document.getElementById('modalOverlay').classList.add('active');
    document.body.style.overflow = 'hidden';
}

// Cargar historial de pagos en modal
function cargarHistorialPagosModal() {
    const container = document.getElementById('listaHistorialPagos');
    
    if (pagosRealizados.length === 0) {
        container.innerHTML = `
            <div class="sin-pagos">
                <i class="fas fa-receipt"></i>
                <h3>No hay pagos registrados</h3>
                <p>Los pagos realizados aparecerán aquí.</p>
            </div>
        `;
        return;
    }
    
    // Ordenar pagos por fecha (más recientes primero)
    const pagosOrdenados = [...pagosRealizados].sort((a, b) => 
        new Date(b.fechaPago) - new Date(a.fechaPago)
    );
    
    let html = '<div class="pagos-lista">';
    
    pagosOrdenados.forEach(pago => {
        const fechaFormateada = new Date(pago.fechaPago).toLocaleString('es-ES');
        
        html += `
            <div class="pago-item">
                <div class="pago-header">
                    <div class="pago-info-principal">
                        <h4>${pago.profesorNombre}</h4>
                        <span class="pago-semana">Semana: ${pago.semana}</span>
                    </div>
                    <div class="pago-monto">
                        <span class="monto-pagado">${formatearMonto(pago.monto)}</span>
                    </div>
                </div>
                <div class="pago-detalles">
                    <div class="pago-dato">
                        <span class="dato-label">Banco origen:</span>
                        <span class="dato-valor">${obtenerNombreBanco(pago.bancoOrigen)}</span>
                    </div>
                    <div class="pago-dato">
                        <span class="dato-label">Fecha:</span>
                        <span class="dato-valor">${fechaFormateada}</span>
                    </div>
                    <div class="pago-dato">
                        <span class="dato-label">Pagado por:</span>
                        <span class="dato-valor">${pago.nombreUsuarioQuePago}</span>
                    </div>
                    ${pago.descripcion ? `
                        <div class="pago-dato">
                            <span class="dato-label">Descripción:</span>
                            <span class="dato-valor">${pago.descripcion}</span>
                        </div>
                    ` : ''}
                </div>
                <div class="pago-acciones">
                    <button class="btn-ver-comprobante" onclick="verComprobante('${pago.comprobante.url}')">
                        <i class="fas fa-image"></i> Ver Comprobante
                    </button>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

// Ver comprobante de pago en modal emergente
function verComprobante(urlComprobante) {
    // Crear modal de comprobante si no existe
    let modalComprobante = document.getElementById('modalComprobante');
    if (!modalComprobante) {
        modalComprobante = document.createElement('div');
        modalComprobante.id = 'modalComprobante';
        modalComprobante.className = 'modal modal-comprobante';
        modalComprobante.innerHTML = `
            <div class="modal-content modal-comprobante-content">
                <div class="modal-header">
                    <h3>Comprobante de Pago</h3>
                    <button class="close-btn" onclick="cerrarModalComprobante()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body modal-comprobante-body">
                    <div class="comprobante-viewer">
                        <div class="loading-comprobante" id="loadingComprobante">
                            <div class="spinner"></div>
                            <p>Cargando comprobante...</p>
                        </div>
                        <img id="imagenComprobante" 
                             src="" 
                             alt="Comprobante de pago" 
                             style="display: none; max-width: 100%; max-height: 80vh; object-fit: contain; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);" 
                             onload="comprobantesCargado()" 
                             onerror="errorCargandoComprobante()">
                        <div id="errorComprobante" style="display: none; text-align: center; padding: 40px; color: #ef4444;">
                            <i class="fas fa-exclamation-triangle" style="font-size: 48px; margin-bottom: 20px;"></i>
                            <h4>Error al cargar el comprobante</h4>
                            <p>No se pudo cargar la imagen del comprobante.</p>
                            <button class="btn btn-outline" onclick="abrirComprobanteEnNuevaVentana('${urlComprobante}')">
                                <i class="fas fa-external-link-alt"></i> Abrir en nueva ventana
                            </button>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="descargarComprobante('${urlComprobante}')">
                        <i class="fas fa-download"></i> Descargar
                    </button>
                    <button class="btn btn-outline" onclick="abrirComprobanteEnNuevaVentana('${urlComprobante}')">
                        <i class="fas fa-external-link-alt"></i> Abrir en nueva ventana
                    </button>
                    <button class="btn btn-secondary" onclick="cerrarModalComprobante()">
                        Cerrar
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modalComprobante);
    }
    
    // Mostrar modal y cargar imagen
    const imagen = document.getElementById('imagenComprobante');
    const loading = document.getElementById('loadingComprobante');
    const error = document.getElementById('errorComprobante');
    
    // Resetear estado
    imagen.style.display = 'none';
    loading.style.display = 'block';
    error.style.display = 'none';
    
    // Cargar imagen
    imagen.src = urlComprobante;
    
    // Mostrar modal
    modalComprobante.classList.add('active');
    document.getElementById('modalOverlay').classList.add('active');
    document.body.style.overflow = 'hidden';
}

// Obtener nombre de banco por clave
function obtenerNombreBanco(claveBanco) {
    if (bancoDinero[claveBanco] && bancoDinero[claveBanco].nombre) {
        return bancoDinero[claveBanco].nombre;
    }
    return claveBanco.toUpperCase();
}

// Cerrar modal de historial
function cerrarModalHistorial() {
    document.getElementById('modalHistorialPagos').classList.remove('active');
    document.getElementById('modalOverlay').classList.remove('active');
    document.body.style.overflow = '';
}

// Funciones de carga
function mostrarCargandoPago(mensaje = 'Procesando...') {
    const loading = document.getElementById('loadingPago') || crearElementoCarga('loadingPago');
    loading.querySelector('.loading-text').textContent = mensaje;
    loading.style.display = 'flex';
}

function ocultarCargandoPago() {
    const loading = document.getElementById('loadingPago');
    if (loading) {
        loading.style.display = 'none';
    }
}

function mostrarCargandoBanco(mensaje = 'Procesando...') {
    const loading = document.getElementById('loadingBanco') || crearElementoCarga('loadingBanco');
    loading.querySelector('.loading-text').textContent = mensaje;
    loading.style.display = 'flex';
}

function ocultarCargandoBanco() {
    const loading = document.getElementById('loadingBanco');
    if (loading) {
        loading.style.display = 'none';
    }
}

function crearElementoCarga(id) {
    const loading = document.createElement('div');
    loading.id = id;
    loading.className = 'loading-overlay';
    loading.innerHTML = `
        <div class="loading-content">
            <div class="spinner"></div>
            <div class="loading-text">Procesando...</div>
        </div>
    `;
    document.body.appendChild(loading);
    return loading;
}

// Funciones auxiliares para el modal de comprobante
function comprobantesCargado() {
    document.getElementById('loadingComprobante').style.display = 'none';
    document.getElementById('imagenComprobante').style.display = 'block';
    document.getElementById('errorComprobante').style.display = 'none';
}

function errorCargandoComprobante() {
    document.getElementById('loadingComprobante').style.display = 'none';
    document.getElementById('imagenComprobante').style.display = 'none';
    document.getElementById('errorComprobante').style.display = 'block';
}

function cerrarModalComprobante() {
    const modal = document.getElementById('modalComprobante');
    if (modal) {
        modal.classList.remove('active');
        document.getElementById('modalOverlay').classList.remove('active');
        document.body.style.overflow = '';
    }
}

function abrirComprobanteEnNuevaVentana(url) {
    window.open(url, '_blank', 'width=800,height=600,scrollbars=yes,resizable=yes');
}

function descargarComprobante(url) {
    const link = document.createElement('a');
    link.href = url;
    link.download = `comprobante_${new Date().getTime()}.jpg`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Función de utilidad para actualizar horarios pagados manualmente
async function actualizarHorariosPagadosManualmente() {
    try {
        console.log('🚀 Iniciando actualización manual de horarios pagados...');
        
        // Obtener todos los pagos
        const pagos = await DB.obtenerHistorialPagos();
        console.log(`📋 Encontrados ${pagos.length} pagos completados`);
        
        let totalActualizados = 0;
        
        for (const pago of pagos) {
            if (pago.estado === 'completado' && pago.profesorId && pago.semana) {
                console.log(`💳 Procesando pago: ${pago.profesorNombre} - Semana: ${pago.semana}`);
                const horariosActualizados = await DB.actualizarHorariosPagadosPorSemana(pago.profesorId, pago.semana);
                totalActualizados += horariosActualizados;
                
                // Actualizar horarios locales si están disponibles
                if (typeof horarios !== 'undefined' && Array.isArray(horarios)) {
                    actualizarHorariosLocales(pago.profesorId, pago.semana);
                }
            }
        }
        
        console.log(`✅ Actualización completada. Total de horarios actualizados: ${totalActualizados}`);
        
        // Recargar vista de horarios si está disponible
        if (typeof inicializarDatos === 'function') {
            console.log('🔄 Recargando vista de horarios...');
            await inicializarDatos();
        }
        
        // Mostrar mensaje de éxito
        if (typeof mostrarMensaje === 'function') {
            mostrarMensaje(`Se actualizaron ${totalActualizados} horarios como pagados`, 'exito');
        }
        
        return totalActualizados;
    } catch (error) {
        console.error('❌ Error en actualización manual:', error);
        if (typeof mostrarMensaje === 'function') {
            mostrarMensaje('Error al actualizar horarios pagados: ' + error.message, 'error');
        }
        throw error;
    }
}

// Función auxiliar para actualizar horarios locales
function actualizarHorariosLocales(profesorId, semana) {
    try {
        // Obtener fechas de la semana
        const fechasSemana = DB.obtenerFechasDesdeFormatoSemana(semana);
        if (!fechasSemana) return;
        
        // Actualizar horarios locales que coincidan
        horarios.forEach(horario => {
            if (horario.usuarioId === profesorId) {
                let fechaHorario;
                if (horario.fecha && typeof horario.fecha === 'object' && horario.fecha.toDate) {
                    fechaHorario = horario.fecha.toDate();
                } else if (typeof horario.fecha === 'string') {
                    fechaHorario = new Date(horario.fecha);
                } else {
                    fechaHorario = horario.fecha;
                }
                
                if (fechaHorario) {
                    const fechaNormalizada = new Date(fechaHorario.getFullYear(), fechaHorario.getMonth(), fechaHorario.getDate());
                    const inicioNormalizado = new Date(fechasSemana.inicio.getFullYear(), fechasSemana.inicio.getMonth(), fechasSemana.inicio.getDate());
                    const finNormalizado = new Date(fechasSemana.fin.getFullYear(), fechasSemana.fin.getMonth(), fechasSemana.fin.getDate());
                    
                    if (fechaNormalizada >= inicioNormalizado && fechaNormalizada <= finNormalizado) {
                        horario.pagado = true;
                        console.log(`🔄 Actualizado localmente: ${horario.tema} - ${fechaHorario.toDateString()}`);
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error actualizando horarios locales:', error);
    }
}

// Exportar funciones para uso global
window.abrirModalPago = abrirModalPago;
window.cerrarModalPago = cerrarModalPago;
window.procesarPago = procesarPago;
window.manejarArchivoComprobante = manejarArchivoComprobante;
window.actualizarHorariosPagadosManualmente = actualizarHorariosPagadosManualmente;
window.abrirGestionBancoDinero = abrirGestionBancoDinero;
window.cerrarModalBancoDinero = cerrarModalBancoDinero;
window.guardarBancoDinero = guardarBancoDinero;
window.agregarNuevoBanco = agregarNuevoBanco;
window.eliminarBanco = eliminarBanco;
window.verHistorialPagos = verHistorialPagos;
window.cerrarModalHistorial = cerrarModalHistorial;
window.verComprobante = verComprobante;
window.cerrarModalComprobante = cerrarModalComprobante;
window.abrirComprobanteEnNuevaVentana = abrirComprobanteEnNuevaVentana;
window.descargarComprobante = descargarComprobante;
window.comprobantesCargado = comprobantesCargado;
window.errorCargandoComprobante = errorCargandoComprobante;
window.estaSemanasPagada = estaSemanasPagada;
window.obtenerInfoPagoSemana = obtenerInfoPagoSemana;
