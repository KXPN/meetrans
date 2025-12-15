'use strict';
class Meetrans {

  // Configuraciones
  // Tu nombre, para mostrar cuando hablas tú, es:
  nombre = '';
  // Sufijo del archivo generado
  sufijo = '';
  // Atajos para iniciar o detener la transcripción
  // Opciones: Alt, Ctrl, Shift, Tecla [Obligatoria]
  // Ejemplo: Ctrl+Shift+Q
  atajosPorAccion = {
    iniciar: 'Ctrl+Shift+Q',
    detener: 'Ctrl+Alt+Q',
  };
  // Transparencia de los subtítulos, debe ser un número natural en el rango
  // [0, 100]
  subtitulosTransparencia = 50;
  // Códigos de reuniones que se deben ignorar, separados por coma
  reunionesCodigosAIgnorar = '';

  // Estos valores tal vez se deben cambiar si Google cambia la interfaz
  botonActivoColor = 'rgb(138, 180, 248)';
  selectores = {
    imagenes: (
      '[data-priority][data-side] [tabindex][role=region] img[src^="https://"][data-iml][alt=""]:not([jsname],[jscontroller],[aria-hidden])'
    ),
    listaParticipante: (
      '[data-panel-container-id=sidePanel1] [data-participant-id]'
    ),
    listaParticipanteNombre: (
      '[data-panel-container-id=sidePanel1] [data-participant-id] span'
    ),
    participantesListaIcono: '[data-panel-id][data-promo-anchor-id] i',
    reunionNombre: '[data-meeting-title]',
    subtituloEstaPrendido: (
      '[data-is-auto-rejoin] [role=region] [role=button][data-tooltip-id][data-idom-class]:not([aria-expanded],[data-emoji],[data-promo-anchor-id],[disabled]) span[aria-hidden]'
    ),
    subtituloEstaPrendidoIcono: (
      '[data-is-auto-rejoin] [role=region] [role=button][data-tooltip-id][data-idom-class]:not([aria-expanded],[data-emoji],[data-promo-anchor-id],[disabled]) span[aria-hidden] i'
    ),
    xpath: {
      reunionBotonFinalizarIcono: '//i[text()="call_end"]',
      reunionNombre: (
        '//div[' +
          'text()="' + window.location.pathname.substring(1) +
        '"]'
      ),
    },
  };

  // De aquí para abajo no se debe configurar más
  archivoDescargado = false;
  dBotonCapturar;
  subtitulosIntervalo;
  mensajesIntervalo;
  intervencionesFragmentosPorHoraYPersona = {};
  participantesNombres = [];
  reunion = {
    codigo: '',
    fechaYHora: '',
    nombre: '',
  };
  ultimaHora = '';
  ultimaPersonaNombre = '';
  chatAbierto = false;
  personaMensajeSufijo = ' (Chat)';

  constructor({ opciones }) {
    if (opciones !== undefined) {
      this.nombre = (opciones.nombre || this.nombre);
      this.sufijo = (opciones.sufijo || this.sufijo);
      this.atajosPorAccion.iniciar = (
        opciones.atajosPorAccion.iniciar ||
        this.atajosPorAccion.iniciar
      );
      this.atajosPorAccion.finalizar = (
        opciones.atajosPorAccion.finalizar ||
        this.atajosPorAccion.finalizar
      );
      this.subtitulosTransparencia = (
        opciones.subtitulosTransparencia ||
        this.subtitulosTransparencia
      );
      this.reunionesCodigosAIgnorar = (
        opciones.reunionesCodigosAIgnorar ||
        this.reunionesCodigosAIgnorar
      );
    }
    const reunionCodigo = (
      document
      .location
      .pathname
      .match(/[a-z]{3}-[a-z]{4}-[a-z]{3}/)
      [0]
    );
    if (this.reunionesCodigosAIgnorar.split(',').includes(reunionCodigo)) {
      return;
    }
    this.reunion.codigo = reunionCodigo;
    this.inicializar();
  }

  inicializar = () => {
    const dSubtitulosBoton = (
      document.querySelector(this.selectores.subtituloEstaPrendido)
    );
    if (!dSubtitulosBoton) {
      setTimeout(this.inicializar.bind(this));
      return;
    }
    const dParticipantesListaIcono = (
      document.querySelector(this.selectores.participantesListaIcono)
    );
    if (!dParticipantesListaIcono) {
      setTimeout(this.inicializar.bind(this));
      return;
    }
    dParticipantesListaIcono.click();
    dParticipantesListaIcono.click();
    this.insertarBotonInicio();
  }

