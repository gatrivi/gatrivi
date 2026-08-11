# Convenciones

- `src/types/`: interfaces de dominio; `src/services/`: persistencia y APIs; `src/context/`: estado compartido; `src/pages/` o componentes de ruta: UI.
- Componentes y tipos en PascalCase; funciones, variables y archivos utilitarios en camelCase; rutas en minúsculas.
- Para una entidad nueva: model → service → context → page. Las páginas no acceden directamente a localStorage o Firestore.
- Tailwind v4 es la base; colores principales: índigo `#5c54dd`, texto `#172033`, fondo `#f7f8fc`, bordes `#e8ebf2`.
- Cuando una tarea dice editar una página/componente, no tocar context, services o types salvo indicación explícita.
