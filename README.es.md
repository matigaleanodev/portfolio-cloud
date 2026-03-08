# Portfolio Cloud

[Read in English](./README.md)

Capa de automatización serverless del ecosistema del portfolio.

Este repositorio es dueño de los workflows AWS post-publicación, la automatización de suscriptores, la generación de OG y la publicación canónica del knowledge editorial del chat.

---

## Rol En El Ecosistema

- `portfolio`: frontend público, contenido editorial estático y deploy en Firebase.
- `portfolio-api`: API pública mínima para flujos dinámicos orientados a usuario.
- `portfolio-cloud`: automatización AWS Lambda, persistencia de suscriptores, procesamiento de releases, notificaciones y handoff editorial canónico.

---

## Lambdas Principales

- `process-release`
- `publish-chat-knowledge`
- `generate-og`
- `notify-post`
- `subscribe`
- `unsubscribe`

---

## Funcionalidades Principales

- Procesamiento de releases disparado después de deploys exitosos del frontend
- Publicación canónica de artifacts de knowledge del chat en R2
- Persistencia de suscriptores respaldada en R2
- Entrega de notificaciones del blog
- Generación de assets Open Graph para contenido publicado
- Utilidades runtime compartidas y tests para flujos cloud

---

## Stack

- TypeScript
- AWS Lambda
- AWS SAM
- AWS SDK
- Cloudflare R2
- Resend
- Vitest

---

## Notas De Runtime

- `process-release` consume `.generated/release-manifest.json` producido por `portfolio`.
- `publish-chat-knowledge` consume el artifact editorial generado por `portfolio`.
- `portfolio-api` lee el knowledge canónico del chat publicado por este repositorio.
- Este repositorio no debe convertirse en la API pública ni en la capa de presentación frontend.

Detalles de arquitectura del repositorio:

- [Notas de arquitectura](./Docs/architecture.es.md)

---

## Desarrollo Local

```bash
npm install
npm run ci
```

Comandos útiles:

- `npm run build`
- `npm run lint`
- `npm test`
- `npm run sam:validate`
- `npm run sam:build`

La configuración de entorno está documentada en `.env.example`.

---

## Version

Versión actual de la aplicación: **1.0.0**
