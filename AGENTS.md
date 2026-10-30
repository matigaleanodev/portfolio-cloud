# portfolio-cloud

## Contexto de trabajo

Si existe un workspace con AGENTS.md en los directorios padre, leerlo explícitamente antes de editar y seguir sus referencias. Una raíz Git anidada puede impedir la herencia automática. Fuera de ese entorno, este archivo y el README deben ser suficientes para trabajar.

## Código y contratos

- TypeScript y AWS SAM; template.yaml declara la infraestructura.
- Entrypoints y lógica en src/; integraciones AWS encapsuladas en módulos dedicados.
- Mantener separados publicación editorial, orquestación y transporte cloud.
- Los flujos scheduled/event-driven deben conservar idempotencia y reintentos seguros.
- Esta capa posee suscriptores y automatización posterior a publicar el frontend.
- La fuente de verdad visual/editorial es portfolio; la API consume los artefactos canónicos.
- Mantener separado el bucket privado de suscriptores y el de media pública.

## Desarrollo y verificación

- npm ci instala; npm run ci cubre lint, tests y build.
- npm run test:run ejecuta Vitest sin watch; npm run build compila TypeScript.
- npm run sam:validate valida template.yaml; npm run sam:build empaqueta localmente.
- Los comandos dev:* y migrate:subscribers pueden invocar proveedores o modificar datos: revisar su configuración antes de usarlos.
- Revisar README y Docs/architecture para contratos de publicación.

## Restricciones

- No repartir clientes AWS ni configuración de proveedores entre handlers sin control común.
- Preservar stages recuperables y contratos de los artifacts publicados.
- Un reintento de pipeline no garantiza deduplicación por destinatario de correo.
- No ejecutar sam:deploy:guided ni migraciones como verificación documental.
- No reemplazar SAM por otra herramienta incidentalmente.
