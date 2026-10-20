# Архітектура MR

Портфоліо на React, TypeScript, Vite, React Router, SCSS Modules і GSAP.

## Структура

```text
src/
├── main.tsx
├── app/
│   ├── App.tsx                         # Роутер і готовність анімацій
│   ├── router/
│   │   ├── router.tsx                  # Маршрути та lazy loading
│   │   └── RouteError.tsx
│   ├── components/                    # Preloader, PageTransition
│   ├── layouts/SiteLayout/
│   │   ├── SiteLayout.tsx
│   │   ├── SiteLayout.module.scss
│   │   ├── hooks/useSmoothScroll.ts
│   │   └── components/
│   │       ├── SiteHeader/             # Містить components/HeaderLink/
│   │       ├── SiteFooter/
│   │       ├── SiteCookies/
│   │       └── FixedPageContacts/
│   ├── config/motion.ts
│   └── styles/                        # main, fonts, reset, base, scrollbar
├── pages/
│   ├── home/
│   │   └── sections/                  # HomeHero, FeaturedProjects, StudioStatement
│   ├── about/
│   │   ├── content.ts                 # Тексти вступу й напрямів роботи
│   │   ├── assets/                    # Локальні фотографії About
│   │   └── sections/                  # AboutHero, AboutServices, AboutPhilosophy, AboutProjects
│   ├── contact/
│   │   └── assets/background.mp4
│   ├── projects/                      # Архів проєктів
│   ├── project/                       # Окремий проєкт
│   └── not-found/
├── modules/projects/
│   ├── model/types.ts
│   ├── data/projects.ts
│   └── components/                    # ProjectCard, ProjectGrid
└── shared/
    ├── ui/                            # Container, PageIntro, AnimatedArrow
    ├── animation/                     # Реєстрація GSAP, readiness contexts
    ├── config/site.ts                 # Назва, контакти, навігація
    ├── styles/                        # tokens, mixins, motion.module.scss
    └── assets/icons/                  # arrow-light.svg, arrow-dark.svg
public/
├── fonts/                             # URL /fonts/...
├── images/projects/                   # URL /images/projects/...
├── favicon.svg
└── icons.svg
tests/
├── unit/page-transition.test.mjs
└── browser/
    ├── navigation.mjs
    ├── projects.mjs
    ├── featured-projects.mjs
    ├── home.mjs
    └── about.mjs
docs/
└── architecture.md
```

## Розподіл відповідальності

`app` збирає застосунок: маршрути, оболонку сайту, прелоадер і переходи.
`pages` містить сторінки та їхні локальні секції. `modules` зберігає предметні
дані, типи й компоненти для різних сторінок. `shared` містить незалежні від
конкретної сторінки UI, налаштування та ресурси.

Напрям залежностей: `app → pages → modules → shared`. Вищі рівні можуть
імпортувати нижчі напряму; модулі не імпортують сторінки або `app`, а `shared`
не залежить від решти рівнів. Невідомий slug використовує `NotFoundPage`
зі сторінки 404.

Компонент, його `*.module.scss` і специфічні hooks тримай поруч. Секції головної
належать `pages/home/sections`, а `HeaderLink`, потрібний тільки шапці, —
`SiteHeader/components`. Нові папки створюй із першим реальним файлом.

`HomePage` лише компонує секції; кожна секція сама задає ширину й використовує
`Container` для свого вмісту. `HomeHero/HeroSpecialties` містить локальний компонент
спеціалізацій і хук переходу від малого рядка до трьох великих. `StudioStatement`
зберігає типографіку звичайним HTML, а анімацію рядків — в окремому локальному хуку.
Ці ефекти не додають глобальні обробники прокрутки: ними керує ScrollTrigger.

`AboutPage` так само лише компонує секції. Тексти зберігаються у `pages/about/content.ts`,
фотографії — у локальних `assets`, а кожна анімована секція має власний хук.
Вступ закріплюється й послідовно змінює три абзаци; напрями роботи закріплюються
лише на десктопі. На мобільних напрями йдуть звичайною вертикальною послідовністю.
Для reduced motion усі абзаци, напрями й фотографії залишаються у потоці без pin.
Нижня сітка бере назви та адреси з наявних проєктів.

Для імпортів між частинами проєкту використовуй alias `@/`, який веде до `src/`.
Усередині компонента залишай відносні імпорти:

```tsx
import Container from '@/shared/ui/Container/Container'
import styles from './HomeHero.module.scss'
```

## Стилі та ресурси

