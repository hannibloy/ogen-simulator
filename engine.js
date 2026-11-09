/* סימולטור עוגן | מנוע שיחה חופשית
   התלמיד מגיב בשפה חופשית לפי כרטיס דמות. משפטי העוגן המאושרים מוצגים מילה במילה.
   אין משוב במהלך השיחה. בסוף: משוב מותאם (נקודות לפי התסריט המאושר, עוגנים מרשימה סגורה), צ'ק ליסט, דילמות. */
(function(){
const {S,SECRECY,order}=window.OGEN;
const {C,STUDENT_RULES,SOURCES}=window.OGEN_CARDS;
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
const ABBR={elem:"ד",middle:"ח",high:"יא",peer:"ט"};
const FINISH_AFTER=12, HARD_CAP=30;
const VERD={ok:{c:"ok",i:"✓",l:"נעשה היטב"},part:{c:"part",i:"⚠",l:"נעשה חלקית"},miss:{c:"again",i:"✗",l:"חסר או שגוי"},na:{c:"none",i:"–",l:"לא הגעתם לשלב הזה"}};
const GUIDE_HTML=`<p style="margin:0"><b>זהו תרגול. אין כאן מבחן, ואין תשובה שתישמר בשמך.</b></p><ul><li>עונים במילים שלכם, כמו בשיחה אמיתית.</li><li>אם נתקעים, כפתור הנורה נותן רמז לכיוון.</li><li>תמיד אפשר לחזור צעד אחורה.</li><li>המשוב מגיע רק בסוף השיחה.</li><li>אין לכתוב שמות או פרטים מזהים של תלמידים אמיתיים.</li></ul><p style="margin:0;color:var(--muted)">מותר לעצור בכל רגע, לצאת מהחדר או לפנות ליועצת.</p>`;

/* ---------- מצב ---------- */
const st={scen:null,g:null,r:"teacher",turns:[],redo:[],hints:[],done:false,busy:false,started:false,fb:null,fbFor:-1,_sc:null,_g:null,review:false,debug:false,noteOpen:null,hintOpen:false};
const SC=()=>S[st.scen], CD=()=>C[st.scen];
const g=s=>String(s??"").replace(/\{([^|}]*)\|([^}]*)\}/g,(_,f,m)=>st.g==="m"?m:f);
/* גרסה 12: תפקיד המשתתף/ת. משפיע על הפנייה בפרומפט, על דילוג עוגנים שמתייחסים ליועצת כגורם שלישי, ועל הרמזים. העוגנים עצמם אינם משתנים. */
const ROLES={teacher:{f:"המורה",m:"המורה",desc:"מחנך/ת או מורה"},counselor:{f:"היועצת",m:"היועץ",desc:"יועץ/ת חינוכי/ת"},staff:{f:"אשת הצוות",m:"איש הצוות",desc:"איש/אשת צוות חינוכי"}};
const roleName=()=>(ROLES[st.r]||ROLES.teacher)[st.g==="m"?"m":"f"];
const skipAnchor=id=>{const a=CD().anchors[id];return !!(a&&a.skipFor&&a.skipFor.includes(st.r));};
/* ליועצ/ת: הרמזים מדברים על המנהלת והפסיכולוג/ית במקום על היועצת */
const roleHint=h=>st.r==="counselor"?String(h).replace(/ליועצת או לאדם אחר/g,"למנהלת או לאדם אחר").replace(/ליועצת/g,"למנהלת").replace(/היועצת לא כאן/g,"המנהלת לא כאן").replace(/היועצת/g,"המנהלת"):h;
function save(){try{localStorage.setItem("ogen-v10",JSON.stringify({scen:st.scen,g:st.g,r:st.r,turns:st.turns,hints:st.hints,done:st.done,promised:!!st.promised}));}catch(e){}}
function load(){try{const v=JSON.parse(localStorage.getItem("ogen-v10")||"null");if(v&&S[v.scen]&&Array.isArray(v.turns)){Object.assign(st,{scen:v.scen,g:v.g,r:v.r||"teacher",turns:v.turns,hints:v.hints||[],done:!!v.done,promised:!!v.promised,started:true});}}catch(e){}}
const teacherTurns=()=>st.turns.filter(t=>t.who==="t").length;
const usedAnchors=()=>new Set(st.turns.filter(t=>t.anchor).map(t=>t.anchor));
function anchorAvailable(id,used){
  const a=CD().anchors[id];if(!a||used.has(id))return false;
  if(a.alt&&used.has(a.alt))return false;
  for(const [k,v] of Object.entries(CD().anchors)){if(v.alt===id&&used.has(k))return false;}
  return (a.req||[]).every(r=>used.has(r)||Object.entries(CD().anchors).some(([k,v])=>v.alt===r&&used.has(k)));
}
function anchorTurn(id){const t=CD().anchors[id].t;return t.startsWith("#")?{who:"n",text:t.slice(1),anchor:id}:{who:"s",text:t,anchor:id};}

/* ---------- בית ---------- */
$("before-m").innerHTML=$("before-r").innerHTML;
$("levels").innerHTML=order.map(k=>{const s=S[k];return `<button class="lv" role="radio" aria-checked="false" data-sc="${k}"><span class="ab">${ABBR[k]}</span><span class="tx">${esc(s.lvl)}<small>${esc(s.cls)} | ${esc(s.name)}</small></span></button>`;}).join("");
document.querySelectorAll("[data-sc]").forEach(b=>b.onclick=()=>{document.querySelectorAll("[data-sc]").forEach(x=>x.setAttribute("aria-checked",String(x===b)));st._sc=b.dataset.sc;ready();});
document.querySelectorAll("[data-g]").forEach(b=>b.onclick=()=>{document.querySelectorAll("[data-g]").forEach(x=>x.setAttribute("aria-checked",String(x===b)));st._g=b.dataset.g;ready();});
document.querySelectorAll("[data-r]").forEach(b=>b.onclick=()=>{document.querySelectorAll("[data-r]").forEach(x=>x.setAttribute("aria-checked",String(x===b)));st._r=b.dataset.r;ready();});
function ready(){$("start").disabled=!(st._sc&&st._g&&st._r);}
function fresh(){st.promised=false;st.turns=[];st.redo=[];st.hints=[];st.done=false;st.fb=null;st.fbFor=-1;st.hintOpen=false;(CD().open||[]).forEach(id=>st.turns.push(anchorTurn(id)));save();}
$("start").onclick=()=>{st.scen=st._sc;st.g=st._g;st.r=st._r||"teacher";st.started=true;fresh();openChat();};
$("resume").onclick=()=>openChat();
function goHome(){show("home");$("resume").hidden=!st.started;}
$("homebtn").onclick=goHome;$("m-home").onclick=goHome;
(function(){const h=(location.hash||"").replace("#","");const map={s1:"middle",s2:"elem",s3:"high",s4:"peer"};if(map[h]){const b=document.querySelector(`[data-sc="${map[h]}"]`);if(b)b.click();}})();

