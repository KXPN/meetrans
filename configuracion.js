const Configuracion = {
  opcionesGuardadas: {},
  actualizar: function() {
    this.opcionesGuardadas = this.convertirEnObjeto();
    this.revisarSiHayCambios();
  },
  cargar: function(opciones) {
    for (let opcionNombre in opciones) {
      if (typeof opciones[opcionNombre] !== 'object') {
        let dOpcion = document.querySelector('[name="' + opcionNombre + '"]');
        dOpcion.value = opciones[opcionNombre];
        continue;
      }
      for (let subopcionNombre in opciones[opcionNombre]) {
        let dOpcion = document.querySelector(
          '[name="' + opcionNombre + '.' + subopcionNombre + '"]'
        );
        dOpcion.value = opciones[opcionNombre][subopcionNombre];
      }
    }
    this.actualizar();
  },
  convertirEnObjeto: function() {
    let opciones = {};
    new FormData(document.querySelector('form')).forEach(
      (opcionValor, opcionNombre) => {
        if (!opcionNombre.includes('.')) {
          opciones[opcionNombre] = opcionValor;
          return;
        }
        const opcionNombrePartes = opcionNombre.split(/\./);
        const opcionNombreLimpio = opcionNombrePartes[0];
        const subopcionNombre = opcionNombrePartes[1];
        if (!opciones[opcionNombreLimpio]) {
          opciones[opcionNombreLimpio] = {};
        }
        opciones[opcionNombreLimpio][subopcionNombre] = opcionValor;
      }
    );
    return opciones;
  },
  guardar: function() {
    let opciones = this.convertirEnObjeto();
    if (typeof browser === 'undefined') {
      var browser = chrome;
    }
    browser.storage.sync.set({ opciones }, this.actualizar.bind(this));
  },
  inicializar: function() {
    window.onbeforeunload = this.revisarSiHayCambios.bind(this);
    document.querySelectorAll('input,textarea').forEach((dOpcion) => {
      dOpcion.addEventListener('input', this.revisarSiHayCambios.bind(this));
    });
    document.querySelector('.jsGuardar').addEventListener(
      'click',
      this.guardar.bind(this),
    );
    document.querySelector('.jsRestaurar').addEventListener(
      'click',
      this.restaurar.bind(this),
    );
    if (typeof browser === 'undefined') {
      var browser = chrome;
    }
    browser.storage.sync.get('opciones', ({ opciones }) => {
      if (opciones === undefined) {
        return;
      }
      this.cargar(opciones);
    });
  },
  restaurar: function() {
    document.querySelector('form').reset();
    this.revisarSiHayCambios();
  },
  revisarSiHayCambios: function() {
    let opcionesGuardadas = JSON.stringify(this.opcionesGuardadas);
    let opcionesActuales = JSON.stringify(this.convertirEnObjeto());
    let hayCambios = (opcionesGuardadas !== opcionesActuales);
    let claseAPoner = 'correcto';
    let claseAQuitar = 'incorrecto';
    if (hayCambios) {
      claseAPoner = 'incorrecto';
      claseAQuitar = 'correcto';
    }
    document.querySelector('.jsGuardar').classList.add(claseAPoner);
    document.querySelector('.jsGuardar').classList.remove(claseAQuitar);
    return (hayCambios ? 'Quieres salir sin guardar cambios?' : null);
  },
};
Configuracion.inicializar();
