# Migración privada de suscriptores

## Ejecución completada el 2026-10-09

La migración de prod ya terminó sin desplegar código: 1 registro privado verificado, 0 públicos, HEAD anterior 404 y concurrencia restaurada. Solo subscribe/unsubscribe/notify-post usan temporalmente ambos buckets de entorno con el valor privado. Mañana desplegar juntos el código y SAM nuevos, con R2_BUCKET=portoflio-blog-media y SUBSCRIBERS_BUCKET=portfolio-blog-subscribers; no repetir la migración ni desplegar el template anterior. Ver el registro EN/ES en Docs/operations del workspace. El procedimiento siguiente es la referencia general, no una tarea pendiente.

El bucket público de media guardaba `subscribers/*.json`. Desplegar el código no elimina esos objetos ya expuestos. El bucket privado debe quedar sin dominios públicos ni URL `r2.dev` habilitada.

## Preparación

1. Crear `portfolio-blog-subscribers` como bucket privado de R2. Dar acceso a objetos a la credencial existente del runtime, o configurar un reemplazo con el alcance correspondiente mediante el mecanismo actual de secretos. No pegar credenciales en comandos, logs ni Git.
2. Configurar `SUBSCRIBERS_BUCKET` en el `.env` local ignorado. Si se elige otro nombre, configurar la variable GitHub `PORTFOLIO_CLOUD_SUBSCRIBERS_BUCKET`. El runtime exige que sea distinto de `R2_BUCKET`.
3. Confirmar en R2 que el acceso anónimo está deshabilitado. La API S3 no permite comprobar que no exista un dominio público asociado: requiere una comprobación administrativa.
4. Pausar las escrituras de suscripciones durante toda la copia, cambio de runtime y limpieza, incluyendo el acceso directo por API Gateway. Mantener disponible la media pública. Esto evita copiar mal un alta/baja concurrente o restaurar una suscripción eliminada. Verificar la pausa antes de continuar.

## Copia y cambio de runtime

Ejecutar desde el repositorio en WSL, con el Node existente:

```sh
npm run migrate:subscribers
npm run migrate:subscribers -- --copy
```

El primer comando solo cuenta objetos de origen. El segundo copia los faltantes, lee el destino y compara hashes SHA-256. Se puede reintentar si las copias existentes coinciden; una diferencia detiene el proceso sin sobrescribirla. No se imprimen emails ni detalles de errores del proveedor.

Desplegar el código cloud probado en el stage activo, con `SubscribersBucket` apuntando al bucket privado. Verificar que las Lambdas subscribe, unsubscribe y notify tengan esa configuración y el código nuevo. El futuro despliegue del stage de producción también debe incluirla. No disparar envíos reales de newsletter como prueba de migración. Verificar persistencia con un suscriptor de prueba explícitamente descartable y quitar ese registro mediante el endpoint normal.

## Retiro de copias públicas

Solo después de activar el runtime privado, manteniendo las escrituras pausadas:

```sh
SUBSCRIBERS_MIGRATION_CUTOVER_CONFIRMED=true npm run migrate:subscribers -- --remove-public
```

El script compara todos los objetos de origen con sus copias privadas antes de borrar algo y relee cada origen inmediatamente antes de eliminarlo. Una copia privada faltante o distinta detiene la limpieza. Confirmar que las claves públicas antiguas conocidas respondan 404 y purgar cualquier caché CDN existente para esas claves antes de reabrir las escrituras. Verificar que el bucket privado siga inaccesible anónimamente.

Antes de limpiar, el rollback puede restaurar el runtime anterior manteniendo las escrituras pausadas. Después de limpiar, restaurar un runtime compatible que siga leyendo el bucket privado; no devolver los datos al almacenamiento público.

La migración termina cuando las URLs públicas antiguas son inaccesibles y el runtime desplegado usa almacenamiento privado. Una prueba local o un workflow preparado no constituyen verificación de producción.