function show(scr){
  $("book").dataset.scr=scr;
  $("scr-home").hidden=scr!=="home";$("scr-chat").hidden=scr!=="chat";$("scr-sum").hidden=scr!=="sum";
  $("scr-chat").style.display=scr==="chat"?"flex":"none";
  $("before-r").hidden=scr!=="home";$("sccard").hidden=scr==="home";$("act-r").hidden=scr==="home";
  if(scr==="home"){$("guide-r").hidden=true;$("guidebtn").setAttribute("aria-expanded","false");}
  steps(scr);
}
function steps(scr){
  const n=st.scen?SC().name:"";
  const items=[["בחירת שלב גילאי",scr==="home"?"on":"done"],[n?`שיחה עם ${n}`:"שיחה עם תלמיד או תלמידה",scr==="chat"?"on":scr==="sum"?"done":""],["משוב, צ'ק ליסט ודילמות",scr==="sum"?"on":""]];
  $("steps").innerHTML=`<span class="lbl">מהלך התרגול</span>`+items.map(([t,c],i)=>`<div class="step ${c}"><span class="dot">${c==="done"?"✓":i+1}</span><span>${esc(t)}</span></div>`).join("");
}
function toggleGuide(){const el=window.innerWidth<=860?$("guide-m"):$("guide-r");const open=el.hidden;el.innerHTML=GUIDE_HTML;el.hidden=!open;$("guidebtn").setAttribute("aria-expanded",String(open));}
$("guidebtn").onclick=toggleGuide;$("m-guide").onclick=toggleGuide;

/* ---------- Claude ---------- */
let sampleFn=null;
(async()=>{try{if(window.claude&&claude.use){sampleFn=await claude.use("sample");}}catch(e){sampleFn=null;}})();
/* אתר עצמאי (Vercel): אין window.claude, והבינה נקראת דרך /api/chat עם מפתח ה-API של חני */
if(!(window.claude&&claude.use)){sampleFn={json:async(prompt,o={})=>{
  const r=await fetch("/api/chat",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({prompt,tier:o.modelTier||"quick"}),signal:o.signal});
  let j=null;try{j=await r.json();}catch(_){}
  if(!r.ok){const err=new Error((j&&j.error)||"server");err.code=(j&&j.code)||(r.status===429?"rate_limited":"server");err.detail=(j&&j.error)||"";console.error("api/chat",r.status,j);throw err;}
  return j&&j.result;}};}
const ERRMAP=e=>{const c=e&&e.code;
  if(c==="not_granted")return "כדי שהתלמיד יענה, צריך לאשר לסימולטור להשתמש ב-Claude. לחצו שוב על שליחה ואשרו.";
  if(c==="rate_limited")return "יותר מדי בקשות ברגע זה. חכו כמה שניות ושלחו שוב.";
  if(c==="aborted"||c==="timeout")return "התשובה התעכבה. שלחו שוב.";
  if(c==="no_key")return "האתר עדיין לא חובר לבינה (חסר מפתח API בהגדרות Vercel).";
  if(c==="blocked")return "התשובה נחסמה על ידי מסנן התוכן של המודל. נסחו מחדש ושלחו שוב.";
  return "התלמיד לא הצליח לענות הפעם. שלחו שוב."+(e&&e.detail?" ("+String(e.detail).slice(0,120)+")":"");};
