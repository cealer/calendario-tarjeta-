# 💳 Calendario de Tarjeta

Aplicación web sencilla para controlar las **fechas de corte y pago** de una tarjeta de crédito. Ingresas el día de corte y el día límite de pago, y la app te muestra:

- Un **calendario mensual** con los días de corte y pago resaltados.
- Las **próximas fechas** de corte y pago, con cuántos días faltan.

No requiere instalación, servidor ni dependencias. Todo corre en el navegador y la configuración se guarda localmente (`localStorage`).

## Uso

Abre `index.html` en tu navegador. O sírvelo localmente:

```bash
# Con Python
python3 -m http.server 8000
# luego abre http://localhost:8000
```

1. Escribe (opcional) el nombre de la tarjeta.
2. Indica el **día de corte** (1–31).
3. Indica el **día límite de pago** (1–31).
4. Pulsa **Guardar**.

Navega entre meses con las flechas ‹ › y vuelve al mes actual con **Ir a hoy**.

## Detalles

- Si un mes tiene menos días que el configurado (p. ej. corte el 31 en febrero), la fecha se ajusta automáticamente al **último día del mes**.
- La semana empieza en **lunes**.
- Funciona sin conexión una vez cargada.

## Estructura

```
index.html   Estructura de la página
styles.css   Estilos (tema oscuro, responsive)
app.js       Lógica: calendario, próximas fechas y persistencia
```
