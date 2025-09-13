// Configuración de Firebase
const firebaseConfig = {
    apiKey: "AIzaSyBT9be3hSPbknlMhqDhYW_c8NyEMR0d5tY",
    authDomain: "finanzas-sg.firebaseapp.com",
    projectId: "finanzas-sg",
    storageBucket: "finanzas-sg.firebasestorage.app",
    messagingSenderId: "253266937165",
    appId: "1:253266937165:web:eb4e069d12f2f2216f6304",
    measurementId: "G-BWCC648R8T"
};

// Variables globales de Firebase (se inicializarán cuando se cargue Firebase)
let app, db;

// Catálogos de datos
const CATALOGOS = {
    ocupaciones: [
        'JEFE DE AREA',
        'PROFESOR COMPLEMENTARIO'
    ],
    tiposBanco: [
        'NEQUI',
        'DAVIPLATA',
        'BANCOLOMBIA',
        'BANCO DE BOGOTÁ',
        'BANCO POPULAR',
        'BBVA COLOMBIA',
        'BANCO DAVIVIENDA',
        'BANCO CAJA SOCIAL',
        'BANCO AGRARIO',
        'BANCO AV VILLAS',
        'BANCO FALABELLA',
        'BANCO PICHINCHA',
        'SCOTIABANK COLPATRIA',
        'EFECTIVO',
        'OTRO'
    ],
    tiposId: [
        'CÉDULA DE CIUDADANÍA',
        'CÉDULA DE EXTRANJERÍA',
        'TARJETA DE IDENTIDAD',
        'PASAPORTE',
        'REGISTRO CIVIL'
    ],
    roles: [
        'PROFESOR',
        'ADMINISTRADOR',
        'SUPER USUARIO'
    ],
    materias: [
        'MTS', // Matemáticas
        'LC',  // Lectura y Comprensión
        'CS',  // Ciencias Sociales
        'ING', // Inglés
        'CN'   // Ciencias Naturales
    ]
};

// Cache local para mejorar rendimiento
let usuariosCache = [];

