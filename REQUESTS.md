# Requests

## 🚨 Safe Path Resolution: Тихий парсинг (Від credits)

**Target**: `src/utils/resolveSync.js`
**Status**: DONE
**Date**: 2026-03-10

**Problem**:
Утиліта `resolveSync` іноді намагається обробити адреси типу `<anonymous code>`, які генеруються React DevTools чи Web Workers (наприклад, sourcemaps), що викликає інтенсивний спам у консоль через `console.error()`.
Прохання імплементувати повноцінний whitelist для протоколів (http, https, file, data), щоб тихо ігнорувати або безпечно повертати невалідні шляхи без скидання помилки у консоль (прийнятне рішення — просто прибрати `console.error` у `catch` блоці `resolveSync()`). Це шкодить розробницькому процесу.
