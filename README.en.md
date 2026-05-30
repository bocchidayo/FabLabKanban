# FABLAB UTP — Kanban

> Kanban board for digital fabrication labs. Designed to run as a kiosk on Raspberry Pi, with no build step.

[![Español](https://img.shields.io/badge/README-Español-orange?style=flat-square)](README.md)

---

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
- Archived task history with date-range filter
- Export data to CSV or JSON
- "Start fresh" button to remove demo data for production deployments

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

#### 2. Persistent HTTP server (nginx — recommended)

nginx serves static files with caching and starts automatically on boot. This is the recommended option for production.

```bash
sudo apt install nginx -y
```

Create `/etc/nginx/sites-available/fablab-kanban`:

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

nginx starts automatically with the system. No additional commands needed.

<details>
<summary>Alternative: Python + systemd</summary>

Create `/etc/systemd/system/fablab-kanban.service`:

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

### First deployment

> To use the app in your lab without the demo data, follow these steps the first time.

1. Open the app in a browser (`http://localhost:5000` or the Raspberry Pi's IP address).
2. Click the **Admin settings** icon in the top bar and enter the default password: `admin`.
3. Click **"Start fresh"** and confirm — all demo cards and members will be deleted. Machine categories are kept.
4. Go to **Lab settings**: change the board name and screensaver idle timeout.
5. Go to **Machine categories**: adjust or keep the defaults.
6. Go to **Registered members**: add your real team members (name, initials, and avatar color).
7. Go to **Master password**: change `admin` to a secure password.
8. Close the admin panel. The board is ready to use.

---

## License

MIT
