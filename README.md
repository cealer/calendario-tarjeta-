# 💳 Mis Tarjetas

Aplicación web para darle **seguimiento a los movimientos de tus tarjetas de crédito**: registra tus gastos, lleva el control del crédito utilizado y disponible, y ve qué te toca pagar en cada estado de cuenta.

No requiere instalación, servidor ni dependencias. Todo corre en el navegador y la información se guarda localmente (`localStorage`).

## Funciones

- **Varias tarjetas**: cada una con su día de corte, día de pago, límite y color.
- **Movimientos**: registra compras con fecha, descripción, monto y categoría.
- **Meses sin intereses / cuotas (MSI)**: indica el número de cuotas y la app reparte el monto en los períodos correspondientes (1/6, 2/6, …).
- **Límite y saldo**: ve el crédito utilizado, el disponible y una barra de uso.
- **Estado de cuenta por período de corte**: para cada ciclo verás la fecha de corte, la fecha límite de pago (con cuenta regresiva), el total a pagar y el detalle de movimientos/cuotas. Puedes **marcar un período como pagado** para liberar crédito.
- **Gastos por categoría**: totales agrupados por categoría.
- **Calendario**: vista mensual con los días de corte, pago y los días con movimientos.

## Uso

Abre `index.html` en tu navegador, o sirve la carpeta localmente:

```bash
python3 -m http.server 8000   # luego abre http://localhost:8000
```

1. En la pestaña **Tarjetas**, crea tu primera tarjeta (nombre, día de corte, día de pago, límite).
2. En **Movimientos**, registra tus compras. Si fue a meses sin intereses, indica el número de cuotas.
3. En **Resumen**, revisa tu saldo y el estado de cuenta de cada período. Navega entre períodos con ‹ › y marca como pagado cuando liquides.
4. En **Calendario**, visualiza cortes, pagos y días con movimientos.

## Cómo se calculan las fechas

- Una compra se factura en el **primer corte posterior o igual** a su fecha.
- Las cuotas (MSI) se reparten en períodos de corte consecutivos a partir de ese primero.
- La **fecha de pago** es el primer día de pago posterior a la fecha de corte.
- Si un mes no tiene el día configurado (p. ej. corte 31 en febrero), se ajusta al **último día del mes**.

## Estructura

```
index.html   Estructura y pestañas (Resumen, Movimientos, Calendario, Tarjetas)
styles.css   Estilos (tema oscuro, responsive)
app.js       Lógica: tarjetas, movimientos, cuotas, períodos y calendario
```
