# ¿Quién es? — prototipo jugable

Web estática (HTML/CSS/JS) con los 23 personajes y sus 115 pistas.

## Cómo abrirla en VS Code

1. Descomprimí la carpeta `adivinanzas-web`.
2. Abrí esa carpeta en VS Code.
3. En la terminal ejecutá `python -m http.server 8000` (en Windows también puede ser `py -m http.server 8000`).
4. Abrí `http://localhost:8000` en el navegador.

También podés usar la extensión Live Server. No abras `index.html` directamente con `file://`, porque el navegador podría bloquear la carga del JSON.

## Tus imágenes

Copiá tus archivos `.png` a la carpeta `imagenes/`. El archivo `personajes.json` tiene `imagen_archivo_sugerido` para cada personaje. Los nombres deben coincidir exactamente (espacios, mayúsculas y acentos). Si el nombre de tu archivo es diferente, corregí ese campo en el JSON o renombrá la imagen.

Para la silueta genérica, agregá `imagenes/silueta.png`. Si no está, se verá un signo de interrogación.

## Mecánica

- 3 personajes diarios, iguales para todos los usuarios del prototipo (determinados por fecha argentina y un orden fijo seudoaleatorio).
- Sin repeticiones dentro del día. Durante la primera semana no se repiten personajes.
- Pistas: ocupación, territorio histórico, año, logros y recuerdo.
- 5 intentos; puntaje 100, 80, 60, 40 y 20.
- «No lo sé» consume un intento; «Me rindo» termina el desafío.
- Buscador de nombres con autocompletado a partir de 2 caracteres, máximo 5 sugerencias.
- Se guarda el progreso en el navegador con `localStorage`.
- Se puede revisar la ficha final de cada desafío terminado durante el día.
- Al cruzar la medianoche argentina, el desafío ya iniciado puede finalizarse; los no iniciados caducan.

## Límites de este prototipo

- **Solo cubre una semana sin repeticiones.** La regla de exclusión de 90 días necesita ampliar la base a 273 o más personajes antes de una operación continua.
- **No es antifraude:** los datos de respuestas están en el navegador. Para un juego público competitivo convendría verificar respuestas en un servidor.
- El historial y estadísticas se guardan en el navegador actual, no entre dispositivos.
- Los nombres de búsqueda se limitan a los 23 personajes cargados; luego se puede agregar un catálogo de candidatos más amplio.
- Revisá la exactitud de las fichas y las licencias de las imágenes antes de publicar.