function transcript(turns){
  const s=SC(),me=roleName();
  const out=[];turns.forEach(t=>{if(t.who==="t")out.push(`${me}: ${t.text}`);else if(t.who==="s")out.push(`${s.name}: ${g(t.text)}`);else out.push(`[מצב: ${g(t.text)}]`);});
  return out.join("\n");
}
/* ---------- מנוע הקצב (גרסה 10): הקוד מחליט מתי מגיע כל עוגן, הבינה רק מנסחת ---------- */
const EXPLICIT_BY=5;
const DIRECT_RE=/להתאבד|התאבדות|מתאבד|למות|מוות|למוֹת|לפגוע בעצמ|לשים קץ|לא להיות בחיים|להרוג את עצמ/;
/* בדיקות ביטחון לקסיקליות (גרסה 11): הבינה מסווגת, הקוד מאמת. direct ו-escort מהבינה נספרים רק אם בהודעת המורה יש מילה מהשדה. */
const DIRECT_HINT_RE=/להתאבד|התאבד|למות|מוות|לחיות|להיות בחיים|לא להיות|לא תהי|שלא תהי|לפגוע בעצמ|להרוג את עצמ|לשים קץ|מה זאת אומרת|מה זה אומר|למה התכוונ|מה התכוונ|מה זה שיהיה|איך לא|שקט ממ/;
const ESCORT_HINT_RE=/יועצ|מנהל|סגנ|רכז|פסיכולוג|מבוגר|מישה[וי] ש|נלך|הולכים|הולכות|ללכת|ביחד|יחד|אית[ךו]|נישאר|נשאר|אשאר|לקרוא ל|שיקרא|יקרא/;
function flowState(){
  const f=CD().flow,used=usedAnchors();
  const expDone=used.has(f.explicit.direct)||used.has(f.explicit.spont);
  const preLeft=f.pre.filter(id=>!used.has(id));
  const postLeft=f.post.filter(x=>Array.isArray(x)?!x.some(id=>used.has(id)||skipAnchor(id)):!(used.has(x)||skipAnchor(x)));
  return {f,used,expDone,preLeft,postLeft};
}
function recentHolds(n){return st.turns.filter(t=>t.who==="s"&&t.gen).slice(-n).map(t=>g(t.text));}
function lastStudentWasHold(){for(let i=st.turns.length-1;i>=0;i--){const t=st.turns[i];if(t.who==="s"||t.who==="n"&&t.anchor)return !!t.hold;}return false;}
async function studentTurn(next,lastText,expDone){
  const s=SC(),c=CD(),n=s.name;
  const nextTxt=next?g(c.anchors[next].t).replace(/^#/,"(תיאור מצב) "):"(אין משפט מתוכנן. התלמיד רק מגיב.)";
  const phase=expDone
    ?"אחרי הגילוי: המורה כבר שמעה אמירה אובדנית מפורשת. השלב עכשיו: לא להשאיר לבד, לשכנע בעדינות וללוות למבוגר שיכול לעזור."
    :"לפני הגילוי: המורה עוד לא שמעה אמירה אובדנית מפורשת.";
  const holdPhase=expDone
    ?`אחרי הגילוי: אם המורה עוד לא הציעה ללכת יחד למבוגר שיכול לעזור, ה-hold מבטא פחד או שאלה ("ומה עכשיו?", "את לא הולכת, נכון?"). אם המורה אמרה שהיא הולכת ומשאירה את ${n} לבד, ${n} מפחד/ת ואומר/ת זאת.`
    :`לפני הגילוי: אם המורה הייתה קרה או מבטלת, ${n} מתכנס/ת ומקטין/ה ("סתם", "לא משנה") אבל משאיר/ה סימן קטן.`;
  const who=roleName(),holds=recentHolds(3);
  const prompt=`# תפקיד
את/ה משחק/ת את ${n} בסימולציית תרגול לצוותי חינוך (מניעת אובדנות, לפי תדריך QPR של שפ"י וחוזר מנכ"ל 0473). מולך ${who} (${(ROLES[st.r]||ROLES.teacher).desc}). ${st.g==="m"?"פנה אליו בלשון זכר":"פנה אליה בלשון נקבה"}. בכל מקום שכתוב כאן "המורה", הכוונה ל${who}. את/ה רק התלמיד/ה: לא מנחה, לא מורה, לא מסביר/ה.

# כרטיס הדמות
${c.card}

# השיחה עד עכשיו (מהישן לחדש)
${transcript(st.turns)}

# ההודעה האחרונה של ${who} (זו ההודעה היחידה שמסווגים)
«${lastText}»${holds.length?`

# תגובות שכבר נאמרו על ידי ${n} בשיחה (אסור לחזור עליהן או על ניסוח דומה להן)
${holds.map(h=>"- "+h).join("\n")}`:""}

# שלב השיחה
${phase}

# המשפט המאושר הבא של ${n} (הדף יציג אותו מילה במילה. אל תכתוב אותו ואל תכתוב גרסה שלו)
${nextTxt}

# מה להחזיר
אובייקט JSON אחד בלבד. שמות השדות באנגלית בדיוק כמו בדוגמה. ערך stance באנגלית באותיות קטנות. direct, promise, escort הם בוליאנים אמיתיים (true או false, לא מחרוזות).

1. stance: היחס של ההודעה האחרונה של המורה. ערך אחד:
   - "warm": מתייחסת למה ש${n} אמר/ה, מקשיבה, משקפת, שואלת בעדינות או בסקרנות, מזמינה לדבר עכשיו. דוגמאות: "שמעתי מה אמרת, וזה חשוב לי. בוא נשב רגע ונדבר", "נשמע שקשה לך מאוד", "ספר לי במילים שלך מה קרה".
   - "cold": מבטלת, מרגיעה בריק, מטיפה, נוזפת, ממהרת, מתווכחת עם הרגש, או סוגרת את הנושא. דוגמאות: "מה פתאום, אל תדבר ככה, הכול יהיה בסדר", "אתה לא נטל! יש לך הורים שאוהבים אותך", "תזדרז, אני נועלת את הכיתה".
   - "neutral": עניינית או קצרה, לא חמה ולא קרה. דוגמאות: "מה קרה?", "בוא נדבר", "הכול בסדר אצלך?"
   - "offtopic": לא מובנת, לא קשורה לשיחה, לא פנייה לתלמיד, גידוף או בדיחה. דוגמאות: "asdf", "מה יש היום בצהריים?", "רגע, אני עונה להודעה".

2. direct: true רק אם ההודעה האחרונה היא שאלה (או בקשת הבהרה) על התאבדות, מוות, רצון למות או לא להיות, מחשבות על מוות, פגיעה עצמית, או בירור של משפט ש${n} אמר/ה שנשמע אובדני.
   true: "אתה חושב להתאבד?", "חשבת לפגוע בעצמך?", "יש לך מחשבות על מוות?", "יש רגעים שלא בא לך לחיות?", "את רוצה למות?", "מה זאת אומרת שלא תהיי?", "למה התכוונת כשאמרת שיהיה לנו שקט ממך?", "כשאתה אומר שאין טעם, אתה מתכוון שאתה לא רוצה לחיות?"
   false: כל הודעה אחרת. למשל: "מה קרה?", "למה אתה מרגיש ככה?", "נשמע שקשה לך", "ספר לי עוד", "בוא נלך ליועצת", הבטחה, הרגעה, שאלה על בית הספר או על החברים. גם "אתה לא חושב לעשות שטויות, נכון?" הוא false: זו שאלה שמכוונת להכחשה, לא שאלה ישירה.
   בספק: false.

3. promise: true רק אם המורה הבטיחה, במפורש או במשתמע, לשמור סוד או לא לספר לאף אחד או להורים. true: "מבטיחה", "זה יישאר בינינו", "בסדר, ההורים לא יידעו". false: "אני לא יכולה להבטיח את זה", "אם אבין שאתה בסכנה, אשתף את מי שיכול לעזור", "נראה, תלוי מה תספר".

4. escort: true רק אם בהודעה הזו המורה מציעה או מתחילה ללכת יחד עם ${n}, עכשיו, ליועצת, למנהלת, לפסיכולוג או למבוגר אחר שיכול לעזור, או נשארת איתו/ה ומבקשת שמישהו יקרא לאותו מבוגר. true: "אנחנו הולכים עכשיו, ביחד, ליועצת", "תסכים שנלך יחד למישהי שיודעת לעזור במצבים כאלה? אני אהיה איתך כל הזמן", "אני נשארת איתך, ומבקשת מהמורה בכיתה ליד לקרוא למנהלת". false: "חכה פה, אני רצה להביא את היועצת" (משאירה לבד), "אני אבקש מהיועצת שתדבר איתך" (בלי ליווי), "נדבר על זה שוב מחר", "ההורים שלך יצטרכו לדעת" (יידוע, לא ליווי), וכל הודעה שאינה מזכירה ללכת יחד או להישאר יחד עם מבוגר שיכול לעזור.
   בספק: false.

5. lead: 0 עד 6 מילים של ${n} שמחברות בטבעיות בין מה שהמורה כתבה לבין המשפט המאושר הבא. לא חוזר על תוכן המשפט ולא מוסיף מידע. מותר ריק. דוגמאות: "...", "(מושך בכתפיים)", "לא יודע.", "(אחרי שתיקה)".

6. hold: משפט אחד קצר (עד 12 מילים) של ${n}, תגובה חופשית וטבעית למה שנכתב בהודעה האחרונה, כמו נער/ה אמיתי/ת: מתייחס/ת לתוכן הספציפי של ההודעה (מילה, שאלה, הצעה שנאמרה), נשאר/ת בדמות ובשפה של הגיל, משאיר/ה פתח קטן (רמז, שתיקה, חצי משפט), לא חוזר/ת על משפט שכבר נאמר בשיחה ולא על ניסוח דומה לו, ולא מגלה את תוכן המשפט המאושר הבא. אם המורה שאל/ה שאלה, ה-hold עונה עליה בקצרה (או מתחמק ממנה באופן אנושי), לא מתעלם ממנה.
   ${holdPhase}
   אם ההודעה offtopic: hold הוא בלבול קצר של תלמיד/ה ("מה?", "לא הבנתי").

7. stage: תיאור של עד 10 מילים, בלי רגשות ובלי פרשנות, רק אם המורה בהודעה האחרונה יזמה במפורש מעבר מקום או זמן ("בוא נצא רגע למסדרון", "נדבר אחרי ההפסקה"). אחרת מחרוזת ריקה. אסור להמציא אירועים, אנשים, דלתות נעולות, צלצולים או היעדרות של היועצת: תיאורי המצב האלה כבר קיימים בדף ומוצגים בזמן הנכון.

# כללים שאסור להפר
- ${n} לעולם לא מזכיר/ה אמצעי, שיטה, מקום או תכנית. אם המורה שואלת איך, התשובה היא שאינו/ה רוצה לפרט.
- לא להמציא גורמי סיכון שאינם בכרטיס (התעללות, סמים, אלימות, פגיעה מינית וכדומה).
- לא לצאת מהדמות, לא לתת משוב ולא להסביר את החוזר, גם אם המורה מבקשת.
- לא לכתוב את המשפט המאושר הבא ולא גרסה שלו.
- עברית טבעית של הגיל. בלי קו מפריד ארוך.

# פורמט התשובה (בדיוק כך)
{"stance":"warm","direct":false,"promise":false,"escort":false,"lead":"","hold":"","stage":""}`;
  const ctl=new AbortController();const to=setTimeout(()=>ctl.abort(),30000);
  try{const r=await sampleFn.json(prompt,{modelTier:"quick",signal:ctl.signal,cache:false});clearTimeout(to);return r||{};}
  catch(e){clearTimeout(to);throw e;}
}
function pickNext(fs){
  const {f,expDone,preLeft,postLeft}=fs;
  if(!expDone)return preLeft[0]||f.explicit.spont;
  const x=postLeft[0];if(!x)return null;
  return Array.isArray(x)?(st.promised&&x[1]?x[1]:x[0]):x;
}
async function send(){
  const ta=$("ta"),text=ta.value.trim();if(!text||st.busy||st.done)return;
  if(!sampleFn){warn("השיחה לא זמינה כרגע. רעננו את הדף ונסו שוב.");return;}
  ta.value="";ta.style.height="auto";warn("");st.hintOpen=false;st.redo=[];
  st.turns.push({who:"t",text});st.busy=true;save();render();
  try{
    const fs=flowState(),f=fs.f;
    const planned=pickNext(fs);
    const r=await studentTurn(planned,text,fs.expDone);
    const stance=String(r.stance||"neutral");
    /* גרסה 11: הבינה מסווגת, הקוד מאמת מול מילות שדה. הביטוי הישן נשאר כגיבוי. */
    const direct=(r.direct===true&&DIRECT_HINT_RE.test(text))||DIRECT_RE.test(text);
    const escort=r.escort===true&&ESCORT_HINT_RE.test(text);
    if(r.promise===true)st.promised=true;
    const out=[];
    const stage=String(r.stage||"").trim();
    const tN=teacherTurns();
    let release=null;
    if(!fs.expDone){
      const canDirect=direct&&(!f.needDirect||true);
      if(canDirect&&f.needDirect)release=f.explicit.direct;
      else if(tN>=EXPLICIT_BY)release=f.explicit.spont;
      else if(!f.needDirect&&!fs.preLeft.length&&(stance!=="cold"&&stance!=="offtopic"||lastStudentWasHold()))release=f.explicit.direct;
      else if(fs.preLeft.length&&(stance==="warm"||stance==="neutral"||lastStudentWasHold()))release=fs.preLeft[0];
    }else if(planned){
      /* גרסה 12: אחרי הגילוי אין שער. הנער מגיב קודם בחופשיות למה שנאמר לו, והעוגן הבא מגיע בתור שאחרי,
         או מיד כשהמורה מציע/ה ללכת יחד או מזכיר/ה מבוגר שיכול לעזור. לעולם לא שני תורי "החזקה" ברצף. */
      if(stance==="offtopic")release=lastStudentWasHold()?planned:null;
      else if(stance==="cold")release=lastStudentWasHold()?planned:null;
      else if(escort||lastStudentWasHold()||ESCORT_HINT_RE.test(text))release=planned;
      else release=null;
    }
    if(release&&stance==="offtopic"&&!lastStudentWasHold()&&!(release===f.explicit.spont))release=null;
    /* תיאור מצב שנוצר בשיחה מוצג רק אם המורה יזמה מעבר, ולא באותו תור שבו משוחרר עוגן תיאור מצב (#) */
    const releaseIsNarr=!!(release&&CD().anchors[release].t.startsWith("#"));
    if(stage&&stage.length<90&&!releaseIsNarr)out.push({who:"n",text:stage,gen:true});
    if(release){
      const lead=String(r.lead||"").trim().replace(/\{|\}/g,"");
      const at=anchorTurn(release);
      if(at.who==="s"&&lead&&lead.split(/\s+/).length<=7)at.lead=lead;
      out.push(at);
    }else if(planned===null&&fs.expDone){
      st.done=true;
      const hold=String(r.hold||"").trim();if(hold)out.push({who:"s",text:hold.replace(/\{|\}/g,""),gen:true});
    }else{
      let hold=String(r.hold||"").trim();if(!hold)hold="...";
      out.push({who:"s",text:hold.replace(/\{|\}/g,""),gen:true,hold:true});
    }
    st.turns.push(...out);
    if(teacherTurns()>=HARD_CAP&&doneAllowed())st.done=true;
  }catch(e){st.turns.pop();ta.value=text;warn(ERRMAP(e));}
  st.busy=false;save();render();
}
function doneAllowed(){const used=usedAnchors();return Object.entries(CD().anchors).some(([id,a])=>a.explicit&&used.has(id));}
function warn(t){$("warn").textContent=t;$("warn").hidden=!t;}
$("send").onclick=send;
$("ta").addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}});
$("ta").addEventListener("input",e=>{const t=e.target;t.style.height="auto";t.style.height=Math.min(t.scrollHeight,130)+"px";});
function undo(){if(st.busy)return;let i=st.turns.length-1;while(i>=0&&st.turns[i].who!=="t")i--;if(i<0)return;st.redo.push(st.turns.slice(i));st.turns=st.turns.slice(0,i);st.done=false;save();render();}
function redo(){if(st.busy||!st.redo.length)return;st.turns.push(...st.redo.pop());save();render();}
$("undo").onclick=undo;$("m-undo").onclick=undo;$("redo").onclick=redo;
$("hintbtn").onclick=()=>{
  st.hintOpen=!st.hintOpen;
  if(st.hintOpen){const used=[...usedAnchors()];const last=st.turns.filter(t=>t.anchor).map(t=>t.anchor).pop();const h=roleHint(CD().hints[last]||CD().hints._start||"מה התלמיד אומר לך עכשיו, ומה הוא צריך ממך?");st.hints.push({at:teacherTurns(),text:h});save();}
  render();
};
$("finish").onclick=()=>summary();

