// parqueo/js/utils.js
// Funciones compartidas entre módulos

window.generarMensajeDeudorWhatsApp = function(nombre, placa, cuota, periodicidad) {
    var hora = new Date().getHours();
    var saludo = '';
    
    if (hora >= 5 && hora < 12) {
        saludo = '☀️ Buenos días';
    } else if (hora >= 12 && hora < 18) {
        saludo = '🌤️ Buenas tardes';
    } else {
        saludo = '🌙 Buenas noches';
    }

    var cuotaFormateada = cuota ? new Intl.NumberFormat('es-CO', { 
        style: 'currency', 
        currency: 'COP', 
        minimumFractionDigits: 0 
    }).format(cuota) : '';
    
    var periodoTexto = periodicidad ? periodicidad.toLowerCase() : 'mensual';

    var mensaje = saludo + ', estimad@ ' + nombre + ' 🙏\n\n' +
        'Espero que se encuentre muy bien. Le escribo de parte del Parqueadero ELIMAR 🅿️ ' +
        'para hacerle un recordatorio amable sobre el servicio de parqueadero correspondiente a este mes.\n\n' +
        '📍 *Datos del servicio:*\n' +
        '🚗 Placa: ' + placa + '\n' +
        '📅 Periodo: ' + periodoTexto + '\n' +
        '💰 Valor: ' + cuotaFormateada + '\n\n' +
        'Queremos recordarle que por favor realice su pago a la mayor brevedad posible ' +
        'para mantener su servicio activo y sin inconvenientes 😊\n\n' +
        'Estamos muy agradecidos por su confianza y preferencia, es un placer atenderle todos los días. ' +
        'Si ya realizó su pago, por favor haga caso omiso a este mensaje.\n\n' +
        '📍 *Parqueadero ELIMAR*\n' +
        '📍 Cll 20 N° 4-81 Barrio San José\n' +
        '📍 Sahagún, Córdoba\n' +
        '📞 3206753900 - 3206641353\n' +
        '🕐 Abierto 24 horas\n\n' +
        '¡Muchas gracias por su comprensión y puntualidad! 🙌✨';

    return mensaje;
};

// Formatear moneda (reutilizable)
window.formatearMoneda = function(amount) {
    return new Intl.NumberFormat('es-CO', { 
        style: 'currency', 
        currency: 'COP', 
        minimumFractionDigits: 0 
    }).format(amount || 0);
};