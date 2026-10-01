# Desplegar GimnasioLibreSV en un VPS con Coolify

Guía paso a paso para correr el demo (o un gimnasio) en un VPS que ya usa
**Coolify** — la PaaS self-hosted que trae Docker + Traefik + HTTPS automático.
Si tu VPS no tiene Coolify y prefieres el stack con Caddy, usa
[DEPLOY_VPS.md](DEPLOY_VPS.md).

> **Tiempo estimado:** 15–25 minutos (la primera build y la media tardan unos
> minutos más).
> **Necesitas:** un VPS con Coolify instalado, acceso al panel y una deploy key
> de solo lectura para el repo privado.

La diferencia clave con la guía de VPS: aquí **Coolify es el proxy** (Traefik).
Por eso el deploy usa `docker-compose.coolify.yml`: sin Caddy, sin publicar
puertos, y con los datos en **volúmenes nombrados**. El dominio que configures
en Coolify enruta al servicio `web` (puerto 80 interno).

## 1. Deploy key (acceso al repo privado)

Coolify clona el repo por SSH con una *deploy key* de solo lectura:

1. En Coolify: **Keys & Tokens → Private Keys → + Add**.
2. Nombre `gimnasiolibre-deploy`, tipo **ED25519** → **Generate new ED25519 SSH
   Key** → **Continue**.
3. Copia la **public key** que muestra Coolify.
4. En GitHub: repo `GimnasioLibreSV-private` → **Settings → Deploy keys → Add
   deploy key**. Pega la pública, título `coolify-vps`, y **deja sin marcar
   "Allow write access"** (solo lectura).

> Esta llave solo da acceso a este repositorio; no sirve para que Coolify
> conecte con el servidor. Esa es otra (Servers → Private Key) y ya quedó
> configurada al instalar Coolify.

## 2. Crear el recurso

1. **Project → + New** (puedes crear un proyecto `GimnasioLibreSV`).
2. Elige **Private Repository (with deploy key)**.
3. Selecciona la deploy key del paso 1 y pega la URL SSH:

   ```text
   git@github.com:DIAL-Studio/GimnasioLibreSV-private.git
   ```

4. Rama: `main`.

## 3. Build Pack

En **Configuration → General**:

| Campo                     | Valor                        |
|---------------------------|------------------------------|
| Build Pack                | `Docker Compose`             |
| Base Directory            | `/`                          |
| Docker Compose Location   | `/docker-compose.coolify.yml` |

Guarda y revisa **Docker Compose Content**: deben aparecer los servicios
`media`, `api` y `web`, los volúmenes `data`, `media_img` y `media_gif`
(visibles también en **Persistent Storage**, de solo lectura porque se editan en
el compose) y las variables `${RP_ID}`, `${ORIGIN}`, `${RP_NAME}`… que Coolify
crea como variables editables (paso 5).

> ⚠️ No uses aquí `docker-compose.prod.yml` ni `deploy/Caddyfile`: su Caddy
> pelea con Traefik por los puertos 80/443 y el sitio deja de responder.

## 4. Dominio (sslip.io, sin tocar DNS)

1. En el recurso, abre **Domains** y selecciona el servicio **web** (puerto 80).
2. Deja que Coolify **genere el dominio**: te dará algo como
   `http://<uuid>.<IP-del-VPS>.sslip.io`.
3. Edítalo y cambia `http://` por `https://`:

   ```text
   https://<uuid>.<IP-del-VPS>.sslip.io
   ```

4. Guarda. Traefik pedirá el certificado a Let's Encrypt (reto HTTP-01, usa el
   puerto 80).

> **No hace falta DNS:** `sslip.io` es un dominio público que resuelve cualquier
> `*.sslip.io` a la IP que va delante. Eso sí: el hostname queda atado a la IP
> del VPS (ver caveats). Asegúrate de que el firewall del VPS tenga abiertos los
> puertos 80 y 443.

## 5. Variables de entorno (Coolify UI)

En **Environment Variables** del recurso, ajusta estas tres (las demás conservan
su valor por defecto):

| Variable  | Valor                                                            | Ejemplo                          |
|-----------|------------------------------------------------------------------|----------------------------------|
| `RP_ID`   | Hostname EXACTO, sin `https://` ni puerto                        | `abc123.203.0.113.sslip.io`      |
| `ORIGIN`  | URL pública EXACTA, con `https://` y sin `/` final               | `https://abc123.203.0.113.sslip.io` |
| `RP_NAME` | Nombre que ve el usuario en el diálogo de la passkey             | `Gimnasio Ejemplo`               |

Opcionales (mismas reglas que en [DEPLOY_VPS.md](DEPLOY_VPS.md)):
`ADMIN_UIDS`, `INVITE_ONLY`, `SESSION_DAYS`, `VAPID_SUBJECT`.

> ⚠️ `RP_ID` y `ORIGIN` deben coincidir **exactamente** con la URL del navegador
> o las passkeys fallarán. Las passkeys solo funcionan sobre HTTPS —la única
> excepción es `http://localhost`— y quedan atadas al hostname de `RP_ID`. Si lo
> cambias después de que la gente se registre, sus passkeys dejan de funcionar:
> elige el dominio antes de invitar a nadie.