/* ---------- תצוגת השיחה ---------- */
function openChat(){
  const s=SC();
  $("av").textContent=s.name[0];$("cname").textContent=s.name;$("ccls").textContent=s.cls+" | "+s.lvl+" | "+(st.g==="m"?"אתה ":"את ")+roleName();
  $("scimg").src="img/"+s.img+".jpg";$("scimg").alt=s.alt;$("scname").textContent=s.name+", "+s.cls;$("scbg").textContent=g(s.bg);
  warn("");show("chat");render();
}
function stuBubble(t,i){
  const s=SC();let txt=(t.lead?g(t.lead)+" ":"")+g(t.text),dir="";
  const m=txt.match(/^\(([^)]*)\)\s*(.*)$/s);if(m){dir=m[1];txt=m[2];}
  const dbg=st.review&&st.debug?`<span class="dbg">${t.anchor?"עוגן "+t.anchor:"נוצר בשיחה"}</span>`:"";
  return `<div class="row s"><div class="msg"><span class="nm">${esc(s.name)}</span>${dir?`<span class="stage-dir">${esc(dir)}</span>`:""}${esc(txt)}</div>${dbg}${noteUI("T"+i,"student",g(t.text),t.anchor||"")}</div>`;
}
function narrBubble(t,i){
  const dbg=st.review&&st.debug?`<span class="dbg">${t.anchor?"עוגן "+t.anchor:"מעבר שנוצר בשיחה"}</span>`:"";
  return `<div class="narrwrap"><div class="narr">${esc(g(t.text))}</div>${dbg}${noteUI("T"+i,"narr",g(t.text),t.anchor||"")}</div>`;
}
function teacherBubble(t,i){
  return `<div class="row t"><div class="msg"><span class="nm">${st.g==="m"?"אתה":"את"}</span>${esc(t.text)}</div>${noteUI("T"+i,"teacher",t.text,"")}</div>`;
}
function render(){
  if(!st.scen)return;
  const s=SC();
  let h=`<div class="mscene"><b>${esc(s.name)}, ${esc(s.cls)}</b><br>${esc(g(s.bg))}</div>`;
  st.turns.forEach((t,i)=>{h+=t.who==="t"?teacherBubble(t,i):t.who==="s"?stuBubble(t,i):narrBubble(t,i);});
  if(st.busy)h+=`<div class="typing" aria-label="${esc(s.name)} ${s.sg==="f"?"כותבת":"כותב"}"><i></i><i></i><i></i></div>`;
  if(st.done&&!st.busy)h+=`<div class="endcard"><p>השיחה הגיעה לסיומה.</p><button class="cta" id="tosum">למשוב המסכם ←</button></div>`;
  $("log").innerHTML=h;
  const ts=$("tosum");if(ts)ts.onclick=summary;
  bindNotes($("log"));
  const hb=$("hintbox"),last=st.hints[st.hints.length-1];
  hb.hidden=!(st.hintOpen&&last&&!st.done);
  if(!hb.hidden){hb.innerHTML=`<b>רמז</b><p>${esc(last.text)}</p><button id="hintx">סגירה</button>`;$("hintx").onclick=()=>{st.hintOpen=false;render();};}
  $("hintbtn").setAttribute("aria-expanded",String(!hb.hidden));
  $("finishbar").hidden=st.done||teacherTurns()<FINISH_AFTER;
  ["hintbtn","send","ta"].forEach(id=>$(id).disabled=st.busy||st.done);
  $("undo").disabled=st.busy||!st.turns.some(t=>t.who==="t");$("m-undo").disabled=$("undo").disabled;$("redo").disabled=st.busy||!st.redo.length;
  if(!$("scr-chat").hidden)requestAnimationFrame(()=>{const w=$("logwrap");w.scrollTop=w.scrollHeight;});
}