  insertarBotonInicio = () => {
    let dReunionNombre = document.querySelector(this.selectores.reunionNombre);
    if (!dReunionNombre) {
      dReunionNombre = (
        this
        .ejecutarXPath(this.selectores.xpath.reunionNombre)
        ?.parentElement
      );
    }
    if (!dReunionNombre) {
      setTimeout(this.insertarBotonInicio);
      return;
    }
    const dBotonCapturar = document.createElement('button');
    dBotonCapturar.innerText = 'Capturar transcripción';
    const botonInicioEstilos = dBotonCapturar.style;
    botonInicioEstilos.background = 'green';
    botonInicioEstilos.cursor = 'pointer';
    dBotonCapturar.addEventListener('click', this.capturar);
    dReunionNombre.parentElement.appendChild(dBotonCapturar);
    document.body.addEventListener('keydown', this.revisarAtajos);
    this.dBotonCapturar = dBotonCapturar;
  }

  revisarAtajos = (evento) => {
    for (let accion in this.atajosPorAccion) {
      const atajoTeclas = (
        this
        .atajosPorAccion
        [accion]
        .toLowerCase()
        .split(/\+/)
      );
      const teclasPresionadasPorTecla = {};
      if (evento.altKey) {
        teclasPresionadasPorTecla.alt = true;
      }
      if (evento.ctrlKey) {
        teclasPresionadasPorTecla.ctrl = true;
      }
      if (evento.shiftKey) {
        teclasPresionadasPorTecla.shift = true;
      }
      const tecla = evento.key.toLowerCase();
      if (teclasPresionadasPorTecla[tecla]) {
        continue;
      }
      teclasPresionadasPorTecla[tecla] = true;
      let atajoTeclasFueronPresionadas = true;
      for (let atajoTecla of atajoTeclas) {
        if (!teclasPresionadasPorTecla[atajoTecla]) {
          atajoTeclasFueronPresionadas = false;
          break;
        }
      }
      if (
        !atajoTeclasFueronPresionadas ||
        (atajoTeclas.length !== Object.keys(teclasPresionadasPorTecla).length)
      ) {
        continue;
      }
      if (accion === 'iniciar') {
        this.capturar();
      } else if (accion === 'detener') {
        this.detener();
      }
      return;
    }
  }

  detener = () => {
    this.cambiarSubtitulosBotonEstado(false);
  }

  cambiarSubtitulosBotonEstado = (debeEstarActivo) => {
    let dSubtituloEstaPrendido = (
      document.querySelector(this.selectores.subtituloEstaPrendidoIcono)
    );
    let dSubtitulosBoton = dSubtituloEstaPrendido?.parentElement?.parentElement;
    if (!dSubtitulosBoton) {
      const dSubtituloEstaPrendidoIcono = (
        document.querySelector(this.selectores.subtituloEstaPrendido)
      );
      dSubtitulosBoton = dSubtituloEstaPrendidoIcono.parentElement;
    }
    const subtitulosBotonFondoColor = (
      getComputedStyle(dSubtitulosBoton)
      .backgroundColor
    );
    const subtitulosBotonEstaActivo = (
      subtitulosBotonFondoColor ===
      this.botonActivoColor
    );
    if (
      (!subtitulosBotonEstaActivo && debeEstarActivo) ||
      (subtitulosBotonEstaActivo && !debeEstarActivo)
    ) {
      dSubtitulosBoton.click();
    }
  }

  ejecutarXPath = (xpath) => {
    return (
      document
      .evaluate(
        xpath,
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null,
      )
      .singleNodeValue
    );
  }

