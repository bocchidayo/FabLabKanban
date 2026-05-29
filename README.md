# FABLAB UTP — Kanban

> Tablero Kanban para laboratorios de fabricación digital. Diseñado para funcionar en modo kiosco sobre Raspberry Pi, sin proceso de compilación.

**[English version below ↓](#english)**

---

## Español

### ¿Qué es?

Una aplicación web estática que permite al equipo de un FabLab gestionar tareas y equipos en tiempo real mediante un tablero Kanban. Corre directamente desde el sistema de archivos con un servidor HTTP simple; no requiere Node.js, base de datos ni proceso de build.

### Características

**Tablero**
- Cuatro columnas: **Backlog → Listo → En Progreso → Completado**
- Filtrado por tipo de máquina (láser, impresión 3D, CNC, electrónica, software)
- Arrastrar y soltar tarjetas entre columnas
- Indicadores visuales de prioridad (alta / media / baja)
- Barra de progreso en tarjetas activas con tiempo transcurrido
- Alertas automáticas: tarjetas vencidas y backlogs estancados
- Botón **Reclamar e iniciar** en columna "Listo" para arrancar una tarea con un clic

**Check-in de miembros**
- Los miembros del lab registran su presencia mediante el menú de check-in en la barra superior
- Las tarjetas muestran el avatar del responsable

**Protector de pantalla**
- Se activa automáticamente tras el tiempo de inactividad configurado (por defecto 3 min)
- Muestra un dashboard en vivo: trabajos activos, miembros presentes y tareas completadas hoy
- Se cierra con cualquier interacción

**Tutorial interactivo**
- Recorrido de 7 pasos con spotlight sobre los elementos de la interfaz
- Se activa con la tecla `?` o desde el botón de ayuda

**Panel de administración** _(protegido por contraseña)_
- Gestión de miembros: añadir, editar nombre/iniciales/color de avatar, eliminar
- Configuración del lab: nombre y tiempo de inactividad para el protector de pantalla
- Tipos de máquina: añadir, editar etiqueta/color/slots, eliminar
- Cambio de idioma (Español / English) — se aplica al instante
- Cambio de contraseña maestra
- Historial de tareas archivadas (agrupadas por día)
- Exportar datos a CSV o JSON
- Reiniciar a datos de demostración

**Persistencia**
- Todo se guarda automáticamente en `localStorage` bajo la clave `fablab_utp_v3`
- No se necesita backend

### Atajos de teclado

| Tecla | Acción |
|-------|--------|
| `?` | Abrir tutorial |
| `h` | Abrir cheatsheet de atajos |
| `N` | Nueva tarea en Backlog |
| `1` – `6` | Filtrar por tipo de máquina (1 = todos) |
| `←` / `→` | Mover tarjeta seleccionada entre columnas |
| `Tab` / `Shift+Tab` | Navegar entre tarjetas de una columna |
| `Enter` | Editar tarjeta seleccionada |
| `Esc` | Cerrar modal / admin / tutorial |
| `F` | Alternar pantalla completa |
| `S` | Vista previa del protector de pantalla |

### Estructura del proyecto

```
FablabKanban/
├── index.html          # Punto de entrada; carga dependencias y scripts
└── app/
    ├── styles.css      # Todos los estilos (variables CSS, componentes)
    ├── data.js         # Capa de datos: estado, localStorage, utilidades
    ├── i18n.js         # Traducciones ES / EN
    ├── board.jsx       # Tablero, columnas, tarjetas, TopBar, filtros
    ├── modal.jsx       # Modal de crear / editar tarea
    ├── admin.jsx       # Panel de administración + pantalla de login
    ├── screensaver.jsx # Dashboard de protector de pantalla
    ├── tutorial.jsx    # Overlay de tutorial con spotlight
    └── main.jsx        # Componente raíz App, estado global, atajos
```

### Stack técnico

| Tecnología | Versión | Propósito |
|------------|---------|-----------|
| React | 18.3.1 | Componentes UI |
| ReactDOM | 18.3.1 | Renderizado |
| Babel Standalone | 7.29.0 | Transpila JSX en el navegador |
| Tabler Icons | 3.31.0 | Iconografía |
| Google Fonts — Figtree | — | Tipografía |

> No hay `npm install`, no hay bundler, no hay pasos de compilación.

### Instalación y uso local

```bash
# Clonar el repositorio
git clone https://github.com/bocchidayo/FablabKanban.git
cd FablabKanban

# Iniciar servidor HTTP (cualquier servidor estático sirve)
python3 -m http.server 5000
# o: npx serve .
# o: php -S localhost:5000

# Abrir en el navegador
open http://localhost:5000
```

> **Importante:** Abrir `index.html` directamente como archivo local (`file://`) puede fallar debido a restricciones de CORS al cargar los scripts `.jsx`. Usar siempre un servidor HTTP.

### Despliegue en Raspberry Pi (modo kiosco)

#### 1. Clonar en la Raspberry Pi

```bash
git clone https://github.com/bocchidayo/FablabKanban.git /home/pi/fablab-kanban
```

#### 2. Servidor al arranque

Añadir a `/etc/rc.local` (antes de `exit 0`):

```bash
cd /home/pi/fablab-kanban && python3 -m http.server 5000 &
```

O crear un servicio systemd (`/etc/systemd/system/fablab-kanban.service`):

```ini
[Unit]
Description=FabLab Kanban HTTP Server
After=network.target

[Service]
ExecStart=/usr/bin/python3 -m http.server 5000
WorkingDirectory=/home/pi/fablab-kanban
Restart=always
User=pi

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable fablab-kanban
sudo systemctl start fablab-kanban
```

#### 3. Chromium en modo kiosco (autostart LXDE)

Editar `/etc/xdg/lxsession/LXDE-pi/autostart`:

```
@xset s off
@xset -dpms
@xset s noblank
@unclutter -idle 0.5 -root &
@chromium-browser --kiosk --noerrdialogs --disable-infobars --no-first-run --disable-session-crashed-bubble --disable-restore-session-state http://localhost:5000
```

#### 4. Reiniciar

```bash
sudo reboot
```

La app se abrirá automáticamente en pantalla completa al arrancar.

---

## English

### What is it?

A static web application that lets a FabLab team manage tasks and equipment in real time with a Kanban board. It runs directly from the filesystem with a simple HTTP server — no Node.js, no database, no build step required.

### Features

**Board**
- Four columns: **Backlog → Ready → In Progress → Done**
- Filter by machine type (laser, 3D print, CNC, electronics, software)
- Drag-and-drop cards between columns
- Visual priority indicators (high / mid / low)
- Progress bar on active cards with elapsed time
- Automatic alerts: overdue cards and stale backlogs
- **Claim & Start** button on "Ready" cards to start a task in one click

**Member check-in**
- Lab members register their presence via the check-in menu in the top bar
- Cards display the assigned member's avatar

**Screensaver**
- Activates automatically after a configurable idle timeout (default 3 min)
- Displays a live dashboard: active jobs, checked-in members, and today's completed tasks
- Dismissed by any user interaction

**Interactive tutorial**
- 7-step spotlight walkthrough over interface elements
- Triggered with the `?` key or the help button

**Admin panel** _(password protected)_
- Member management: add, edit name/initials/avatar color, remove
- Lab settings: name and idle timeout for the screensaver
- Machine types: add, edit label/color/slots, remove
- Language switch (Español / English) — applies instantly
- Master password change
- Archived task history (grouped by day)
- Export data to CSV or JSON
- Reset to demo data

**Persistence**
- Everything is saved automatically to `localStorage` under key `fablab_utp_v3`
- No backend required

### Keyboard shortcuts

| Key | Action |
|-----|--------|
| `?` | Open tutorial |
| `h` | Open shortcuts cheatsheet |
| `N` | New task in Backlog |
| `1` – `6` | Filter by machine type (1 = all) |
| `←` / `→` | Move selected card between columns |
| `Tab` / `Shift+Tab` | Navigate cards within a column |
| `Enter` | Edit selected card |
| `Esc` | Close modal / admin / tutorial |
| `F` | Toggle fullscreen |
| `S` | Preview screensaver |

### Project structure

```
FablabKanban/
├── index.html          # Entry point; loads dependencies and app scripts
└── app/
    ├── styles.css      # All styles (CSS variables, components)
    ├── data.js         # Data layer: state, localStorage, utilities
    ├── i18n.js         # ES / EN translations
    ├── board.jsx       # Board, columns, cards, TopBar, filters
    ├── modal.jsx       # Create / edit task modal
    ├── admin.jsx       # Admin panel + login screen
    ├── screensaver.jsx # Screensaver live dashboard
    ├── tutorial.jsx    # Spotlight tutorial overlay
    └── main.jsx        # Root App component, global state, shortcuts
```

### Tech stack

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.3.1 | UI components |
| ReactDOM | 18.3.1 | Rendering |
| Babel Standalone | 7.29.0 | In-browser JSX transpilation |
| Tabler Icons | 3.31.0 | Iconography |
| Google Fonts — Figtree | — | Typography |

> No `npm install`, no bundler, no build steps.

### Local setup

```bash
# Clone the repository
git clone https://github.com/bocchidayo/FablabKanban.git
cd FablabKanban

# Start an HTTP server (any static server works)
python3 -m http.server 5000
# or: npx serve .
# or: php -S localhost:5000

# Open in browser
open http://localhost:5000
```

> **Important:** Opening `index.html` directly as a local file (`file://`) may fail due to CORS restrictions when loading `.jsx` scripts. Always use an HTTP server.

### Raspberry Pi kiosk deployment

#### 1. Clone onto the Raspberry Pi

```bash
git clone https://github.com/bocchidayo/FablabKanban.git /home/pi/fablab-kanban
```

#### 2. Start server on boot

Add to `/etc/rc.local` (before `exit 0`):

```bash
cd /home/pi/fablab-kanban && python3 -m http.server 5000 &
```

Or create a systemd service (`/etc/systemd/system/fablab-kanban.service`):

```ini
[Unit]
Description=FabLab Kanban HTTP Server
After=network.target

[Service]
ExecStart=/usr/bin/python3 -m http.server 5000
WorkingDirectory=/home/pi/fablab-kanban
Restart=always
User=pi

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable fablab-kanban
sudo systemctl start fablab-kanban
```

#### 3. Chromium kiosk mode (LXDE autostart)

Edit `/etc/xdg/lxsession/LXDE-pi/autostart`:

```
@xset s off
@xset -dpms
@xset s noblank
@unclutter -idle 0.5 -root &
@chromium-browser --kiosk --noerrdialogs --disable-infobars --no-first-run --disable-session-crashed-bubble --disable-restore-session-state http://localhost:5000
```

#### 4. Reboot

```bash
sudo reboot
```

The app will open automatically in fullscreen on boot.

---

## License

MIT