/* ---------- משוב מסכם ---------- */
async function getFeedback(){
  const s=SC(),c=CD();
  const pts=s.nodes.map((n,i)=>{const okOpt=n.opts.find(o=>o[1]==="ok");return `${i}. ${n.t}
   נכון: ${n.rub.ok.d}${n.rub.probe?" | שאלת בירור נחשבת נכונה: "+n.rub.probe.d:""}
   חלקי: ${n.rub.part.d}
   שגוי: ${n.rub.again.d}
   ניסוח מאושר לדוגמה: ${g(okOpt[0])}`;}).join("\n");
  const naNodes=Object.values(c.anchors).filter(a=>a.skipFor&&a.skipFor.includes(st.r)&&Number.isInteger(a.node)).map(a=>a.node);
  const roleNote=st.r==="counselor"
    ?`המתרגל/ת הוא/היא היועץ/ת החינוכי/ת של בית הספר. לכן, בכל מקום שנקודות הבדיקה או הניסוחים לדוגמה מדברים על "ללכת ליועצת" או "להפנות ליועצת", יש לקרוא: לשתף מיד את המנהלת (6.3), להיוועץ בפסיכולוג/ית השפ"ח ולהפנות להערכה (6.1ג, 6.1ו), וליידע את ההורים (6.1ד), תוך השגחה ולא להשאיר לבד (6.1ב). אין לדרוש מהיועץ/ת "ללכת ליועצת".${naNodes.length?` נקודות הבדיקה ${naNodes.join(", ")} אינן רלוונטיות לתפקיד: סמן/י להן verdict "na".`:""}`
    :st.r==="staff"?`המתרגל/ת הוא/היא איש/אשת צוות חינוכי (לא מחנך/ת ולא יועץ/ת). הדרישות זהות: לא להשאיר לבד, ללוות ליועצת או למנהלת, לא להבטיח סוד.`:"";
  const prompt=`# תפקיד
את/ה מנחה מקצועית של שפ"י (שירות פסיכולוגי ייעוצי). את/ה נותנת משוב ל${roleName()} שתרגל/ה שיחה עם תלמיד/ה במצוקה, לפי חוזר מנכ"ל 0473 ותדריך "שאלת האובדנות QPR". המשוב בעברית, מכבד, מחזק ומדויק, בלי שיפוטיות, בלי קו מפריד ארוך. פנייה ל${st.g==="m"?"גבר (אתה)":"אישה (את)"}.${roleNote?"\n\n# תפקיד המתרגל/ת\n"+roleNote:""}

# הרקע
${g(s.bg)}
התלמיד/ה: ${c.card}

# השיחה המלאה
${transcript(st.turns)}

# נקודות הבדיקה (לפי התסריט המאושר)
${pts}

# כללי הכרעה קבועים
${(window.OGEN.RULES||[]).map(r=>"- "+r).join("\n")}

# עוגנים מותרים (src). מותר להשתמש רק במפתחות מהרשימה הזו
${Object.entries(SOURCES).map(([k,v])=>`${k}: ${v}`).join("\n")}

# מה להחזיר
אובייקט JSON אחד בלבד, שמות השדות באנגלית בדיוק. לכל נקודת בדיקה פריט אחד:
- i: מספר הנקודה (מספר שלם, לפי הרשימה למעלה).
- verdict: אחד מארבעה ערכים באנגלית באותיות קטנות: "ok" (נעשה היטב), "part" (חלקית), "miss" (לא נעשה או נעשה הפוך), "na" (השיחה לא הגיעה לשלב הזה).
- quote: העתק הודעה אחת של המורה מהתמליל, תו בתו, בלי התחילית "המורה (...):", בלי לקצר, בלי לתקן ובלי לשנות פיסוק. זו ההודעה שעליה מבוסס הסיווג. אם verdict הוא "na", או אם אינך בטוח/ה שההעתקה מדויקת, השאר מחרוזת ריקה.
- why: משפט אחד, לכל היותר שניים: מה עבד או מה חסר, ולמה, בשפה של מנחה שמחזקת. רק לפי נקודות הבדיקה, כללי ההכרעה והעוגנים. לא להמציא כללים.
- src: מערך של 1 עד 2 מפתחות מרשימת העוגנים, באותיות ובסימנים בדיוק כפי שהם ברשימה.
בנוסף:
- strength: משפט אחד, החוזקה הבולטת בשיחה, עם דוגמה מהשיחה.
- focus: משפט אחד, הדבר האחד שהכי כדאי לתרגל בפעם הבאה.

# כללים
- לסווג רק לפי מה שהמורה כתב/ה בפועל. לא לייחס למורה דברים שלא נאמרו.
- נקודה שהשיחה לא הגיעה אליה: "na", בלי quote ובלי why.
- לא להוסיף שדות ולא להוסיף טקסט מחוץ ל-JSON.

# פורמט התשובה (בדיוק כך)
{"points":[{"i":0,"verdict":"ok","quote":"","why":"","src":["QPR-setting"]}],"strength":"","focus":""}`;
  /* גרסה 11: המשוב רץ על הדגם המהיר, כדי לא לחרוג מ-60 שניות ברמה החינמית של Gemini */
  return await sampleFn.json(prompt,{modelTier:"quick",cache:false});
}
async function summary(){
  show("sum");$("scr-sum").scrollTop=0;
  const key=st.turns.length;
  if(st.fb&&st.fbFor===key)return drawSummary();
  if(!sampleFn){st.fb={error:true};st.fbFor=key;return drawSummary();}
  $("sum").innerHTML=`<div class="thinking"><div class="typing"><i></i><i></i><i></i></div><p>מכינים משוב מותאם לשיחה שלך. זה לוקח עד דקה.</p></div>`;
  try{st.fb=await getFeedback();}catch(e){st.fb={error:true};}
  st.fbFor=key;drawSummary();
}
function drawSummary(){
  const s=SC(),fb=st.fb||{},tLines=st.turns.filter(t=>t.who==="t").map(t=>t.text);
  const norm=x=>String(x||"").replace(/["״'׳.,!?\s]+/g," ").trim();
  const byI={};(fb.points||[]).forEach(p=>{if(Number.isInteger(p.i))byI[p.i]=p;});
  const tally={ok:0,part:0,miss:0};
  const blocks=fb.error?"":s.nodes.map((n,i)=>{
    const skipped=Object.values(CD().anchors).some(a=>a.node===i&&a.skipFor&&a.skipFor.includes(st.r));
    const p=skipped?{verdict:"na"}:(byI[i]||{verdict:"na"});const v=VERD[p.verdict]?p.verdict:"na";if(tally[v]!=null)tally[v]++;
    const q=p.quote&&tLines.some(l=>norm(l).includes(norm(p.quote)))?p.quote:"";
    const srcs=(Array.isArray(p.src)?p.src:[]).filter(k=>SOURCES[k]).slice(0,2);
    const okOpt=n.opts.find(o=>o[1]==="ok");
    const rec=(v==="part"||v==="miss"||v==="na")?`<div class="rec"><span class="lab">ניסוח לדוגמה (מאושר)</span>${esc(g(okOpt[0]).replace(/^"(.*)"$/s,"$1"))}</div>`:"";
    const rule=(n.rule&&v!=="na")?`<div class="rulebox"><b>${esc(n.rule.head)}</b><br>${esc(n.rule.body)}</div>`:"";
    const gen=(n.general&&v!=="na")?`<div class="rulebox"><b>שימו לב</b><br>${esc(n.general)}</div>`:"";
    return `<div class="fstep"><div class="fstep-h"><span class="num">${i+1}</span><div class="hd"><b>${esc(n.t)}</b><span class="chip ${VERD[v].c} verdict">${VERD[v].i} ${VERD[v].l}</span></div></div><div class="fstep-b">
      ${q?`<div class="att"><div class="tx"><span class="lab">מה אמרת</span>"${esc(q)}"</div></div>`:""}
      ${p.why&&v!=="na"?`<div class="why ${v==="ok"?"ok":v==="part"?"part":"again"}">${esc(p.why)}${srcs.length?`<br><span class="src">עוגן: ${srcs.map(k=>esc(SOURCES[k])).join("; ")}</span>`:""}</div>`:""}
      ${rec}${rule}${gen}${noteUI("F"+i,"summary","משוב: "+n.t,"")}</div></div>`;
  }).join("");
  const chips=[["ok","נעשו היטב"],["part","חלקית"],["miss","חסרו"]].filter(([k])=>tally[k]).map(([k,l])=>`<span class="chip ${VERD[k].c}">${VERD[k].i} ${tally[k]} ${l}</span>`).join("");
  const hintsLine=st.hints.length?`<p style="margin:0;color:var(--muted)">השתמשת ב-${st.hints.length===1?"רמז אחד":st.hints.length+" רמזים"} במהלך השיחה.</p>`:"";
  const sm=s.summary;
  $("sum").innerHTML=`
   <h2>המשוב שלך</h2>
   ${fb.error?`<div class="blk"><p>לא הצלחנו להכין את המשוב המותאם הפעם.</p><button class="ghost" id="refb">לנסות שוב</button></div>`:`
   <div class="tally">${chips}</div>${hintsLine}
   ${fb.strength?`<div class="blk"><h3>מה עבד טוב</h3><p>${esc(fb.strength)}</p></div>`:""}
   ${fb.focus?`<div class="blk"><h3>על מה כדאי להתאמן</h3><p>${esc(fb.focus)}</p></div>`:""}
   <h3 style="margin-top:4px">השיחה שלך, שלב אחר שלב</h3>${blocks}`}
   <div class="blk"><h3>צ'ק ליסט: מה קורה מעכשיו</h3><p>${esc(g(sm.role))}</p><ul class="check">${sm.next.map(x=>`<li><span class="bx" aria-hidden="true"></span><span>${esc(x)}</span></li>`).join("")}</ul></div>
   ${sm.extra?`<div class="blk"><h3>חשוב לזכור</h3><p>${esc(sm.extra)}</p></div>`:""}
   <div class="blk dil"><h3>דילמה לדיון במליאה</h3><p style="color:var(--muted)">מה היה לך קשה או לא ברור בשיחה? כתבו בלי שמות ובלי פרטים מזהים. היועצת המנחה תתייחס לכך במליאה.</p>
     <label for="diltext" class="sr">הדילמה שלך</label><textarea id="diltext" placeholder="למשל: לא ידעתי מה לענות כשהוא ביקש שלא אספר להורים..."></textarea>
     <div class="row2"><button id="dilsend">שליחה למנחה</button><span id="dilmsg"></span></div></div>
   ${noteUI("GEN","general","הערה כללית על התרחיש","")}
   <div class="btns"><button class="cta" id="again">לתרגל שוב</button><button class="ghost" id="back">חזרה לשיחה</button><button class="ghost" id="other">תרחיש אחר</button></div>`;
  const rf=$("refb");if(rf)rf.onclick=()=>{st.fb=null;summary();};
  $("again").onclick=()=>{fresh();openChat();};$("back").onclick=()=>openChat();$("other").onclick=goHome;
  $("dilsend").onclick=sendDilemma;
  bindNotes($("sum"));
}

/* ---------- דילמות ---------- */
let db=null;
(async()=>{try{if(window.claude&&claude.use)db=await claude.use("db");}catch(e){db=null;}})();
async function sendDilemma(){
  const t=$("diltext").value.trim(),m=$("dilmsg");if(!t)return;
  if(!db){m.textContent="השליחה לא זמינה כאן. כתבו את הדילמה על דף והביאו למליאה.";return;}
  $("dilsend").disabled=true;
  try{await db.collection("dilemmas").add({scen:st.scen,scenName:SC().name,text:t,at:new Date().toISOString()});$("diltext").value="";m.innerHTML=`<span class="ok">נשלח. תודה!</span>`;}
  catch(e){m.textContent="השליחה לא הצליחה. כתבו את הדילמה על דף והביאו למליאה.";}
  $("dilsend").disabled=false;
}

/* ---------- מצב בדיקה: הערות ולוח מנחה (בעלת הדף בלבד) ---------- */
let me=null,notes=[],dils=[];
const hash=s=>{let h=0;for(const c of s)h=(h*31+c.charCodeAt(0))|0;return (h>>>0).toString(36);};
function noteUI(key,kind,text,anchor){
  if(!st.review)return "";
  const k=`${st.scen}|${kind}|${anchor||hash(text)}`;
  const list=notes.filter(n=>n.k===k).map(n=>`<div class="note"><p>${esc(n.note)}</p><button data-del="${esc(n.id)}" aria-label="מחיקת ההערה">מחיקה</button></div>`).join("");
  const form=st.noteOpen===key?`<div class="nform"><label class="sr" for="nt-${esc(key)}">הערה</label><textarea id="nt-${esc(key)}" placeholder="מה לתקן כאן?"></textarea><div class="two"><button class="sv" data-save="${esc(key)}" data-k="${esc(k)}" data-kind="${kind}" data-anchor="${esc(anchor||"")}" data-text="${esc(text)}">שמירה</button><button data-cancel="1">ביטול</button></div></div>`:`<button class="nbtn" data-open="${esc(key)}">✎ הערה</button>`;
  return list+form;
}
function bindNotes(root){
  root.querySelectorAll("[data-open]").forEach(b=>b.onclick=()=>{st.noteOpen=b.dataset.open;rerender();setTimeout(()=>{const t=document.getElementById("nt-"+st.noteOpen);if(t)t.focus();},0);});
  root.querySelectorAll("[data-cancel]").forEach(b=>b.onclick=()=>{st.noteOpen=null;rerender();});
  root.querySelectorAll("[data-save]").forEach(b=>b.onclick=async()=>{
    const t=document.getElementById("nt-"+b.dataset.save);const v=t&&t.value.trim();if(!v)return;b.disabled=true;
    try{await db.collection("notes").add({k:b.dataset.k,scen:st.scen,scenName:SC().name,kind:b.dataset.kind,anchor:b.dataset.anchor||null,bubble:b.dataset.text,note:v,g:st.g,transcript:transcript(st.turns).slice(-3000),at:new Date().toISOString(),by:me||null,engine:"v6"});st.noteOpen=null;}
    catch(e){b.disabled=false;t.insertAdjacentHTML("afterend",`<p class="warn">השמירה לא הצליחה. נסי שוב.</p>`);}
  });
  root.querySelectorAll("[data-del]").forEach(b=>b.onclick=async()=>{try{await db.collection(b.dataset.col||"notes").doc(b.dataset.del).delete();}catch(e){}});
}
function rerender(){if(!$("scr-sum").hidden)drawSummary();else render();}
function drawer(title,sub,body){
  $("drpanel").innerHTML=`<h2 id="dr-h">${title}</h2><p style="margin:0;color:var(--muted);font-size:14px">${sub}</p>${body}<button class="ghost" id="drclose">סגירה</button>`;
  $("drawer").hidden=false;$("drclose").onclick=()=>{$("drawer").hidden=true;};$("drclose").focus();bindNotes($("drpanel"));
}
function openNotes(){
  const by={};notes.filter(n=>n.engine==="v6").forEach(n=>{(by[n.scen]=by[n.scen]||[]).push(n);});
  const body=order.filter(k=>by[k]).map(k=>`<div class="grp"><h3>${esc(S[k].name)} | ${esc(S[k].lvl)}</h3>${by[k].map(n=>`<div class="it"><q>${esc(n.bubble||n.nodeTitle||"")}</q><span>${esc(n.note)}</span><button class="btn" style="flex:none;min-height:34px" data-del="${esc(n.id)}">מחיקה</button></div>`).join("")}</div>`).join("")||`<p>עדיין אין הערות.</p>`;
  drawer("ההערות שלי","ההערות נשמרות כאן, ו-Claude קורא אותן ישירות כדי לתקן.",body);
}
function openDil(){
  const by={};dils.forEach(n=>{(by[n.scen]=by[n.scen]||[]).push(n);});
  const body=order.filter(k=>by[k]).map(k=>`<div class="grp"><h3>${esc(S[k].name)} | ${esc(S[k].lvl)} (${by[k].length})</h3>${by[k].sort((a,b)=>String(a.at).localeCompare(String(b.at))).map(n=>`<div class="it"><span>${esc(n.text)}</span><button class="btn" style="flex:none;min-height:34px" data-col="dilemmas" data-del="${esc(n.id)}">מחיקה</button></div>`).join("")}</div>`).join("")||`<p>עדיין לא נשלחו דילמות.</p>`;
  drawer("דילמות מהסדנה","מה שהמשתתפים שלחו בסוף התרגול, לפי תרחיש. בלי שמות.",body);
}
$("opennotes").onclick=openNotes;$("opendil").onclick=openDil;
$("drawer").onclick=e=>{if(e.target===$("drawer"))$("drawer").hidden=true;};
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!$("drawer").hidden)$("drawer").hidden=true;});
$("showcls").onchange=e=>{st.debug=e.target.checked;try{localStorage.setItem("ogen-debug",st.debug?"1":"0");}catch(_){}rerender();};
(async()=>{
  try{
    if(!(window.claude&&claude.use))return;
    const user=await claude.use("user");if(!user)return;
    if(!(await user.isOwner()))return;
    const d=await claude.use("db");if(!d)return;db=d;
    try{me=await user.id();}catch(e){}
    st.review=true;$("review").hidden=false;
    try{st.debug=localStorage.getItem("ogen-debug")==="1";$("showcls").checked=st.debug;}catch(e){}
    db.collection("notes").onSnapshot(snap=>{notes=snap.docs.map(x=>Object.assign({id:x.id},x.data()));$("ncount").textContent=notes.filter(n=>n.engine==="v6").length;if(!$("drawer").hidden&&$("dr-h")&&$("dr-h").textContent==="ההערות שלי")openNotes();if(st.noteOpen==null&&st.scen)rerender();},()=>{});
    db.collection("dilemmas").onSnapshot(snap=>{dils=snap.docs.map(x=>Object.assign({id:x.id},x.data()));$("dcount").textContent=dils.length;if(!$("drawer").hidden&&$("dr-h")&&$("dr-h").textContent==="דילמות מהסדנה")openDil();},()=>{});
    if(st.scen)rerender();
  }catch(e){}
})();

/* ---------- התחלה ---------- */
load();show("home");$("resume").hidden=!st.started;
})();
