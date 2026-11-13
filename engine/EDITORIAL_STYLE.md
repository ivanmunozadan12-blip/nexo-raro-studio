# BEHIND DEL MUNDO — guía editorial y de dirección visual

Este archivo define cómo preparar los guiones técnicos JSON manualmente para el motor. El motor no llama a Groq ni a otra IA: recibe el JSON y renderiza la voz, los subtítulos, los gráficos, el sonido y el MP4.

## Principio creativo

Cada vídeo debe sentirse como una mini-historia visual, no como una clase leída ni una presentación de diapositivas. El espectador debe entenderlo sin conocimientos previos y tener una razón para quedarse hasta el final.

### Narración
- Español de España, natural, cercano y fácil de entender.
- Entre 110 y 175 palabras, pensadas para una narración de unos 60–72 segundos.
- Abrir con un gancho en los primeros 2 segundos: pregunta inesperada, contradicción, imagen mental o dato sorprendente.
- Explicar una sola idea por frase. Evitar jerga; si un término técnico es necesario, explicarlo inmediatamente.
- Usar analogías cotidianas, comparaciones visuales y humor breve, no chistes forzados. Ejemplos: “como una pista de baile microscópica”, “no hay un mini DJ dentro”, “imagina una fila de fichas de dominó”.
- Alternar explicación, sorpresa y pequeñas preguntas abiertas. Introducir micro-ganchos entre escenas y cerrar con una revelación, consecuencia o detalle que invite a comentar.
- Mantener rigor: el humor nunca debe cambiar la explicación científica. No inventar cifras ni simplificar hasta decir algo falso.
- No incluir indicaciones para el narrador entre paréntesis. El motor usa una voz masculina es-ES-AlvaroNeural.
- La narración completa vive solo en el audio. Nunca debe imprimirse completa en el vídeo.

## Ocho escenas con ocho funciones

Cada guion debe tener exactamente ocho escenas. No basta con cambiar el título o el color: cada escena debe avanzar la historia y mostrar algo distinto.

1. Gancho visual: presentar la pregunta o el objeto en contexto.
2. Presentación: revelar el componente, lugar o fenómeno protagonista.
3. Primer paso: mostrar cómo empieza el proceso.
4. Funcionamiento: enseñar el mecanismo o causa invisible.
5. Detalle: acercarse a la pieza, molécula, parte o factor clave.
6. Consecuencia: visualizar qué cambia y por qué.
7. Giro o aclaración: desmontar una idea equivocada o mostrar el matiz importante.
8. Remate: conclusión visual clara, sorpresa final o consejo memorable.

## Dirección visual específica por tema

Elegir el fondo y el lenguaje visual según lo que se cuenta. No reutilizar el mismo fondo azul oscuro por defecto.

- Objetos y mecanismos domésticos (microondas, motor, móvil): fondo limpio o taller; objeto reconocible a tamaño grande; despiece, flechas de flujo, piezas internas y movimiento mecánico.
- Fenómenos atmosféricos o aviación (estela de avión): cielo azul, nubes a distintas profundidades, avión reconocible en vuelo, estela que crece detrás y cámara que lo acompaña. No poner el avión dentro de una tarjeta flotante sobre fondo abstracto.
- Espacios e instalaciones (aeropuerto, fábrica, hospital): entorno contextual primero, después corte transversal, pasillos, salas, máquinas y recorridos internos.
- Naturaleza y geografía: cielo, vegetación, agua, relieve, escala y movimiento ambiental.
- Ciencia invisible (ondas, electricidad, moléculas): comenzar con el objeto real y pasar a una visualización ampliada, con escalas, partículas, campos y vectores identificados.
- Historia o procesos temporales: entorno coherente con la época, hitos que se transforman y transiciones claras.
- Evitar tarjetas/paneles que encierren todo el contenido sin motivo. Usar texto en pantalla solo para títulos cortos, etiquetas y datos imprescindibles.

