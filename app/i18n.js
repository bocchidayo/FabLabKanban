/* ============================================================
   FABLAB UTP — Translations (EN / ES)
   ============================================================ */
(function () {
  var TX = {
    // ---- board ----------------------------------------------------------
    "board.subtitle":            { en: "Workshop board",           es: "Tablero del taller" },
    "board.checkin":             { en: "Check in",                 es: "Registrarse" },
    "board.checkin_count":       { en: "· {n}",               es: "· {n}" },

    "checkin.title":             { en: "Presence",                 es: "Presencia" },
    "checkin.desc":              { en: "Tap a member to check them in or out.", es: "Toca un miembro para registrarlo." },
    "checkin.out":               { en: "Out",                      es: "Fuera" },
    "checkin.in":                { en: "In",                       es: "Dentro" },

    "member.strip":              { en: "Members",                  es: "Miembros" },
    "member.not_checked_in":     { en: "Not checked in",           es: "No registrado" },
    "member.free":               { en: "Free",                     es: "Libre" },
    "member.busy":               { en: "Busy",                     es: "Ocupado" },

    "filter.all":                { en: "All",                      es: "Todos" },

    "col.backlog":               { en: "Backlog",                  es: "Pendientes" },
    "col.ready":                 { en: "Ready",                    es: "Listo" },
    "col.inprogress":            { en: "In Progress",              es: "En Progreso" },
    "col.done":                  { en: "Done",                     es: "Completado" },

    "col.empty":                 { en: "No tasks",                 es: "Sin tareas" },
    "col.add_task":              { en: "Add task",                 es: "Añadir tarea" },

    "card.elapsed":              { en: "{t} elapsed",              es: "{t} transcurrido" },
    "card.stale":                { en: "stale",                    es: "estancado" },
    "card.overdue_mins":         { en: "+{n} min",                 es: "+{n} min" },
    "card.claim_start":          { en: "Claim & start",            es: "Tomar y empezar" },

    "priority.high":             { en: "High",                     es: "Alta" },
    "priority.mid":              { en: "Medium",                   es: "Media" },
    "priority.low":              { en: "Low",                      es: "Baja" },

    "button.saver_title":        { en: "Screensaver preview",      es: "Vista previa del salvapantallas" },
    "button.admin_title":        { en: "Admin settings",           es: "Administración" },
    "button.help_title":         { en: "How to use",               es: "Cómo usar" },
    "button.fullscreen_title":   { en: "Toggle fullscreen",        es: "Pantalla completa" },

    // ---- modal ----------------------------------------------------------
    "modal.new_task":            { en: "New task",                 es: "Nueva tarea" },
    "modal.edit_task":           { en: "Edit task",                es: "Editar tarea" },
    "modal.adding_to":           { en: "Adding to {col}",          es: "Añadiendo a {col}" },

    "field.owner":               { en: "Owner",                    es: "Responsable" },
    "field.owner_placeholder":   { en: "Select member…",       es: "Seleccionar miembro…" },
    "field.owner_unchecked":     { en: "(not checked in)",         es: "(no registrado)" },

    "field.title":               { en: "Title",                    es: "Título" },
    "field.title_placeholder":   { en: "What needs to be done?",   es: "¿Qué hay que hacer?" },

    "field.desc":                { en: "Description",              es: "Descripción" },
    "field.desc_placeholder":    { en: "Material, settings, quantity, anything the next person needs to know.", es: "Material, ajustes, cantidad, lo que la siguiente persona necesite saber." },

    "field.machine":             { en: "Machine",                  es: "Máquina" },
    "field.machine_optional":    { en: "optional",                 es: "opcional" },

    "field.priority":            { en: "Priority",                 es: "Prioridad" },

    "field.est_duration":        { en: "Est. duration",            es: "Duración est." },
    "field.est_placeholder":     { en: "e.g. 120",                 es: "ej. 120" },
    "field.minutes":             { en: "min",                      es: "min" },

    "field.reassign_owner":      { en: "Owner",                    es: "Responsable" },
    "field.assistants":          { en: "Assistants",               es: "Asistentes" },
    "field.assistants_hint":     { en: "Optional — tap to add",    es: "Opcional — toca para añadir" },
    "field.assistants_none":     { en: "No assistants",            es: "Sin asistentes" },
    "label.owner":               { en: "Owner",                    es: "Responsable" },
    "label.team":                { en: "Team",                     es: "Equipo" },
    "label.assistant":           { en: "Assistant",                es: "Asistente" },

    "action.cancel":             { en: "Cancel",                   es: "Cancelar" },
    "action.create_task":        { en: "Create task",              es: "Crear tarea" },
    "action.save":               { en: "Save",                     es: "Guardar" },
    "action.delete":             { en: "Delete",                   es: "Eliminar" },
    "action.delete_confirm":     { en: "Yes, delete",              es: "Sí, eliminar" },
    "action.delete_warning":     { en: "Delete this task? This cannot be undone.", es: "¿Eliminar esta tarea? No se puede deshacer." },

    "kbd.esc_cancel":            { en: "Esc to cancel",            es: "Esc para cancelar" },

    // ---- cheatsheet -----------------------------------------------------
    "cheatsheet.title":          { en: "Keyboard Shortcuts",       es: "Atajos de teclado" },
    "cheat.new_task":            { en: "New task",                 es: "Nueva tarea" },
    "cheat.filter_board":        { en: "Filter board",             es: "Filtrar tablero" },
    "cheat.screensaver":         { en: "Screensaver",              es: "Salvapantallas" },
    "cheat.close":               { en: "Close",                    es: "Cerrar" },
    "cheat.move_card":           { en: "Move card",                es: "Mover tarjeta" },
    "cheat.edit_card":           { en: "Edit card",                es: "Editar tarjeta" },
    "cheat.select_next":         { en: "Select next",              es: "Seleccionar siguiente" },
    "cheat.tutorial":            { en: "Tutorial",                 es: "Tutorial" },
    "cheat.cheatsheet":          { en: "This cheatsheet",          es: "Estos atajos" },
    "cheat.dismiss":             { en: "Press Esc to dismiss",     es: "Presiona Esc para cerrar" },

    // ---- screensaver ----------------------------------------------------
    "saver.live":                { en: "Live",                     es: "En vivo" },
    "saver.no_active_jobs":      { en: "No active jobs",           es: "Sin trabajos activos" },
    "saver.unknown":             { en: "Unknown",                  es: "Desconocido" },

    "saver.stat_progress":       { en: "Jobs in progress",         es: "Trabajos en progreso" },
    "saver.stat_checked_in":     { en: "Members checked in",       es: "Miembros registrados" },
    "saver.stat_free":           { en: "Members free",             es: "Miembros libres" },
    "saver.stat_done":           { en: "Jobs done today",          es: "Trabajos completados hoy" },

    "saver.active_jobs":         { en: "Active jobs",              es: "Trabajos activos" },
    "saver.members":             { en: "Members",                  es: "Miembros" },
    "saver.members_count":       { en: "{a}/{b}",                  es: "{a}/{b}" },

    "saver.left":                { en: "{t} left",                 es: "{t} restante" },
    "saver.completed_today":     { en: "Completed today · {n}", es: "Completados hoy · {n}" },
    "saver.any_key":             { en: "Press any key to return",  es: "Presiona cualquier tecla para volver" },
    "saver.key_label":           { en: "any key",                  es: "cualquier tecla" },

    // ---- admin ----------------------------------------------------------
    "admin.title":               { en: "Admin",                    es: "Administración" },
    "admin.tag":                 { en: "Settings",                 es: "Ajustes" },

    "admin.login_title":         { en: "Admin access",             es: "Acceso administrador" },
    "admin.login_desc":          { en: "Enter the master password to access admin settings.", es: "Ingresa la contraseña maestra para acceder a los ajustes." },
    "admin.login_placeholder":   { en: "Enter password",           es: "Ingresar contraseña" },
    "admin.login_error":         { en: "Incorrect password. Try again.", es: "Contraseña incorrecta. Intenta de nuevo." },
    "admin.login_back":          { en: "Back to board",            es: "Volver al tablero" },
    "admin.login_unlock":        { en: "Unlock",                   es: "Desbloquear" },
    "admin.login_hint":          { en: "Demo password: admin",     es: "Contraseña demo: admin" },

    "admin.members_title":       { en: "Registered members",       es: "Miembros registrados" },
    "admin.members_desc":        { en: "{n} members. Edit name, initials, or avatar color.", es: "{n} miembros. Edita nombre, iniciales o color." },
    "admin.members_placeholder": { en: "New member name",          es: "Nombre del nuevo miembro" },
    "admin.members_add":         { en: "Add",                      es: "Añadir" },

    "admin.lab_title":           { en: "Lab settings",             es: "Ajustes del laboratorio" },
    "admin.lab_desc":            { en: "Board name shown in the top bar, and minutes of inactivity before the screensaver activates.", es: "Nombre mostrado en la barra superior, y minutos de inactividad antes del salvapantallas." },
    "admin.lab_name":            { en: "Board name",               es: "Nombre del tablero" },
    "admin.lab_idle":            { en: "Idle (min)",               es: "Inactividad (min)" },

    "admin.machines_title":      { en: "Machine types",            es: "Tipos de máquina" },
    "admin.machines_desc":       { en: "Add, edit or remove machine categories. Icons, labels and colours update everywhere immediately.", es: "Añade, edita o elimina categorías de máquina. Íconos, nombres y colores se actualizan al instante." },
    "admin.machines_placeholder":{ en: "Machine name",             es: "Nombre de la máquina" },
    "admin.machines_add":        { en: "Add machine",              es: "Añadir máquina" },
    "admin.machines_slots":      { en: "{n}/8 slots used",         es: "{n}/8 espacios usados" },
    "admin.machines_save":       { en: "Save machines",            es: "Guardar máquinas" },
    "admin.machines_min":        { en: "Must have at least one machine type", es: "Debe haber al menos un tipo de máquina" },
    "admin.machines_remove":     { en: "Remove",                   es: "Eliminar" },

    "admin.lang_title":          { en: "Language",                 es: "Idioma" },
    "admin.lang_desc":           { en: "Interface language. Changes apply immediately.", es: "Idioma de la interfaz. Los cambios se aplican al instante." },
    "admin.lang_en":             { en: "English",                  es: "Inglés" },
    "admin.lang_es":             { en: "Español",             es: "Español" },

    "admin.pw_title":            { en: "Master password",          es: "Contraseña maestra" },
    "admin.pw_desc":             { en: "Change the password required to access admin settings.", es: "Cambia la contraseña para acceder a los ajustes de administrador." },
    "admin.pw_save":             { en: "Save",                     es: "Guardar" },
    "admin.pw_saved":            { en: "Saved",                    es: "Guardado" },

    "admin.archive_title":       { en: "Archived tasks",           es: "Tareas archivadas" },
    "admin.archive_desc":        { en: "Completed tasks from past days, grouped by date.", es: "Tareas completadas de días anteriores, agrupadas por fecha." },
    "admin.archive_empty":       { en: "No archived tasks yet. Completed tasks are archived daily at midnight.", es: "Aún no hay tareas archivadas. Las tareas completadas se archivan cada medianoche." },
    "admin.archive_count":       { en: "{n} task{s}",              es: "{n} tarea{s}" },
    "admin.archive_from":        { en: "From",                     es: "Desde" },
    "admin.archive_to":          { en: "To",                       es: "Hasta" },
    "admin.archive_clear":       { en: "Clear filter",             es: "Limpiar" },
    "admin.archive_none":        { en: "No entries match the selected dates.", es: "No hay tareas en el rango seleccionado." },

    "admin.export_title":        { en: "Export data",              es: "Exportar datos" },
    "admin.export_desc":         { en: "Download your board data in CSV or JSON format.", es: "Descarga los datos del tablero en formato CSV o JSON." },
    "admin.export_csv":          { en: "Export CSV",               es: "Exportar CSV" },
    "admin.export_json":         { en: "Export JSON",              es: "Exportar JSON" },
    "admin.reset":               { en: "Reset demo data",          es: "Restablecer datos demo" },
    "admin.reset_confirm":       { en: "Reset all demo data? This cannot be undone.", es: "¿Restablecer todos los datos? No se puede deshacer." },
    "admin.fresh_btn":           { en: "Start fresh",              es: "Comenzar sin datos demo" },
    "admin.fresh_confirm":       { en: "This will delete ALL members and tasks and cannot be undone. Machine categories will be kept. Continue?", es: "Esto eliminará TODOS los miembros y tareas y no se puede deshacer. Las categorías de máquinas se conservarán. ¿Continuar?" },
    "admin.unknown_member":      { en: "Unknown",                  es: "Desconocido" },

    // ---- tutorial -------------------------------------------------------
    "tut.step1_title": { en: "The Board", es: "El Tablero" },
    "tut.step1_text":  { en: "Four columns track every job from idea to done. <strong>Backlog</strong> holds upcoming work, <strong>Ready</strong> means good to go, <strong>In Progress</strong> is active, and <strong>Done</strong> is finished for today. Cards move left to right as work progresses.",
                         es: "Cuatro columnas siguen cada trabajo desde la idea hasta el final. <strong>Pendientes</strong> contiene el trabajo próximo, <strong>Listo</strong> significa listo para empezar, <strong>En Progreso</strong> está activo, y <strong>Completado</strong> está terminado por hoy. Las tarjetas se mueven de izquierda a derecha." },
    "tut.step2_title": { en: "Reading a Card", es: "Leyendo una Tarjeta" },
    "tut.step2_text":  { en: "Each card shows a <strong>priority dot</strong> (red = high, amber = mid, gray = low), an optional <strong>machine tag</strong> (like Laser or 3D Print), the <strong>owner's avatar</strong>, and a <strong>timestamp</strong>. In Progress cards also show elapsed time and a progress bar.",
                         es: "Cada tarjeta muestra un <strong>punto de prioridad</strong> (rojo = alta, ámbar = media, gris = baja), una <strong>etiqueta de máquina</strong> opcional (como Láser o Impresión 3D), el <strong>avatar del responsable</strong>, y una <strong>marca de tiempo</strong>. Las tarjetas en progreso también muestran el tiempo transcurrido y una barra de progreso." },
    "tut.step3_title": { en: "Member Strip",            es: "Tira de Miembros" },
    "tut.step3_text":  { en: "See who's in the lab at a glance. <strong>Green dot</strong> = free, <strong>orange dot</strong> = busy on a job, <strong>grayed out</strong> = not checked in. The board uses this to know who's available for new work.",
                         es: "Ve quién está en el laboratorio de un vistazo. <strong>Punto verde</strong> = libre, <strong>punto naranja</strong> = ocupado, <strong>atenuado</strong> = no registrado. El tablero usa esto para saber quién está disponible para nuevo trabajo." },
    "tut.step4_title": { en: "Check-in",                   es: "Registro de presencia" },
    "tut.step4_text":  { en: "The <strong>Check-in button</strong> in the top bar shows how many members are currently in the lab. Click it to open the presence list — tap any name to toggle that person <strong>in</strong> or <strong>out</strong>. Checked-in members appear active on the board; their free/busy status is inferred automatically from their active cards.",
                         es: "El <strong>botón de registro</strong> en la barra superior muestra cuántos miembros están en el lab ahora mismo. Haz clic para abrir la lista de presencia — toca un nombre para registrarlo como <strong>dentro</strong> o <strong>fuera</strong>. Los miembros registrados aparecen activos en el tablero; su estado libre/ocupado se deduce automáticamente de sus tarjetas activas." },
    "tut.step5_title": { en: "Creating a Card", es: "Creando una Tarjeta" },
    "tut.step5_text":  { en: "Click <strong>Add task</strong> at the bottom of any column to open the creation form. Fill in the <strong>owner</strong>, <strong>title</strong>, and <strong>description</strong> (required), then optionally pick a <strong>machine type</strong> and <strong>priority</strong>. Press <strong>Ctrl+Enter</strong> or click Create. The card lands in that column.",
                         es: "Haz clic en <strong>Añadir tarea</strong> al final de cualquier columna para abrir el formulario. Llena el <strong>responsable</strong>, <strong>título</strong> y <strong>descripción</strong> (obligatorios), luego opcionalmente elige un <strong>tipo de máquina</strong> y <strong>prioridad</strong>. Presiona <strong>Ctrl+Enter</strong> o haz clic en Crear." },
    "tut.step6_title": { en: "Moving Cards", es: "Moviendo Tarjetas" },
    "tut.step6_text":  { en: "<strong>Drag</strong> any card and drop it into another column to move it. Prefer the keyboard? Press <strong>Tab</strong> to select a card, then use <strong>←</strong> and <strong>→</strong> arrow keys to move it left or right one column. <strong>Enter</strong> opens the selected card for editing.",
                         es: "<strong>Arrastra</strong> cualquier tarjeta y suéltala en otra columna para moverla. ¿Prefieres el teclado? Presiona <strong>Tab</strong> para seleccionar una tarjeta, luego usa las flechas <strong>←</strong> y <strong>→</strong> para moverla entre columnas. <strong>Enter</strong> abre la tarjeta para editarla." },
    "tut.step7_title": { en: "Claim & Start", es: "Tomar y Empezar" },
    "tut.step7_text":  { en: "See a Ready card you want to work on? Click the orange <strong>Claim &amp; start</strong> button — it <strong>assigns the card to you</strong>, moves it to In Progress, and <strong>starts the timer</strong> from zero. If nobody is checked in, it picks the first available member.",
                         es: "¿Ves una tarjeta Lista en la que quieres trabajar? Haz clic en el botón naranja <strong>Tomar y empezar</strong> — <strong>te asigna la tarjeta</strong>, la mueve a En Progreso, y <strong>arranca el temporizador</strong> desde cero. Si nadie está registrado, elige al primer miembro disponible." },
    "tut.step8_title": { en: "The Screensaver", es: "El Salvapantallas" },
    "tut.step8_text":  { en: "After a few idle minutes the screen switches to a <strong>live dashboard</strong> with four big stats, active jobs with progress bars, member presence, and today's completed tasks. <strong>Press any key or click</strong> to return. You can also preview it anytime with the monitor button in the top bar.",
                         es: "Después de unos minutos de inactividad, la pantalla cambia a un <strong>panel en vivo</strong> con cuatro estadísticas grandes, trabajos activos con barras de progreso, presencia de miembros y tareas completadas hoy. <strong>Presiona cualquier tecla o haz clic</strong> para volver. También puedes previsualizarlo con el botón del monitor en la barra superior." },

    "tut.step_counter":          { en: "{a} of {b}",               es: "{a} de {b}" },
    "tut.back":                  { en: "Back",                     es: "Atrás" },
    "tut.next":                  { en: "Next",                     es: "Siguiente" },
    "tut.done":                  { en: "Done",                     es: "Listo" },
    "tut.skip":                  { en: "Skip tutorial",            es: "Saltar tutorial" },

    // ---- attendance -------------------------------------------------------
    "admin.attendance_title":    { en: "Attendance",                         es: "Asistencia" },
    "admin.attendance_desc":     { en: "Check-in and check-out log by day.", es: "Registro de entradas y salidas por día." },
    "admin.attendance_date":     { en: "Day",                                es: "Día" },
    "admin.attendance_entry":    { en: "Entry",                              es: "Entrada" },
    "admin.attendance_exit":     { en: "Exit",                               es: "Salida" },
    "admin.attendance_duration": { en: "Duration",                           es: "Duración" },
    "admin.attendance_active":   { en: "— active",                           es: "— activo" },
    "admin.attendance_ongoing":  { en: "ongoing",                            es: "en curso" },
    "admin.attendance_absent":   { en: "No check-in today",                  es: "Sin check-in hoy" },
    "admin.attendance_export":   { en: "Export attendance CSV",              es: "Exportar CSV asistencia" },
    "admin.attendance_empty":    { en: "No attendance records for this day.", es: "Sin registros de asistencia para este día." },
  };

  function t(key, lang) {
    var entry = TX[key];
    if (!entry) return key;
    return entry[lang] || entry["en"] || key;
  }

  window.I18n = {
    t: t,
    translations: TX,
  };
})();
