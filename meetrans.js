'use strict';
class Meetrans {

  // Configuraciones
  // Tu nombre, para mostrar cuando hablas tú, es:
  nombre = '';
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

  // Estos valores tal vez se deben cambiar si Google cambia la interfaz
  botonActivoColor = 'rgb(138, 180, 248)';
  selectores = {
    imagenes: (
      'img[src^="https://"][data-iml][alt=""]:not([jsname]):not([jscontroller])'
    ),
    reunionNombre: '[data-meeting-title]',
    subtitulosBotonIcono: 'span.material-icons-extended',
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
  intervalo;
  intervencionesFragmentosPorHoraYPersona = {};
  reunion = {
    fechaYHora: '',
    nombre: '',
  };
  ultimaHora = '';
  ultimaPersonaNombre = '';

  constructor({ opciones }) {
    console.log(opciones);
    if (opciones !== undefined) {
      this.nombre = (opciones.nombre || this.nombre);
      this.atajosPorAccion.inicializar = (
        opciones.atajosPorAccion.inicializar ||
        this.atajosPorAccion.inicializar
      );
      this.atajosPorAccion.finalizar = (
        opciones.atajosPorAccion.finalizar ||
        this.atajosPorAccion.finalizar
      );
      this.subtitulosTransparencia = (
        opciones.subtitulosTransparencia ||
        this.subtitulosTransparencia
      );
    }
    this.inicializar();
  }

  inicializar = () => {
    const dSubtitulosBoton = (
      document
      .querySelector(this.selectores.subtitulosBotonIcono)
    );
    if (!dSubtitulosBoton) {
      setTimeout(this.inicializar);
      return;
    }
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
      (
        atajoTeclas
        .forEach((tecla) => {delete teclasPresionadasPorTecla[tecla];})
      );
      if (Object.keys(teclasPresionadasPorTecla).length) {
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
    const dSubtitulosBoton = (
      document
      .querySelector(this.selectores.subtitulosBotonIcono)
      .parentElement
    );
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
    if (!this.reunion.fechaYHora) {
      return;
    }
    this.dBotonCapturar.remove();
    window.addEventListener('beforeunload', this.descargarArchivo);
    this.reunion.fechaYHora = this.obtenerFechaYHoraActualSinPuntuacion();
    this.reunion.nombre = (
      (
        document
        .querySelector(this.selectores.reunionNombre)
        ?.dataset
        ?.meetingTitle
      ) ||
      ''
    );
    const dBotonColgar = (
      this
      .ejecutarXPath(this.selectores.xpath.reunionBotonFinalizarIcono)
      .parentElement
    );
    dBotonColgar.addEventListener('click', this.descargarArchivo);
    this.intervalo = setInterval(this.actualizar);
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
    if (this.nombre) {
      ultimaPersonaNombre = (
        ultimaPersonaNombre
        .replace(
          (
            document
            .querySelector('[data-self-name]')
            .dataset
            .selfName
          ),
          this.nombre
        )
      );
    }
    this.ultimaPersonaNombre = ultimaPersonaNombre;
    const dIntervencionFragmentos = (
      dPersonaNombre
      .nextElementSibling
      .querySelectorAll('span')
    );
    dIntervencionFragmentos.forEach(this.guardarIntervencionFragmento);
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

  guardarIntervencionFragmento = (dIntervencionFragmento) => {
    const fragmentoNuevo = dIntervencionFragmento.innerText;
    let fragmentoId = dIntervencionFragmento.id;
    if (!fragmentoId) {
      fragmentoId = new Date().getTime();
      dIntervencionFragmento.id = fragmentoId;
    }
    const horaYPersona = (this.ultimaHora + ' ' + this.ultimaPersonaNombre);
    if (!this.intervencionesFragmentosPorHoraYPersona[horaYPersona]) {
      this.intervencionesFragmentosPorHoraYPersona[horaYPersona] = {};
    }
    this.intervencionesFragmentosPorHoraYPersona[horaYPersona][fragmentoId] = (
      fragmentoNuevo
    );
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
      ' ' +
      this.reunion.nombre
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
