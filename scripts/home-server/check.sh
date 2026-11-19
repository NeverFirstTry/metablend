#!/usr/bin/env bash
# The site's requests to Open-Meteo, asked from our own server (docs/home-server.md): twelve requests,
# twice each, with the answer code and the seconds. The requests are the ones the code builds today
# (2026-11-19), each with every model the site can ask for it anywhere, so a place also shows which
# regional models have nothing there (the server answers those with empty values, not with an error).
#   bash scripts/home-server/check.sh [base, default http://127.0.0.1:8080] [lat lon height, default Vienna]
# Through the tunnel: OM_ID and OM_SECRET in the environment are sent as the service token's two headers.
B="${1:-http://127.0.0.1:8080}"; LAT="${2:-48.2082}"; LON="${3:-16.3738}"; ELEV="${4:-180}"
P="latitude=$LAT&longitude=$LON"
TOKEN=()
[ -n "$OM_ID" ] && [ -n "$OM_SECRET" ] && TOKEN=(-H "CF-Access-Client-Id: $OM_ID" -H "CF-Access-Client-Secret: $OM_SECRET")
ALL=ecmwf_ifs025,gfs_seamless,icon_seamless,chmi_aladin_central_europe_2km,gem_seamless,jma_seamless,meteofrance_seamless,knmi_harmonie_arome_europe,dmi_harmonie_arome_europe,metno_nordic
MORE=chmi_aladin_central_europe_2km,gem_seamless,jma_seamless,cma_grapes_global,ecmwf_aifs025_single,meteoswiss_icon_ch1,italia_meteo_arpae_icon_2i,knmi_harmonie_arome_europe,dmi_harmonie_arome_europe,ncep_nbm_conus
SUMMIT=temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,cape,freezing_level_height,lightning_potential,cloud_cover,wind_speed_10m,wind_speed_850hPa,wind_speed_700hPa,wind_speed_600hPa,wind_speed_500hPa,wind_speed_300hPa
ask() { for i in 1 2; do curl -s -o /dev/null -m 200 "${TOKEN[@]}" -w "$1  try $i: %{http_code} in %{time_total} s\n" "$B$2"; done; }
echo "$B at $LAT, $LON ($ELEV m)"
ask 'forecast, now           ' "/v1/forecast?$P&current=temperature_2m,apparent_temperature,precipitation_probability,windspeed_10m,weathercode&timezone=auto"
ask 'forecast, 15 minutes    ' "/v1/forecast?$P&minutely_15=temperature_2m,apparent_temperature,precipitation_probability,wind_speed_10m,weather_code&models=ecmwf_ifs025,gfs_seamless,icon_seamless,meteofrance_seamless&forecast_minutely_15=1&timezone=GMT"
ask 'forecast, more models   ' "/v1/forecast?$P&hourly=temperature_2m,apparent_temperature,precipitation_probability,wind_speed_10m,weather_code&models=$MORE&forecast_hours=1&timezone=GMT"
ask 'forecast, UV            ' "/v1/forecast?$P&current=uv_index&daily=uv_index_max&timezone=auto&forecast_days=1"
ask 'forecast, details       ' "/v1/forecast?$P&current=snowfall,visibility,cloudcover,soil_temperature_0cm,precipitation&timezone=auto"
ask 'forecast, yesterday     ' "/v1/forecast?$P&daily=temperature_2m_max,temperature_2m_min&past_days=1&forecast_days=1&timezone=auto"
ask 'air quality and pollen  ' "/v1/air-quality?$P&current=european_aqi,alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,olive_pollen,ragweed_pollen&timezone=auto"
ask 'outlook, 8 days         ' "/v1/forecast?$P&hourly=temperature_2m,precipitation_probability,precipitation,wind_speed_10m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,weather_code,sunrise,sunset&models=$ALL&forecast_days=8&timezone=auto"
ask 'summit forecast         ' "/v1/forecast?$P&elevation=$ELEV&hourly=$SUMMIT&daily=sunrise,sunset&models=$ALL&forecast_days=8&timezone=auto"
ask 'route weather, 3 points ' "/v1/forecast?latitude=$LAT,$LAT,$LAT&longitude=$LON,$LON,$LON&elevation=$ELEV,$ELEV,$ELEV&hourly=$SUMMIT&daily=sunrise,sunset&models=ecmwf_ifs025,icon_seamless,gfs_seamless&forecast_days=8&timezone=auto"
ask 'rain, next hours        ' "/v1/forecast?$P&minutely_15=precipitation&forecast_minutely_15=10&past_minutely_15=1&timezone=auto&models=best_match,icon_d2,meteofrance_arome_france_hd,knmi_harmonie_arome_europe,dmi_harmonie_arome_europe,metno_nordic,ncep_rrfs_conus"
ask 'heights, 2 points       ' "/v1/elevation?latitude=47.0745,47.61824&longitude=12.6941,15.14245"