// Funciones de base de datos con Firebase
const DB = {
    // Crear usuario en Firestore
    crearUsuario: async function (datosUsuario) {
        try {
            const nuevoUsuario = {
                usuario: datosUsuario.usuario,
                contraseña: datosUsuario.contraseña,
                nombre: datosUsuario.nombre,
                ocupacionPre: datosUsuario.ocupacionPre,
                nombreQuienRecibe: datosUsuario.nombreQuienRecibe,
                tipoBanco: datosUsuario.tipoBanco,
                tipoId: datosUsuario.tipoId,
                numeroId: datosUsuario.numeroId,
                numeroCuenta: datosUsuario.numeroCuenta,
                nombreCuenta: datosUsuario.nombreCuenta,
                esProfesor: datosUsuario.esProfesor,
                materias: datosUsuario.materias || [],
                roles: datosUsuario.roles || [],
                fechaCreacion: new Date()
            };

            const docRef = await firebase.firestore().collection("usuarios").add(nuevoUsuario);
            nuevoUsuario.id = docRef.id;

            // Actualizar cache
            usuariosCache.push(nuevoUsuario);

            return nuevoUsuario;
        } catch (error) {
            console.error("Error creando usuario:", error);
            throw error;
        }
    },

    // Validar login
    validarLogin: async function (usuario, contraseña) {
        try {
            const querySnapshot = await firebase.firestore()
                .collection("usuarios")
                .where("usuario", "==", usuario)
                .where("contraseña", "==", contraseña)
                .get();

            if (!querySnapshot.empty) {
                const doc = querySnapshot.docs[0];
                return { id: doc.id, ...doc.data() };
            }

            return null;
        } catch (error) {
            console.error("Error validando login:", error);
            throw error;
        }
    },

    // Obtener todos los usuarios
    obtenerUsuarios: async function () {
        try {
            const querySnapshot = await firebase.firestore().collection("usuarios").get();
            const usuarios = [];

            querySnapshot.forEach((doc) => {
                usuarios.push({ id: doc.id, ...doc.data() });
            });

            usuariosCache = usuarios;
            return usuarios;
        } catch (error) {
            console.error("Error obteniendo usuarios:", error);
            throw error;
        }
    },

    // Verificar si usuario existe
    usuarioExiste: async function (nombreUsuario) {
        try {
            const querySnapshot = await firebase.firestore()
                .collection("usuarios")
                .where("usuario", "==", nombreUsuario)
                .get();

            return !querySnapshot.empty;
        } catch (error) {
            console.error("Error verificando usuario:", error);
            throw error;
        }
    },

    // Crear usuario administrador por defecto
    crearAdminPorDefecto: async function () {
        try {
            const adminExiste = await this.usuarioExiste('admin');

            if (!adminExiste) {
                const adminData = {
                    usuario: 'admin',
                    contraseña: 'admin123',
                    nombre: 'Administrador del Sistema',
                    ocupacionPre: 'JEFE DE AREA',
                    nombreQuienRecibe: 'ADMINISTRADOR GENERAL',
                    tipoBanco: 'BANCOLOMBIA',
                    tipoId: 'CÉDULA DE CIUDADANÍA',
                    numeroId: 'ADMIN123456789',
                    numeroCuenta: '1234567890123456',
                    nombreCuenta: 'ADMINISTRADOR DEL SISTEMA',
                    esProfesor: false,
                    materias: [],
                    roles: ['SUPER USUARIO', 'ADMINISTRADOR']
                };

                await this.crearUsuario(adminData);
                console.log('Usuario administrador creado');
            }
        } catch (error) {
            console.error("Error creando admin por defecto:", error);
        }
    },

    // FUNCIONES PARA HORARIOS
    // Crear horario en Firestore
    crearHorario: async function (datosHorario) {
        try {
            const nuevoHorario = {
                dia: datosHorario.dia,
                cantidadHoras: parseInt(datosHorario.cantidadHoras),
                tipologia: datosHorario.tipologia,
                unidad: datosHorario.unidad,
                tema: datosHorario.tema,
                tutor: datosHorario.tutor,
                fecha: datosHorario.fecha,
                materia: datosHorario.materia,
                pagado: datosHorario.pagado,
                usuarioId: datosHorario.usuarioId, // ID del usuario que creó el horario
                fechaCreacion: new Date(),
                fechaModificacion: new Date()
            };

            const docRef = await firebase.firestore().collection("horarios").add(nuevoHorario);
            nuevoHorario.id = docRef.id;

            return nuevoHorario;
        } catch (error) {
            console.error("Error creando horario:", error);
            throw error;
        }
    },

    // Obtener horarios del usuario
    obtenerHorarios: async function (usuarioId = null) {
        try {
            let query = firebase.firestore().collection("horarios");
            
            if (usuarioId) {
                query = query.where("usuarioId", "==", usuarioId);
            }

            const querySnapshot = await query.get();
            const horarios = [];

            querySnapshot.forEach((doc) => {
                const data = doc.data();
                // Convertir fechas de Firestore a formato string si es necesario
                if (data.fechaCreacion && data.fechaCreacion.toDate) {
                    data.fechaCreacion = data.fechaCreacion.toDate();
                }
                if (data.fechaModificacion && data.fechaModificacion.toDate) {
                    data.fechaModificacion = data.fechaModificacion.toDate();
                }
                horarios.push({ id: doc.id, ...data });
            });

            // Ordenar por fecha en el cliente
            horarios.sort((a, b) => {
                const fechaA = new Date(a.fecha);
                const fechaB = new Date(b.fecha);
                return fechaA - fechaB;
            });

            console.log('Horarios obtenidos:', horarios);
            return horarios;
        } catch (error) {
            console.error("Error obteniendo horarios:", error);
            throw error;
        }
    },

    // Actualizar horario
    actualizarHorario: async function (horarioId, datosActualizados) {
        try {
            const datosParaActualizar = {
                ...datosActualizados,
                fechaModificacion: new Date()
            };

            await firebase.firestore()
                .collection("horarios")
                .doc(horarioId)
                .update(datosParaActualizar);

            return true;
        } catch (error) {
            console.error("Error actualizando horario:", error);
            throw error;
        }
    },

    // Eliminar horario
    eliminarHorario: async function (horarioId) {
        try {
            await firebase.firestore()
                .collection("horarios")
                .doc(horarioId)
                .delete();

            return true;
        } catch (error) {
            console.error("Error eliminando horario:", error);
            throw error;
        }
    },

    // Obtener horarios por materia
    obtenerHorariosPorMateria: async function (materia, usuarioId = null) {
        try {
            let query = firebase.firestore()
                .collection("horarios")
                .where("materia", "==", materia);
            
            if (usuarioId) {
                query = query.where("usuarioId", "==", usuarioId);
            }

            const querySnapshot = await query.get();
            const horarios = [];

            querySnapshot.forEach((doc) => {
                const data = doc.data();
                // Convertir fechas si es necesario
                if (data.fechaCreacion && data.fechaCreacion.toDate) {
                    data.fechaCreacion = data.fechaCreacion.toDate();
                }
                if (data.fechaModificacion && data.fechaModificacion.toDate) {
                    data.fechaModificacion = data.fechaModificacion.toDate();
                }
                horarios.push({ id: doc.id, ...data });
            });

            // Ordenar por fecha en el cliente
            horarios.sort((a, b) => {
                const fechaA = new Date(a.fecha);
                const fechaB = new Date(b.fecha);
                return fechaA - fechaB;
            });

            return horarios;
        } catch (error) {
            console.error("Error obteniendo horarios por materia:", error);
            throw error;
        }
    },

    // Obtener horarios por rango de fechas
    obtenerHorariosPorFecha: async function (fechaInicio, fechaFin, usuarioId = null) {
        try {
            let query = firebase.firestore()
                .collection("horarios")
                .where("fecha", ">=", fechaInicio)
                .where("fecha", "<=", fechaFin);
            
            if (usuarioId) {
                query = query.where("usuarioId", "==", usuarioId);
            }

            const querySnapshot = await query.get();
            const horarios = [];

            querySnapshot.forEach((doc) => {
                const data = doc.data();
                // Convertir fechas si es necesario
                if (data.fechaCreacion && data.fechaCreacion.toDate) {
                    data.fechaCreacion = data.fechaCreacion.toDate();
                }
                if (data.fechaModificacion && data.fechaModificacion.toDate) {
                    data.fechaModificacion = data.fechaModificacion.toDate();
                }
                horarios.push({ id: doc.id, ...data });
            });

            // Ordenar por fecha en el cliente
            horarios.sort((a, b) => {
                const fechaA = new Date(a.fecha);
                const fechaB = new Date(b.fecha);
                return fechaA - fechaB;
            });

            return horarios;
        } catch (error) {
            console.error("Error obteniendo horarios por fecha:", error);
            throw error;
        }
    },

    // Obtener maestros por materia
    obtenerMaestrosPorMateria: async function (codigoMateria) {
        try {
            // Primero obtener todos los profesores
            const querySnapshot = await firebase.firestore()
                .collection("usuarios")
                .where("roles", "array-contains", "PROFESOR")
                .get();

            const maestros = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                // Filtrar por materia en el cliente
                if (data.materias && data.materias.includes(codigoMateria)) {
                    maestros.push({ 
                        id: doc.id, 
                        nombre: data.nombre,
                        usuario: data.usuario,
                        materias: data.materias || []
                    });
                }
            });

            return maestros;
        } catch (error) {
            console.error("Error obteniendo maestros por materia:", error);
            throw error;
        }
    },

    // Obtener todos los maestros
    obtenerTodosLosMaestros: async function () {
        try {
            const querySnapshot = await firebase.firestore()
                .collection("usuarios")
                .where("roles", "array-contains", "PROFESOR")
                .get();

            const maestros = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                maestros.push({ 
                    id: doc.id, 
                    nombre: data.nombre,
                    usuario: data.usuario,
                    materias: data.materias || []
                });
            });

            return maestros;
        } catch (error) {
            console.error("Error obteniendo todos los maestros:", error);
            throw error;
        }
    },

    // FUNCIONES PARA CUENTAS POR PAGAR
    // Obtener datos de profesores con sus clases dadas para cuentas por pagar
    obtenerDatosProfesoresParaCuentas: async function () {
        try {
            // Obtener todos los profesores
            const profesoresQuery = await firebase.firestore()
                .collection("usuarios")
                .where("roles", "array-contains", "PROFESOR")
                .get();

            const datosProfesores = [];

            for (const docProfesor of profesoresQuery.docs) {
                const profesor = { id: docProfesor.id, ...docProfesor.data() };
                
                // Obtener horarios/clases dadas del profesor
                const horariosQuery = await firebase.firestore()
                    .collection("horarios")
                    .where("usuarioId", "==", profesor.id)
                    .where("dioClase", "==", true)
                    .get();

                const clasesDadas = [];
                const semanasPorMateria = {};

                horariosQuery.forEach((docHorario) => {
                    const horario = docHorario.data();
                    const fecha = new Date(horario.fecha);
                    const numeroSemana = this.obtenerNumeroSemana(fecha);
                    const año = fecha.getFullYear();
                    const claveSemanaMes = `S${numeroSemana}-${fecha.getMonth() + 1}/${año}`;
                    
                    clasesDadas.push({
                        ...horario,
                        id: docHorario.id,
                        fecha: fecha,
                        numeroSemana,
                        año,
                        claveSemanaMes
                    });

                    // Agrupar por materia y semana
                    if (!semanasPorMateria[horario.materia]) {
                        semanasPorMateria[horario.materia] = {};
                    }
                    if (!semanasPorMateria[horario.materia][claveSemanaMes]) {
                        semanasPorMateria[horario.materia][claveSemanaMes] = {
                            totalHoras: 0,
                            clases: [],
                            fechaInicio: fecha,
                            fechaFin: fecha
                        };
                    }
                    
                    semanasPorMateria[horario.materia][claveSemanaMes].totalHoras += horario.cantidadHoras;
                    semanasPorMateria[horario.materia][claveSemanaMes].clases.push(horario);
                    
                    // Actualizar rango de fechas de la semana
                    if (fecha < semanasPorMateria[horario.materia][claveSemanaMes].fechaInicio) {
                        semanasPorMateria[horario.materia][claveSemanaMes].fechaInicio = fecha;
                    }
                    if (fecha > semanasPorMateria[horario.materia][claveSemanaMes].fechaFin) {
                        semanasPorMateria[horario.materia][claveSemanaMes].fechaFin = fecha;
                    }
                });

                // Solo incluir profesores que tienen clases dadas
                if (clasesDadas.length > 0) {
                    datosProfesores.push({
                        id: profesor.id,
                        nombre: profesor.nombre,
                        ocupacionPre: profesor.ocupacionPre,
                        nombreQuienRecibe: profesor.nombreQuienRecibe,
                        tipoBanco: profesor.tipoBanco,
                        tipoId: profesor.tipoId,
                        numeroId: profesor.numeroId,
                        numeroCuenta: profesor.numeroCuenta,
                        nombreCuenta: profesor.nombreCuenta,
                        materias: profesor.materias || [],
                        clasesDadas,
                        semanasPorMateria,
                        totalClasesDadas: clasesDadas.length
                    });
                }
            }

            console.log('Datos de profesores para cuentas obtenidos:', datosProfesores);
            return datosProfesores;
        } catch (error) {
            console.error("Error obteniendo datos de profesores para cuentas:", error);
            throw error;
        }
    },

    // Función auxiliar para obtener número de semana
    obtenerNumeroSemana: function(fecha) {
        const primerDiaAño = new Date(fecha.getFullYear(), 0, 1);
        const diasTranscurridos = Math.floor((fecha - primerDiaAño) / (24 * 60 * 60 * 1000));
        return Math.ceil((diasTranscurridos + primerDiaAño.getDay() + 1) / 7);
    },

    // Obtener todas las semanas únicas donde se dieron clases
    obtenerSemanasUnicasClases: async function () {
        try {
            const querySnapshot = await firebase.firestore()
                .collection("horarios")
                .where("dioClase", "==", true)
                .get();

            const semanasUnicas = new Set();
            
            querySnapshot.forEach((doc) => {
                const horario = doc.data();
                const fecha = new Date(horario.fecha);
                const numeroSemana = this.obtenerNumeroSemana(fecha);
                const año = fecha.getFullYear();
                const mes = fecha.getMonth() + 1;
                const claveSemanaMes = `S${numeroSemana}-${mes}/${año}`;
                semanasUnicas.add(claveSemanaMes);
            });

            return Array.from(semanasUnicas).sort();
        } catch (error) {
            console.error("Error obteniendo semanas únicas:", error);
            throw error;
        }
    },

    // Crear cuenta por pagar en Firestore (actualizada para trabajar con datos de profesores)
    crearCuentaPorPagar: async function (datosCuenta) {
        try {
            const nuevaCuenta = {
                profesorId: datosCuenta.profesorId,
                ocupacionPre: datosCuenta.ocupacionPre,
                asignatura: datosCuenta.asignatura,
                nombreQuienRecibe: datosCuenta.nombreQuienRecibe,
                tipoBanco: datosCuenta.tipoBanco,
                tipoId: datosCuenta.tipoId,
                numeroId: datosCuenta.numeroId,
                numeroCuenta: datosCuenta.numeroCuenta,
                nombreCuenta: datosCuenta.nombreCuenta,
                montosPorSemana: datosCuenta.montosPorSemana || {}, // Objeto con clave semana y valor monto
                estado: datosCuenta.estado || 'pendiente',
                fechaVencimiento: datosCuenta.fechaVencimiento || null,
                observaciones: datosCuenta.observaciones || '',
                usuarioCreador: datosCuenta.usuarioCreador,
                fechaCreacion: new Date(),
                fechaModificacion: new Date()
            };

            const docRef = await firebase.firestore().collection("cuentas_por_pagar").add(nuevaCuenta);
            nuevaCuenta.id = docRef.id;

            return nuevaCuenta;
        } catch (error) {
            console.error("Error creando cuenta por pagar:", error);
            throw error;
        }
    },

    // Obtener todas las cuentas por pagar
    obtenerCuentasPorPagar: async function () {
        try {
            const querySnapshot = await firebase.firestore()
                .collection("cuentas_por_pagar")
                .orderBy("fechaCreacion", "desc")
                .get();

            const cuentas = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                // Convertir fechas de Firestore a formato Date si es necesario
                if (data.fechaCreacion && data.fechaCreacion.toDate) {
                    data.fechaCreacion = data.fechaCreacion.toDate();
                }
                if (data.fechaModificacion && data.fechaModificacion.toDate) {
                    data.fechaModificacion = data.fechaModificacion.toDate();
                }
                cuentas.push({ id: doc.id, ...data });
            });

            console.log('Cuentas por pagar obtenidas:', cuentas);
            return cuentas;
        } catch (error) {
            console.error("Error obteniendo cuentas por pagar:", error);
            throw error;
        }
    },

    // Actualizar cuenta por pagar
    actualizarCuentaPorPagar: async function (cuentaId, datosActualizados) {
        try {
            const datosParaActualizar = {
                ...datosActualizados,
                fechaModificacion: new Date()
            };

            await firebase.firestore()
                .collection("cuentas_por_pagar")
                .doc(cuentaId)
                .update(datosParaActualizar);

            return true;
        } catch (error) {
            console.error("Error actualizando cuenta por pagar:", error);
            throw error;
        }
    },

    // Eliminar cuenta por pagar
    eliminarCuentaPorPagar: async function (cuentaId) {
        try {
            await firebase.firestore()
                .collection("cuentas_por_pagar")
                .doc(cuentaId)
                .delete();

            return true;
        } catch (error) {
            console.error("Error eliminando cuenta por pagar:", error);
            throw error;
        }
    },

    // Obtener cuentas por pagar por estado
    obtenerCuentasPorEstado: async function (estado) {
        try {
            const querySnapshot = await firebase.firestore()
                .collection("cuentas_por_pagar")
                .where("estado", "==", estado)
                .get();

            const cuentas = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                // Convertir fechas si es necesario
                if (data.fechaCreacion && data.fechaCreacion.toDate) {
                    data.fechaCreacion = data.fechaCreacion.toDate();
                }
                if (data.fechaModificacion && data.fechaModificacion.toDate) {
                    data.fechaModificacion = data.fechaModificacion.toDate();
                }
                cuentas.push({ id: doc.id, ...data });
            });

            // Ordenar localmente por fecha de creación descendente
            cuentas.sort((a, b) => {
                const fechaA = a.fechaCreacion ? new Date(a.fechaCreacion) : new Date(0);
                const fechaB = b.fechaCreacion ? new Date(b.fechaCreacion) : new Date(0);
                return fechaB - fechaA;
            });

            return cuentas;
        } catch (error) {
            console.error("Error obteniendo cuentas por estado:", error);
            throw error;
        }
    },

    // Obtener cuentas por pagar por asignatura
    obtenerCuentasPorAsignatura: async function (asignatura) {
        try {
            const querySnapshot = await firebase.firestore()
                .collection("cuentas_por_pagar")
                .where("asignatura", "==", asignatura)
                .get();

            const cuentas = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                // Convertir fechas si es necesario
                if (data.fechaCreacion && data.fechaCreacion.toDate) {
                    data.fechaCreacion = data.fechaCreacion.toDate();
                }
                if (data.fechaModificacion && data.fechaModificacion.toDate) {
                    data.fechaModificacion = data.fechaModificacion.toDate();
                }
                cuentas.push({ id: doc.id, ...data });
            });

            // Ordenar localmente por fecha de creación descendente
            cuentas.sort((a, b) => {
                const fechaA = a.fechaCreacion ? new Date(a.fechaCreacion) : new Date(0);
                const fechaB = b.fechaCreacion ? new Date(b.fechaCreacion) : new Date(0);
                return fechaB - fechaA;
            });

            return cuentas;
        } catch (error) {
            console.error("Error obteniendo cuentas por asignatura:", error);
            throw error;
        }
    },

    // Obtener resumen de cuentas por pagar
    obtenerResumenCuentas: async function () {
        try {
            const querySnapshot = await firebase.firestore()
                .collection("cuentas_por_pagar")
                .get();

            let totalPendiente = 0;
            let totalPagado = 0;
            let totalVencido = 0;
            let cantidadPendiente = 0;
            let cantidadPagado = 0;
            let cantidadVencido = 0;

            querySnapshot.forEach((doc) => {
                const data = doc.data();
                const montoTotal = (data.montoS1 || 0) + (data.montoS2 || 0);
                
                switch (data.estado) {
                    case 'pendiente':
                        totalPendiente += montoTotal;
                        cantidadPendiente++;
                        break;
                    case 'pagado':
                        totalPagado += montoTotal;
                        cantidadPagado++;
                        break;
                    case 'vencido':
                        totalVencido += montoTotal;
                        cantidadVencido++;
                        break;
                }
            });

            return {
                totalPendiente,
                totalPagado,
                totalVencido,
                cantidadPendiente,
                cantidadPagado,
                cantidadVencido,
                totalGeneral: totalPendiente + totalPagado + totalVencido
            };
        } catch (error) {
            console.error("Error obteniendo resumen de cuentas:", error);
            throw error;
        }
    },

    // FUNCIONES PARA TARIFAS DE PROFESORES
    // Actualizar tarifa por hora de un profesor
    actualizarTarifaProfesor: async function (profesorId, tarifaPorHora) {
        try {
            await firebase.firestore()
                .collection("usuarios")
                .doc(profesorId)
                .update({
                    tarifaPorHora: parseFloat(tarifaPorHora),
                    fechaModificacionTarifa: new Date()
                });

            return true;
        } catch (error) {
            console.error("Error actualizando tarifa del profesor:", error);
            throw error;
        }
    },

    // Obtener tarifa de un profesor específico
    obtenerTarifaProfesor: async function (profesorId) {
        try {
            const doc = await firebase.firestore()
                .collection("usuarios")
                .doc(profesorId)
                .get();

            if (doc.exists) {
                const data = doc.data();
                return data.tarifaPorHora || 20000; // Tarifa por defecto si no tiene configurada
            }
            return 20000; // Tarifa por defecto
        } catch (error) {
            console.error("Error obteniendo tarifa del profesor:", error);
            return 20000; // Tarifa por defecto en caso de error
        }
    },

    // Obtener todas las tarifas de profesores
    obtenerTodasLasTarifas: async function () {
        try {
            const querySnapshot = await firebase.firestore()
                .collection("usuarios")
                .where("roles", "array-contains", "PROFESOR")
                .get();

            const tarifas = {};
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                tarifas[doc.id] = data.tarifaPorHora || 20000; // Tarifa por defecto
            });

            return tarifas;
        } catch (error) {
            console.error("Error obteniendo todas las tarifas:", error);
            throw error;
        }
    },

    // FUNCIONES PARA SISTEMA DE PAGOS
    // Obtener banco de dinero
    obtenerBancoDinero: async function () {
        try {
            const doc = await firebase.firestore()
                .collection("sistema")
                .doc("banco_dinero")
                .get();

            if (doc.exists) {
                const data = doc.data();
                console.log('Datos del banco obtenidos de Firebase:', data);
                return data;
            }
            
            // Si no existe, crear con valores por defecto
            console.log('No existe documento de banco, creando estructura inicial');
            const bancoPorDefecto = {
                fechaCreacion: new Date(),
                fechaModificacion: new Date(),
                // Agregar algunos bancos por defecto con saldo 0
                'nequi': { nombre: 'NEQUI', saldo: 0 },
                'daviplata': { nombre: 'DAVIPLATA', saldo: 0 },
                'bancolombia': { nombre: 'BANCOLOMBIA', saldo: 0 },
                'efectivo': { nombre: 'EFECTIVO', saldo: 0 }
            };
            
            await this.actualizarBancoDinero(bancoPorDefecto);
            return bancoPorDefecto;
        } catch (error) {
            console.error("Error obteniendo banco de dinero:", error);
            throw error;
        }
    },

    // Actualizar banco de dinero
    actualizarBancoDinero: async function (datosBanco) {
        try {
            const datosParaActualizar = {
                ...datosBanco,
                fechaModificacion: new Date()
            };

            await firebase.firestore()
                .collection("sistema")
                .doc("banco_dinero")
                .set(datosParaActualizar, { merge: true });

            return true;
        } catch (error) {
            console.error("Error actualizando banco de dinero:", error);
            throw error;
        }
    },

    // Registrar pago
    registrarPago: async function (datosPago) {
        try {
            const nuevoPago = {
                ...datosPago,
                fechaCreacion: new Date(),
                fechaModificacion: new Date()
            };

            const docRef = await firebase.firestore().collection("pagos").add(nuevoPago);
            nuevoPago.id = docRef.id;

            return nuevoPago;
        } catch (error) {
            console.error("Error registrando pago:", error);
            throw error;
        }
    },

    // Obtener historial de pagos
    obtenerHistorialPagos: async function (usuarioId = null) {
        try {
            let query = firebase.firestore()
                .collection("pagos")
                .orderBy("fechaPago", "desc");
            
            if (usuarioId) {
                query = query.where("usuarioQuePago", "==", usuarioId);
            }

            const querySnapshot = await query.get();
            const pagos = [];

            querySnapshot.forEach((doc) => {
                const data = doc.data();
                // Convertir fechas de Firestore a formato Date si es necesario
                if (data.fechaPago && data.fechaPago.toDate) {
                    data.fechaPago = data.fechaPago.toDate();
                }
                if (data.fechaCreacion && data.fechaCreacion.toDate) {
                    data.fechaCreacion = data.fechaCreacion.toDate();
                }
                if (data.fechaModificacion && data.fechaModificacion.toDate) {
                    data.fechaModificacion = data.fechaModificacion.toDate();
                }
                pagos.push({ id: doc.id, ...data });
            });

            return pagos;
        } catch (error) {
            console.error("Error obteniendo historial de pagos:", error);
            throw error;
        }
    },

    // Actualizar estado de pago de horarios por semana
    actualizarHorariosPagadosPorSemana: async function (profesorId, semana) {
        try {
            console.log(`Actualizando horarios pagados para profesor ${profesorId}, semana ${semana}`);
            
            // Obtener fechas de la semana basándose en el formato usado en los pagos
            const fechasSemana = this.obtenerFechasDesdeFormatoSemana(semana);
            
            if (!fechasSemana) {
                console.error(`No se pudieron obtener las fechas para la semana: ${semana}`);
                return 0;
            }
            
            // Crear consulta para obtener horarios del profesor en esa semana
            const querySnapshot = await firebase.firestore()
                .collection("horarios")
                .where("usuarioId", "==", profesorId)
                .get();
            
            const batch = firebase.firestore().batch();
            let horariosActualizados = 0;
            
            querySnapshot.forEach((doc) => {
                const horario = doc.data();
                let fechaHorario;
                
                // Manejar diferentes formatos de fecha
                if (horario.fecha && typeof horario.fecha === 'object' && horario.fecha.toDate) {
                    fechaHorario = horario.fecha.toDate();
                } else if (typeof horario.fecha === 'string') {
                    // Evitar problemas de zona horaria: fijar mediodía local
                    fechaHorario = new Date(horario.fecha + 'T12:00:00');
                } else {
                    fechaHorario = horario.fecha;
                }
                
                // Verificar si el horario está en la semana pagada
                if (fechaHorario) {
                    // Normalizar fechas para comparación (solo fecha, sin hora)
                    const fechaNormalizada = new Date(fechaHorario.getFullYear(), fechaHorario.getMonth(), fechaHorario.getDate());
                    const inicioNormalizado = new Date(fechasSemana.inicio.getFullYear(), fechasSemana.inicio.getMonth(), fechasSemana.inicio.getDate());
                    const finNormalizado = new Date(fechasSemana.fin.getFullYear(), fechasSemana.fin.getMonth(), fechasSemana.fin.getDate());
                    
                    if (fechaNormalizada >= inicioNormalizado && fechaNormalizada <= finNormalizado) {
                        console.log(`✅ Marcando como pagado horario: ${doc.id} - ${horario.tema} - Fecha: ${fechaHorario.toDateString()}`);
                        console.log(`   Rango semana: ${inicioNormalizado.toDateString()} - ${finNormalizado.toDateString()}`);
                        batch.update(doc.ref, { pagado: true });
                        horariosActualizados++;
                    } else {
                        console.log(`❌ Horario NO está en la semana: ${doc.id} - ${horario.tema} - Fecha: ${fechaHorario.toDateString()}`);
                        console.log(`   Rango semana: ${inicioNormalizado.toDateString()} - ${finNormalizado.toDateString()}`);
                    }
                } else {
                    console.log(`⚠️ Horario sin fecha: ${doc.id} - ${horario.tema}`);
                }
            });
            
            if (horariosActualizados > 0) {
                await batch.commit();
                console.log(`${horariosActualizados} horarios actualizados como pagados`);
            } else {
                console.log('No se encontraron horarios para actualizar en la semana especificada');
            }
            
            return horariosActualizados;
        } catch (error) {
            console.error("Error actualizando horarios pagados:", error);
            throw error;
        }
    },

    // Función auxiliar para obtener fechas desde formato de semana como "8/14 SEPTIEMBRE"
    obtenerFechasDesdeFormatoSemana: function(semana) {
        try {
            console.log(`Parseando formato de semana: ${semana}`);
            
            // Mapeo de nombres de meses en español a números
            const meses = {
                'ENERO': 0, 'FEBRERO': 1, 'MARZO': 2, 'ABRIL': 3, 'MAYO': 4, 'JUNIO': 5,
                'JULIO': 6, 'AGOSTO': 7, 'SEPTIEMBRE': 8, 'OCTUBRE': 9, 'NOVIEMBRE': 10, 'DICIEMBRE': 11
            };
            
            // Patrón para formato "8/14 SEPTIEMBRE" o "28/4 ABRIL A MAYO"
            const patron1 = /(\d+)\/(\d+)\s+([A-ZÁÉÍÓÚ]+)/;
            const patron2 = /(\d+)\/(\d+)\s+([A-ZÁÉÍÓÚ]+)\s+A\s+([A-ZÁÉÍÓÚ]+)/;
            
            let match = semana.match(patron2); // Primero intentar patrón con dos meses
            let inicioSemana, finSemana;
            const añoActual = new Date().getFullYear();
            
            if (match) {
                // Formato "28/4 ABRIL A MAYO"
                const diaInicio = parseInt(match[1]);
                const diaFin = parseInt(match[2]);
                const mesInicio = meses[match[3].toUpperCase()];
                const mesFin = meses[match[4].toUpperCase()];
                
                if (mesInicio !== undefined && mesFin !== undefined) {
                    inicioSemana = new Date(añoActual, mesInicio, diaInicio);
                    finSemana = new Date(añoActual, mesFin, diaFin);
                }
            } else {
                match = semana.match(patron1);
                if (match) {
                    // Formato "8/14 SEPTIEMBRE"
                    const diaInicio = parseInt(match[1]);
                    const diaFin = parseInt(match[2]);
                    const mes = meses[match[3].toUpperCase()];
                    
                    if (mes !== undefined) {
                        inicioSemana = new Date(añoActual, mes, diaInicio);
                        finSemana = new Date(añoActual, mes, diaFin);
                    }
                }
            }
            
            if (inicioSemana && finSemana) {
                console.log(`Fechas parseadas: ${inicioSemana.toDateString()} - ${finSemana.toDateString()}`);
                return {
                    inicio: inicioSemana,
                    fin: finSemana
                };
            }
            
            console.error(`No se pudo parsear el formato de semana: ${semana}`);
            return null;
        } catch (error) {
            console.error(`Error parseando formato de semana: ${semana}`, error);
            return null;
        }
    },

    // Función auxiliar para obtener fechas de inicio y fin de una semana (método legacy)
    obtenerFechasSemana: function(numeroSemana, año) {
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
    },

    // Obtener pagos por profesor
    obtenerPagosPorProfesor: async function (profesorId) {
        try {
            const querySnapshot = await firebase.firestore()
                .collection("pagos")
                .where("profesorId", "==", profesorId)
                .get();

            const pagos = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                if (data.fechaPago && data.fechaPago.toDate) {
                    data.fechaPago = data.fechaPago.toDate();
                }
                pagos.push({ id: doc.id, ...data });
            });

            // Ordenar localmente por fecha de pago descendente
            pagos.sort((a, b) => {
                const fechaA = a.fechaPago ? new Date(a.fechaPago) : new Date(0);
                const fechaB = b.fechaPago ? new Date(b.fechaPago) : new Date(0);
                return fechaB - fechaA;
            });

            return pagos;
        } catch (error) {
            console.error("Error obteniendo pagos por profesor:", error);
            throw error;
        }
    },

    // Actualizar estado de pago
    actualizarEstadoPago: async function (pagoId, nuevoEstado) {
        try {
            await firebase.firestore()
                .collection("pagos")
                .doc(pagoId)
                .update({
                    estado: nuevoEstado,
                    fechaModificacion: new Date()
                });

            return true;
        } catch (error) {
            console.error("Error actualizando estado de pago:", error);
            throw error;
        }
    },

    // FUNCIONES PARA GESTIÓN DE INGRESOS
    // Crear ingreso (compatible con gestion-ingresos.js)
    crearIngreso: async function (datosIngreso) {
        try {
            const nuevoIngreso = {
                banco: datosIngreso.banco,
                monto: parseFloat(datosIngreso.monto),
                descripcion: datosIngreso.descripcion || '',
                tipoIngreso: datosIngreso.tipoIngreso || 'manual',
                categoria: datosIngreso.categoria || 'general',
                comprobante: datosIngreso.comprobante || null,
                usuarioCreador: datosIngreso.usuarioCreador,
                fecha: datosIngreso.fecha || new Date().toISOString(),
                fechaCreacion: new Date(),
                fechaModificacion: new Date(),
                estado: 'completado'
            };

            const docRef = await firebase.firestore().collection("ingresos").add(nuevoIngreso);
            nuevoIngreso.id = docRef.id;

            return nuevoIngreso;
        } catch (error) {
            console.error("Error creando ingreso:", error);
            throw error;
        }
    },

    // Registrar ingreso (método legacy)
    registrarIngreso: async function (datosIngreso) {
        try {
            const nuevoIngreso = {
                bancoDestino: datosIngreso.bancoDestino,
                monto: parseFloat(datosIngreso.monto),
                descripcion: datosIngreso.descripcion || '',
                tipoIngreso: datosIngreso.tipoIngreso || 'manual',
                categoria: datosIngreso.categoria || 'general',
                comprobante: datosIngreso.comprobante || null,
                usuarioRegistra: datosIngreso.usuarioRegistra,
                nombreUsuarioRegistra: datosIngreso.nombreUsuarioRegistra,
                fechaIngreso: new Date(datosIngreso.fechaIngreso || Date.now()),
                fechaCreacion: new Date(),
                fechaModificacion: new Date(),
                estado: 'completado'
            };

            const docRef = await firebase.firestore().collection("ingresos").add(nuevoIngreso);
            nuevoIngreso.id = docRef.id;

            return nuevoIngreso;
        } catch (error) {
            console.error("Error registrando ingreso:", error);
            throw error;
        }
    },

    // Obtener ingresos (compatible con gestion-ingresos.js)
    obtenerIngresos: async function (filtros = {}) {
        try {
            let query = firebase.firestore()
                .collection("ingresos")
                .orderBy("fecha", "desc");
            
            const querySnapshot = await query.get();
            const ingresos = [];

            querySnapshot.forEach((doc) => {
                const data = doc.data();
                // Convertir fechas de Firestore a formato Date si es necesario
                if (data.fecha && data.fecha.toDate) {
                    data.fecha = data.fecha.toDate().toISOString();
                }
                if (data.fechaCreacion && data.fechaCreacion.toDate) {
                    data.fechaCreacion = data.fechaCreacion.toDate();
                }
                if (data.fechaModificacion && data.fechaModificacion.toDate) {
                    data.fechaModificacion = data.fechaModificacion.toDate();
                }
                ingresos.push({ id: doc.id, ...data });
            });

            return ingresos;
        } catch (error) {
            console.error("Error obteniendo ingresos:", error);
            throw error;
        }
    },

    // Obtener historial de ingresos (método legacy)
    obtenerHistorialIngresos: async function (filtros = {}) {
        try {
            let query = firebase.firestore()
                .collection("ingresos")
                .orderBy("fechaIngreso", "desc");
            
            // Aplicar filtros si existen
            if (filtros.bancoDestino) {
                query = query.where("bancoDestino", "==", filtros.bancoDestino);
            }
            
            if (filtros.fechaInicio && filtros.fechaFin) {
                query = query.where("fechaIngreso", ">=", new Date(filtros.fechaInicio))
                           .where("fechaIngreso", "<=", new Date(filtros.fechaFin));
            }

            const querySnapshot = await query.get();
            const ingresos = [];

            querySnapshot.forEach((doc) => {
                const data = doc.data();
                // Convertir fechas de Firestore a formato Date si es necesario
                if (data.fechaIngreso && data.fechaIngreso.toDate) {
                    data.fechaIngreso = data.fechaIngreso.toDate();
                }
                if (data.fechaCreacion && data.fechaCreacion.toDate) {
                    data.fechaCreacion = data.fechaCreacion.toDate();
                }
                if (data.fechaModificacion && data.fechaModificacion.toDate) {
                    data.fechaModificacion = data.fechaModificacion.toDate();
                }
                ingresos.push({ id: doc.id, ...data });
            });

            return ingresos;
        } catch (error) {
            console.error("Error obteniendo historial de ingresos:", error);
            throw error;
        }
    },

    // Obtener resumen de movimientos por banco
    obtenerResumenMovimientosBanco: async function (fechaInicio = null, fechaFin = null) {
        try {
            const resumen = {};

            // Obtener banco de dinero actual
            const bancoDinero = await this.obtenerBancoDinero();
            const { fechaCreacion, fechaModificacion, ...bancos } = bancoDinero;

            // Inicializar resumen para cada banco
            Object.keys(bancos).forEach(bancoClave => {
                const banco = bancos[bancoClave];
                resumen[bancoClave] = {
                    nombre: banco.nombre || bancoClave,
                    saldoActual: banco.saldo || 0,
                    totalIngresos: 0,
                    totalGastos: 0,
                    movimientoNeto: 0,
                    cantidadIngresos: 0,
                    cantidadGastos: 0,
                    ingresos: [],
                    gastos: []
                };
            });

            // Configurar consultas con filtros de fecha si se proporcionan
            let queryIngresos = firebase.firestore().collection("ingresos");
            let queryPagos = firebase.firestore().collection("pagos");

            if (fechaInicio && fechaFin) {
                const fechaInicioDate = new Date(fechaInicio);
                const fechaFinDate = new Date(fechaFin);
                
                queryIngresos = queryIngresos
                    .where("fechaIngreso", ">=", fechaInicioDate)
                    .where("fechaIngreso", "<=", fechaFinDate);
                    
                queryPagos = queryPagos
                    .where("fechaPago", ">=", fechaInicioDate)
                    .where("fechaPago", "<=", fechaFinDate);
            }

            // Obtener ingresos
            const ingresosSnapshot = await queryIngresos.get();
            ingresosSnapshot.forEach((doc) => {
                const ingreso = doc.data();
                const banco = ingreso.bancoDestino;
                
                if (resumen[banco]) {
                    resumen[banco].totalIngresos += ingreso.monto;
                    resumen[banco].cantidadIngresos++;
                    resumen[banco].ingresos.push({
                        id: doc.id,
                        ...ingreso,
                        fechaIngreso: ingreso.fechaIngreso && ingreso.fechaIngreso.toDate ? 
                            ingreso.fechaIngreso.toDate() : ingreso.fechaIngreso
                    });
                }
            });

            // Obtener gastos (pagos)
            const pagosSnapshot = await queryPagos.get();
            pagosSnapshot.forEach((doc) => {
                const pago = doc.data();
                const banco = pago.bancoOrigen;
                
                if (resumen[banco]) {
                    resumen[banco].totalGastos += pago.monto;
                    resumen[banco].cantidadGastos++;
                    resumen[banco].gastos.push({
                        id: doc.id,
                        ...pago,
                        fechaPago: pago.fechaPago && pago.fechaPago.toDate ? 
                            pago.fechaPago.toDate() : pago.fechaPago
                    });
                }
            });

            // Calcular movimiento neto para cada banco
            Object.keys(resumen).forEach(bancoClave => {
                resumen[bancoClave].movimientoNeto = 
                    resumen[bancoClave].totalIngresos - resumen[bancoClave].totalGastos;
            });

            return resumen;
        } catch (error) {
            console.error("Error obteniendo resumen de movimientos:", error);
            throw error;
        }
    },

    // Obtener estadísticas generales de ingresos y gastos
    obtenerEstadisticasGenerales: async function (fechaInicio = null, fechaFin = null) {
        try {
            const estadisticas = {
                totalIngresos: 0,
                totalGastos: 0,
                balanceNeto: 0,
                cantidadIngresos: 0,
                cantidadGastos: 0,
                promedioIngresosPorTransaccion: 0,
                promedioGastosPorTransaccion: 0
            };

            // Configurar consultas con filtros de fecha
            let queryIngresos = firebase.firestore().collection("ingresos");
            let queryPagos = firebase.firestore().collection("pagos");

            if (fechaInicio && fechaFin) {
                const fechaInicioDate = new Date(fechaInicio);
                const fechaFinDate = new Date(fechaFin);
                
                queryIngresos = queryIngresos
                    .where("fechaIngreso", ">=", fechaInicioDate)
                    .where("fechaIngreso", "<=", fechaFinDate);
                    
                queryPagos = queryPagos
                    .where("fechaPago", ">=", fechaInicioDate)
                    .where("fechaPago", "<=", fechaFinDate);
            }

            // Procesar ingresos
            const ingresosSnapshot = await queryIngresos.get();
            ingresosSnapshot.forEach((doc) => {
                const ingreso = doc.data();
                estadisticas.totalIngresos += ingreso.monto;
                estadisticas.cantidadIngresos++;
            });

            // Procesar gastos
            const pagosSnapshot = await queryPagos.get();
            pagosSnapshot.forEach((doc) => {
                const pago = doc.data();
                estadisticas.totalGastos += pago.monto;
                estadisticas.cantidadGastos++;
            });

            // Calcular estadísticas derivadas
            estadisticas.balanceNeto = estadisticas.totalIngresos - estadisticas.totalGastos;
            estadisticas.promedioIngresosPorTransaccion = 
                estadisticas.cantidadIngresos > 0 ? 
                estadisticas.totalIngresos / estadisticas.cantidadIngresos : 0;
            estadisticas.promedioGastosPorTransaccion = 
                estadisticas.cantidadGastos > 0 ? 
                estadisticas.totalGastos / estadisticas.cantidadGastos : 0;

            return estadisticas;
        } catch (error) {
            console.error("Error obteniendo estadísticas generales:", error);
            throw error;
        }
    },

    // Eliminar ingreso
    eliminarIngreso: async function (ingresoId) {
        try {
            await firebase.firestore()
                .collection("ingresos")
                .doc(ingresoId)
                .delete();

            return true;
        } catch (error) {
            console.error("Error eliminando ingreso:", error);
            throw error;
        }
    },

    // Actualizar ingreso
    actualizarIngreso: async function (ingresoId, datosActualizados) {
        try {
            const datosParaActualizar = {
                ...datosActualizados,
                fechaModificacion: new Date()
            };

            await firebase.firestore()
                .collection("ingresos")
                .doc(ingresoId)
                .update(datosParaActualizar);

            return true;
        } catch (error) {
            console.error("Error actualizando ingreso:", error);
            throw error;
        }
    },

    // Actualizar saldo de un banco específico
    actualizarSaldoBanco: async function (banco, nuevoSaldo) {
        try {
            const bancoDinero = await this.obtenerBancoDinero();
            bancoDinero[banco] = parseFloat(nuevoSaldo);
            
            await this.actualizarBancoDinero(bancoDinero);
            return true;
        } catch (error) {
            console.error("Error actualizando saldo del banco:", error);
            throw error;
        }
    },

    // FUNCIONES PARA GASTOS
    // Crear gasto
    crearGasto: async function (datosGasto) {
        try {
            const nuevoGasto = {
                banco: datosGasto.banco,
                monto: parseFloat(datosGasto.monto),
                descripcion: datosGasto.descripcion || '',
                tipoGasto: datosGasto.tipoGasto || 'manual',
                categoria: datosGasto.categoria || 'general',
                comprobante: datosGasto.comprobante || null,
                usuarioCreador: datosGasto.usuarioCreador,
                fecha: datosGasto.fecha || new Date().toISOString(),
                fechaCreacion: new Date(),
                fechaModificacion: new Date(),
                estado: 'completado'
            };

            const docRef = await firebase.firestore().collection("gastos").add(nuevoGasto);
            nuevoGasto.id = docRef.id;

            return nuevoGasto;
        } catch (error) {
            console.error("Error creando gasto:", error);
            throw error;
        }
    },

    // Obtener gastos
    obtenerGastos: async function (filtros = {}) {
        try {
            let query = firebase.firestore()
                .collection("gastos")
                .orderBy("fecha", "desc");
            
            const querySnapshot = await query.get();
            const gastos = [];

            querySnapshot.forEach((doc) => {
                const data = doc.data();
                // Convertir fechas de Firestore a formato Date si es necesario
                if (data.fecha && data.fecha.toDate) {
                    data.fecha = data.fecha.toDate().toISOString();
                }
                if (data.fechaCreacion && data.fechaCreacion.toDate) {
                    data.fechaCreacion = data.fechaCreacion.toDate();
                }
                if (data.fechaModificacion && data.fechaModificacion.toDate) {
                    data.fechaModificacion = data.fechaModificacion.toDate();
                }
                gastos.push({ id: doc.id, ...data });
            });

            return gastos;
        } catch (error) {
            console.error("Error obteniendo gastos:", error);
            throw error;
        }
    },

    // Eliminar gasto
    eliminarGasto: async function (gastoId) {
        try {
            await firebase.firestore()
                .collection("gastos")
                .doc(gastoId)
                .delete();

            return true;
        } catch (error) {
            console.error("Error eliminando gasto:", error);
            throw error;
        }
    },

    // Actualizar gasto
    actualizarGasto: async function (gastoId, datosActualizados) {
        try {
            const datosParaActualizar = {
                ...datosActualizados,
                fechaModificacion: new Date()
            };

            await firebase.firestore()
                .collection("gastos")
                .doc(gastoId)
                .update(datosParaActualizar);

            return true;
        } catch (error) {
            console.error("Error actualizando gasto:", error);
            throw error;
        }
    }
};

// Función para inicializar Firebase
function initializeFirebase() {
    try {
        app = firebase.initializeApp(firebaseConfig);
        console.log('Firebase inicializado correctamente');

        // Crear admin por defecto después de inicializar
        DB.crearAdminPorDefecto();
    } catch (error) {
        console.error('Error inicializando Firebase:', error);
    }
}

// Hacer disponibles globalmente
window.DB = DB;
window.CATALOGOS = CATALOGOS;
window.initializeFirebase = initializeFirebase;