# Procesador de Órdenes DOW

Web app en un único archivo (HTML/CSS/JS, sin dependencias ni build) que procesa el texto
copiado de los mails de cambios logísticos de DOW Argentina y calcula los campos listos para
cargar en **ALET**, con botón de copiado por campo.

## Qué hace

- **Altas**: detecta los registros estructurados (agrupando lotes por *Shipment*), y calcula
  Nro. orden, Shipment, Delivery, Tipo de unidad, Fecha/Turno, Alocación, Cliente, Transporte,
  Localidad, Provincia, Fecha planeada de carga y Fecha de entrega (DeliveryDate).
  Botón **"Exportar Excel (import Manual ALET)"**: genera un `.xlsx` con una orden por fila,
  con cada dato en la columna que pide la *Importación de preingresos* de ALET (Origen: **Manual**):
  Transporte→A, Shipment→B, N° orden→D, Cliente→F, Localidad→G, Alocación→L, Fecha planeada de
  carga→Q, Fecha de entrega→R, Provincia→AE, Tipo de unidad→AF, Delivery→AO. *Carga combinada
  externa* (AL) y *Centro de distribución* (AN) se dejan vacíos (ALET los pide al confirmar).

> **Formato del .xlsx**: ambos exports (Expo y Manual) generan un workbook **estándar**
> (`styles.xml` + `sharedStrings.xml` + `docProps` + `<dimension>`), no un xlsx mínimo. El lector
> de ALET es estricto y rechaza con "error de formato" los archivos que solo traen celdas
> `inlineStr` sin esas partes. Generado 100% en el navegador, sin dependencias.
- **Bajas**: lista las órdenes a eliminar en ALET (transportista, SAP, shipment, cliente, sector, fecha).
- **Selector de transportista**: autollena el campo Transporte de todas las órdenes.

### Turnero Expo (Excel → ALET)

Pestaña **"Turnero Expo"**: se arrastra el Excel del turnero de exportación (el archivo original
multi-hoja sirve tal cual — detecta sola la hoja del turnero) y genera **un .xlsx por fecha** con
los datos en las columnas que pide la importación de preingresos de ALET (Origen: Exportación):
Shipment → B, N° orden → D, Cliente → E, Transporte → N. Todo el armado del xlsx es en el navegador,
sin dependencias.
- **Robustez**: aguanta campos faltantes (Our Reference / Storage Location / Batch Number),
  Nro. de orden de 9 o 10 dígitos, y pesos en formato `28.500,000`.

### Reglas principales

- Shipment: 8 dígitos, prefijo de campaña (48 = 2026, 49 = 2027, …).
- Tipo de unidad: ≤ 27.000 kg → *Standard*; > 27.000 kg → *22 pallets*.
- Alocación: todo DP → *Don Pedro*; todo CT/WH → *Planta*; mezcla → *Combinada*.
  Si un lote con carga (> 0 kg) no trae Storage Location → la orden queda *sin alocación*.
- Provincia: se deduce de la localidad (tabla de provincias y ciudades argentinas).

## PWA + ventana flotante

- Instalable y **funciona offline** (service worker).
- Botón **"⧉ Flotar encima"**: abre las tarjetas en una ventana *always-on-top* sobre ALET
  (Document Picture-in-Picture, solo en Chrome/Edge de escritorio).

## Cómo correrla

Necesita servirse desde `https` o `localhost` (la ventana flotante y el modo offline **no**
funcionan abriendo el archivo con `file://`).

- **Deploy estático** (ej. Vercel): subir el repo y listo.
- **Local**: servir la carpeta con cualquier servidor estático, por ejemplo:
  ```
  npx serve
  ```
  y abrir la URL `localhost` que indique.

## Archivos

- `index.html` — la app completa
- `manifest.json` — metadata PWA
- `sw.js` — service worker (offline)
- `icon.svg` / `icon-maskable.svg` — íconos
