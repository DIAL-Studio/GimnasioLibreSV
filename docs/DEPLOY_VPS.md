# Desplegar GimnasioLibreSV en un VPS (Hostinger)

Guía paso a paso para correr uno o varios gimnasios en un VPS con HTTPS real —
obligatorio para que funcionen las passkeys. Está pensada para un VPS de
Hostinger con Ubuntu, pero sirve para cualquier proveedor con Docker.

> **Tiempo estimado:** 20–30 minutos.
> **Necesitas:** un VPS con Ubuntu 22.04/24.04, un dominio que puedas apuntar a
> su IP y acceso SSH.

## 1. Preparar el VPS

Entra por SSH y actualiza el sistema:

```bash
ssh root@TU_IP_DEL_VPS
apt update && apt upgrade -y
```

Instala Docker con el script oficial:

```bash
curl -fsSL https://get.docker.com | sh
docker --version && docker compose version
```

Abre solo los puertos necesarios:

```bash
ufw allow OpenSSH
ufw allow 80/tcp      # Caddy lo usa para el challenge TLS y redirige a HTTPS
ufw allow 443/tcp     # HTTPS
ufw allow 443/udp     # HTTP/3 (opcional)
ufw enable
```

> Si la plantilla de Hostinger ya trae Docker instalado, salta la instalación y
> verifica con `docker compose version`.

## 2. Clonar el proyecto

Crea una carpeta por gimnasio (aquí `gym1`):

```bash
mkdir -p /srv/gimnasios && cd /srv/gimnasios
git clone https://github.com/DIAL-Studio/GimnasioLibreSV.git gym1
cd gym1
```

> Si el repositorio es privado, clona con un token de GitHub
> (`git clone https://TU_TOKEN@github.com/DIAL-Studio/GimnasioLibreSV.git gym1`)
> o configura una deploy key.

## 3. Configurar `.env`

```bash
cp .env.example .env
nano .env
```

Lo mínimo a editar:

```dotenv
RP_ID=gym1.tudominio.com
ORIGIN=https://gym1.tudominio.com
WEB_PORT=8080
RP_NAME=Gimnasio Ejemplo
```

| Variable      | Qué es                                                              | Ejemplo                 |
|---------------|---------------------------------------------------------------------|-------------------------|
| `RP_ID`       | Hostname EXACTO del sitio (sin `https://`, sin puerto). Las passkeys quedan atadas a él. | `gym1.tudominio.com` |
| `ORIGIN`      | URL pública EXACTA (con `https://`, sin `/` final).                 | `https://gym1.tudominio.com` |
| `WEB_PORT`    | Puerto local del host para depurar (Caddy lo publica solo en `127.0.0.1`). | `8080`            |
| `RP_NAME`     | Nombre que ve el usuario en el diálogo de la passkey.               | `Gimnasio Ejemplo`      |
| `ADMIN_UIDS`  | (Opcional) ids de usuario con panel de administración.              | *(ninguno)*             |
| `INVITE_ONLY` | (Opcional) `1` para exigir código de invitación al crear perfil.    | *(desactivado)*         |

> ⚠️ **HTTPS y hostname exactos son obligatorios.** Las passkeys (WebAuthn) solo
> funcionan sobre HTTPS —la única excepción es `http://localhost`— y quedan atadas
> al hostname de `RP_ID`. Si cambias `RP_ID` después de que la gente se registre,
> sus passkeys dejan de funcionar: elige el dominio antes de invitar a nadie.

## 4. DNS

En Hostinger (o tu proveedor de DNS) crea un registro **A**:

| Tipo | Nombre | Valor          |
|------|--------|----------------|
| A    | `gym1` | `TU_IP_DEL_VPS` |

Comprueba que ya resuelve antes de seguir:

```bash
dig +short gym1.tudominio.com   # debe imprimir la IP del VPS
```

> Caddy no podrá emitir el certificado hasta que el DNS apunte al VPS. Si acabas
> de crear el registro, espera unos minutos (depende del TTL).

## 5. Arrancar con HTTPS

Edita `deploy/Caddyfile` y descomenta el bloque de tu gimnasio con tu dominio:

```caddy
gym1.tudominio.com {
    reverse_proxy gym-web:80
}
```

Luego arranca el stack de producción:

```bash
docker network create gimnasiolibre-edge
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

- `gimnasiolibre-edge` es la red compartida por la que Caddy habla con el
  contenedor `web` de cada gimnasio (así se pueden sumar más gimnasios después).
- La primera vez se construyen las imágenes y se descarga la media de ejercicios
  (~140 MB, una sola vez).
- Caddy pide el certificado a Let's Encrypt automáticamente. Mira el progreso:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f caddy
```

Comprueba que todo está sano:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
curl https://gym1.tudominio.com/api/health   # {"ok":true,...}
```

Abre `https://gym1.tudominio.com`, crea tu perfil con passkey y añádelo a la
pantalla de inicio (iOS: Compartir → Añadir a pantalla de inicio; Android: ⋮ →
Añadir a pantalla de inicio).

> El comando es largo; si quieres, crea un alias en tu shell:
> `alias dc='docker compose -f docker-compose.yml -f docker-compose.prod.yml'`.

## 6. Varios gimnasios en el mismo VPS

Cada gimnasio es un stack independiente: su carpeta, su `.env`, su `./data` y su
subdominio. Todos comparten la red `gimnasiolibre-edge` y **un solo Caddy** (el
del primer gimnasio) les da HTTPS.