  capturar = () => {
    this.cambiarSubtitulosBotonEstado(true);
    if (this.reunion.fechaYHora) {
      return;
    }
    this.dBotonCapturar.remove();
    window.addEventListener('beforeunload', this.descargarArchivo);
    this.reunion.fechaYHora = this.obtenerFechaYHoraActualSinPuntuacion();
    const dListaParticipantes = (
      document.querySelectorAll(this.selectores.listaParticipante)
    );
    dListaParticipantes.forEach(this.agregarParticipante);
    const reunionNombre = (
      (
        document
        .querySelector(this.selectores.reunionNombre)
        ?.dataset
        ?.meetingTitle
      ) ||
      ''
    );
    const inicioMensaje = (
      'En ' +
      this.obtenerFechaActualSinPuntuacion() +
      ' ' +
      'inicia la transcripción de la reunión' +
      (reunionNombre ? (' "' + reunionNombre + '"') : '') +
      ' ' +
      'con código ' +
      '"' + this.reunion.codigo + '" ' +
      'con ' +
      this.participantesNombres.join(', ')
    );
    this.guardarSistemaIntervencion(inicioMensaje);
    this.reunion.nombre = reunionNombre;
    const dBotonColgar = (
      this
      .ejecutarXPath(this.selectores.xpath.reunionBotonFinalizarIcono)
      .parentElement
    );
    dBotonColgar.addEventListener('click', this.descargarArchivo);
    this.subtitulosIntervalo = setInterval(this.actualizar);
    this.mensajesIntervalo = setInterval(this.capturarMensajes);
  }

  actualizar = () => {
    const dImagenes = document.querySelectorAll(this.selectores.imagenes);
    dImagenes.forEach(this.actualizarIntervenciones);
  }

  actualizarIntervenciones = (dIntervencionImagen) => {
    if (!dIntervencionImagen.offsetHeight) {
      return;
    }
    dIntervencionImagen.parentElement.parentElement.style.opacity = (
      1 -
      (this.subtitulosTransparencia / 100)
    );
    let interaccionHora = dIntervencionImagen.hora;
    if (!interaccionHora) {
      interaccionHora = this.obtenerHoraActualConDosPuntos();
      dIntervencionImagen.hora = interaccionHora;
    }
    this.ultimaHora = interaccionHora;
    const dPersonaNombre = dIntervencionImagen.nextElementSibling;
    if (!dPersonaNombre) {
      return;
    }
    let ultimaPersonaNombre = dPersonaNombre.innerText.trim();
    ultimaPersonaNombre = this.reemplazarPronombre(ultimaPersonaNombre);
    this.ultimaPersonaNombre = ultimaPersonaNombre;
    const dIntervencionFragmentos = (
      dPersonaNombre
      .parentElement
      .parentElement
      .querySelectorAll('div:not(:has(div),:has(span))')
    );
    dIntervencionFragmentos.forEach(this.guardarIntervencionFragmento);
  }

  reemplazarPronombre = (personaNombre) => {
    if (!this.nombre) {
      return personaNombre;
    }
    return (
      personaNombre
      .replace(
        (
          document
          .querySelector(this.selectores.listaParticipanteNombre)
          .innerText
        ),
        this.nombre,
      )
    );
  }

  obtenerFechaYHoraActualSinPuntuacion = () => {
    const fechaSinPuntuacion = this.obtenerFechaActualSinPuntuacion();
    const horaActualSinPuntuacion = (
      this
      .obtenerHoraActualConDosPuntos()
      .replace(/:/g, '')
    );
    return (fechaSinPuntuacion + ' ' + horaActualSinPuntuacion);
  }

  obtenerFechaActualSinPuntuacion = () => {
    const fechaYHora = new Date();
    const ano = fechaYHora.getFullYear();
    const mes = this.ajustarADosDigitos(fechaYHora.getMonth() + 1);
    const dia = this.ajustarADosDigitos(fechaYHora.getDate());
    return (ano + mes + dia);
  }

  obtenerHoraActualConDosPuntos = () => {
    const fechaYHora = new Date();
    const horas = this.ajustarADosDigitos(fechaYHora.getHours());
    const minutos = this.ajustarADosDigitos(fechaYHora.getMinutes());
    const segundos = this.ajustarADosDigitos(fechaYHora.getSeconds());
    return (horas + ':' + minutos + ':' + segundos);
  }

  ajustarADosDigitos = (numero) => {
    return ('0' + numero).slice(-2);
  }

  marcarMensajesComoAgregados = () => {
    (
      document
      .querySelectorAll('[data-message-text]')
      .forEach((dMensaje) => {dMensaje.agregado = true})
    );
  }

  capturarMensajes = () => {
    if (document.querySelector('[data-panel-id="2"]').ariaPressed === 'true') {
      if (!this.chatAbierto) {
        this.marcarMensajesComoAgregados();
        this.chatAbierto = true;
      }

      (
        document
        .querySelectorAll('[data-message-text]')
        .forEach(this.guardarIntervencionMensaje)
      );
      return;
    }

    this.chatAbierto = false;
    (
      document
      .querySelectorAll('[data-key^="notification-"]')
      .forEach(this.guardarIntervencionNotificacion)
    );
  }