`main.tsx` підключає `app/styles/main.scss` — єдиний вхід глобальних стилів:
шрифтів, reset, базових елементів і scrollbar. Стилі компонентів та сторінок
залишаються в SCSS Modules.

Кольори, шрифти, відступи та тривалість переходів визначені в
`shared/styles/_tokens.scss`, адаптивні міксини — у `_mixins.scss`.
Підключай їх через `@use '@/shared/styles/tokens' as *` і
`@use '@/shared/styles/mixins' as *`.
`motion.module.scss` передає тривалість переходу з SCSS у `app/config/motion.ts`.
Решта параметрів GSAP, прелоадера та скролу налаштовується в `motion.ts`.

Імпортовані ресурси Vite обробляє та хешує. Спільні іконки лежать у
`shared/assets/icons`, відео контактів — біля цієї сторінки.
`AnimatedArrow` приймає `variant="light"` (за замовчуванням) або `variant="dark"`.
Ресурси з `public` доступні за незмінними URL: `/fonts/...` для шрифтів
і `/images/projects/...` для обкладинок із `modules/projects/data/projects.ts`.

## GSAP і плавний скрол

Імпортуй `gsap`, `useGSAP`, `ScrollTrigger`, `ScrollSmoother` з
`@/shared/animation/gsap`: плагіни реєструються централізовано.
Кожна секція має власний root ref і передає його як `scope` у `useGSAP`.
Timeline та ScrollTrigger створюй у hook, щоб GSAP context очищав їх
при розмонтуванні, зокрема в StrictMode.

Для ефектів, залежних від props, використовуй `dependencies` і
`revertOnUpdate: true`. Пізні callbacks із GSAP обгортай у `contextSafe`.
Власні listeners, timers, observers і `matchMedia` очищуй окремо.
Враховуй `prefers-reduced-motion`: контент має залишатися доступним без руху.

`app/layouts/SiteLayout/hooks/useSmoothScroll.ts` створює один ScrollSmoother
для оболонки сайту та вимикає його для reduced motion. Єдина дитина
`#smooth-wrapper` — `#smooth-content`, що містить `main` і footer.
Wrapper не повинен стискати content через flex: ScrollSmoother вимірює повну
висоту контенту. Фіксовані елементи, зокрема шапку та контакти, тримай поза
`#smooth-wrapper`, оскільки content переміщується через transform.

## Готовність, прелоадер і переходи

`App` поєднує готовність прелоадера й переходу в `AnimationReadyContext`.
Секційні анімації отримують її через `useAnimationReady()` і передають
у dependencies `useGSAP`, щоб починатися після відкриття сторінки.
Поки контент не готовий, оболонка має `inert`.

`app/components/Preloader` показується один раз при відкритті документа.
`Preloader.tsx` містить розмітку; `useInitialAssets.ts` запускає очікування після
commit початкового маршруту: `SiteLayout` і `RouteError` повідомляють про нього
через `InitialRouteCommitContext`, щоб готовність роутера не випереджала появу DOM.
`initialAssets.ts` чекає `document.fonts.ready`, а після застосування шрифтів визначає
видимі у `main` зображення для декодування й autoplay-відео для першого кадру.
Критичні медіа анімованого hero позначаються `data-preload`, щоб їхній початковий
стан поза екраном не виключав їх з перевірки. Решта ресурсів поза першим екраном
і майбутні lazy-сторінки не затримують відкриття. Лічильник має три етапи готовності:
маршрут, шрифти, медіа; остання третина ділиться між потрібними медіа. Він показує
готовність цих перевірок, а не відсоток завантажених байтів.
Помилка ресурсу завершує його перевірку; timeout відкриває сторінку з поточним
значенням лічильника, без штучного стрибка до 100. Abort очищує listeners і timer
та не дозволяє пізнім подіям оновлювати прогрес після розмонтування.