```bash
cd /srv/gimnasios
git clone https://github.com/DIAL-Studio/GimnasioLibreSV.git gym2
cd gym2
cp .env.example .env
nano .env
```

En el `.env` del segundo gimnasio añade, además de `RP_ID`/`ORIGIN`/`RP_NAME`:

```dotenv
COMPOSE_PROJECT_NAME=gym2   # evita choques de nombres de contenedor
WEB_ALIAS=gym2              # nombre con el que Caddy lo encuentra
WEB_PORT=8081               # distinto del gym1 (solo depuración local)
```

Arranca **solo sus servicios** (sin Caddy, que ya corre en gym1):

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build web api
```

Y en el Caddyfile del gimnasio 1 (`/srv/gimnasios/gym1/deploy/Caddyfile`) añade el
bloque del nuevo gimnasio y recarga:

```caddy
gym2.tudominio.com {
    reverse_proxy gym2-web:80
}
```

```bash
cd /srv/gimnasios/gym1
docker compose -f docker-compose.yml -f docker-compose.prod.yml restart caddy
```

Cada `./data` es independiente: respáldalos por separado (sección 7). Para
personalizar la marca de cada gimnasio (nombre en la passkey, textos), edita su
`.env` (`RP_NAME`) y reconstruye con `up -d --build`.

## 7. Respaldos

Todo lo importante vive en `./data`: `db.json` (perfiles + passkeys públicas),
`state-<usuario>.json` (plan, entrenos, peso) y `secret` / `vapid.json` (claves
de sesión y notificaciones). La media se puede volver a descargar
(`./scripts/fetch-media.sh`), así que no hace falta respaldarla.

El script `deploy/backup.sh` crea un `.tar.gz` con fecha en `./backups`, borra
los más viejos (conserva 7 por defecto) y, si defines `RCLONE_REMOTE`, copia el
archivo fuera del servidor.

```bash
./deploy/backup.sh --help
./deploy/backup.sh                                      # local, conserva 7
./deploy/backup.sh --keep 14                            # conserva 14
RCLONE_REMOTE=gdrive:gimnasio-gym1 ./deploy/backup.sh   # + copia externa
```

Cron diario a las 03:30 (ejecuta el script una vez a mano antes, para que exista
`./backups`):

```bash
crontab -e
```

```cron
30 3 * * * cd /srv/gimnasios/gym1 && ./deploy/backup.sh >> backups/backup.log 2>&1
```

Para el respaldo externo instala y configura rclone:

```bash
apt install -y rclone
rclone config          # crea un remoto (Google Drive, S3, Backblaze…)
rclone lsd gdrive:     # comprueba que funciona
```

Restaurar (para el stack antes de sobrescribir `./data`):

```bash
cd /srv/gimnasios/gym1
docker compose -f docker-compose.yml -f docker-compose.prod.yml stop api
tar -xzf backups/data-2026-10-01-0330.tar.gz -C .
docker compose -f docker-compose.yml -f docker-compose.prod.yml start api
```

> Los archivos JSON se escriben de forma atómica, así que el respaldo es seguro
> con la app corriendo. Si quieres consistencia total, detén `api` un momento.

## 8. Actualizar

```bash
cd /srv/gimnasios/gym1
git pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

El `./data` y la media no se tocan. Si el `Caddyfile` cambió, reinicia Caddy
(`... restart caddy`). Repite por cada gimnasio; en los que no corren Caddy añade
`web api` al final del `up` (como en la sección 6).

## 9. Solución de problemas

| Síntoma | Causa probable / solución |
|---|---|
| No aparece el diálogo de passkey en el celular | Estás en `http://` o por IP. Debe ser HTTPS con el hostname de `RP_ID`. |
| "verification failed" al iniciar sesión | `RP_ID`/`ORIGIN` no coinciden exactamente con la URL del navegador. Corrige y reinicia (`docker compose ... up -d`). |
| Caddy no emite el certificado | El DNS aún no apunta al VPS, o los puertos 80/443 están cerrados (`ufw status`). Revisa `logs -f caddy`. |
| `network gimnasiolibre-edge not found` | Falta `docker network create gimnasiolibre-edge` (una vez por VPS). |
| `port is already allocated` al arrancar | Otro stack usa ese puerto: cambia `WEB_PORT` en `.env`. Los puertos 80/443 los usa un solo Caddy. |
| La media no se descargó | `docker compose ... logs media`; reintenta `up -d` o corre `./scripts/fetch-media.sh`. |
| El sitio carga pero `/api` da 502 | El `api` no está sano: `docker compose ... logs api` y `ps` (debe aparecer `healthy`). |
| Cambié `RP_ID` y ya nadie entra | Las passkeys quedaron atadas al hostname viejo. Vuelve al hostname anterior; si no, los usuarios existentes tendrán que registrar una passkey nueva. |
| No puedo entrar desde la red local | Por IP/HTTP solo funciona el **modo invitado** (datos solo en ese navegador). Usa el dominio HTTPS. |

## Enlaces

- **[SELF_HOSTING.md](SELF_HOSTING.md)** — guía general de self-hosting (inglés):
  modo invitado, notificaciones, Cloudflare Tunnel y otros proxies.
- **[README.md](../README.md)** — características y configuración.
- **[NOTICE.md](../NOTICE.md)** — licencias, incluida la de la media de ejercicios.
