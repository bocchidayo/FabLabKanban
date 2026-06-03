# FABLAB UTP — Kanban

> Tablero Kanban para laboratorios de fabricación digital. Diseñado para funcionar en modo kiosco sobre Raspberry Pi, sin proceso de compilación.

[![English](https://img.shields.io/badge/README-English-blue?style=flat-square)](README.en.md)

---

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
- Historial de tareas archivadas con filtro por rango de fechas
- Exportar datos a CSV o JSON
- Botón "Comenzar sin datos demo" para despliegue en producción

**Persistencia**
- Todo se guarda en un archivo `data.json` en el disco de la Raspberry Pi (no en el navegador)
- Un pequeño servicio Python (`server.py`, sólo biblioteca estándar) gestiona la lectura/escritura vía `GET`/`POST /api/state`
- Escrituras atómicas (archivo temporal → `os.replace`) y copias de seguridad rotativas en `backups/` (máx. 20, como mucho una cada 5 min)
- nginx sirve los archivos estáticos y reenvía `/api/` al servicio en `127.0.0.1:5001`
- Botón **Importar JSON** en el panel de administración para restaurar una exportación

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

#### 2. Servidor HTTP persistente (nginx — recomendado)

nginx sirve archivos estáticos con caché y arranque automático. Es la opción recomendada para producción.

```bash
sudo apt install nginx -y
```

Crea `/etc/nginx/sites-available/fablab-kanban`:

```nginx
server {
    listen 5000;
    root /home/pi/fablab-kanban;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/fablab-kanban /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl start nginx
```

nginx arranca automáticamente con el sistema. No se necesita ningún comando adicional.

#### 2b. Servicio de persistencia (sidecar)

El archivo `data.json` lo gestiona un servicio Python que corre junto a nginx.

```bash
sudo cp /home/fablab/FabLabKanban/deploy/fablab-kanban-data.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now fablab-kanban-data
```

Añade el bloque `location /api/` (ver `deploy/nginx-api-snippet.conf`) dentro del `server { ... }` de nginx y asegúrate de que nginx arranque después del sidecar:

```bash
sudo systemctl edit nginx   # añade:  [Unit]\n  Wants=fablab-kanban-data.service\n  After=fablab-kanban-data.service
sudo nginx -t && sudo systemctl reload nginx
```

> ⚠️ El bloque `/api/` no está activo hasta que **recargas nginx**. No te saltes ese paso.

<details>
<summary>Alternativa: Python + systemd</summary>

Crea `/etc/systemd/system/fablab-kanban.service`:

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

</details>

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

### Primer despliegue en producción

> Para usar la app en el laboratorio sin los datos de demostración, sigue estos pasos la primera vez.

1. Abre la app en el navegador (`http://localhost:5000` o la IP de la Raspberry Pi).
2. Haz clic en el ícono de **Ajustes** en la barra superior e ingresa la contraseña por defecto: `admin`.
3. Haz clic en **"Comenzar sin datos demo"** y confirma — se eliminarán todas las tarjetas y miembros de prueba. Las categorías de máquinas se conservan.
4. Ve a **Ajustes del laboratorio**: cambia el nombre del tablero y el tiempo de inactividad del salvapantallas.
5. Ve a **Tipos de máquina**: ajusta o conserva las categorías por defecto.
6. Ve a **Miembros registrados**: añade a los integrantes reales del equipo (nombre, iniciales y color de avatar).
7. Ve a **Contraseña maestra**: cambia `admin` por una contraseña segura.
8. Cierra el panel de administración. El tablero está listo para usar.

#### Migrar datos existentes (de localStorage a archivo)

Si ya tenías datos en el navegador y acabas de actualizar a la versión con persistencia en archivo:

1. Despliega el código, copia y arranca el servicio `fablab-kanban-data`, y recarga nginx (pasos arriba).
2. Abre la app: mostrará un tablero vacío (nueva instalación).
3. Abre **Ajustes** (contraseña) → **Importar JSON** → elige tu copia de seguridad (`fablab-utp-AAAA-MM-DD.json`).
4. Confirma. Los datos quedan en `data.json`. Haz copias de seguridad copiando ese archivo.

---

## Licencia

MIT
