document.addEventListener("DOMContentLoaded", () => {
  // ---- Referencias al DOM ----
  const botonGirar = document.getElementById("boton-girar");
  const preguntaContainer = document.getElementById("question-container");
  const preguntaTitulo = document.getElementById("pregunta-titulo");
  const preguntaImagenContainer = document.getElementById("pregunta-imagen-container");
  const preguntaImagen = document.getElementById("pregunta-imagen");
  const seleccionEquipoResponder = document.getElementById("seleccion-equipo-responder");
  const equiposSelectorRespuesta = document.getElementById("equipos-selector-respuesta");
  const temporizadorEl = document.getElementById("temporizador");
  const opcionesRespuesta = document.getElementById("opciones-respuesta");
  const teamDisplay1 = document.getElementById("team-display-1");
  const teamDisplay2 = document.getElementById("team-display-2");
  const gameArea = document.getElementById("game-area");
  const matchWinnerDisplay = document.getElementById("match-winner-display");
  const matchWinnerName = document.getElementById("match-winner-name");
  const tournamentStatus = document.getElementById("tournament-status");
  const botonSiguiente = document.getElementById("boton-siguiente");
  const winnerModal = document.getElementById("winner-modal");
  const winnerTeamName = document.getElementById("winner-team-name");
  const btnVolverDocente = document.getElementById("btn-volver-docente");
  const categoriaSeleccionadaSpan = document.getElementById("categoria-seleccionada");
  const feedbackContainer = document.getElementById("feedback-container");
  const desempateBanner = document.getElementById("desempate-banner");
  const toastContainer = document.getElementById("toast-container");
  const arrowEl = document.querySelector(".arrow");
  const ruletaCanvas = document.getElementById("ruleta");

  // ---- Estado del Juego ----
  let estadoJuego = {
    torneoRonda: 1,
    enfrentamientosRonda: [],
    ganadoresRonda: [],
    enfrentamientoActualIdx: 0,
    preguntaActualEnfrentamiento: 0,
    totalPreguntasPorEnfrentamiento: 3,
    puntosEnfrentamiento: [0, 0],
    equipoActivoIdx: -1,
    esDesempate: false,
    totalEnfrentamientosTorneo: 0,
    enfrentamientoGlobalActual: 0,
  };
  let preguntaActual = null;
  let temporizador = null;
  let respuestaCorrectaTexto = "";

  // ---- Utils ----
  const clearChildren = (el) => {
    while (el.firstChild) el.removeChild(el.firstChild);
  };
  const norm = (s) =>
    String(s ?? "")
      .trim()
      .toLowerCase();

  function showToast(msg, type, ttl = 2200) {
    if (!toastContainer) return;
    const el = document.createElement("div");
    el.className = "toast" + (type ? ` toast--${type}` : "");
    el.textContent = String(msg || "");
    toastContainer.appendChild(el);
    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, ttl);
  }

  // ===== INICIALIZACIÓN DEL JUEGO CON DATOS DE LA API =====
  async function initGame() {
    try {
      const [materiasRes, equiposRes, preguntasRes, configRes] =
        await Promise.all([
          fetch("/api/materias"),
          fetch("/api/equipos"),
          fetch("/api/preguntas"),
          fetch("/api/configuracion"),
        ]);

      if (
        !materiasRes.ok ||
        !equiposRes.ok ||
        !preguntasRes.ok ||
        !configRes.ok
      ) {
        throw new Error(
          "No se pudieron cargar los datos del juego desde el servidor."
        );
      }

      const materias = await materiasRes.json();
      const equipos = await equiposRes.json();
      const preguntas = await preguntasRes.json();
      const configDB = await configRes.json();

      estadoJuego.totalPreguntasPorEnfrentamiento = configDB.cantidad;

      if (equipos.length < 2) {
        alert(
          "Se necesitan al menos 2 equipos para jugar. Volviendo al panel del docente."
        );
        window.location.href = "/docente";
        return;
      }
      if (materias.length === 0 || preguntas.length === 0) {
        alert(
          "Se necesita al menos una materia y una pregunta para jugar. Volviendo al panel del docente."
        );
        window.location.href = "/docente";
        return;
      }

      runGame(materias, equipos, preguntas);
    } catch (error) {
      console.error("Error fatal al iniciar el juego:", error);
      alert("Error de conexión. No se pudo iniciar el juego.");
      window.location.href = "/docente";
    }
  }

  // ===== LÓGICA PRINCIPAL DEL JUEGO (RUN GAME) =====
  function runGame(materias, todosLosEquipos, todasLasPreguntas) {
    let preguntasDisponibles = [...todasLasPreguntas];

    function iniciarTorneo() {
      estadoJuego.totalEnfrentamientosTorneo = todosLosEquipos.length - 1;

      const equiposOrdenados = todosLosEquipos.map((e) => ({
        nombre: e.nombre_equipo,
        puntos: 0,
        avatarSrc: null,
      }));

      let equipoQueEspera = null;

      if (equiposOrdenados.length % 2 !== 0) {
        equipoQueEspera = equiposOrdenados.pop();
      }

      for (let i = 0; i < equiposOrdenados.length; i += 2) {
        if (equiposOrdenados[i + 1]) {
          estadoJuego.enfrentamientosRonda.push([
            equiposOrdenados[i],
            equiposOrdenados[i + 1],
          ]);
        }
      }

      if (equipoQueEspera) {
        estadoJuego.ganadoresRonda.push(equipoQueEspera);
      }

      iniciarEnfrentamiento();
    }

    function mostrarResultado(categoria) {
      const preguntasParaCategoria = preguntasDisponibles.filter(
        (p) => p.materia_nombre === categoria.nombre
      );

      gameArea.style.display = "none";
      preguntaContainer.style.display = "block";
      feedbackContainer.style.display = "none";
      categoriaSeleccionadaSpan.textContent = categoria.nombre;

      if (preguntasParaCategoria.length === 0) {
        preguntaTitulo.textContent = "No hay más preguntas para esta categoría.";
        preguntaImagenContainer.style.display = "none";
        setTimeout(siguientePregunta, 1500);
        return;
      }

      const indiceAleatorio = Math.floor(
        Math.random() * preguntasParaCategoria.length
      );
      preguntaActual = preguntasParaCategoria[indiceAleatorio];

      preguntasDisponibles = preguntasDisponibles.filter(
        (p) => p.id_pregunta !== preguntaActual.id_pregunta
      );

      // NUEVO: Lógica para mostrar texto O imagen
      if (preguntaActual.imagen_url) {
        // Si tiene imagen, mostrar solo la imagen
        preguntaTitulo.style.display = "none";
        preguntaImagen.src = preguntaActual.imagen_url;
        preguntaImagenContainer.style.display = "block";
      } else {
        // Si NO tiene imagen, mostrar el texto
        preguntaTitulo.textContent = preguntaActual.pregunta;
        preguntaTitulo.style.display = "block";
        preguntaImagenContainer.style.display = "none";
      }

      const respuestaCorrectaObj = preguntaActual.respuestas.find(
        (r) => r.es_correcta === 1
      );
      respuestaCorrectaTexto = respuestaCorrectaObj
        ? respuestaCorrectaObj.respuesta
        : "";

      clearChildren(opcionesRespuesta);
      const opcionesMezcladas = [...preguntaActual.respuestas].sort(
        () => Math.random() - 0.5
      );
      opcionesMezcladas.forEach((op) => {
        const b = document.createElement("button");
        b.className = "btn-opcion";
        b.textContent = op.respuesta;
        b.disabled = true;
        b.onclick = () => responder(estadoJuego.equipoActivoIdx, op.respuesta);
        opcionesRespuesta.appendChild(b);
      });

      clearChildren(equiposSelectorRespuesta);
      const enJuego =
        estadoJuego.enfrentamientosRonda[estadoJuego.enfrentamientoActualIdx];
      enJuego.forEach((eq, i) => {
        const b = document.createElement("button");
        b.className = "btn-equipo-selector";
        b.textContent = eq.nombre;
        b.onclick = () => seleccionarEquipoParaResponder(i);
        equiposSelectorRespuesta.appendChild(b);
      });

      seleccionEquipoResponder.style.display = "block";
      opcionesRespuesta.style.display = "none";
    }

    function setFeedback(texto, tipo) {
      feedbackContainer.style.display = "block";
      feedbackContainer.className =
        "feedback-container" + (tipo ? " " + tipo : "");
clearChildren(feedbackContainer);
      const strong = document.createElement("strong");
      strong.textContent = texto;
      feedbackContainer.appendChild(strong);
    }

    function setOpcionesEnabled(enabled) {
      opcionesRespuesta
        .querySelectorAll(".btn-opcion")
        .forEach((b) => (b.disabled = !enabled));
    }

    function setDesempateUI(on) {
      if (desempateBanner)
        desempateBanner.style.display = on ? "block" : "none";
    }

    function iniciarEnfrentamiento() {
      if (
        estadoJuego.enfrentamientoActualIdx >=
        estadoJuego.enfrentamientosRonda.length
      ) {
        finalizarRondaDeTorneo();
        return;
      }
      estadoJuego.enfrentamientoGlobalActual++;

      estadoJuego.preguntaActualEnfrentamiento = 0;
      estadoJuego.puntosEnfrentamiento = [0, 0];
      setDesempateUI(false);
      siguientePregunta();
    }

    function siguientePregunta() {
      estadoJuego.preguntaActualEnfrentamiento++;
      if (
        estadoJuego.preguntaActualEnfrentamiento >
        estadoJuego.totalPreguntasPorEnfrentamiento
      ) {
        finalizarEnfrentamiento();
        return;
      }
      prepararTurnoUI();
    }

    function actualizarCategoriasRuleta() {
      const materiasConPreguntas = new Set(
        preguntasDisponibles.map((p) => p.materia_nombre)
      );
      categoriasRuleta = materias
        .filter((m) => materiasConPreguntas.has(m.materia_nombre))
        .map((m) => ({ nombre: m.materia_nombre }));

      if (categoriasRuleta.length === 0 && !animando) {
        showToast(
          "¡Felicidades! Han respondido todas las preguntas disponibles.",
          "info",
          3000
        );
        setTimeout(finalizarJuego, 1000);
      }
    }

    function prepararTurnoUI() {
      preguntaContainer.style.display = "none";
      matchWinnerDisplay.style.display = "none";
      botonSiguiente.style.display = "none";
      gameArea.style.display = "flex";

      actualizarCategoriasRuleta();
      dibujarRuleta();

      botonGirar.disabled = categoriasRuleta.length === 0;

      actualizarUI();
      updateArrowPosition();
    }

    function finalizarEnfrentamiento() {
      const [p1, p2] = estadoJuego.puntosEnfrentamiento;
      const [e1, e2] =
        estadoJuego.enfrentamientosRonda[estadoJuego.enfrentamientoActualIdx];
      if (p1 === p2) {
        estadoJuego.esDesempate = true;
        setDesempateUI(true);
        showToast("Empate → muerte súbita (1 pregunta decisiva)", "warn", 2600);
        prepararTurnoUI();
      } else {
        const ganador = p1 > p2 ? e1 : e2;
        mostrarGanadorDelEnfrentamiento(ganador);
      }
    }

    function mostrarGanadorDelEnfrentamiento(ganador) {
      estadoJuego.ganadoresRonda.push(ganador);
      gameArea.style.display = "none";
      preguntaContainer.style.display = "none";
      matchWinnerName.textContent = ganador.nombre;
      matchWinnerDisplay.style.display = "block";
      botonSiguiente.textContent = "Siguiente Enfrentamiento";
      botonSiguiente.style.display = "block";
      botonSiguiente.onclick = () => {
        estadoJuego.enfrentamientoActualIdx++;
        iniciarEnfrentamiento();
      };
    }

    function finalizarRondaDeTorneo() {
      if (estadoJuego.ganadoresRonda.length <= 1) {
        finalizarJuego();
        return;
      }
      estadoJuego.torneoRonda++;
      const prox = [...estadoJuego.ganadoresRonda];
      estadoJuego.ganadoresRonda = [];
      estadoJuego.enfrentamientoActualIdx = 0;
      estadoJuego.enfrentamientosRonda = [];
      for (let i = 0; i < prox.length; i += 2) {
        if (prox[i + 1])
          estadoJuego.enfrentamientosRonda.push([prox[i], prox[i + 1]]);
        else estadoJuego.ganadoresRonda.push(prox[i]);
      }
      iniciarEnfrentamiento();
    }

    function finalizarJuego() {
      let ganadorFinal = null;
      if (estadoJuego.ganadoresRonda.length === 1) {
        ganadorFinal = estadoJuego.ganadoresRonda[0];
      } else {
        const puntajesFinales = new Map();
        estadoJuego.enfrentamientosRonda.flat().forEach((eq) => {
          if (!puntajesFinales.has(eq.nombre))
            puntajesFinales.set(eq.nombre, 0);
        });
        estadoJuego.ganadoresRonda.forEach((eq) => {
          if (!puntajesFinales.has(eq.nombre))
            puntajesFinales.set(eq.nombre, 0);
        });

        if (estadoJuego.ganadoresRonda.length > 0) {
          ganadorFinal =
            estadoJuego.ganadoresRonda[estadoJuego.ganadoresRonda.length - 1];
        }
      }
      winnerTeamName.textContent = ganadorFinal
        ? ganadorFinal.nombre
        : "No se pudo determinar un ganador";
      winnerModal.style.display = "flex";
    }

    window.seleccionarEquipoParaResponder = (idx) => {
      estadoJuego.equipoActivoIdx = idx;
      seleccionEquipoResponder.style.display = "none";
      opcionesRespuesta.style.display = "flex";
      setOpcionesEnabled(true);
      iniciarTemporizador(idx);
    };

    function responder(equipoRespondeIdx, opcionSeleccionada) {
      detenerTemporizador();
      setOpcionesEnabled(false);
      const esCorrecta =
        norm(opcionSeleccionada) === norm(respuestaCorrectaTexto);
      if (estadoJuego.esDesempate) {
        if (esCorrecta) {
          const equipos =
            estadoJuego.enfrentamientosRonda[
              estadoJuego.enfrentamientoActualIdx
            ];
          const ganador = equipos[equipoRespondeIdx];
          estadoJuego.esDesempate = false;
          setDesempateUI(false);
          setFeedback(`¡${ganador.nombre} gana el desempate!`, "correct");
          setTimeout(() => mostrarGanadorDelEnfrentamiento(ganador), 2000);
        } else {
          setFeedback(
            "Incorrecto. Se vuelve a girar para continuar el desempate.",
            "incorrect"
          );
          setTimeout(() => {
            feedbackContainer.style.display = "none";
            prepararTurnoUI();
          }, 1800);
        }
        return;
      }
      if (esCorrecta) {
        setFeedback("¡Correcto!", "correct");
        estadoJuego.puntosEnfrentamiento[equipoRespondeIdx]++;
      } else {
        setFeedback("Incorrecto.", "incorrect");
      }
      actualizarUI();
      setTimeout(siguientePregunta, 2000);
    }

    function renderTeamCard(container, equipo, idxPuntos) {
      clearChildren(container);

      const tpl = document.getElementById("tpl-team-card");
      const fragment = tpl.content.cloneNode(true);
      const card = fragment.querySelector(".team-card");

      card.querySelector(".team-title").textContent = equipo.nombre;

      card.querySelector(".score").textContent = String(
        estadoJuego.puntosEnfrentamiento[idxPuntos]
      );

      const iconContainer = card.querySelector(".team-icon");
      const input = iconContainer.querySelector(".file-input");
      const status = iconContainer.querySelector(".file-status");

      if (equipo.avatarSrc) {
        clearChildren(iconContainer);
        const img = document.createElement("img");
        img.src = equipo.avatarSrc;
        img.classList.add("team-avatar");
        iconContainer.appendChild(img);
      } else {
        input.addEventListener("change", function () {
          const file = this.files[0];
          if (!file) {
            status.textContent = "Ningún archivo seleccionado";
            return;
          }

          const img = document.createElement("img");
          img.src = URL.createObjectURL(file);
          img.classList.add("team-avatar");

          equipo.avatarSrc = img.src;

          clearChildren(iconContainer);
          iconContainer.appendChild(img);
        });
      }

      container.appendChild(card);
    }

    function actualizarUI() {
      const enf =
        estadoJuego.enfrentamientosRonda[estadoJuego.enfrentamientoActualIdx];
      if (!enf) return;
      tournamentStatus.textContent = estadoJuego.esDesempate
        ? "🔥 ¡MUERTE SÚBITA POR EMPATE! 🔥"
        : `Enfrentamiento ${estadoJuego.enfrentamientoGlobalActual} de ${estadoJuego.totalEnfrentamientosTorneo} | Pregunta ${estadoJuego.preguntaActualEnfrentamiento} de ${estadoJuego.totalPreguntasPorEnfrentamiento}`;
      tournamentStatus.style.display = "block";
      const [e1, e2] = enf;
      renderTeamCard(teamDisplay1, e1, 0);
      renderTeamCard(teamDisplay2, e2, 1);
    }

    function iniciarTemporizador() {
      let t = 15;
      temporizadorEl.style.display = "block";
      const draw = () => {
        temporizadorEl.textContent = `⏰ ${t}s`;
      };
      draw();
      temporizador = setInterval(() => {
        t--;
        draw();
        if (t <= 0) {
          detenerTemporizador();
          setFeedback(
            "Tiempo terminado.\nSeleccione la opción que indicó el Jugador.",
            "info"
          );
        }
      }, 1000);
    }

    function detenerTemporizador() {
      clearInterval(temporizador);
      temporizadorEl.style.display = "none";
    }

    let categoriasRuleta = materias.map((m) => ({ nombre: m.materia_nombre }));
    let ruletaCtx = setupHiDPICanvas(ruletaCanvas);
    let anguloActual = 0,
      velocidad = 0,
      animando = false;

    function setupHiDPICanvas(canvas) {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      const ctx = canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return ctx;
    }

    function updateArrowPosition() {
      if (!arrowEl) return;
      const triH = 18;
      const gap = 18;
      arrowEl.style.top = `${ruletaCanvas.offsetTop - triH + gap}px`;
    }

    function dibujarRuleta() {
  const size = ruletaCanvas.getBoundingClientRect().width;
  const center = size / 2;
  const radio = center - 5;
  ruletaCtx.clearRect(0, 0, size, size);

  const totalSectores = categoriasRuleta.length;
  if (totalSectores === 0) return;

  const anguloPorSector = (2 * Math.PI) / totalSectores;

  // 1 color por categoría (7 en tu caso)
  const coloresRuleta = [
    "#2ecc71", // LOGICA
    "#e67e22", // PIZZARRA
    "#3498db", // ALGEBRA
    "#9b59b6", // CALCULO
    "#e74c3c", // ESTADISTICA
    "#c016a6", // GEOMETRIA
    "#f1c40f"  // INGENIERIA
  ];

  for (let i = 0; i < totalSectores; i++) {
    const angI = anguloActual + i * anguloPorSector;

    // un color fijo para cada sector
    ruletaCtx.fillStyle = coloresRuleta[i];

    ruletaCtx.beginPath();
    ruletaCtx.moveTo(center, center);
    ruletaCtx.arc(center, center, radio, angI, angI + anguloPorSector, false);
    ruletaCtx.lineTo(center, center);
    ruletaCtx.fill();

    ruletaCtx.save();
    ruletaCtx.fillStyle = "#fff";
    ruletaCtx.font = "bold 16px Poppins";
    ruletaCtx.translate(center, center);
    ruletaCtx.rotate(angI + anguloPorSector / 2);
    ruletaCtx.textAlign = "right";
    ruletaCtx.fillText(categoriasRuleta[i].nombre, radio - 10, 5);
    ruletaCtx.restore();
  }
}


    function animar() {
      if (!animando) return;
      velocidad *= 0.985;
      if (velocidad < 0.001) {
        animando = false;
        velocidad = 0;
        const totalSectores = categoriasRuleta.length;
        const anguloPorSector = (2 * Math.PI) / totalSectores;
        const angParada = anguloActual % (2 * Math.PI);
        const angFlecha = 1.5 * Math.PI;
        const angRel = (angFlecha - angParada + 2 * Math.PI) % (2 * Math.PI);
        const idx = Math.floor(angRel / anguloPorSector);
        if (categoriasRuleta[idx]) mostrarResultado(categoriasRuleta[idx]);
        return;
      }
      anguloActual += velocidad;
      dibujarRuleta();
      requestAnimationFrame(animar);
    }

    botonGirar.onclick = () => {
      if (animando || categoriasRuleta.length === 0) return;
      animando = true;
      botonGirar.disabled = true;
      velocidad = Math.random() * 0.25 + 0.25;
      animar();
    };

    window.addEventListener("resize", () => {
      ruletaCtx = setupHiDPICanvas(ruletaCanvas);
      dibujarRuleta();
      updateArrowPosition();
    });

    btnVolverDocente.onclick = () => {
      window.location.href = "/docente";
    };

    updateArrowPosition();
    dibujarRuleta();
    iniciarTorneo();
  }

  initGame();
});