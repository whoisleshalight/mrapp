# Архітектура MR

Каркас портфоліо: React, TypeScript, Vite, React Router, SCSS Modules і GSAP.
Контент демонстраційний; дизайн і складні анімації розробляються поверх цього каркаса.

## Структура

```text
src/
├── main.tsx                       # Точка входу, глобальні стилі
├── app/
│   ├── App.tsx                    # Провайдер роутера
│   ├── router.tsx                 # Маршрути, lazy loading сторінок
│   ├── components/                # Preloader, PageTransition
│   ├── config/motion.ts           # Тривалість і easing анімацій
│   └── layouts/                   # Оболонка сайту, Outlet, помилки
├── pages/
│   ├── home/
│   │   ├── HomePage.tsx
│   │   ├── HomePage.module.scss
│   │   └── sections/
│   │       ├── HomeHero/
│   │       └── FeaturedProjects/
│   ├── about/                     # /about
│   ├── contact/                   # /contact
│   ├── projects/                  # /projects — архів
│   ├── project/                   # /projects/:slug — один проєкт
│   ├── news/                      # /news — архів
│   ├── post/                      # /news/:slug — одна стаття
│   └── not-found/                 # Невідомий URL або slug
├── modules/
│   ├── projects/
│   │   ├── types.ts
│   │   ├── data/projects.ts
│   │   └── components/            # ProjectCard, ProjectGrid
│   └── news/
│       ├── types.ts
│       ├── data/posts.ts
│       └── components/            # PostCard
├── shared/
│   ├── components/                # Container, PageIntro, SiteHeader, SiteFooter
│   ├── animation/                 # GSAP registration, useReveal, animation readiness
│   └── config/site.ts             # Назва, контакти, навігація
├── styles/
│   ├── main.scss                  # Єдиний вхід глобальних стилів
│   ├── _tokens.scss               # Кольори, шрифти, відступи, ширини
│   ├── _reset.scss
│   ├── _base.scss                 # Базові HTML-елементи
│   └── _mixins.scss               # Адаптивні медіазапити
└── assets/
    ├── images/                    # Імпортовані зображення
    └── icons/                     # Імпортовані іконки
public/
├── fonts/                         # Фіксовані URL /fonts/...
└── videos/                        # Фіксовані URL /videos/...
```

## Розподіл відповідальності

Сторінка збирає секції та отримує дані. Великі секції тримай у
`pages/<page>/sections/`, дрібні локальні компоненти — у `pages/<page>/components/`.
Ці папки додавай за потреби. Прості сторінки поки не потребують зайвих вкладень.

Компоненти з предметною логікою належать модулю: картка проєкту — `modules/projects`,
картка статті — `modules/news`. Фільтри, пошук і пагінацію додавай у відповідний модуль.
Компоненти без прив'язки до контенту — кнопки, модалки, поля — додавай у shared.

Напрям залежностей: `app → pages → modules → shared`. Модулі не імпортують сторінки
або app; shared не імпортує модулі. Сторінки не використовують одна одну як бізнес-компоненти;
виняток у каркасі — спільний стан 404. Локальний UI state залишай у компоненті.

Компонент, його стилі та специфічні hooks тримай поруч:

```text
pages/about/sections/AboutHero/
├── AboutHero.tsx
├── AboutHero.module.scss
└── useAboutHeroAnimation.ts
```

## Стилі

`*.module.scss` — локальні стилі компонентів і секцій. Глобально залишай лише tokens,
reset, base та підключення шрифтів. Не додавай стилі конкретної сторінки в `main.scss`.
SCSS-змінні `$...` з tokens підключай через `@use 'відносний/шлях/styles/tokens' as *`.
Окремий `Page.module.scss` потрібен
тільки коли сторінка має власні стилі.

Для breakpoint mixins використовуй `@use` з відносним шляхом до `styles/mixins`.
Тема, відступи й ширина контейнера змінюються в `_tokens.scss`.

## Кастомні анімації

Імпортуй `gsap`, `useGSAP`, `ScrollTrigger`, `ScrollSmoother` з
`shared/animation/gsap.ts`:
плагіни реєструються централізовано. `HomeHero` показує базовий приклад `useReveal`.
Цей ефект запускається при монтуванні; scroll-ефекти створюй окремо для конкретної секції.

`app/layouts/useSmoothScroll.ts` створює один ScrollSmoother для всього layout.
Він використовує нативний scroll із затримкою 1 с, коротку затримку 0,1 с на touch,
підтримує `data-speed` / `data-lag` і повністю вимикається для reduced motion.
Єдина дитина `#smooth-wrapper` — `#smooth-content`, що містить header, main і footer.
Wrapper не має стискати content через flex: ScrollSmoother вимірює його повну висоту.
Фіксовані елементи тримай поза `#smooth-wrapper`, бо `#smooth-content` рухається
через transform. Значення згладжування налаштовуються в `app/config/motion.ts`.

