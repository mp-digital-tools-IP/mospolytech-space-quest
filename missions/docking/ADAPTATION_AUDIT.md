# Mission 02 — Docking: этап 1, импорт и аудит

Источник: https://github.com/gcgarriga/apollo-docking-game  
Лицензия: MIT, copyright (c) 2025 Gemma Garriga.

## Что импортировано
- `upstream/apollo_docking.html`
- `upstream/game.js`
- `upstream/README.md`
- `upstream/LICENSE`

Исходный код сохранён отдельно от будущей адаптации.

## Игровой цикл исходника
1. старт с поверхности;
2. набор высоты;
3. выход в район орбиты;
4. выравнивание относительной скорости;
5. сближение;
6. мягкая стыковка.

## Аудит под старый iPad
Целевой профиль: iPad 2016–2017, Safari/iOS примерно 10–12.

- ES modules: есть — нужно убрать/собрать в обычный script
- Touch events: есть
- Pointer events: не обнаружены
- requestAnimationFrame: есть
- localStorage: есть — нужна безопасная обёртка
- WebGL/Three.js: не используется
- optional chaining: нет
- nullish coalescing: есть — заменить
- object spread/rest: есть — лучше заменить для Safari 10–11
- arrow functions: есть — проверить/при необходимости заменить
- classes: есть — проверить
- async/await: нет

## Следующий этап
1. сделать адаптированную копию рядом с `upstream`;
2. убрать ES-module загрузку и рискованные конструкции;
3. сделать крупные экранные touch-кнопки;
4. ограничить миссию примерно 60–120 секундами;
5. русифицировать HUD;
6. наложить фирменный стиль Московского Политеха;
7. прогнать WebKit/iPad portrait + landscape тесты до слияния в main.
