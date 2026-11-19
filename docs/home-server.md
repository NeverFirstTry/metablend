# Home server: our own Open-Meteo

A setup guide for the mini-ITX system (i5-7500, 16 GB, 500 GB NVMe, picoPSU 120 W, Ubuntu Server), written on 2026-11-19. Follow it top to bottom. Each step says what you should see.

Nothing in this guide changes production. The site keeps asking the public service until three settings are set in Vercel (step 10), and each of those waits for a decision.

**Not tested** marks what could not be run when this was written: the board was not there. The commands of steps 4, 6 and 8 ran on a Windows PC with Docker on 2026-11-12 (the rehearsal); the Cloudflare steps are from Cloudflare's documentation as of 2026-11-19.

This repository is public. The first part of the server's address and the two token values are never written into it. Where this guide says `NAME`, put the name you chose.

## What you end up with

- Three containers: `open-meteo` (the API, reachable only on the server itself), `open-meteo-sync` (fetches the model data), `cloudflared` (the tunnel).
- One address, `https://NAME.neverfirsttry.dev`, that answers only a request carrying our service token.
- No port opened on the router. The tunnel only connects outwards (port 7844, TCP and UDP).

## 0. Is the hardware enough?

| Part | Needed | This system |
|---|---|---|
| Processor | AVX2 (the server does not start without it) | i5-7500 has it. Step 1 checks. |
| Memory | 8 GB at least, 16 GB recommended (Open-Meteo's docs) | 16 GB in two slots: fine. |
| Disk | see step 5: about 65 GB for Europe, about 125 GB for the world | 500 GB: enough either way. |
| Power | processor 65 W plus board, memory and NVMe | fine, if the 12 V brick delivers what the picoPSU is rated for (120 W is 10 A). |
| Line | Europe needs 12 Mbit/s on average, the world 27 | your line decides, see step 5. |

## 1. Ubuntu

```bash
sudo apt update && sudo apt full-upgrade -y
sudo apt install -y unattended-upgrades ufw smartmontools curl
sudo dpkg-reconfigure -plow unattended-upgrades      # answer Yes: security updates install themselves
sudo ufw default deny incoming && sudo ufw default allow outgoing
sudo ufw allow from 192.168.0.0/16 to any port 22 proto tcp   # SSH from the home network only; change the range if yours differs
sudo ufw enable
grep -c avx2 /proc/cpuinfo
timedatectl | grep synchronized
```

You should see `4` from the `grep` line (one per processor thread; `0` means this board cannot run the server) and `System clock synchronized: yes`.

## 2. Docker

```bash
sudo apt install -y docker.io
sudo usermod -aG docker $USER && newgrp docker
docker run --rm hello-world
```

You should see "Hello from Docker!". Whoever is in the `docker` group can do on this machine what root can: keep it to your own user.

## 3. The data volume and two networks

```bash
docker volume create open-meteo-data
docker network create om-api
docker network create -o com.docker.network.bridge.name=br-omsync om-sync
```

Each line prints a name or a long id. The sync gets its own network so that only it can be slowed down (step 6).

## 4. The API server

```bash
docker run -d --name open-meteo --restart unless-stopped --network om-api \
  -v open-meteo-data:/app/data \
  -e REMOTE_DATA_DIRECTORY=https://openmeteo.s3.amazonaws.com/data/ -e CACHE_SIZE=8GB \
  -p 127.0.0.1:8080:8080 ghcr.io/open-meteo/open-meteo
docker ps --format "{{.Names}} {{.Status}} {{.Ports}}"
curl -s "http://127.0.0.1:8080/v1/forecast?latitude=47.1&longitude=8.4&models=ecmwf_ifs025&hourly=temperature_2m" | head -c 120
```

You should see `open-meteo Up ... 127.0.0.1:8080->8080/tcp` and then a line starting with `{"latitude":47.1`. `127.0.0.1` means: reachable from this machine only.

`REMOTE_DATA_DIRECTORY` lets the server read whatever is not on its disk from Open-Meteo's open data on AWS. That is not the public API and counts against no limit, but it is slow: in the rehearsal a first request for a new place took up to a minute, a summit forecast 66 seconds. The site waits 4 seconds (step 12). So the data has to be on the disk: the sync.

`CACHE_SIZE=8GB` is one file the server reserves at full size when it starts. It is not downloaded data.

## 5. Which models, how much disk, and is 500 GB enough?

What the site asks today (read from the code on 2026-11-19, 14 different requests) needs these folders of Open-Meteo's data, 40 in all, and 56 variables. Sizes were measured on the data bucket's file listings (2026-11-12; CHMI on 2026-11-19). A model run rewrites its current files, so a sync fetches them again after every run: the daily download is far more than the disk it fills.

| What the site asks | Folders | GB a day, world | GB on disk, world | GB a day, Europe | GB on disk, Europe |
|---|---|---|---|---|---|
| ECMWF IFS (`ecmwf_ifs025`) | `ecmwf_ifs`, `ecmwf_ifs025`, `ecmwf_ifs025_ensemble` | 41.5 | 10.4 | 1.6 | 0.4 |
| ECMWF AIFS | `ecmwf_aifs025_single` | 1.9 | 0.5 | 0.1 | 0.0 |
| NOAA GFS (`gfs_seamless`) | `ncep_gfs013`, `ncep_gfs025`, `ncep_gefs025`, `ncep_gefs05` | 54.0 | 25.6 | 2.1 | 1.0 |
| DWD ICON (`icon_seamless`, `icon_d2`) | `dwd_icon`, `dwd_icon_eu`, `dwd_icon_eu_native`, `dwd_icon_d2`, `dwd_icon_d2_15min`, `dwd_icon_d2_native`, `dwd_icon_d2_native_15min`, `dwd_icon_d2_ruc_native`, `dwd_icon_d2_ruc_native_15min`, `dwd_icon_eu_eps_native`, `dwd_icon_global_eps_native` | 88.4 | 24.9 | 60.1 | 11.6 |
| Météo-France (`meteofrance_seamless`, AROME HD) | `meteofrance_arpege_world025`, `meteofrance_arpege_europe`, `meteofrance_arome_france0025`, `meteofrance_arome_france0025_15min`, `meteofrance_arome_france_hd`, `meteofrance_arome_france_hd_15min` | 23.2 | 8.8 | 14.2 | 5.1 |
| CHMI ALADIN | `chmi_aladin_central_europe_2km` | 3.2 | 2.4 | 3.2 | 2.4 |
| Canada GEM (`gem_seamless`) | `cmc_gem_gdps_15km`, `cmc_gem_gdps_15km_upper_level`, `cmc_gem_geps`, `cmc_gem_rdps_10km` | 8.1 | 7.3 | 0.5 | 1.6 |
| JMA (`jma_seamless`) | `jma_gsm` | 0.8 | 0.2 | 0.0 | 0.0 |
| CMA GRAPES | `cma_grapes_global` | 10.4 | 2.6 | 0.4 | 0.1 |
| KNMI HARMONIE | `knmi_harmonie_arome_europe` | 5.1 | 0.5 | 5.1 | 0.5 |
| DMI HARMONIE | `dmi_harmonie_arome_europe` | 12.1 | 3.5 | 12.0 | 3.5 |
| MET Nordic | `metno_nordic_pp` | 29.3 | 2.0 | 29.1 | 2.0 |
| MeteoSwiss ICON-CH1 | `meteoswiss_icon_ch1`, `meteoswiss_icon_ch1_ensemble` | 2.6 | 0.9 | 2.6 | 0.9 |
| ItaliaMeteo ICON-2I | `italia_meteo_arpae_icon_2i` | 0.3 | 0.4 | 0.3 | 0.4 |
| Air quality and pollen | `cams_europe`, `cams_global` | 0.6 | 0.5 | 0.2 | 0.3 |
| **All 40** | | **282** | **90** | **131** | **30** |
| Heights (`/v1/elevation`) | `copernicus_dem90` | once 9.8 | 9.8 | once 9.8 | 9.8 |

"On disk" is the files of the last 7 days. "Europe" is the box 34,-25,72,45 and an upper estimate (the folders on DWD's native grids are counted in full). The ensemble folders are there because the rain probability comes from them.

Not in the list: the regional models of North America and Japan (`ncep_nbm_conus` 62.5 GB a day and 6.3 GB on disk, `ncep_rrfs_conus` 9.1 and 6.9, the Japanese and Canadian fine grids not measured). They matter only for a worldwide sync.

**Is 500 GB enough? Yes.**

| | Model data | Heights | Cache file | Ubuntu and Docker | Total of 500 GB |
|---|---|---|---|---|---|
| Europe box | about 30 GB | 9.8 GB | 8 GB | about 15 GB | about 65 GB |
| World | about 90 GB | 9.8 GB | 8 GB | about 15 GB | about 125 GB |

The disk's size is not the limit. Two other things are:

- **The line.** Europe is about 131 GB a day (12 Mbit/s on average), the world about 282 GB (27 Mbit/s), every day.
- **The NVMe's life.** Europe writes about 48 TB a year, the world about 103 TB. Common 500 GB drives are rated for 110 to 300 TB written in total. Look up yours (the data sheet says "TBW") and read its counter now and then:

```bash
sudo smartctl -a /dev/nvme0 | grep -E "Percentage Used|Data Units Written"
```

**Europe or world?** Start with Europe. One thing to know before the server answers first: for a place outside the box our server gives an answer with empty values (measured in the rehearsal: New York), and the site's switch takes an answered request as answered. So the Europe box is right for the comparison run (step 10), where nothing a visitor sees comes from our server. Before it answers first, either the global models are synced worldwide, or the switch learns to pass an empty answer on to the public service. That decision comes with the first measured days.

**The list on the day.** DWD ends the regular ICON grids on 2026-11-30 (Open-Meteo's page: after that date `dwd_icon_global`, `dwd_icon_eu` and `dwd_icon_d2` use native grids), so the ICON folders above change. Read the list from the server itself on the day you set it up. It takes about ten minutes:

```bash
docker run -d --rm --name om-probe -e REMOTE_DATA_DIRECTORY=https://openmeteo.s3.amazonaws.com/data/ \
  -e CACHE_SIZE=1GB -e LOG_LEVEL=debug -p 127.0.0.1:8081:8080 ghcr.io/open-meteo/open-meteo
for place in "48.2082 16.3738 180" "48.8566 2.3522 35" "59.9139 10.7522 20" "47.3769 8.5417 410" "45.4642 9.19 120" "47.0745 12.6941 3798" "45.8326 6.8652 4808"; do
  bash scripts/home-server/check.sh http://127.0.0.1:8081 $place
done
docker logs om-probe 2>&1 | grep -o 'amazonaws.com/data/[a-z0-9_]*/[A-Za-z0-9_]*/' | cut -d/ -f3,4 | sort -u > folders.txt
echo "MODELS=$(cut -d/ -f1 folders.txt | sort -u | paste -sd, -)"
echo "VARIABLES=$(cut -d/ -f2 folders.txt | grep -v '^static$' | sort -u | paste -sd, -)"
docker stop om-probe
```

The two lines it prints are the lists for step 6. If they differ from the lists below, use what the server printed. (Vienna, Paris, Oslo, Zurich, Milan, the Großglockner and Mont Blanc: the places the lists below were read from.)

## 6. The sync

**Optional: a speed limit for the sync**, if it slows the home network. The sync command's own `--rate` does not apply to this data source, so the limit sits on the sync's network. **Not tested.**

```bash
sudo tee /etc/systemd/system/om-sync-limit.service >/dev/null <<'EOF'
[Unit]
Description=Bandwidth limit for the Open-Meteo sync network
After=docker.service
Requires=docker.service
[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/usr/sbin/tc qdisc replace dev br-omsync root tbf rate 80mbit burst 1mbit latency 400ms
[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload && sudo systemctl enable --now om-sync-limit
tc qdisc show dev br-omsync
```

The last line should show `qdisc tbf` with `rate 80Mbit`.

**The heights, once** (9.8 GB):

```bash
docker run --rm --network om-sync -v open-meteo-data:/app/data ghcr.io/open-meteo/open-meteo sync copernicus_dem90 static
```

**The models, for the Europe box.** For the world, leave out the last line.

```bash
MODELS=cams_europe,cams_global,chmi_aladin_central_europe_2km,cma_grapes_global,cmc_gem_gdps_15km,cmc_gem_gdps_15km_upper_level,cmc_gem_geps,cmc_gem_rdps_10km,dmi_harmonie_arome_europe,dwd_icon,dwd_icon_d2,dwd_icon_d2_15min,dwd_icon_d2_native,dwd_icon_d2_native_15min,dwd_icon_d2_ruc_native,dwd_icon_d2_ruc_native_15min,dwd_icon_eu,dwd_icon_eu_eps_native,dwd_icon_eu_native,dwd_icon_global_eps_native,ecmwf_aifs025_single,ecmwf_ifs,ecmwf_ifs025,ecmwf_ifs025_ensemble,italia_meteo_arpae_icon_2i,jma_gsm,knmi_harmonie_arome_europe,meteofrance_arome_france0025,meteofrance_arome_france0025_15min,meteofrance_arome_france_hd,meteofrance_arome_france_hd_15min,meteofrance_arpege_europe,meteofrance_arpege_world025,meteoswiss_icon_ch1,meteoswiss_icon_ch1_ensemble,metno_nordic_pp,ncep_gefs025,ncep_gefs05,ncep_gfs013,ncep_gfs025
VARIABLES=alder_pollen,birch_pollen,boundary_layer_height,cape,categorical_freezing_rain,cloud_cover,convective_inhibition,diffuse_radiation,direct_radiation,freezing_level_height,grass_pollen,lifted_index,lightning_potential,mugwort_pollen,nitrogen_dioxide,olive_pollen,ozone,pm10,pm2_5,precipitation,precipitation_probability,ragweed_pollen,relative_humidity_2m,shortwave_radiation,showers,snowfall,snowfall_height,snowfall_water_equivalent,soil_temperature_0cm,sulphur_dioxide,surface_temperature,temperature_2m,temperature_2m_max,temperature_2m_min,uv_index,visibility,weather_code,wind_gusts_10m,wind_speed_10m,wind_speed_300hPa,wind_speed_500hPa,wind_speed_600hPa,wind_speed_700hPa,wind_speed_850hPa,wind_u_component_10m,wind_u_component_300hPa,wind_u_component_500hPa,wind_u_component_600hPa,wind_u_component_700hPa,wind_u_component_850hPa,wind_v_component_10m,wind_v_component_300hPa,wind_v_component_500hPa,wind_v_component_600hPa,wind_v_component_700hPa,wind_v_component_850hPa

docker run -d --name open-meteo-sync --restart unless-stopped --network om-sync \
  -v open-meteo-data:/app/data ghcr.io/open-meteo/open-meteo \
  sync "$MODELS" "$VARIABLES" \
  --past-days 3 --repeat-interval 5 --concurrent 1 --concurrent-models 2 --max-concurrent-reads 4 \
  --bounding-box 34,-25,72,45
docker logs -f --tail 20 open-meteo-sync
```

You should see lines "Downloaded bbox ... transferred=..." and, per model, "files completed ... Average speed". The first fill is about 20 GB for the Europe box. Ctrl+C stops watching; the sync keeps running and looks for new files every five minutes.

`--past-days 3`: the site's requests look back one day, and a file older than three days is a finished one.

## 7. Old files

Finished files are not needed after ten days (Open-Meteo's own advice, adapted):

```bash
( sudo crontab -l 2>/dev/null; echo '15 3 * * * find /var/lib/docker/volumes/open-meteo-data/_data -type f -name "chunk_*" -mtime +10 -delete' ) | sudo crontab -
sudo crontab -l
```

## 8. Check with the site's own requests

Once the first fill is through:

```bash
bash scripts/home-server/check.sh
```

Twelve requests, twice each: the answer code and the seconds. You want `200` everywhere and well under one second on the second try (the rehearsal measured 6 ms from synced data). **A request that takes longer than 4 seconds counts as "server down" for the site.**

After a day, three numbers tell whether the plan holds:

```bash
docker logs open-meteo-sync 2>&1 | grep -c "Downloaded"
sudo du -sh /var/lib/docker/volumes/open-meteo-data/_data
docker stats --no-stream --format "{{.Name}} {{.MemUsage}} {{.CPUPerc}}"
```

## 9. Cloudflare: the token, the lock, the tunnel

In this order, so that the address is never open: first the token, then the lock, then the tunnel.

**9a. The service token.** Zero Trust > Access controls > Service credentials > Service Tokens > Create Service Token. Name it `metablend-vercel`, duration one year, Generate token. Copy the **Client ID** and the **Client Secret** into your password manager now: the secret is shown this one time. They never go into a chat, a commit or this repository.

**9b. The lock.** Zero Trust > Access controls > Applications > Create new application > Self-hosted and private > Add public hostname: subdomain `NAME`, domain `neverfirsttry.dev`. Add one policy: action **Service Auth** (not Allow: with Allow, Cloudflare asks for a login), selector **Service Token**, value `metablend-vercel`. On the Additional settings tab switch on **401 Response for Service Auth policies**. Create.

**9c. The tunnel.** Cloudflare dashboard > Networking > Tunnels > Create a tunnel, name it `home`. The page shows an install command that contains the tunnel's token, a long string. Copy only that string, then on the server:

```bash
mkdir -p -m 700 ~/open-meteo
( umask 077; read -rsp "Tunnel token: " T; echo "TUNNEL_TOKEN=$T" > ~/open-meteo/tunnel.env )
docker run -d --name cloudflared --restart unless-stopped --network om-api \
  --env-file ~/open-meteo/tunnel.env cloudflare/cloudflared:latest tunnel --no-autoupdate run
docker logs --tail 8 cloudflared
```

The token is typed blind and lands in a file only you can read, not in the shell's history. The log should show registered tunnel connections, and the dashboard the tunnel as healthy.

Then the route: the tunnel > Routes > Add route > Published application: subdomain `NAME`, domain `neverfirsttry.dev`, Service URL `http://open-meteo:8080`. (`cloudflared` and `open-meteo` share the network `om-api`, so the container's name is its address. `http://localhost:8080` would point at the tunnel's own container.)

**9d. The check from outside.** On your PC, not on the server:

```bash
read -rsp "Client ID: " OM_ID; echo; read -rsp "Client Secret: " OM_SECRET; echo
U="https://NAME.neverfirsttry.dev/v1/forecast?latitude=48.2&longitude=16.4&current=temperature_2m"
curl -s -o /dev/null -w "without the token: %{http_code}\n" "$U"
curl -s -o /dev/null -w "with the token: %{http_code}\n" -H "CF-Access-Client-Id: $OM_ID" -H "CF-Access-Client-Secret: $OM_SECRET" "$U"
```

You should see `401` (or `403`) without the token and `200` with it. A `200` or a `302` without the token means the lock is not right: stop and fix 9b before anything else.

**Limited to our Vercel functions?** Vercel's functions have no fixed addresses, so the limit is the token: only a request that carries both values passes, and only Vercel's Production settings hold them. The site sends them to this one address only and refuses to follow a redirect.

**The token ends after a year.** Put the date in your calendar (Cloudflare's "Expiring Access Service Token" notification is listed as part of a paid Access plan). Renewing: the token's menu > Rotate secret, with a grace period in which the old one still works; then the new secret into Vercel and a redeploy.

## 10. The site's settings (Vercel, Production). Not now.

These are production changes. Each waits for a decision, is set in Vercel's settings by the owner, and takes effect with the next deploy.

| Setting | Value | What it does |
|---|---|---|
| `OPEN_METEO_SELF` | `https://NAME.neverfirsttry.dev` (no path) | where our server is |
| `OPEN_METEO_SELF_ID` | the Client ID, marked Sensitive | sent to that address only |
| `OPEN_METEO_SELF_SECRET` | the Client Secret, marked Sensitive | sent to that address only |
| `OPEN_METEO_SHADOW` | `0.2` | **the comparison run**: the public service answers everything as today, one request in five is also asked from our server afterwards and compared. Nothing a visitor sees comes from our server. |

With the first three set and `OPEN_METEO_SHADOW` not set, our server **answers first** and the public service is the fallback (step 12). The plan: the comparison run for some days, a report on it, then the decision.

Two more exist: `OPEN_METEO_SELF_TIMEOUT_MS` (how long our server may take, default 4000) and `OPEN_METEO_PUBLIC=off` (the public service is never asked; not planned).

## 11. Updates

- **Ubuntu** installs security updates by itself (step 1). When `/var/run/reboot-required` exists, reboot at a quiet hour. The containers come back by themselves.
- **Open-Meteo's image**: once a month, and on 2026-12-01 (the ICON change of step 5, and NOAA's HRRR ends on 2026-11-30):

```bash
docker pull ghcr.io/open-meteo/open-meteo
docker rm -f open-meteo open-meteo-sync
# now the two "docker run" commands of steps 4 and 6 again; the data volume stays
bash scripts/home-server/check.sh
```

- **cloudflared**: `docker pull cloudflare/cloudflared:latest && docker rm -f cloudflared`, then the `docker run` of step 9c again.
- After the image update on 2026-12-01: the probe of step 5 again. New folder names go into the sync's lists.
- Nothing updates the containers by itself, on purpose: an update is done when someone looks at `check.sh` afterwards.

While a container is being replaced (under a minute) the site does what step 12 says.

## 12. When the server is down: what the site does

Only once our server answers first (step 10). In the comparison run a visitor notices nothing, and the outage shows as `mirror:failed` in the counter.

- **What counts as down:** no answer within 4 seconds, an answer with 500 or above, a 401 or 403 (the lock refused us), or a redirect. A slow server is a down server: this is why step 8 looks at the seconds.
- **What happens:** the same request goes to the public service at once. The visitor gets the same forecast, up to 4 seconds later. Pages and API answers the CDN already holds are not affected at all.
- **How fast it stops waiting:** after three failures in a row a function instance leaves our server out for 60 seconds, then tries again. So during an outage at most three requests a minute and instance wait their 4 seconds; all others go straight to the public service.
- **How it is counted** (`open_meteo_calls`): every request to our server as `self:<kind>` with weight 0, and every request that went on to the public service under its usual kind with its full weight. A full day without the server costs the public service's free allowance what a day costs now (7,000 to 9,500 weighted calls a day in the week of 2026-11-16; the limit is 10,000).
- **What our server answers with 400, 404 or 429** is taken as its answer, not as an outage.
- **When it is back:** the next attempt after the pause succeeds and requests go to it again. Nothing to do.
- **If the public service must carry more than its free allowance** (the server down for days, after launch): the branch `feat/open-meteo-key` stands ready, unmerged, for a paid key.

With `OPEN_METEO_PUBLIC=off` (not planned) there is no fallback: a request our server cannot answer fails like any failed source, and the forecast is blended from the other sources.

## 13. Not in this guide

- An alarm when the server goes down. The site's own counter shows it afterwards (`self:` falling, the usual kinds rising); a watcher that tells you at once is not built.
- Backups: there is nothing on the server worth keeping. A new disk is filled by the sync again.
- A power cut: the server must be set to start by itself when power returns (the board's BIOS, "restore on AC power loss").