Кожна секція має власний root ref. Передавай його як `scope` до `useGSAP`, щоб
селектори не зачіпали інші секції. Timeline, ScrollTrigger і matchMedia створюй
усередині hook; matchMedia очищуй через `revert()`. `useGSAP` очищає свій GSAP context
при розмонтуванні, зокрема при навігації та повторному монтуванні в StrictMode.

Для ефектів, що залежать від props, використовуй `dependencies` і `revertOnUpdate: true`.
GSAP-код у пізніх callbacks обгорни в `contextSafe`. Власні listeners, timers та
observers очищуй окремо.

Враховуй `prefers-reduced-motion`: контент має бути доступний без руху.
Не приховуй контент глобальним CSS до запуску JS. Специфічні ефекти тримай біля
секції; у shared перенось тільки повторювану поведінку.

### Переходи між сторінками та прелоадер

`app/components/PageTransition` керує переходом через `useBlocker` і нативний
View Transition API: зберігає знімок старої сторінки, викликає `proceed()`, чекає
commit нового lazy-маршруту і відкриває нову сторінку знизу вгору за 0,8 с,
одночасно затемнюючи стару до 25% яскравості. Easing відповідає White Desert.
У браузерах без API використовується двофазна шторка GSAP.
Працює з Link/NavLink, navigate та
Back/Forward без перезавантаження. Переходи лише до hash не блокуються.
`ScrollRestoration` відновлює scroll; після відкриття викликається `ScrollTrigger.refresh()`.
Візуальний ефект можна замінити в PageTransition без змін у картках або навігації.

`app/components/Preloader` показується один раз при відкритті документа. Чекає
початкову готовність роутера, `window.load` та `document.fonts.ready`, після чого
виїжджає вгору. Очікування assets обмежене timeout, помилка маршруту теж дозволяє
завершити loader. Це не фіктивний відсотковий прогрес і не гарантія завантаження
майбутніх lazy images чи відео. Для важких ресурсів конкретної сторінки додавай
окремий loader у її модуль.

Поки прелоадер видимий, shell має `inert`, scroll заблокований. Після завершення
`AnimationReadyContext` дозволяє старт секцій після прелоадера та після завершення
кожного переходу. Під час переходу shell теж має `inert`. `useReveal` вже це враховує;
у кастомних hooks використовуй `useAnimationReady()` і передавай готовність
у dependencies `useGSAP`. Для reduced motion тривалість переходів і loader дорівнює 0.
`PageRevealContext` вимикає повторний `useReveal` після нативного переходу:
нова сторінка вже видима у знімку, тож її контент не має знову зникати.
При початковому відкритті й fallback-шторці секційні reveal-анімації працюють.
Тривалість переходів — `$page-transition-duration` у `styles/_tokens.scss`.
`styles/motion.module.scss` передає її в JavaScript для GSAP; решта налаштувань часу —
`app/config/motion.ts`, кольори екранів — `styles/_tokens.scss`.

## Контент, форми, API та деплой

`modules/*/data` містять демодані з типами й пошуком за slug. Після вибору CMS/API
додай в модуль `api/` або `repository.ts` і отримуй дані через route loaders.
Не розкидай fetch-запити по картках і секціях. Для складних case studies та статей
розширюй модель типізованими контентними блоками; `body: string[]` — проста заглушка.

Форму контактів з валідацією та статусами запиту додавай у
`modules/contact/components/ContactForm/`, коли буде реальний endpoint.
Зараз контакти містять mailto з демонстраційною адресою: заміни її в `shared/config/site.ts`.

Для невідомих slug показується 404. Це клієнтська SPA: HTTP-статус відповіді сервера
залежить від хостингу. При розгортанні налаштуй fallback маршрутів на `index.html`,
щоб пряме відкриття вкладених URL працювало. Якщо розділу новин потрібен повний HTML
для пошуковиків і соцмереж, окремо обери prerender або SSR.

`src/assets` — імпортовані ресурси, які Vite обробить і хешує; `public` — ресурси з
фіксованими URL. Папки для hooks, utils, API та нових секцій створюй із першим
реальним файлом. Не потрібні абстракції наперед для всіх майбутніх сценаріїв.

## Перевірка

`npm run dev` — локальна розробка, `npm run build` — TypeScript і production build,
`npm run lint` — ESLint, `npm run preview` — перегляд готової збірки.

Браузерна перевірка на Windows з установленим Chrome/Edge:
`node --experimental-websocket scripts/check-navigation.mjs` після `npm run build`.
Перевіряє прелоадер, порядок переходу, відсутність reload, вкладені сторінки,
Back/Forward, reduced motion та 404. Запускає headless browser і preview на портах
9287 та 4187; тимчасовий профіль браузера створюється в системній temp-папці.