## 6. Deploy y verificación

Pulsa **Deploy** y mira **Deployments** (build) y los **Logs** de cada servicio.
Lo normal es ver:

1. Clonado del repo con la deploy key.
2. Build de `api` y de `web` (la primera vez tarda unos minutos).
3. `media`: `↓ Downloading exercise media (~140 MB, one time)…` →
   `✓ Exercise media ready (N images).` Solo la primera vez; después dice
   "already present" y el contenedor queda **exited** (es de un solo uso:
   normal).
4. `api` healthy y `web` sirviendo.

Comprueba que todo está sano:

```bash
curl https://<hostname>/api/health   # {"ok":true,...}
```

Abre `https://<hostname>` en el navegador: debe cargar la app con candado (TLS).

## 7. Guion de demo

1. **Android (Chrome):** abre `https://<hostname>` → menú **⋮ → Instalar app /
   Añadir a pantalla de inicio**. Queda a pantalla completa, como app nativa.
2. **iPhone (Safari):** abre la misma URL → **Compartir → Añadir a pantalla de
   inicio**.
3. Entra con **"Continuar sin cuenta"** (modo invitado: los datos viven solo en
   ese navegador, sin passkey ni fricción).
4. **Ajustes → "Cargar plan inicial"** → se llena la rutina Push / Pull /
   Piernas.
5. Muestra **Exportar copia (JSON)** y **Exportar para apps de salud**.
6. (Opcional, para el pitch B2B) Crea un perfil con passkey y muestra que la
   sesión y los datos quedan separados por usuario.

> En invitado los datos no salen del teléfono. Es justo lo que quieres para el
> demo: cero cuentas, cero fricción.

## 8. Fallback: sin certificado (HTTP + IP)

Si Let's Encrypt falla (puerto 80 bloqueado, límite de intentos, etc.), el demo
sigue funcionando por HTTP:

1. En **Domains**, borra el dominio (déjalo vacío).
2. En el repo, descomenta el bloque `ports:` del servicio `web` en
   `docker-compose.coolify.yml`:

   ```yaml
   ports:
     - "${WEB_PORT:-8080}:80"
   ```

3. Haz commit y push a `main`; en Coolify pulsa **Deploy** de nuevo.
4. En **Environment Variables**, ajusta `ORIGIN=http://<IP-del-VPS>:8080`.
5. Abre `http://<IP-del-VPS>:8080` y usa el **modo invitado** ("Continuar sin
   cuenta").

> Sin HTTPS no hay passkeys (WebAuthn exige un contexto seguro), no hay
> instalación real en Android (Chrome la requiere) y no hay offline. En iPhone
> Safari sí puedes "Añadir a pantalla de inicio", pero también sin offline.
> Para el demo alcanza; para un gimnasio real, vuelve al dominio con HTTPS.

## 9. Caveats (limitaciones y mantenimiento)

- **El hostname sslip.io está atado a la IP.** Si la IP del VPS cambia, cambia
  el hostname: el certificado y las passkeys dejan de valer. Para un gimnasio
  real usa un dominio propio apuntado a la IP; elige dominio antes de invitar a
  nadie.
- **`media` aparece "exited"**: es de un solo uso (`restart: "no"`). Si las
  imágenes ya están en el volumen, se salta la descarga; solo preocúpate si la
  primera vez su log no dice "ready".
- **No uses `docker-compose.prod.yml` / `deploy/Caddyfile` bajo Coolify.**
  Caddy chocaría con Traefik (puertos 80/443) y `web` quedaría publicado dos
  veces.
- **Los datos viven en volúmenes nombrados** (`data`, `media_img`, `media_gif`),
  no en `./data`. `deploy/backup.sh` no los ve: respalda el volumen `data`
  (contiene `db.json`, los estados, `secret` y `vapid.json`). Con
  `docker volume ls` encuentras su nombre real (Coolify le pone prefijo):

  ```bash
  docker volume ls | grep data
  docker run --rm -v <proyecto>_data:/data -v "$PWD:/backup" alpine \
    tar czf /backup/data-$(date +%F-%H%M).tgz -C /data .
  ```

  (O usa la función de backups de Coolify si prefieres S3.)
- **Actualizar** = push a `main` + **Deploy** en Coolify (o configura
  auto-deploy con webhook). La media y `data` no se tocan.
- **Varios gimnasios:** crea un recurso por gimnasio con su dominio y su
  `RP_NAME`; cada uno tendrá sus propios volúmenes y datos.

## Enlaces

- **[DEPLOY_VPS.md](DEPLOY_VPS.md)** — la misma app con Caddy en un VPS sin
  Coolify (modo multi-gimnasio, respaldos con rclone, etc.).
- **[SELF_HOSTING.md](SELF_HOSTING.md)** — guía general de self-hosting (inglés):
  modo invitado, notificaciones, Cloudflare Tunnel y otros proxies.
- **[README.md](../README.md)** — características y configuración.
- **[NOTICE.md](../NOTICE.md)** — licencias, incluida la de la media de
  ejercicios.
