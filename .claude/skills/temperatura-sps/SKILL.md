---
name: temperatura-sps
description: Obtiene la temperatura actual de San Pedro Sula, Honduras en grados centígrados (°C). Usar cuando el usuario pregunte por el clima, temperatura o calor/frío en San Pedro Sula.
---

# Temperatura San Pedro Sula (°C)

Usa la API gratuita Open-Meteo (sin API key).

## Pasos

1. Ejecutar:

```bash
curl -s "https://api.open-meteo.com/v1/forecast?latitude=15.5042&longitude=-88.025&current=temperature_2m,apparent_temperature,relative_humidity_2m&temperature_unit=celsius&timezone=America%2FTegucigalpa"
```

2. Leer del JSON, campo `current`:
   - `temperature_2m` → temperatura (°C)
   - `apparent_temperature` → sensación térmica (°C)
   - `relative_humidity_2m` → humedad (%)
   - `time` → hora local

3. Responder en español, conciso. Formato:

```
San Pedro Sula: 29.4 °C (sensación 33.1 °C), humedad 70%. Hora local: 14:00
```

## Notas

- Coordenadas: 15.5042, -88.0250. Zona horaria: America/Tegucigalpa.
- Si el curl falla (sin red / error HTTP), informar el error; no inventar valores.
- Solo grados centígrados; no convertir a °F salvo que se pida.
