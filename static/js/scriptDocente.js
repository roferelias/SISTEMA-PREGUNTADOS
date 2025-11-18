/* Panel Docente – Conectado a la API de Flask y MySQL (CRUD Completo) */
document.addEventListener("DOMContentLoaded", () => {
  // ===== Estado =====
  let materias = [];
  let preguntas = [];
  let equipos = [];
  let configuracion = { rondas: 1, grupo: "mañana" };
  let imagenPreguntaFile = null; // NUEVO: Variable para almacenar el archivo de imagen

  // ===== Refs DOM =====
  const rondasInput = document.getElementById("rondasInput");
  const grupoSelect = document.getElementById("grupoSelect");
  const materiaInput = document.getElementById("materia");
  const materiasList = document.getElementById("materiasList");
  const tplMateriaItem = document.getElementById("tpl-materia-item");
  const tplMateriaEditor = document.getElementById("tpl-materia-editor");
  const materiasCount = document.getElementById("materias-count");
  const equipoInput = document.getElementById("equipo");
  const equiposList = document.getElementById("equiposList");
  const tplEquipoItem = document.getElementById("tpl-equipo-item");
  const tplEquipoEditor = document.getElementById("tpl-equipo-editor");
  const equiposCount = document.getElementById("equipos-count");
  const selectMateria = document.getElementById("materiaSelect");
  const preguntaInput = document.getElementById("pregunta");
  const resp1Input = document.getElementById("resp1");
  const resp2Input = document.getElementById("resp2");
  const resp3Input = document.getElementById("resp3");
  const imagenPreguntaInput = document.getElementById("imagenPregunta"); // NUEVO
  const previewPregunta = document.getElementById("previewPregunta"); // NUEVO
  const preguntasList = document.getElementById("preguntasList");
  const tplPreguntaItem = document.getElementById("tpl-pregunta-item");
  const tplPreguntaEditor = document.getElementById("tpl-pregunta-editor");
  const toastContainer = document.getElementById("toast-container");
  const preguntasCount = document.getElementById("preguntas-count");

  const filtroMateria = document.getElementById("filtroMateria");
  const filtroTexto = document.getElementById("filtroTexto");

  // ===== Utils =====
  const clearChildren = (node) => {
    while (node.firstChild) node.removeChild(node.firstChild);
  };
  const createOption = (value, text) => {
    const o = document.createElement("option");
    o.value = value;
    o.textContent = text;
    return o;
  };
  const asText = (v) => String(v ?? "").trim();

  function showToast(message, variant = "success") {
    const toast = document.createElement("div");
    toast.className = "toast";
    const icon = document.createElement("div");
    icon.className = "icon";
    icon.textContent =
      variant === "success" ? "✅" : variant === "warn" ? "⚠️" : "ℹ️";
    const msg = document.createElement("div");
    msg.className = "msg";
    msg.textContent = message;
    const close = document.createElement("button");
    close.className = "close";
    close.setAttribute("aria-label", "Cerrar notificación");
    close.textContent = "✖";
    close.addEventListener("click", () => {
      if (toast.parentNode === toastContainer)
        toastContainer.removeChild(toast);
    });
    toast.appendChild(icon);
    toast.appendChild(msg);
    toast.appendChild(close);
    toastContainer.appendChild(toast);
    setTimeout(() => {
      if (toast.parentNode === toastContainer)
        toastContainer.removeChild(toast);
    }, 2600);
  }

  // ===== NUEVO: Funciones para manejo de imágenes =====
  function setupImagePreview(inputElement, previewElement) {
    inputElement.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) {
        previewElement.classList.remove("active");
        clearChildren(previewElement);
        imagenPreguntaFile = null;
        return;
      }

      // Validar tipo de archivo
      const validTypes = ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"];
      if (!validTypes.includes(file.type)) {
        showToast("Formato de imagen no válido. Use PNG, JPG, GIF o WEBP.", "warn");
        inputElement.value = "";
        return;
      }

      // Validar tamaño (máximo 5MB)
      if (file.size > 5 * 1024 * 1024) {
        showToast("La imagen no debe superar los 5MB.", "warn");
        inputElement.value = "";
        return;
      }

      imagenPreguntaFile = file;
      const reader = new FileReader();
      reader.onload = (event) => {
        clearChildren(previewElement);
        const img = document.createElement("img");
        img.src = event.target.result;
        
        const removeBtn = document.createElement("button");
        removeBtn.className = "image-preview-remove";
        removeBtn.textContent = "✖";
        removeBtn.type = "button";
        removeBtn.addEventListener("click", () => {
          inputElement.value = "";
          clearChildren(previewElement);
          previewElement.classList.remove("active");
          imagenPreguntaFile = null;
        });

        previewElement.appendChild(img);
        previewElement.appendChild(removeBtn);
        previewElement.classList.add("active");
      };
      reader.readAsDataURL(file);
    });
  }

  // Configurar preview de imagen
  setupImagePreview(imagenPreguntaInput, previewPregunta);

  // ===== LÓGICA DE COMUNICACIÓN CON LA API =====
  async function loadInitialData() {
    try {
      const filtroMateriaId = filtroMateria.value;

      if (filtroMateriaId === "ninguna") {
        const responses = await Promise.all([
          fetch("/api/materias"),
          fetch("/api/equipos"),
          fetch("/api/configuracion"),
        ]);

        if (responses.some((res) => !res.ok)) {
          throw new Error(
            "Una de las solicitudes de datos al servidor falló."
          );
        }

        const [materiasData, equiposData, configData] = await Promise.all(
          responses.map((res) => res.json())
        );

        materias = materiasData;
        equipos = equiposData;
        preguntas = [];
        configuracion.rondas = configData.cantidad;
        rondasInput.value = configuracion.rondas;

        render();
        return;
      }

      const filtroTextoVal = filtroTexto.value;
      let preguntasUrl = "/api/preguntas?";
      if (filtroMateriaId) {
        preguntasUrl += `materia_id=${filtroMateriaId}&`;
      }
      if (filtroTextoVal) {
        preguntasUrl += `texto=${encodeURIComponent(filtroTextoVal)}`;
      }

      const responses = await Promise.all([
        fetch("/api/materias"),
        fetch("/api/equipos"),
        fetch(preguntasUrl),
        fetch("/api/configuracion"),
      ]);

      if (responses.some((res) => res.status === 401)) {
        return;
      }

      if (responses.some((res) => !res.ok)) {
        throw new Error("Una de las solicitudes de datos al servidor falló.");
      }

      const [materiasData, equiposData, preguntasData, configData] =
        await Promise.all(responses.map((res) => res.json()));

      materias = materiasData;
      equipos = equiposData;
      preguntas = preguntasData;
      configuracion.rondas = configData.cantidad;
      rondasInput.value = configuracion.rondas;

      render();
    } catch (error) {
      console.error("Error al cargar datos:", error);
      showToast("Error de conexión con el servidor.", "warn");
    }
  }

  // ===== Operaciones CRUD (Crear, Actualizar, Borrar) =====

  async function addMateria() {
    const nombre = asText(materiaInput.value);
    if (!nombre) return;
    const response = await fetch("/api/materias", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ materia_nombre: nombre }),
    });
    if (response.ok) {
      materiaInput.value = "";
      showToast("Materia agregada.");
      loadInitialData();
    } else {
      const err = await response.json();
      showToast(err.error, "warn");
    }
  }

  async function updateMateria(id, nuevoNombre) {
    if (!nuevoNombre) return;
    const response = await fetch(`/api/materias/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ materia_nombre: nuevoNombre }),
    });
    if (response.ok) {
      showToast("Materia actualizada.");
      loadInitialData();
    } else {
      const err = await response.json();
      showToast(err.error, "warn");
    }
  }

  async function deleteMateria(id) {
    if (!confirm("¿Eliminar esta materia y todas sus preguntas?")) return;
    const response = await fetch(`/api/materias/${id}`, { method: "DELETE" });
    if (response.ok) {
      showToast("Materia eliminada.");
      loadInitialData();
    } else {
      const err = await response.json();
      showToast(err.error, "warn");
    }
  }

  async function addEquipo() {
    const nombre = asText(equipoInput.value);
    if (!nombre) return;
    const response = await fetch("/api/equipos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: nombre }),
    });
    if (response.ok) {
      equipoInput.value = "";
      showToast("Equipo agregado.");
      loadInitialData();
    } else {
      const err = await response.json();
      showToast(err.error, "warn");
    }
  }

  async function updateEquipo(id, nuevoNombre) {
    if (!nuevoNombre) return;
    const response = await fetch(`/api/equipos/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: nuevoNombre }),
    });
    if (response.ok) {
      showToast("Equipo actualizado.");
      loadInitialData();
    } else {
      const err = await response.json();
      showToast(err.error, "warn");
    }
  }

  async function deleteEquipo(id) {
    if (!confirm("¿Eliminar este equipo?")) return;
    const response = await fetch(`/api/equipos/${id}`, { method: "DELETE" });
    if (response.ok) {
      showToast("Equipo eliminado.");
      loadInitialData();
    } else {
      const err = await response.json();
      showToast(err.error, "warn");
    }
  }

  // NUEVO: Función para agregar pregunta con imagen
  async function addPregunta() {
    const idMateria = asText(selectMateria.value);
    const preguntaTexto = asText(preguntaInput.value);
    const r1 = asText(resp1Input.value),
      r2 = asText(resp2Input.value),
      r3 = asText(resp3Input.value);
    
    if (!idMateria || !preguntaTexto || !r1 || !r2) {
      showToast("Faltan campos requeridos.", "warn");
      return;
    }

    const formData = new FormData();
    formData.append("id_materia", idMateria);
    formData.append("pregunta", preguntaTexto);
    
    // NUEVO: Agregar imagen si existe
    if (imagenPreguntaFile) {
      formData.append("imagen", imagenPreguntaFile);
    }

    const respuestas = [
      { texto: r1, es_correcta: 1 },
      { texto: r2, es_correcta: 0 },
    ];
    if (r3) respuestas.push({ texto: r3, es_correcta: 0 });
    
    formData.append("respuestas", JSON.stringify(respuestas));

    const response = await fetch("/api/preguntas", {
      method: "POST",
      body: formData,
    });

    if (response.ok) {
      preguntaInput.value = "";
      resp1Input.value = "";
      resp2Input.value = "";
      resp3Input.value = "";
      imagenPreguntaInput.value = "";
      clearChildren(previewPregunta);
      previewPregunta.classList.remove("active");
      imagenPreguntaFile = null;
      showToast("Pregunta agregada.");
      loadInitialData();
    } else {
      const err = await response.json();
      showToast(err.error, "warn");
    }
  }

  async function updatePregunta(id, payload, imagenFile = null) {
    let response;
    
    if (imagenFile) {
      // Si hay imagen, usar FormData
      const formData = new FormData();
      Object.keys(payload).forEach(key => {
        if (key === "respuestas") {
          formData.append(key, JSON.stringify(payload[key]));
        } else {
          formData.append(key, payload[key]);
        }
      });
      formData.append("imagen", imagenFile);
      
      response = await fetch(`/api/preguntas/${id}`, {
        method: "PUT",
        body: formData,
      });
    } else {
      // Sin imagen, usar JSON
      response = await fetch(`/api/preguntas/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }

    if (response.ok) {
      showToast("Pregunta actualizada.");
      loadInitialData();
    } else {
      const err = await response.json();
      showToast(err.error, "warn");
    }
  }

  async function deletePregunta(id) {
    if (!confirm("¿Eliminar esta pregunta?")) return;
    const response = await fetch(`/api/preguntas/${id}`, { method: "DELETE" });
    if (response.ok) {
      showToast("Pregunta eliminada.");
      loadInitialData();
    } else {
      const err = await response.json();
      showToast(err.error, "warn");
    }
  }

  async function saveConfigToDB() {
    const nuevaCantidad = parseInt(rondasInput.value, 10);
    if (!nuevaCantidad || nuevaCantidad < 1) {
      rondasInput.value = configuracion.rondas;
      return;
    }
    const response = await fetch("/api/configuracion", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cantidad: nuevaCantidad }),
    });
    if (response.ok) {
      configuracion.rondas = nuevaCantidad;
      showToast("Configuración guardada.");
    } else {
      showToast("Error al guardar la configuración.", "warn");
      rondasInput.value = configuracion.rondas;
    }
  }

  // ===== Lógica para mostrar los editores en línea =====

  function beginEditMateria(li, materiaId) {
    const materia = materias.find((m) => m.id_materia === materiaId);
    if (!materia) return;
    clearChildren(li);
    const editorNode = tplMateriaEditor.content.cloneNode(true);
    const editorElement = editorNode.querySelector(".inline-editor");
    const inp = editorElement.querySelector(".inp-materia-edit");
    inp.value = materia.materia_nombre;
    editorElement
      .querySelector(".btn-save")
      .addEventListener("click", () =>
        updateMateria(materiaId, asText(inp.value))
      );
    editorElement
      .querySelector(".btn-cancel")
      .addEventListener("click", () => loadInitialData());
    li.appendChild(editorNode);
    inp.focus();
  }

  function beginEditEquipo(li, equipoId) {
    const equipo = equipos.find((e) => e.id_equipo === equipoId);
    if (!equipo) return;
    clearChildren(li);
    const editorNode = tplEquipoEditor.content.cloneNode(true);
    const editorElement = editorNode.querySelector(".inline-editor");
    const inp = editorElement.querySelector(".inp-equipo-edit");
    inp.value = equipo.nombre_equipo;
    editorElement
      .querySelector(".btn-save")
      .addEventListener("click", () =>
        updateEquipo(equipoId, asText(inp.value))
      );
    editorElement
      .querySelector(".btn-cancel")
      .addEventListener("click", () => loadInitialData());
    li.appendChild(editorNode);
    inp.focus();
  }

  // NUEVO: Editor de pregunta con soporte de imagen
  function beginEditPregunta(li, preguntaId) {
    const pregunta = preguntas.find((p) => p.id_pregunta === preguntaId);
    if (!pregunta) {
      showToast("Error: No se encontró la pregunta.", "warn");
      return;
    }
    clearChildren(li);

    const editorNode = tplPreguntaEditor.content.cloneNode(true);
    const editorElement = editorNode.querySelector(".inline-editor");

    const selMateria = editorElement.querySelector(".inp-preg-materia");
    const inpPreguntaTexto = editorElement.querySelector(".inp-preg-texto");
    const inpImagen = editorElement.querySelector(".inp-preg-imagen");
    const previewContainer = editorElement.querySelector(".editor-preview-container");
    const inpR1 = editorElement.querySelector(".inp-preg-r1");
    const inpR2 = editorElement.querySelector(".inp-preg-r2");
    const inpR3 = editorElement.querySelector(".inp-preg-r3");

    if (!selMateria || !inpPreguntaTexto || !inpR1 || !inpR2 || !inpR3) {
      showToast(
        "Error: La plantilla del editor de preguntas está corrupta.",
        "warn"
      );
      return;
    }

    materias.forEach((m) =>
      selMateria.appendChild(createOption(m.id_materia, m.materia_nombre))
    );
    selMateria.value = pregunta.id_materia;
    inpPreguntaTexto.value = pregunta.pregunta;

    // Mostrar imagen existente si la tiene
    if (pregunta.imagen_url) {
      const img = document.createElement("img");
      img.src = pregunta.imagen_url;
      previewContainer.appendChild(img);
      previewContainer.classList.add("active");
    }

    // Manejar cambio de imagen en el editor
    let nuevaImagenFile = null;
    inpImagen.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) {
        clearChildren(previewContainer);
        previewContainer.classList.remove("active");
        nuevaImagenFile = null;
        return;
      }

      const validTypes = ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"];
      if (!validTypes.includes(file.type)) {
        showToast("Formato de imagen no válido.", "warn");
        inpImagen.value = "";
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        showToast("La imagen no debe superar los 5MB.", "warn");
        inpImagen.value = "";
        return;
      }

      nuevaImagenFile = file;
      const reader = new FileReader();
      reader.onload = (event) => {
        clearChildren(previewContainer);
        const img = document.createElement("img");
        img.src = event.target.result;
        previewContainer.appendChild(img);
        previewContainer.classList.add("active");
      };
      reader.readAsDataURL(file);
    });

    const rCorrecta = pregunta.respuestas.find((r) => r.es_correcta);
    const rIncorrectas = pregunta.respuestas.filter((r) => !r.es_correcta);

    inpR1.value = rCorrecta ? rCorrecta.respuesta : "";
    inpR2.value = rIncorrectas[0] ? rIncorrectas[0].respuesta : "";
    inpR3.value = rIncorrectas[1] ? rIncorrectas[1].respuesta : "";

    // Listener para guardar SOLO la pregunta y la materia
    editorElement
      .querySelector(".btn-save-question")
      .addEventListener("click", () => {
        const idMateria = asText(selMateria.value);
        const preguntaTexto = asText(inpPreguntaTexto.value);
        if (!idMateria || !preguntaTexto) {
          showToast(
            "La materia y el texto de la pregunta no pueden estar vacíos.",
            "warn"
          );
          return;
        }
        const payload = {
          id_materia: parseInt(idMateria, 10),
          pregunta: preguntaTexto,
        };
        updatePregunta(preguntaId, payload, nuevaImagenFile);
      });

    // Listener para guardar SOLO las respuestas
    editorElement
      .querySelector(".btn-save-answers")
      .addEventListener("click", () => {
        const r1 = asText(inpR1.value);
        const r2 = asText(inpR2.value);
        const r3 = asText(inpR3.value);

        if (!r1 || !r2) {
          showToast(
            "La respuesta correcta y al menos una incorrecta son requeridas.",
            "warn"
          );
          return;
        }

        const respuestas = [
          { texto: r1, es_correcta: 1 },
          { texto: r2, es_correcta: 0 },
        ];
        if (r3) respuestas.push({ texto: r3, es_correcta: 0 });

        const payload = { respuestas: respuestas };
        updatePregunta(preguntaId, payload);
      });

    editorElement
      .querySelector(".btn-cancel")
      .addEventListener("click", () => loadInitialData());

    li.appendChild(editorNode);
  }

  // ===== Render =====
  function renderMaterias() {
    clearChildren(materiasList);
    materias.forEach((m) => {
      const node = tplMateriaItem.content.cloneNode(true);
      const li = node.querySelector("li");
      li.querySelector(".item-text").textContent = m.materia_nombre;
      li.querySelector(".btn-edit").addEventListener("click", () =>
        beginEditMateria(li, m.id_materia)
      );
      li.querySelector(".btn-delete").addEventListener("click", () =>
        deleteMateria(m.id_materia)
      );
      materiasList.appendChild(node);
    });
    materiasCount.textContent = `${materias.length} Materia${
      materias.length !== 1 ? "s" : ""
    } Cargada${materias.length !== 1 ? "s" : ""}`;
  }

  function renderEquipos() {
    clearChildren(equiposList);
    equipos.forEach((e) => {
      const node = tplEquipoItem.content.cloneNode(true);
      const li = node.querySelector("li");
      li.querySelector(".item-text").textContent = e.nombre_equipo;
      li.querySelector(".score-text").textContent = `0 pts`;
      li.querySelector(".btn-edit").addEventListener("click", () =>
        beginEditEquipo(li, e.id_equipo)
      );
      li.querySelector(".btn-delete").addEventListener("click", () =>
        deleteEquipo(e.id_equipo)
      );
      equiposList.appendChild(node);
    });
    equiposCount.textContent = `${equipos.length} Jugador${
      equipos.length !== 1 ? "es" : ""
    } Participando`;
  }

  // ACTUALIZADO: Renderizar preguntas con imágenes
  function renderPreguntas() {
    clearChildren(preguntasList);
    preguntas.forEach((p) => {
      const node = tplPreguntaItem.content.cloneNode(true);
      const li = node.querySelector("li");
      li.querySelector(".item-materia").textContent = p.materia_nombre;
      li.querySelector(".item-text").textContent = p.pregunta;
      
      // NUEVO: Mostrar imagen si existe
      const imagenContainer = li.querySelector(".item-imagen-container");
      if (p.imagen_url) {
        const img = document.createElement("img");
        img.src = p.imagen_url;
        img.alt = "Imagen de la pregunta";
        imagenContainer.appendChild(img);
      }
      
      li.querySelector(".btn-edit").addEventListener("click", () =>
        beginEditPregunta(li, p.id_pregunta)
      );
      li.querySelector(".btn-delete").addEventListener("click", () =>
        deletePregunta(p.id_pregunta)
      );
      preguntasList.appendChild(li);
    });
    preguntasCount.textContent = `${preguntas.length} Pregunta${
      preguntas.length !== 1 ? "s" : ""
    } Cargada${preguntas.length !== 1 ? "s" : ""}`;
  }

  function renderSelects() {
    const prev = selectMateria.value;
    clearChildren(selectMateria);
    selectMateria.appendChild(createOption("", "Seleccionar materia"));
    materias.forEach((m) =>
      selectMateria.appendChild(createOption(m.id_materia, m.materia_nombre))
    );
    selectMateria.value = prev;

    const prevFiltro = filtroMateria.value;
    clearChildren(filtroMateria);
    filtroMateria.appendChild(createOption("", "Todas"));
    filtroMateria.appendChild(createOption("ninguna", "Ninguna"));
    materias.forEach((m) =>
      filtroMateria.appendChild(createOption(m.id_materia, m.materia_nombre))
    );
    filtroMateria.value = prevFiltro;
  }

  function render() {
    grupoSelect.value = configuracion.grupo;
    renderMaterias();
    renderEquipos();
    renderSelects();
    renderPreguntas();
  }

  // ===== Listeners =====
  filtroMateria.addEventListener("change", loadInitialData);
  filtroTexto.addEventListener("input", loadInitialData);
  rondasInput.addEventListener("change", saveConfigToDB);
  materiaInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") addMateria();
  });
  equipoInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") addEquipo();
  });

  window.startCompetencia = function startCompetencia() {
    window.location.href = "/juego";
  };

  window.addMateria = addMateria;
  window.addEquipo = addEquipo;
  window.addPregunta = addPregunta;

  // ===== INICIO =====
  loadInitialData();
});