`usePreloaderMotion.ts` керує входом, очікуванням ресурсів і виходом через одну
GSAP timeline. `sphereRenderer.ts` малює дві прозорі текстові сфери через WebGL:
геометрія й текстури створюються локально, додаткові бібліотеки й мережеві моделі
не потрібні. Тексти, швидкості обертання й тривалість входу/виходу налаштовуються
в `preloader.config.ts`; кожен елемент `bands` має `text`, `fontSize`, `fontWeight`,
`repetitions` і `rotationSpeed`. Повтори нижньої фрази дають менші літери по
окружності, а `fontSize` визначає їхню висоту. Загальна тривалість згасання —
у `app/config/motion.ts`. `pointerOrbit.ts` нормалізує координати миші та плавно
змінює ракурс із незалежним від FPS згладжуванням. Сила, час відгуку й мінімальна
ширина задаються в `preloader.pointer`; на вузьких екранах і для touch взаємодію
вимкнено. Вихід курсора й втрата фокуса повертають ракурс до центру; listeners
прибираються разом із прелоадером, при втраті WebGL та для reduced motion.
Після завершення `App` прибирає прелоадер, дозволяє анімації секцій і на наступному
кадрі викликає `ScrollTrigger.refresh()`. Scroll і всі елементи навігації залишаються
заблокованими до завершення. Для reduced motion та без WebGL є статичний текстовий
варіант без затримки на анімацію. Зміна на reduced motion під час завантаження
прибирає рух, але зберігає очікування ресурсів. GSAP context, ticker і WebGL-ресурси
очищуються при розмонтуванні, зокрема в StrictMode.

`app/components/PageTransition` використовує `useBlocker` і View Transition API:
зберігає старий знімок, викликає `proceed()`, чекає commit lazy-маршруту
та відкриває новий знімок знизу вгору із затемненням старого.
Без цього API працює двофазна шторка GSAP. Підтримуються Link/NavLink,
програмна навігація та Back/Forward; зміни лише hash не запускають перехід.
`ScrollRestoration` відновлює позицію скролу, а завершення переходу оновлює
ScrollTrigger. Нова навігація та розмонтування скасовують попередній перехід.
Для reduced motion тривалість переходу й виходу прелоадера дорівнює нулю.

Контакти доступні за `/contacts` та сумісною адресою `/contact`.
Для них новий знімок відкривається еліптичною маскою з правого верхнього кута.
Перед знімком `contactMedia.ts` чекає перший кадр `[data-contact-video]`
до 1,5 с; помилка, timeout або abort припиняють очікування.
Контактна сторінка показує фонове відео з `object-fit: cover` без footer,
cookie-повідомлення й FixedPageContacts. Для reduced motion автозапуск
вимкнений; відтворенням можна керувати кнопкою.

## Контент і розгортання

Дані проєктів та пошук за slug знаходяться в `modules/projects/data/projects.ts`,
їхня модель — у `modules/projects/model/types.ts`. Контакти та навігація —
в `shared/config/site.ts`. Невідомі URL і slug показують сторінку 404.
Сторінка About доступна за `/about`; `/about-us` перенаправляє на цю адресу.

Це клієнтська SPA. Для прямого відкриття вкладених URL хостинг повинен
повертати `index.html`; HTTP-статус 404 залежить від конфігурації хостингу.

## Перевірки

Команди запуску наведені в [README](../README.md).
Unit-тести перевіряють переходи, скасування очікувань і reduced motion.
`tests/unit/preloader.test.mjs` перевіряє готовність шрифтів і медіа першого екрана,
декодування, помилки, timeout і скасування без пізніх оновлень прогресу.
Вони читають вихідні файли та підміняють імпорти: при перенесенні коду
оновлюй шляхи файлів і ключі моків у `tests/unit/page-transition.test.mjs`.

Браузерні перевірки запускаються з кореня після `npm run build`
і потребують Windows із Chrome або Edge. `navigation.mjs` перевіряє
прелоадер, переходи, контакти, Back/Forward, reduced motion та 404;
`preloader.mjs` перевіряє WebGL, монотонність лічильника, повільні й зламані
ресурси, блокування клавіатури й скролу, мобільну версію, зміну reduced motion,
відсутність WebGL і відсутність повторного прелоадера при навігації (порти 9293/4193).
`projects.mjs` — картки, зображення, parallax, hover, клавіатуру й мобільний вигляд.
`featured-projects.mjs` перевіряє закріплену горизонтальну галерею на головній,
клавіатурну навігацію, мобільну версію, reduced motion і очищення pin після переходів.
`home.mjs` перевіряє перший екран, розгортання спеціалізацій і появу тексту
StudioStatement під час прокрутки, зокрема на мобільних і для reduced motion.
`about.mjs` перевіряє пряме відкриття About, посилання в меню, зміну абзаців,
напрями роботи, фотографії, адаптивність, reduced motion і очищення після навігації.
Вони запускають headless browser і Vite preview: навігація використовує порти
9287/4187, проєкти — 9288/4188, головна галерея — 9289/4189, секції головної — 9290/4191.
About використовує порти 9292/4192.
Тимчасовий профіль браузера створюється
в системній temp-папці.