## Contrato JSON

Campos de nivel superior:
- `title`: título corto y claro.
- `hook`: gancho inicial.
- `narration`: texto completo que se locuta.
- `scenes`: exactamente ocho objetos.
- `sources`: al menos tres fuentes reales, con título y URL HTTPS.
- `caption`: copy breve para redes, si procede.

Cada escena debe incluir:
- `headline`: rótulo corto (máximo 52 caracteres).
- `subtitle`: aclaración breve (máximo 90 caracteres).
- `description`: descripción visual literal y específica de lo que debe aparecer, su posición, escala y contexto.
- `action`: qué cambia o se mueve durante la escena, en orden.
- `narration_excerpt`: fragmento literal de la narración asociado a esa escena.
- `visual_type`: familia de dibujo soportada (por ejemplo: microwave, aircraft, engine, machine, object_cutaway, molecule, science, process, fact, timeline, interior, building_cutaway, map).
- `background`: uno de `sky`, `clean`, `workshop`, `ocean`, `nature`, `dark_lab`.
- `camera`: objeto con `movement` (push_in, pull_out, pan_left, pan_right, follow o static), `zoom_start` y `zoom_end`.
- `visual_elements`: entre 6 y 14 elementos. Cada elemento debe incluir `shape`, `x`, `y`, `width`, `height`, `color`, `label`, `role`, `description` y `motion`. Coordenadas x/y van de 0 a 1000. Las formas admitidas son rect, rounded_rect, circle, ellipse, line, arrow, polygon, gear, wave, arc y text. Movimientos: none, float, pulse, rotate y flow.
- `sound_effect`: mechanical, electric, water, impact, click o wind/whoosh.
- `accent`: color hexadecimal.
- `labels`: etiquetas cortas si el tipo visual las usa.
- `metric`: objeto value/label/detail solo si hay un dato que merezca una visualización.

Las descripciones de elementos no son adornos: explican qué representa cada forma y por qué está ahí. Evitar elementos vagos como “círculo decorativo” o “línea azul”. Usar “motor eléctrico”, “flujo de aire”, “pared metálica”, “molécula de agua”, etc. Si el objeto es reconocible (animal, móvil, satélite, edificio, planeta), debe aparecer como tal en el plano principal; no se puede representar únicamente con círculos y líneas.

## Subtítulos

No escribir subtítulos manuales en el JSON. El motor toma los tiempos de Edge TTS y los divide automáticamente en frases de hasta seis palabras, repartiendo cada bloque según su duración. El render revela las palabras progresivamente y resalta la palabra activa. Nunca poner la narración entera como una sola línea.

## Ejemplo de dirección para un avión

Para una escena sobre estelas:
- `background: "sky"`
- `visual_type: "aircraft"`
- `description`: “Avión comercial reconocible en vuelo, de perfil tres cuartos, con alas y motores visibles; nubes en primer y segundo plano”.
- `action`: “El avión avanza suavemente; la estela aparece detrás, se alarga y se dispersa mientras la cámara lo sigue”.
- `camera.movement: "follow"`
- Añadir elementos visuales específicos para estela, vapor, aire frío, nubes y trayectoria.
- Explicar con precisión que la estela visible está formada principalmente por diminutas gotas de agua o cristales de hielo, según las condiciones atmosféricas; no llamarla humo del motor.

## Revisión antes de entregar un guion

1. ¿El gancho despierta curiosidad en dos segundos?
2. ¿Una persona sin conocimientos técnicos lo entiende?
3. ¿Hay comparaciones o humor natural sin perder rigor?
4. ¿Cada escena muestra exactamente lo que se está narrando?
5. ¿El fondo y la cámara pertenecen a ese tema concreto?
6. ¿Cada elemento visual está identificado y descrito?
7. ¿La narración dura entre 60 y 72 segundos?
8. ¿Las fuentes respaldan las afirmaciones importantes?
