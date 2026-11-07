# סימולטור עוגן

תרגול שיח QPR לצוותי חינוך, לפי חוזר מנכ"ל 0473 ותדריך שפ"י "שאלת האובדנות QPR".
פיתוח: חני Bloy, שפ"י.

## מבנה
- `index.html`, `content.js`, `cards.js`, `engine.js`: הסימולטור (אתר סטטי, בלי בנייה).
- `img/`: לוגו ואיורי צבעי מים.
- `api/chat.js`: פונקציית שרת ב-Vercel שפונה ל-Anthropic API. המפתח נשמר רק במשתנה הסביבה `ANTHROPIC_API_KEY`.

## הפעלה ב-Vercel
1. Import של הריפו הזה ב-Vercel (Framework: Other, בלי Build Command).
2. Settings → Environment Variables, אחד משניים:
   - `GEMINI_API_KEY` = מפתח מ-aistudio.google.com (יש רמה חינמית), או
   - `ANTHROPIC_API_KEY` = מפתח מ-console.anthropic.com.
   כשיש שניהם, `PROVIDER` = `gemini` או `anthropic` בוחר.
3. אופציונלי: `GEMINI_MODEL_QUICK`, `GEMINI_MODEL_DEFAULT`, `MODEL_QUICK`, `MODEL_DEFAULT` להחלפת הדגמים.

## פרטיות
אין לכתוב בסימולטור שמות או פרטים מזהים של תלמידים אמיתיים. השיחה נשמרת רק בדפדפן של המשתמשת.