  guardarIntervencionMensaje = (dMensaje) => {
    if (dMensaje.agregado) {
      return;
    }
    dMensaje.agregado = true;
    this.ultimaHora = this.obtenerHoraActualConDosPuntos();
    this.ultimaPersonaNombre = (
      dMensaje.parentElement.parentElement.dataset.senderName +
      this.personaMensajeSufijo
    );
    this.guardarIntervencion(dMensaje.innerText);
  }

  guardarIntervencionNotificacion = (dNotificacion) => {
    if (dNotificacion.agregada) {
      return;
    }
    dNotificacion.agregada = true;
    const notificacionPartes = dNotificacion.innerText.split('\n');
    const notificacionTipo = notificacionPartes[0];
    if (notificacionTipo === 'domain_disabled') {
      return;
    }
    if (notificacionTipo !== 'chat') {
      this.guardarSistemaIntervencion(notificacionPartes[0]);
      return;
    }
    this.ultimaPersonaNombre = (
      notificacionPartes[1] +
      this.personaMensajeSufijo
    );
    this.guardarIntervencion(notificacionPartes.splice(2).join('\n'));
  }

  guardarIntervencionFragmento = (dIntervencionFragmento) => {
    const fragmentoNuevo = dIntervencionFragmento.innerText;
    let fragmentoId = dIntervencionFragmento.id;
    if (!fragmentoId) {
      fragmentoId = new Date().getTime();
      dIntervencionFragmento.id = fragmentoId;
    }

    this.guardarIntervencion(fragmentoNuevo, fragmentoId);
  }

  guardarIntervencion = (fragmentoNuevo, fragmentoId = '') => {
    const horaYPersona = (this.ultimaHora + ' ' + this.ultimaPersonaNombre);
    if (!fragmentoId) {
      fragmentoId = new Date().getTime();
    }
    if (!this.intervencionesFragmentosPorHoraYPersona[horaYPersona]) {
      this.intervencionesFragmentosPorHoraYPersona[horaYPersona] = {};
    }
    this.intervencionesFragmentosPorHoraYPersona[horaYPersona][fragmentoId] = (
      fragmentoNuevo
    );
  }

  guardarSistemaIntervencion = (fragmentoNuevo) => {
    this.ultimaHora = this.obtenerHoraActualConDosPuntos();
    this.ultimaPersonaNombre = 'Sistema';
    this.guardarIntervencion(fragmentoNuevo);
  }

  agregarParticipante = (dListaParticipante) => {
    const nombre = dListaParticipante.querySelector('span').textContent.trim();
    this.participantesNombres.push(nombre);
  }

  descargarArchivo = () => {
    if (this.archivoDescargado) {
      return;
    }
    let archivoContenido = '';
    for (let horaYPersona in this.intervencionesFragmentosPorHoraYPersona) {
      archivoContenido += (horaYPersona + ': ');
      const intervencionFragmentos = (
        this
        .intervencionesFragmentosPorHoraYPersona
        [horaYPersona]
      );
      for (const fragmentoId in intervencionFragmentos) {
        const intervencionFragmento = intervencionFragmentos[fragmentoId];
        archivoContenido += (intervencionFragmento + ' ');
      }
      archivoContenido = (archivoContenido.trim() + '\n\n');
    }
    if (!archivoContenido) {
      return;
    }
    archivoContenido = archivoContenido.replace(/ +/, ' ');
    const dDescargaEnlace = document.createElement('a');
    const archivoObjeto = new Blob([archivoContenido], {type: 'text/plain'})
    dDescargaEnlace.href = window.URL.createObjectURL(archivoObjeto);
    dDescargaEnlace.download = (
      this.reunion.fechaYHora +
      (
        this.reunion.nombre ?
        (' ' + this.reunion.nombre) :
        ''
      ) +
      this.sufijo +
      '.txt'
    );
    dDescargaEnlace.click();
    this.archivoDescargado = true;
  }

}

if (typeof browser === 'undefined') {
  var browser = chrome;
}
if (browser.storage) {
  browser.storage.sync.get('opciones', iniciarMeetrans);
} else {
  iniciarMeetrans({});
}

function iniciarMeetrans(opciones) {
  window.meetrans = new Meetrans(opciones);
}
