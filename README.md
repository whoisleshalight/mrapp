# MR

Портфоліо на React, TypeScript і Vite з React Router, SCSS Modules та GSAP.
Сторінки: головна, архів проєктів, окремий проєкт і контакти.

## Запуск

```sh
npm install
npm run dev
```

## Команди

| Команда | Призначення |
| --- | --- |
| `npm run dev` | Локальна розробка |
| `npm run build` | Перевірка TypeScript і production build |
| `npm run lint` | Перевірка ESLint |
| `npm run preview` | Перегляд готової збірки |
| `npm test` | Unit-тести переходів між сторінками |
| `npm run test:browser:nav` | Браузерна перевірка навігації та контактів |
| `npm run test:browser:projects` | Браузерна перевірка карток проєктів |

Перед браузерними перевірками виконай `npm run build`.
Вони потребують Windows із встановленим Chrome або Edge; запускай команди з кореня проєкту.

Структура папок, правила імпортів, стилів і анімацій описані в
[архітектурі проєкту](docs/architecture.md).
Дані проєктів редагуються в `src/modules/projects/data/projects.ts`,
контакти й навігація — у `src/shared/config/site.ts`.
