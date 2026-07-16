/* Protein Tracker PWA — logic (v2)
   Storage (localStorage, per-device, offline — the source of truth):
     pt:log:<YYYY-MM-DD>  entries for that day
     pt:customfoods       permanently saved foods
     pt:targets           {p,k,f,c,fib} — externally derived (weekly coaching
                          review); never assume specific values
     pt:weights           [{d:'YYYY-MM-DD', kg:Number}]
     pt:waist             [{d:'YYYY-MM-DD', cm:Number}] — weekly-ish
     pt:taps              {foodName: tapCount}   -> drives favourites
     pt:lastexport        ISO timestamp of the last JSON export
     pt:nudgesnooze       ISO timestamp when the export nudge was dismissed
*/
(function(){
  "use strict";
  /* First-run fallback only, until the first coaching targets are entered in
     Settings. pt:targets is externally derived and drifts — no logic or copy
     anywhere may assume these specific values. */
  const DEFAULT_TARGETS={p:160,k:1975,f:58,c:200,fib:30};
  const CIRC=2*Math.PI*59;   /* matches r=59 in the 140px hero ring */
  const MEALS=["Breakfast","Lunch","Snack","Dinner"];

  /* Food model (v2, grams-first):
       per100  macros per 100 g (or 100 ml) — canonical
       sv      serving presets [{l:label, g:grams, d:1 if default}]
       ver     provenance: label | product-page | reference (custom = your label)
       step    grams step in exact mode
     Gram weights behind old count units: egg 50 g · white 30 g · cheese slice
     20 g · roti 40 g · idli 40 g · dosa 80 g · bread slice 30 g · katori 150 g
     (papaya katori 140 g) · banana 120/160/40 g by variety · apple 180 g ·
     guava 100 g · orange 130 g · date 7 g · tsp 5 g. Chosen so per-100 values
     match standard references and old default portions round-trip exactly. */
  const BASE_FOODS=[
    // Protein & dairy
    {n:"TruNativ Raw Concentrate",cat:"Protein & dairy",unit:"g",ver:"label",hint:"1 scoop = 35 g · label: 28.1g P, 0.5g F, 2.7g C, 128 kcal",per100:{p:80.29,f:1.43,c:7.71,k:365.7,fib:0},sv:[{l:"½ scoop",g:17.5},{l:"1 scoop",g:35,d:1},{l:"1.5 scoop",g:52.5}],step:5},
    {n:"TruNativ Pro Blend",cat:"Protein & dairy",unit:"g",ver:"product-page",hint:"1 scoop = 36 g · 26 g protein",per100:{p:73.3,f:5.94,c:11,k:390.8,fib:0},sv:[{l:"½ scoop",g:18},{l:"1 scoop",g:36,d:1},{l:"1.5 scoop",g:54}],step:6},
    {n:"Chicken breast (cooked)",cat:"Protein & dairy",unit:"g",ver:"reference",per100:{p:30,f:3.6,c:0,k:165,fib:0},sv:[{l:"100 g",g:100},{l:"150 g",g:150,d:1},{l:"200 g",g:200}],step:25},
    {n:"Fish – rohu/surmai (cooked)",cat:"Protein & dairy",unit:"g",ver:"reference",per100:{p:22,f:5,c:0,k:135,fib:0},sv:[{l:"100 g",g:100},{l:"150 g",g:150,d:1},{l:"175 g",g:175}],step:25},
    {n:"Tuna (drained)",cat:"Protein & dairy",unit:"g",ver:"reference",hint:"1 tin ≈ 100 g",per100:{p:25,f:0.8,c:0,k:116,fib:0},sv:[{l:"1 tin (100 g)",g:100,d:1},{l:"½ tin",g:50}],step:20},
    {n:"Prawns (cooked)",cat:"Protein & dairy",unit:"g",ver:"reference",per100:{p:24,f:0.3,c:0.2,k:99,fib:0},sv:[{l:"100 g",g:100,d:1},{l:"150 g",g:150}],step:25},
    {n:"Whole egg",cat:"Protein & dairy",unit:"g",ver:"reference",per100:{p:12,f:10,c:1,k:144,fib:0},sv:[{l:"1 egg",g:50},{l:"2 eggs",g:100,d:1},{l:"3 eggs",g:150}],step:10},
    {n:"Egg white",cat:"Protein & dairy",unit:"g",ver:"reference",per100:{p:12,f:0.2,c:0.6667,k:56.6667,fib:0},sv:[{l:"1 white",g:30},{l:"3 whites",g:90,d:1},{l:"6 whites",g:180}],step:10},
    {n:"Paneer",cat:"Protein & dairy",unit:"g",ver:"reference",per100:{p:18,f:20,c:4,k:265,fib:0},sv:[{l:"50 g",g:50},{l:"100 g",g:100,d:1},{l:"150 g",g:150}],step:20},
    {n:"Tofu",cat:"Protein & dairy",unit:"g",ver:"reference",per100:{p:8,f:4.8,c:1.9,k:76,fib:0.9},sv:[{l:"100 g",g:100,d:1},{l:"150 g",g:150}],step:25},
    {n:"Soya chunks (dry)",cat:"Protein & dairy",unit:"g",ver:"reference",per100:{p:52,f:0.5,c:33,k:345,fib:13},sv:[{l:"25 g",g:25},{l:"50 g",g:50,d:1},{l:"75 g",g:75}],step:10},
    {n:"Moong sprouts (boiled)",cat:"Protein & dairy",unit:"g",ver:"reference",hint:"no-cook: steam/soak",per100:{p:7.5,f:0.5,c:17,k:100,fib:2},sv:[{l:"100 g",g:100,d:1},{l:"150 g",g:150}],step:25},
    {n:"Greek yogurt / hung curd",cat:"Protein & dairy",unit:"g",ver:"reference",per100:{p:10,f:2.7,c:4,k:87,fib:0},sv:[{l:"100 g",g:100},{l:"150 g",g:150,d:1},{l:"200 g",g:200}],step:25},
    {n:"Curd (regular)",cat:"Protein & dairy",unit:"g",ver:"reference",per100:{p:5.3,f:3,c:4.8,k:60,fib:0},sv:[{l:"100 g",g:100},{l:"150 g",g:150,d:1}],step:25},
    {n:"Buttermilk / chaas",cat:"Protein & dairy",unit:"ml",ver:"reference",hint:"no-cook",per100:{p:1,f:0.5,c:2.5,k:20,fib:0},sv:[{l:"1 glass (200 ml)",g:200,d:1}],step:50},
    {n:"Cheese slice",cat:"Protein & dairy",unit:"g",ver:"reference",per100:{p:17.5,f:22.5,c:5,k:300,fib:0},sv:[{l:"1 slice",g:20,d:1},{l:"2 slices",g:40}],step:5},
    {n:"Milk – Nandini toned",cat:"Protein & dairy",unit:"ml",ver:"product-page",hint:"per 100 ml: 3.1 g protein",per100:{p:3.1,f:3,c:4.8,k:58,fib:0},sv:[{l:"100 ml",g:100},{l:"1 glass (200 ml)",g:200,d:1},{l:"250 ml",g:250}],step:50},
    // Grains & carbs
    {n:"Alpino High-Protein Oats (Choco)",cat:"Grains & carbs",unit:"g",ver:"product-page",hint:"27 g protein / 100 g",per100:{p:27,f:9.5,c:47,k:380,fib:9},sv:[{l:"40 g",g:40},{l:"50 g",g:50,d:1},{l:"60 g",g:60}],step:10},
    {n:"Rolled oats (plain)",cat:"Grains & carbs",unit:"g",ver:"reference",per100:{p:13,f:7,c:66,k:380,fib:10},sv:[{l:"40 g",g:40},{l:"50 g",g:50,d:1},{l:"60 g",g:60}],step:10},
    {n:"Muesli",cat:"Grains & carbs",unit:"g",ver:"reference",hint:"no-cook: add milk/curd",per100:{p:10,f:7.5,c:67,k:375,fib:7},sv:[{l:"40 g",g:40,d:1},{l:"60 g",g:60}],step:10},
    {n:"Rice (cooked)",cat:"Grains & carbs",unit:"g",ver:"reference",per100:{p:2.7,f:0.3,c:28,k:130,fib:0.4},sv:[{l:"100 g",g:100},{l:"150 g",g:150,d:1},{l:"200 g",g:200}],step:25},
    {n:"Sweet potato / shakarkandi",cat:"Grains & carbs",unit:"g",ver:"reference",per100:{p:1.6,f:0.1,c:20,k:86,fib:3},sv:[{l:"100 g",g:100},{l:"150 g",g:150,d:1},{l:"200 g",g:200}],step:25},
    {n:"Chapati / roti",cat:"Grains & carbs",unit:"g",ver:"reference",per100:{p:7.5,f:7.5,c:50,k:300,fib:5},sv:[{l:"1 roti",g:40},{l:"2 rotis",g:80,d:1},{l:"3 rotis",g:120}],step:10},
    {n:"Idli",cat:"Grains & carbs",unit:"g",ver:"reference",hint:"steam only",per100:{p:4,f:0.5,c:20,k:100,fib:1.5},sv:[{l:"2 idli",g:80},{l:"3 idli",g:120,d:1},{l:"4 idli",g:160}],step:10},
    {n:"Dosa (plain)",cat:"Grains & carbs",unit:"g",ver:"reference",per100:{p:3.75,f:5,c:25,k:162.5,fib:1.5},sv:[{l:"1 dosa",g:80,d:1},{l:"2 dosas",g:160}],step:20},
    {n:"Poha (cooked)",cat:"Grains & carbs",unit:"g",ver:"reference",hint:"quick cook",per100:{p:2,f:3.3333,c:22.6667,k:133.3333,fib:1},sv:[{l:"½ katori (75 g)",g:75},{l:"1 katori (150 g)",g:150,d:1}],step:25},
    {n:"Brown bread",cat:"Grains & carbs",unit:"g",ver:"reference",per100:{p:13.3333,f:3.3333,c:46.6667,k:266.6667,fib:5},sv:[{l:"1 slice",g:30},{l:"2 slices",g:60,d:1}],step:10},
    {n:"Roasted chana",cat:"Grains & carbs",unit:"g",ver:"reference",per100:{p:20,f:5.5,c:53,k:365,fib:15},sv:[{l:"30 g",g:30,d:1},{l:"50 g",g:50}],step:10},
    {n:"Dal / rajma (cooked)",cat:"Grains & carbs",unit:"g",ver:"reference",hint:"1 katori ≈ 150 g",per100:{p:4.6667,f:2,c:12,k:80,fib:3.3333},sv:[{l:"½ katori (75 g)",g:75},{l:"1 katori (150 g)",g:150,d:1},{l:"1.5 katori (225 g)",g:225}],step:25},
    // Vegetables
    {n:"Carrot (raw)",cat:"Vegetables",unit:"g",ver:"reference",per100:{p:0.93,f:0.24,c:9.6,k:41,fib:2.8},sv:[{l:"1 medium (60 g)",g:60},{l:"100 g",g:100,d:1}],step:10},
    {n:"Cucumber (raw)",cat:"Vegetables",unit:"g",ver:"reference",per100:{p:0.65,f:0.11,c:3.6,k:15,fib:0.5},sv:[{l:"100 g",g:100,d:1},{l:"\u00bd medium (150 g)",g:150}],step:25},
    {n:"Bhurji veg (onion/tomato/capsicum)",cat:"Vegetables",unit:"g",ver:"reference",hint:"raw mix for bhurji",per100:{p:1.2,f:0.2,c:6.8,k:32,fib:1.7},sv:[{l:"1 katori (100 g)",g:100,d:1}],step:25},
    {n:"Spinach / palak (cooked)",cat:"Vegetables",unit:"g",ver:"reference",per100:{p:2.9,f:0.4,c:3.6,k:23,fib:2.4},sv:[{l:"100 g",g:100,d:1},{l:"150 g",g:150}],step:25},
    {n:"Broccoli (cooked)",cat:"Vegetables",unit:"g",ver:"reference",per100:{p:2.8,f:0.4,c:7,k:35,fib:3.3},sv:[{l:"100 g",g:100,d:1},{l:"150 g",g:150}],step:25},
    {n:"Mixed veg sabzi (1 tsp oil)",cat:"Vegetables",unit:"g",ver:"reference",per100:{p:1.3333,f:2.6667,c:5.3333,k:50,fib:2},sv:[{l:"½ katori (75 g)",g:75},{l:"1 katori (150 g)",g:150,d:1},{l:"1.5 katori (225 g)",g:225}],step:25},
    {n:"Sambar",cat:"Vegetables",unit:"g",ver:"reference",per100:{p:2.6667,f:1.6667,c:8,k:60,fib:2},sv:[{l:"½ katori (75 g)",g:75},{l:"1 katori (150 g)",g:150,d:1},{l:"1.5 katori (225 g)",g:225}],step:25},
    {n:"Kosambari (moong salad)",cat:"Vegetables",unit:"g",ver:"reference",hint:"no-cook",per100:{p:3.3333,f:1.3333,c:8,k:60,fib:2.6667},sv:[{l:"½ katori (75 g)",g:75},{l:"1 katori (150 g)",g:150,d:1}],step:25},
    {n:"Green salad (dressed)",cat:"Vegetables",unit:"g",ver:"reference",per100:{p:0.6667,f:0.1333,c:2.6667,k:13.3333,fib:1},sv:[{l:"1 katori (150 g)",g:150,d:1},{l:"2 katori (300 g)",g:300}],step:25},
    // Fruit
    {n:"Watermelon (cubes)",cat:"Fruit",unit:"g",ver:"reference",per100:{p:0.61,f:0.15,c:7.55,k:30,fib:0.4},sv:[{l:"1 katori (150 g)",g:150,d:1},{l:"2 katori (300 g)",g:300}],step:25},
    {n:"Banana – Robusta/Cavendish",cat:"Fruit",unit:"g",ver:"reference",hint:"~120g edible, the common everyday banana",per100:{p:1.1,f:0.3,c:22.8,k:89,fib:2.6},sv:[{l:"1 banana",g:120,d:1},{l:"½ banana",g:60}],step:10},
    {n:"Banana – Nendran",cat:"Fruit",unit:"g",ver:"reference",hint:"~160g edible, larger Kerala/coastal variety",per100:{p:1.1,f:0.3,c:22.8,k:89,fib:2.6},sv:[{l:"1 banana",g:160,d:1},{l:"½ banana",g:80}],step:10},
    {n:"Banana – Yelakki (Elaichi)",cat:"Fruit",unit:"g",ver:"reference",hint:"~40g edible each, small — figures below are for 2",per100:{p:1.1,f:0.3,c:22.8,k:89,fib:2.6},sv:[{l:"1 small",g:40},{l:"2 small",g:80,d:1}],step:10},
    {n:"Apple",cat:"Fruit",unit:"g",ver:"reference",per100:{p:0.2778,f:0.1667,c:13.8889,k:52.7778,fib:2.4444},sv:[{l:"1 apple",g:180,d:1},{l:"½ apple",g:90}],step:10},
    {n:"Guava",cat:"Fruit",unit:"g",ver:"reference",per100:{p:2.6,f:1,c:14,k:68,fib:5.4},sv:[{l:"1 guava",g:100,d:1},{l:"2 guavas",g:200}],step:10},
    {n:"Papaya (cubes)",cat:"Fruit",unit:"g",ver:"reference",per100:{p:0.5,f:0.2857,c:10.7143,k:42.8571,fib:1.7857},sv:[{l:"1 katori (140 g)",g:140,d:1},{l:"2 katori (280 g)",g:280}],step:20},
    {n:"Orange",cat:"Fruit",unit:"g",ver:"reference",per100:{p:0.9231,f:0.1538,c:11.5385,k:47.6923,fib:2.3846},sv:[{l:"1 orange",g:130,d:1}],step:10},
    {n:"Dates",cat:"Fruit",unit:"g",ver:"reference",per100:{p:2.8571,f:0,c:75.7143,k:285.7143,fib:11.4286},sv:[{l:"2 dates",g:14,d:1},{l:"4 dates",g:28}],step:7},
    {n:"Coconut water",cat:"Fruit",unit:"ml",ver:"reference",hint:"no-cook",per100:{p:0.7,f:0,c:4.5,k:19,fib:0},sv:[{l:"1 glass (200 ml)",g:200,d:1}],step:50},
    {n:"Moong dal (dry)",cat:"Grains & carbs",unit:"g",ver:"reference",hint:"dry \u2014 ~2 chilla per 50 g",per100:{p:24,f:1.2,c:59,k:347,fib:16.3},sv:[{l:"for 2 chilla (50 g)",g:50,d:1},{l:"25 g",g:25}],step:5},
    {n:"Dalia / broken wheat (cooked)",cat:"Grains & carbs",unit:"g",ver:"reference",hint:"USDA bulgur, cooked",per100:{p:3.08,f:0.24,c:18.6,k:83,fib:4.5},sv:[{l:"1 katori (150 g)",g:150,d:1},{l:"1.5 katori (225 g)",g:225}],step:25},
    {n:"Upma (no oil)",cat:"Grains & carbs",unit:"g",ver:"estimate",hint:"sooji + veg, no oil",per100:{p:3.8,f:0.4,c:22,k:110,fib:1.4},sv:[{l:"1 katori (150 g)",g:150,d:1}],step:25},
    {n:"Ragi mudde / ragi rice (cooked)",cat:"Grains & carbs",unit:"g",ver:"estimate",hint:"IFCT dry values \u00f7 cooked hydration",per100:{p:2.1,f:0.4,c:19,k:91,fib:3.2},sv:[{l:"1 katori (150 g)",g:150,d:1},{l:"1.5 katori (225 g)",g:225}],step:25},
    {n:"Jowar rice (cooked)",cat:"Grains & carbs",unit:"g",ver:"estimate",hint:"IFCT dry values \u00f7 cooked hydration",per100:{p:2.9,f:0.5,c:20,k:97,fib:2.7},sv:[{l:"1 katori (150 g)",g:150,d:1}],step:25},
    {n:"Curd rice",cat:"Grains & carbs",unit:"g",ver:"estimate",hint:"~2:1 rice:curd",per100:{p:3.6,f:1.2,c:20,k:107,fib:0.3},sv:[{l:"1 katori (150 g)",g:150,d:1}],step:25},
    {n:"Veg pulao",cat:"Grains & carbs",unit:"g",ver:"estimate",hint:"oil included",per100:{p:2.5,f:3.5,c:21,k:130,fib:1.3},sv:[{l:"1 katori (150 g)",g:150,d:1},{l:"1 plate (250 g)",g:250}],step:25},
    {n:"Jeera / lemon rice",cat:"Grains & carbs",unit:"g",ver:"estimate",hint:"tempering oil included",per100:{p:2.5,f:4.5,c:24,k:150,fib:0.7},sv:[{l:"1 katori (150 g)",g:150,d:1}],step:25},
    {n:"Chicken biryani",cat:"Grains & carbs",unit:"g",ver:"estimate",hint:"home-style; restaurant runs higher",per100:{p:7.5,f:5,c:16,k:140,fib:0.8},sv:[{l:"1 katori (150 g)",g:150,d:1},{l:"1 plate (250 g)",g:250}],step:25},
    // Nuts & fats
    {n:"Almonds",cat:"Nuts & fats",unit:"g",ver:"reference",per100:{p:21,f:49,c:22,k:580,fib:12.5},sv:[{l:"10 g (~8 nuts)",g:10,d:1},{l:"20 g",g:20}],step:5},
    {n:"Walnuts",cat:"Nuts & fats",unit:"g",ver:"reference",per100:{p:15,f:65,c:14,k:654,fib:6.7},sv:[{l:"10 g",g:10,d:1},{l:"20 g",g:20}],step:5},
    {n:"Peanuts (roasted)",cat:"Nuts & fats",unit:"g",ver:"reference",per100:{p:26,f:49,c:16,k:567,fib:8.5},sv:[{l:"20 g",g:20,d:1},{l:"30 g",g:30}],step:5},
    {n:"Cashews",cat:"Nuts & fats",unit:"g",ver:"reference",per100:{p:18,f:44,c:30,k:553,fib:3.3},sv:[{l:"15 g",g:15,d:1},{l:"30 g",g:30}],step:5},
    {n:"Chia seeds",cat:"Nuts & fats",unit:"g",ver:"reference",per100:{p:17,f:31,c:42,k:486,fib:34},sv:[{l:"1 tbsp",g:12,d:1},{l:"2 tbsp",g:24}],step:3},
    {n:"Flax seeds",cat:"Nuts & fats",unit:"g",ver:"reference",per100:{p:18,f:42,c:29,k:534,fib:27},sv:[{l:"1 tbsp",g:10,d:1},{l:"2 tbsp",g:20}],step:5},
    {n:"Peanut butter",cat:"Nuts & fats",unit:"g",ver:"reference",per100:{p:25,f:50,c:20,k:590,fib:6},sv:[{l:"1 tbsp",g:15,d:1},{l:"2 tbsp",g:30}],step:5},
    {n:"Coconut (fresh grated)",cat:"Nuts & fats",unit:"g",ver:"reference",per100:{p:3,f:33,c:15,k:354,fib:9},sv:[{l:"20 g",g:20,d:1},{l:"30 g",g:30}],step:10},
    {n:"Ghee / oil",cat:"Nuts & fats",unit:"g",ver:"reference",per100:{p:0,f:100,c:0,k:900,fib:0},sv:[{l:"1 tsp",g:5,d:1},{l:"1 tbsp",g:15}],step:5}
  ];
  const BASE_CATS=["My foods","Protein & dairy","Grains & carbs","Vegetables","Fruit","Nuts & fats"];

  const $=id=>document.getElementById(id);
  /* Safe wiring: a missing element must never take down the rest of the app
     (e.g. a stale index.html paired with a fresh app.js after a partial deploy). */
  function bind(id,ev,fn){const el=$(id); if(el) el.addEventListener(ev,fn); return el;}
  function warn(msg){ try{console.warn("[tracker] "+msg);}catch(e){} }
  const prog=$("prog"); prog.style.strokeDasharray=CIRC;

  let entries=[], customFoods=[], FOODS=[], targets={}, weights=[], waist=[], taps={}, targetlog=[];
  let sheetFood=null, sheetMeal=null, sheetMode="log", histDate=null;
  const dateKey=todayKey();

  /* ---------- utils ---------- */
  function todayKey(d){d=d||new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");}
  function keyToDate(k){const[a,b,c]=k.split("-").map(Number);return new Date(a,b-1,c);}
  function prettyDate(d){return (d||new Date()).toLocaleDateString(undefined,{weekday:"short",day:"numeric",month:"short"});}
  function round(n){return Math.round(n*10)/10;}
  function nice(n){n=round(n);return n%1===0?String(n):n.toFixed(1);}
  function fmtAmt(n){return String(Math.round(n*100)/100);}
  function weekHit(){return Math.round(targets.p*0.97);}
  function toast(msg){const t=$("toast");t.textContent=msg;t.classList.add("show");clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove("show"),1700);}

  /* ---------- storage ---------- */
  function lsGet(k,fb){ try{const v=localStorage.getItem(k);return v?JSON.parse(v):fb;}catch(e){return fb;} }
  function lsSet(k,v){ try{localStorage.setItem(k,JSON.stringify(v));}catch(e){toast("Storage full or blocked");} }
  function loadDay(k){return lsGet("pt:log:"+k,[]);}
  function saveDay(){lsSet("pt:log:"+dateKey,entries);}
  function saveCustom(){lsSet("pt:customfoods",customFoods);}
  function saveTargets(){lsSet("pt:targets",targets);}
  function saveWeights(){lsSet("pt:weights",weights);}
  function saveWaist(){lsSet("pt:waist",waist);}
  function saveTaps(){lsSet("pt:taps",taps);}
  function allLogKeys(){
    const out=[];
    for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith("pt:log:"))out.push(k);}
    return out.sort();
  }

  function rebuildFoods(){FOODS=customFoods.map(c=>Object.assign({},c,{mine:true})).concat(BASE_FOODS);}
  function findFood(n){return FOODS.find(f=>f.n===n);}

  /* ---------- food model helpers (grams-first) ---------- */
  function perGram(f){          // macros per 1 g/ml — or per 1 unit for count-based customs
    if(f.countBased) return f.perUnit;
    const h=f.per100;
    return {p:h.p/100,f:h.f/100,c:h.c/100,k:h.k/100,fib:(h.fib||0)/100};
  }
  function macrosFor(f,amt){
    const g=perGram(f);
    return {p:g.p*amt,f:g.f*amt,c:g.c*amt,k:g.k*amt,fib:(g.fib||0)*amt};
  }
  function defServing(f){
    if(f.countBased) return {l:fmtAmt(f.def)+" "+f.unit,g:f.def,d:1};
    return (f.sv||[]).find(s=>s.d)||(f.sv||[])[0]||{l:"100 "+f.unit,g:100};
  }
  function defAmt(f){return defServing(f).g;}
  const VER_LABEL={label:"✓ label-verified","product-page":"from product page",reference:"reference values",estimate:"estimate",custom:"your label"};
  /* v1 custom foods stored macros per one <unit> ({per, def}). g/ml foods
     convert exactly to per100; count-based units (piece, serving…) keep a
     per-unit model — no gram weight exists to invent. Idempotent. */
  function migrateCustom(c){
    if(c.per100||c.countBased) return c;
    const per=c.per||{};
    if(c.unit==="g"||c.unit==="ml"){
      return {n:c.n,cat:"My foods",unit:c.unit,ver:"custom",
        per100:{p:(per.p||0)*100,f:(per.f||0)*100,c:(per.c||0)*100,k:(per.k||0)*100,fib:(per.fib||0)*100},
        sv:[{l:fmtAmt(c.def)+" "+c.unit,g:c.def,d:1}],step:c.step||5};
    }
    return {n:c.n,cat:"My foods",unit:c.unit||"serving",ver:"custom",countBased:true,
      perUnit:{p:per.p||0,f:per.f||0,c:per.c||0,k:per.k||0,fib:per.fib||0},def:c.def||1,step:c.step||1};
  }
  function sumOf(list){return list.reduce((a,e)=>{a.p+=e.p||0;a.f+=e.f||0;a.c+=e.c||0;a.k+=e.k||0;a.fib+=e.fib||0;return a;},{p:0,f:0,c:0,k:0,fib:0});}
  function totals(){return sumOf(entries);}
  function guessMeal(){
    const h=new Date().getHours()+new Date().getMinutes()/60;
    if(h<11.5)return "Breakfast";
    if(h<16)return "Lunch";
    if(h<19.5)return "Snack";
    return "Dinner";
  }

  /* ---------- main render ---------- */
  /* hero shows whole grams — at a glance "149 of 160" is the information;
     decimals live in the log rows and the scrolled-appbar readout */
  function heroRow(id,val,target,barId,opts){
    opts=opts||{};
    const box=$(id); if(!box)return;
    const v=box.querySelector("#"+opts.valId);
    if(v)v.textContent=opts.oneDp?nice(round(val)):String(Math.round(val));
    const of=box.querySelector(".of");
    if(of)of.textContent="/ "+target+(opts.unitless?"":" g");
    const bar=$(barId);
    if(bar)bar.style.width=(Math.min(val/(target||1),1)*100)+"%";
    if(opts.overAt!=null)box.classList.toggle("over",val>opts.overAt);
    if(opts.metAt!=null)box.classList.toggle("met",val>=opts.metAt);
  }
  function render(){
    const t=totals(), p=round(t.p);
    $("pnum").textContent=String(Math.round(p));
    $("ptarget").textContent="/ "+targets.p+" g";
    prog.style.strokeDashoffset=CIRC*(1-Math.min(p/targets.p,1));
    $("hero").classList.toggle("hit",p>=targets.p);
    $("miniP").innerHTML="<b>"+nice(p)+"</b>/"+targets.p+" g";
    heroRow("calbox",t.k,targets.k,"calbar",{valId:"cal",unitless:true,overAt:targets.k+40});
    heroRow("fatbox",t.f,targets.f,"fatbar",{valId:"fat",overAt:targets.f+5});
    heroRow("carbbox",t.c,targets.c,"carbbar",{valId:"carb"});
    heroRow("fibbox",t.fib,targets.fib,"fibbar",{valId:"fib",oneDp:true,metAt:targets.fib});
    $("footTargets").textContent="Targets: "+targets.p+" g protein · "+targets.k+" kcal · fat "+targets.f+" g · carbs "+targets.c+" g · fibre "+targets.fib+" g";
    renderRecommender();
    renderLog();
  }

  /* ---------- recommender (multi-macro engine lives in recommend.js) ----------
     Priority protein -> calories -> fibre -> fat/carb flex. First suggestion
     is the next plan meal adapted to the live targets; ad-hoc closers below. */
  function renderRecommender(){
    const box=$("rec"); if(!box)return;
    if(!window.RECOMMEND||!window.MEAL_PLAN){box.innerHTML="";return;}
    const now=new Date();
    const r=RECOMMEND.recommend(entries,targets,window.MEAL_PLAN,FOODS,
      {h:now.getHours()+now.getMinutes()/60,dateKey:dateKey});
    box.classList.toggle("done",r.kind==="done");
    let html='<div class="rh"><h3>'+(r.kind==="meal"?"From your plan":r.headline)+'</h3></div>';
    if(r.kind==="done"){
      box.innerHTML=html+'<div class="celebrate">✓ '+r.headline+'</div><div class="sub" style="margin-top:6px">'+r.reasoning+'</div>';
      return;
    }
    html+='<div class="sub">'+r.reasoning+'</div>';
    if(r.kind==="meal"){
      const m=r.meal;
      html+='<div class="recmeal"><div class="rmh"><span class="potag">'+m.tag+'</span><span class="rmn"></span></div>'+
        '<ul class="poing">'+m.items.map(it=>'<li>'+esc(planItemLabel(it))+'</li>').join("")+'</ul>'+
        '<div class="pomac">'+macLine(m.totals)+'</div>'+
        '<button class="rlog" id="recLog">Log this meal</button></div>';
    }
    if(r.adhoc&&r.adhoc.length){
      html+='<div class="sub" style="margin-top:10px">'+(r.kind==="meal"?"Or close it à la carte:":"Quickest ways to close it:")+'</div><div class="opts">';
      r.adhoc.forEach((s,i)=>{
        const over=!s.fits?' <span class="over">(+'+s.overK+' over kcal)</span>':'';
        const partial=s.partial?' · gets you part-way':'';
        const gain= s.mode==="fibre" ? '+'+nice(round(s.adds.fib))+'g fibre' : '+'+nice(round(s.adds.p))+'g P';
        html+='<div class="opt"><div class="oi"><div class="on"></div>'+
          '<div class="oq"><b>'+gain+'</b> · '+Math.round(s.adds.k)+' kcal'+over+partial+'</div></div>'+
          '<button class="oadd" data-i="'+i+'">'+fmtAmt(s.amt)+' '+s.unit+'</button></div>';
      });
      html+='</div>';
    }
    box.innerHTML=html;
    const rmn=box.querySelector(".rmn"); if(rmn&&r.meal) rmn.textContent=r.meal.name;
    box.querySelectorAll(".oadd").forEach(btn=>{
      const s=r.adhoc[+btn.dataset.i];
      btn.parentElement.querySelector(".on").textContent=s.food;
      btn.onclick=()=>{const f=findFood(s.food); if(f)openSheet(f,s.amt);};
    });
    const lg=$("recLog");
    if(lg) lg.onclick=()=>{
      const m=r.meal;
      addEntry({n:m.slot+" "+m.tag+" — "+m.name+" (plan)",amt:null,unit:"",meal:m.logSlot,
        note:m.items.map(planItemLabel).join(" · "),
        p:m.totals.p,f:m.totals.f,c:m.totals.c,k:m.totals.k,fib:m.totals.fib});
      toast("+"+nice(round(m.totals.p))+" g protein · "+m.name);
    };
  }

  /* ---------- today's log, grouped by meal ---------- */
  function entryRow(e,removable){
    const row=document.createElement("div");row.className="row";
    const q=e.lbl||(e.amt!=null?(fmtAmt(e.amt)+" "+e.unit):(e.note||""));
    row.innerHTML='<div class="rn"><div class="rt"></div><div class="rq">'+q+'</div></div>'+
      '<div class="rm"><b>'+nice(round(e.p))+'g P</b><br>'+Math.round(e.k)+' kcal</div>'+
      (removable?'<button class="x" aria-label="Remove entry">×</button>':'');
    row.querySelector(".rt").textContent=e.n;
    if(removable) row.querySelector(".x").onclick=()=>remove(e.id);
    return row;
  }
  function renderLog(){
    const log=$("log"); log.innerHTML="";
    if(!entries.length){log.innerHTML='<div class="empty">Nothing logged yet. Tap a food above to start.</div>';return;}
    MEALS.forEach(m=>{
      const items=entries.filter(e=>e.meal===m);
      if(!items.length)return;
      const s=sumOf(items);
      const h=document.createElement("div");h.className="mealhead";
      h.innerHTML='<span class="mt">'+m+'</span><span class="ms"><b>'+nice(round(s.p))+'g P</b> · '+Math.round(s.k)+' kcal</span>';
      log.appendChild(h);
      items.forEach(e=>log.appendChild(entryRow(e,true)));
    });
    const untagged=entries.filter(e=>!MEALS.includes(e.meal));
    if(untagged.length){
      const h=document.createElement("div");h.className="mealhead";h.innerHTML='<span class="mt">Other</span>';
      log.appendChild(h);untagged.forEach(e=>log.appendChild(entryRow(e,true)));
    }
  }

  /* ---------- favourites ---------- */
  function renderFavs(){
    const wrap=$("favs"); if(!wrap)return; wrap.innerHTML="";
    const top=Object.entries(taps).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([key])=>{
      if(key.indexOf("meal:")===0){
        const m=(meals||[]).find(x=>"meal:"+x.id===key);
        return m?{meal:m,n:m.name}:null;
      }
      return findFood(key);
    }).filter(Boolean);
    if(top.length<2){wrap.style.display="none";return;}
    wrap.style.display="flex";
    top.forEach(f=>{
      const b=document.createElement("button");b.className="fav";b.type="button";
      if(f.meal){
        const t=mealTotals(f.meal);
        b.innerHTML='<div class="fn"></div><div class="fm">'+nice(round(t.p))+'g P · whole meal</div>';
        b.querySelector(".fn").textContent=f.n;
        b.onclick=()=>logMeal(f.meal);
      } else {
        const ds=defServing(f), dm=macrosFor(f,ds.g);
        b.innerHTML='<div class="fn"></div><div class="fm">'+nice(round(dm.p))+'g P · '+ds.l+'</div>';
        b.querySelector(".fn").textContent=f.n;
        b.onclick=()=>openSheet(f);
      }
      wrap.appendChild(b);
    });
  }

  /* ---------- food chips ---------- */
  function renderChips(filter){
    filter=(filter||"").trim().toLowerCase();
    const wrap=$("foodlist");wrap.innerHTML="";
    const openState=lsGet("pt:accordions",{"Protein & dairy":true});
    let matches=0;
    BASE_CATS.forEach(cat=>{
      const items=FOODS.filter(f=>f.cat===cat && f.n.toLowerCase().includes(filter));
      if(!items.length)return;
      matches+=items.length;
      const acc=document.createElement("details");
      acc.className="acc";
      // searching auto-expands anything that matches; otherwise use remembered state
      acc.open = filter ? true : (cat==="My foods" ? true : !!openState[cat]);
      const sum=document.createElement("summary");
      sum.innerHTML='<span class="ttl'+(cat==="My foods"?" mine":"")+'"></span>'+
        '<span class="cnt">'+items.length+'</span>'+
        '<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
      sum.querySelector(".ttl").textContent = cat==="My foods" ? "★ My foods" : cat;
      acc.appendChild(sum);
      const body=document.createElement("div");body.className="accbody";
      const grid=document.createElement("div");grid.className="chips";
      items.forEach(f=>{
        const wrap=document.createElement("div");wrap.className="chip"+(f.mine?" mine":"");
        const ds=defServing(f), dm=macrosFor(f,ds.g);
        wrap.innerHTML='<button class="cmain" type="button"><div class="nm"></div>'+
          '<div class="mac"><b>'+nice(round(dm.p))+'g P</b> · '+Math.round(dm.k)+' kcal / '+ds.l+'</div></button>'+
          '<button class="cadd" type="button" aria-label="Log '+esc(ds.l)+' of '+esc(f.n)+' now">+</button>';
        wrap.querySelector(".nm").textContent=f.n;
        wrap.querySelector(".cmain").onclick=()=>openSheet(f);
        wrap.querySelector(".cadd").onclick=()=>quickAdd(f);
        grid.appendChild(wrap);
      });
      body.appendChild(grid);acc.appendChild(body);
      // remember which sections you keep open (only when not searching)
      acc.addEventListener("toggle",()=>{
        if($("search").value.trim())return;
        const st=lsGet("pt:accordions",{});st[cat]=acc.open;lsSet("pt:accordions",st);
      });
      wrap.appendChild(acc);
    });
    if(!matches) wrap.innerHTML='<div class="empty">No foods match \u201c'+filter+'\u201d. Add it below to save it permanently.</div>';
  }

  /* ---------- one-tap quick add: default serving, undo via the log row × ---------- */
  function quickAdd(f){
    const ds=defServing(f), amt=ds.g, m=macrosFor(f,amt);
    let lbl=null;
    if(!f.countBased && !/^[\d.½]+ ?(g|ml)/.test(ds.l))
      lbl = /\(\d+(\.\d+)? ?(g|ml)\)/.test(ds.l) ? ds.l : ds.l+" · "+fmtAmt(amt)+" "+f.unit;
    const meal=guessMeal();
    addEntry({n:f.n,amt:amt,unit:f.unit,lbl:lbl,meal:meal,p:m.p,f:m.f,c:m.c,k:m.k,fib:m.fib});
    taps[f.n]=(taps[f.n]||0)+1;saveTaps();renderFavs();
    toast("+"+nice(round(m.p))+" g protein · "+ds.l+" · "+meal);
  }

  /* ---------- generic sheet open/close ---------- */
  function showSheet(sheetId,backId){
    const s=$(sheetId); s.style.transform=""; s.classList.remove("dragging");
    $(backId).classList.add("show"); s.classList.add("show");
  }
  function hideSheet(sheetId,backId){
    const s=$(sheetId); $(backId).classList.remove("show"); s.classList.remove("show"); s.style.transform="";
  }

  /* ---------- quantity sheet ---------- */
  function setSeg(meal){
    sheetMeal=meal;
    $("sSeg").querySelectorAll("button").forEach(b=>b.classList.toggle("on",b.dataset.m===meal));
  }
  let qtyMode="sv", selSv=0;   // sv = serving presets, exact = grams/ml stepper
  function currentAmt(){
    if(!sheetFood)return 0;
    if(qtyMode==="sv"&&!sheetFood.countBased) return (sheetFood.sv[selSv]||defServing(sheetFood)).g;
    return parseFloat($("sAmt").value)||0;
  }
  function renderQtyUI(){
    const f=sheetFood; if(!f)return;
    const modeSeg=$("sQMode"), presets=$("sPresets"), stepper=$("sStepper");
    if(f.countBased){
      if(modeSeg)modeSeg.style.display="none";
      if(presets)presets.style.display="none";
      stepper.style.display="";
      $("sUnit").textContent=f.unit;
    } else {
      if(modeSeg){
        modeSeg.style.display="grid";
        modeSeg.querySelectorAll("button").forEach(b=>b.classList.toggle("on",b.dataset.q===qtyMode));
      }
      $("sUnit").textContent=f.unit;
      if(presets){
        presets.style.display = qtyMode==="sv" ? "grid" : "none";
        presets.innerHTML="";
        f.sv.forEach((s,i)=>{
          const b=document.createElement("button");b.type="button";
          b.className="svbtn"+(i===selSv?" on":"");
          b.innerHTML='<span class="svl"></span>'+(s.l.indexOf("(")<0?'<span class="svg">'+fmtAmt(s.g)+' '+f.unit+'</span>':'');
          b.querySelector(".svl").textContent=s.l;
          b.onclick=()=>{selSv=i;renderQtyUI();updateSheetMacros();};
          presets.appendChild(b);
        });
      }
      stepper.style.display = qtyMode==="exact" ? "" : "none";
    }
  }
  function openSheet(f,amt,mode){
    sheetFood=f; sheetMode=mode||"log";
    $("sTitle").textContent=f.n;
    $("sHint").textContent=f.hint||"";
    const prov=$("sProv");
    if(prov){prov.textContent=VER_LABEL[f.ver]||"";prov.className="prov"+(f.ver==="label"?" strong":"");}
    // presets by default; a passed-in amount (recommender) opens exact at that value
    if(f.countBased){qtyMode="exact";$("sAmt").value=fmtAmt(amt!=null?amt:f.def);}
    else if(amt!=null){qtyMode="exact";$("sAmt").value=fmtAmt(amt);}
    else{
      qtyMode="sv";selSv=Math.max(0,f.sv.findIndex(s=>s.d));
      $("sAmt").value=fmtAmt(defAmt(f));
    }
    $("delFood").style.display=(f.mine&&sheetMode==="log")?"block":"none";
    const segEl=$("sSeg"); if(segEl) segEl.style.display = sheetMode==="meal" ? "none" : "grid";
    $("sAdd").textContent = sheetMode==="meal" ? "Add to meal" : "Add to today";
    // when picking a food for a meal, stack above the builder sheet
    $("sheet").classList.toggle("stacked", sheetMode==="meal");
    $("sheetBack").classList.toggle("stacked", sheetMode==="meal");
    setSeg(guessMeal());
    renderQtyUI();
    updateSheetMacros();
    showSheet("sheet","sheetBack");
  }
  function closeSheet(){hideSheet("sheet","sheetBack");sheetFood=null;}
  function updateSheetMacros(){
    if(!sheetFood)return;
    const m=macrosFor(sheetFood,currentAmt());
    $("sMacros").innerHTML='<span class="pm">'+nice(m.p)+'g P</span><span>'+Math.round(m.k)+
      ' kcal</span><span>F '+nice(m.f)+'</span><span>C '+nice(m.c)+'</span>'+
      (m.fib>0?'<span>Fib '+nice(m.fib)+'</span>':'');
  }
  function stepSheet(dir){
    if(!sheetFood)return;
    let a=parseFloat($("sAmt").value)||0;
    a=Math.max(0,Math.round((a+dir*sheetFood.step)*100)/100);
    $("sAmt").value=fmtAmt(a);updateSheetMacros();
  }
  bind("sQMode","click",e=>{
    const b=e.target.closest("button"); if(!b||!sheetFood||sheetFood.countBased)return;
    if(b.dataset.q==="exact") $("sAmt").value=fmtAmt(currentAmt());   // carry the preset over
    qtyMode=b.dataset.q;
    renderQtyUI();updateSheetMacros();
  });
  $("sMinus").onclick=()=>stepSheet(-1);
  $("sPlus").onclick=()=>stepSheet(1);
  $("sAmt").oninput=updateSheetMacros;
  $("sAmt").onfocus=function(){this.select();};
  $("sCancel").onclick=closeSheet;
  $("sheetBack").onclick=closeSheet;
  $("sSeg").querySelectorAll("button").forEach(b=>b.onclick=()=>setSeg(b.dataset.m));
  $("sAdd").onclick=()=>{
    if(!sheetFood)return;
    const a=currentAmt();
    if(a<=0){toast("Set an amount above 0");return;}
    const m=macrosFor(sheetFood,a), fname=sheetFood.n, funit=sheetFood.unit;
    // human label when a preset was used and it says more than the raw amount
    let lbl=null;
    if(qtyMode==="sv"&&!sheetFood.countBased){
      const s=sheetFood.sv[selSv];
      if(s&&!/^[\d.½]+ ?(g|ml)/.test(s.l))
        lbl = /\(\d+(\.\d+)? ?(g|ml)\)/.test(s.l) ? s.l : s.l+" · "+fmtAmt(a)+" "+funit;
    }
    if(sheetMode==="meal"){
      if(!draft){closeSheet();return;}
      draft.items.push({n:fname,amt:a,unit:funit,lbl:lbl,
        p:m.p,f:m.f,c:m.c,k:m.k,fib:m.fib});
      renderDraft();closeSheet();   // note: closeSheet() nulls sheetFood, so read it before here
      const se=$("mbSearch"); if(se){se.value="";renderPicker("");}
      toast(fname+" added to the meal");
      return;
    }
    addEntry({n:fname,amt:a,unit:funit,lbl:lbl,meal:sheetMeal,p:m.p,f:m.f,c:m.c,k:m.k,fib:m.fib});
    taps[fname]=(taps[fname]||0)+1; saveTaps(); renderFavs();
    toast("+"+nice(round(m.p))+" g protein · "+sheetMeal);
    closeSheet();
  };
  $("delFood").onclick=()=>{
    if(!sheetFood||!sheetFood.mine)return;
    if(confirm('Remove "'+sheetFood.n+'" from your saved foods?')){
      customFoods=customFoods.filter(c=>c.n!==sheetFood.n);
      delete taps[sheetFood.n]; saveTaps();
      saveCustom();rebuildFoods();renderChips($("search").value);renderFavs();closeSheet();toast("Food removed");
    }
  };

  /* ---------- drag-to-dismiss (all sheets) ---------- */
  function makeDraggable(sheetId,onClose){
    const sheet=$(sheetId); let dragging=false,startY=0,curY=0,lastY=0,lastT=0,vel=0;
    const zone=t=>t.closest(".grab")||t.closest(".sheet-title")||t.closest(".sheet-hint");
    sheet.addEventListener("pointerdown",e=>{
      if(!zone(e.target))return;
      dragging=true;startY=e.clientY;curY=0;lastY=e.clientY;lastT=performance.now();vel=0;
      sheet.setPointerCapture(e.pointerId);sheet.classList.add("dragging");
    });
    sheet.addEventListener("pointermove",e=>{
      if(!dragging)return;
      curY=Math.max(0,e.clientY-startY);
      const now=performance.now(),dt=now-lastT;
      if(dt>0){vel=(e.clientY-lastY)/dt;lastY=e.clientY;lastT=now;}
      sheet.style.transform="translateY("+curY+"px)";
    });
    const end=()=>{
      if(!dragging)return;dragging=false;sheet.classList.remove("dragging");
      const h=sheet.getBoundingClientRect().height;
      if(curY>h*0.32||vel>0.7) onClose(); else sheet.style.transform="";
    };
    sheet.addEventListener("pointerup",end);
    sheet.addEventListener("pointercancel",end);
  }
  makeDraggable("sheet",closeSheet);

  /* ---------- entries ---------- */
  function addEntry(e){
    e.id=Date.now()+"-"+Math.random().toString(36).slice(2,6);
    if(!e.meal)e.meal=guessMeal();
    entries.push(e);saveDay();render();renderWeek();
  }
  function remove(id){entries=entries.filter(e=>e.id!==id);saveDay();render();renderWeek();}

  $("search").oninput=function(){renderChips(this.value);};

  /* ---------- permanent custom food ---------- */
  $("cfAdd").onclick=()=>{
    const name=($("cfName").value||"").trim();
    const unit=($("cfUnit").value||"").trim()||"serving";
    const amt=parseFloat($("cfAmt").value)||0;
    const p=parseFloat($("cfP").value)||0,k=parseFloat($("cfK").value)||0,
          f=parseFloat($("cfF").value)||0,c=parseFloat($("cfC").value)||0,
          fib=parseFloat($("cfFib").value)||0;
    if(!name){toast("Give the food a name");return;}
    if(amt<=0){toast("Enter the amount those macros are for");return;}
    if(!p&&!k){toast("Enter at least protein or calories");return;}
    if(FOODS.some(x=>x.n.toLowerCase()===name.toLowerCase())){toast("A food with that name exists");return;}
    customFoods.push(migrateCustom({n:name,cat:"My foods",unit:unit,def:amt,step:(amt>=20?5:(amt>=5?1:0.5)),
      per:{p:p/amt,f:f/amt,c:c/amt,k:k/amt,fib:fib/amt}}));
    saveCustom();rebuildFoods();
    ["cfName","cfUnit","cfAmt","cfP","cfK","cfF","cfC","cfFib"].forEach(i=>{const el=$(i);if(el)el.value="";});
    document.querySelector(".addfood").open=false;
    renderChips($("search").value);toast('"'+name+'" saved to your foods');
  };

  $("clear").onclick=()=>{
    if(!entries.length)return;
    if(confirm("Clear everything logged today?")){entries=[];saveDay();render();renderWeek();}
  };

  /* ---------- weight ---------- */
  function rollingAvg(n){
    const recent=weights.slice(-n);
    if(!recent.length)return null;
    return recent.reduce((a,w)=>a+w.kg,0)/recent.length;
  }
  function renderWeight(){
    const today=weights.find(w=>w.d===dateKey);
    $("wtIn").value = today? String(today.kg) : "";
    const avg7=rollingAvg(7);
    $("wtAvg").innerHTML = avg7!=null ? '7-day avg <b>'+avg7.toFixed(1)+' kg</b>' : '—';

    const sp=$("wtSpark"); sp.innerHTML="";
    const last=weights.slice(-14);
    if(last.length>=2){
      const vals=last.map(w=>w.kg), min=Math.min(...vals), max=Math.max(...vals), span=Math.max(0.6,max-min);
      last.forEach((w,i)=>{
        const el=document.createElement("i");
        el.style.height=Math.max(3,Math.round(((w.kg-min)/span)*30)+4)+"px";
        if(i===last.length-1)el.className="last";
        el.title=w.d+": "+w.kg+" kg";
        sp.appendChild(el);
      });
    }
    // trend: this week's avg vs the previous week's
    const t=$("wtTrend");
    if(weights.length<4){
      t.innerHTML="Weigh in most mornings — the 7-day average is what matters, not any single day. Need about a week of entries before a trend means anything.";
      return;
    }
    const cur=rollingAvg(7);
    const prevSlice=weights.slice(-14,-7);
    if(prevSlice.length<3){t.innerHTML="Building your baseline — <b>"+cur.toFixed(1)+" kg</b> average so far. A second week makes the trend readable.";return;}
    const prev=prevSlice.reduce((a,w)=>a+w.kg,0)/prevSlice.length;
    const diff=cur-prev;
    /* Rate vs the 0.3–0.5 kg/week goal only — no prescriptions.
       Adjustment calls belong to the weekly coaching review, not this app. */
    let verdict;
    if(diff<=-0.7) verdict='<span class="warn">Faster than the 0.3–0.5 kg/week goal.</span>';
    else if(diff<=-0.25) verdict='<span class="good">On pace</span> — inside the 0.3–0.5 kg/week goal.';
    else if(diff<=-0.05) verdict='Losing, but slower than the 0.3–0.5 kg/week goal.';
    else if(diff<0.25) verdict='Flat week on week.';
    else verdict='<span class="warn">Up week on week.</span>';
    t.innerHTML='Week on week: <b>'+(diff>0?"+":"")+diff.toFixed(2)+' kg</b> ('+prev.toFixed(1)+' → '+cur.toFixed(1)+' kg). '+verdict;
  }
  $("wtAdd").onclick=()=>{
    const kg=parseFloat($("wtIn").value);
    if(!kg||kg<25||kg>300){toast("Enter a weight in kg");return;}
    const ex=weights.find(w=>w.d===dateKey);
    if(ex)ex.kg=kg; else weights.push({d:dateKey,kg:kg});
    weights.sort((a,b)=>a.d<b.d?-1:1);
    saveWeights();renderWeight();toast(ex?"Weight updated":"Weight logged");
  };

  /* ---------- waist (weekly, feeds the coaching export) ---------- */
  function daysBetween(isoOrKey){
    const d=new Date(isoOrKey); if(isNaN(d))return null;
    return Math.floor((Date.now()-d.getTime())/86400000);
  }
  function renderWaist(){
    const line=$("waLast"); if(!line)return;
    if(!waist.length){line.textContent="Once a week is plenty — it rides along in the export.";return;}
    const last=waist[waist.length-1];
    const days=daysBetween(last.d);
    line.innerHTML='Last: <b>'+last.cm.toFixed(1)+' cm</b> · '+prettyDate(keyToDate(last.d))+
      (days>=7?' — due for a fresh one':'');
  }
  bind("waAdd","click",()=>{
    const cm=parseFloat($("waIn").value);
    if(!cm||cm<40||cm>200){toast("Enter a waist in cm");return;}
    const ex=waist.find(w=>w.d===dateKey);
    if(ex)ex.cm=cm; else waist.push({d:dateKey,cm:cm});
    waist.sort((a,b)=>a.d<b.d?-1:1);
    saveWaist();$("waIn").value="";renderWaist();toast(ex?"Waist updated":"Waist logged");
  });

  /* ---------- 7-day strip (tappable) ---------- */
  function renderWeek(){
    const days=$("days");days.innerHTML="";let hits=0;
    const arr=[];for(let i=6;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);arr.push(d);}
    const res=arr.map(d=>{
      const k=todayKey(d);
      const list=k===dateKey?entries:loadDay(k);
      return {k,d,p:round(sumOf(list).p),today:k===dateKey};
    });
    const max=Math.max(targets.p,...res.map(r=>r.p));
    res.forEach(r=>{
      if(r.p>=weekHit())hits++;
      const el=document.createElement("button");
      el.className="day"+(r.p>=weekHit()?" hit":"")+(r.today?" today":"");
      el.type="button";
      el.setAttribute("aria-label",prettyDate(r.d)+": "+nice(r.p)+" g protein");
      el.innerHTML='<div class="col" style="height:'+Math.max(4,Math.round((r.p/max)*54))+'px"></div>'+
        '<div class="dl">'+r.d.toLocaleDateString(undefined,{weekday:"short"}).slice(0,1)+'</div>';
      el.onclick=()=>openHistory(r.k);
      days.appendChild(el);
    });
    $("hitCount").textContent=hits;
  }

  /* ---------- history ---------- */
  function openHistory(k){histDate=k||dateKey;renderHistory();showSheet("histSheet","histBack");}
  function closeHistory(){hideSheet("histSheet","histBack");}
  makeDraggable("histSheet",closeHistory);
  $("btnHist").onclick=()=>openHistory(dateKey);
  $("hClose").onclick=closeHistory;
  $("histBack").onclick=closeHistory;
  $("hPrev").onclick=()=>{const d=keyToDate(histDate);d.setDate(d.getDate()-1);histDate=todayKey(d);renderHistory();};
  $("hNext").onclick=()=>{const d=keyToDate(histDate);d.setDate(d.getDate()+1);histDate=todayKey(d);renderHistory();};
  function renderHistory(){
    const isToday=histDate===dateKey;
    const list=isToday?entries:loadDay(histDate);
    const s=sumOf(list);
    $("hDate").textContent=(isToday?"Today · ":"")+prettyDate(keyToDate(histDate));
    $("hTot").innerHTML= list.length
      ? '<b>'+nice(round(s.p))+'g P</b> · '+Math.round(s.k)+' kcal · F '+nice(round(s.f))+' · C '+Math.round(s.c)+' · Fib '+nice(round(s.fib))
      : 'nothing logged';
    $("hNext").disabled = histDate>=dateKey;
    const body=$("hBody");body.innerHTML="";
    if(!list.length){body.innerHTML='<div class="empty">Nothing logged on this day.</div>';return;}
    MEALS.concat(["Other"]).forEach(m=>{
      const items= m==="Other" ? list.filter(e=>!MEALS.includes(e.meal)) : list.filter(e=>e.meal===m);
      if(!items.length)return;
      const ms=sumOf(items);
      const h=document.createElement("div");h.className="mealhead";
      h.innerHTML='<span class="mt">'+m+'</span><span class="ms"><b>'+nice(round(ms.p))+'g P</b> · '+Math.round(ms.k)+' kcal</span>';
      body.appendChild(h);
      items.forEach(e=>body.appendChild(entryRow(e,isToday)));
    });
  }

  /* ---------- settings + coach check-in ---------- */
  /* pt:targetlog: [{d: ISO, targets:{p,k,f,c,fib}}] — appended on every coach
     update and carried in the export, so the coach sees when changes took effect */
  function saveTargetlog(){lsSet("pt:targetlog",targetlog);}
  function deltaChipsHtml(oldT,newT){
    const KEYS=[["k","kcal"],["p","P"],["f","F"],["c","C"],["fib","Fib"]];
    return KEYS.map(([key,lbl])=>{
      const o=oldT[key],n=newT[key];
      return '<span>'+lbl+' '+o+(o===n?' =':' → <b>'+n+'</b>')+'</span>';
    }).join("");
  }
  function renderCoachLine(){
    const line=$("coachLine"),chips=$("coachChips");
    if(!line)return;
    const bits=[];
    if(targetlog.length){
      const d=daysBetween(targetlog[targetlog.length-1].d);
      bits.push("Targets last updated "+(d===0?"today":d+" day"+(d===1?"":"s")+" ago"));
    } else bits.push("No coach update recorded yet");
    const le=lsGet("pt:lastexport",null);
    if(le){const d=daysBetween(le);bits.push("export sent "+(d===0?"today":d+" day"+(d===1?"":"s")+" ago"));}
    line.textContent=bits.join(" · ");
    if(chips){
      chips.innerHTML="";
      if(targetlog.length>=2)
        chips.innerHTML=deltaChipsHtml(targetlog[targetlog.length-2].targets,targetlog[targetlog.length-1].targets);
    }
  }
  function openSettings(){
    renderCoachLine();
    const days=allLogKeys().length;
    $("statLine").textContent=days+" day"+(days===1?"":"s")+" logged · "+customFoods.length+" custom food"+(customFoods.length===1?"":"s")+" · "+meals.length+" meal"+(meals.length===1?"":"s")+" · "+weights.length+" weigh-in"+(weights.length===1?"":"s")+" · "+waist.length+" waist";
    const sl=$("storageLine"); if(sl) sl.textContent=storageLineText();
    showSheet("setSheet","setBack");
  }
  function closeSettings(){hideSheet("setSheet","setBack");}
  makeDraggable("setSheet",closeSettings);
  $("btnSet").onclick=openSettings;
  $("setCancel").onclick=closeSettings;
  $("setBack").onclick=closeSettings;

  function readCoachInputs(){
    return {p:parseFloat($("tP").value),k:parseFloat($("tK").value),
            f:parseFloat($("tF").value),c:parseFloat($("tC").value),
            fib:parseFloat(($("tFib")||{}).value)};
  }
  function renderDeltaChips(){
    const el=$("deltaChips"); if(!el)return;
    const v=readCoachInputs();
    const nt={p:Math.round(v.p)||0,k:Math.round(v.k)||0,f:Math.round(v.f)||0,c:Math.round(v.c)||0,fib:Math.round(v.fib)||0};
    el.innerHTML=deltaChipsHtml(targets,nt);
  }
  function openCoach(){
    $("tP").value=targets.p;$("tK").value=targets.k;$("tF").value=targets.f;$("tC").value=targets.c;
    const tf=$("tFib"); if(tf) tf.value=targets.fib;
    renderDeltaChips();
    showSheet("coachSheet","coachBack");
  }
  function closeCoach(){hideSheet("coachSheet","coachBack");}
  makeDraggable("coachSheet",closeCoach);
  bind("coachBtn","click",openCoach);
  bind("coachCancel","click",closeCoach);
  bind("coachBack","click",closeCoach);
  ["tP","tK","tF","tC","tFib"].forEach(id=>bind(id,"input",renderDeltaChips));
  bind("coachSave","click",()=>{
    const v=readCoachInputs();
    if(!(v.p>0&&v.k>0)){toast("Protein and calories must be above 0");return;}
    if(v.p>400||v.k>8000){toast("That looks out of range — check the numbers");return;}
    const nt={p:Math.round(v.p),k:Math.round(v.k),f:Math.round(v.f)||0,c:Math.round(v.c)||0,
              fib:Math.round(v.fib)||DEFAULT_TARGETS.fib};
    const changed=JSON.stringify(nt)!==JSON.stringify(targets);
    targets=nt;saveTargets();
    if(changed){targetlog.push({d:new Date().toISOString(),targets:nt});saveTargetlog();}
    planRendered=false;render();renderWeek();renderCoachLine();closeCoach();
    toast(changed?"Targets updated from coach":"Targets unchanged");
  });

  /* ---------- export / import ---------- */
  function download(name,text,type){
    const blob=new Blob([text],{type:type});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();
    setTimeout(()=>{URL.revokeObjectURL(url);a.remove();},400);
  }
  /* The JSON export is an interface, not a backup: it feeds the weekly
     coaching review that produces new pt:targets. Always full history,
     never deltas. Schema history: 3 = v1 backup; 4 = adds schema field,
     waist series. Import accepts 3 and 4. */
  function collectAll(){
    const logs={};
    allLogKeys().forEach(k=>{logs[k.replace("pt:log:","")]=lsGet(k,[]);});
    logs[dateKey]=entries;
    return {app:"protein-tracker",version:4,schema:4,exported:new Date().toISOString(),
            targets,targetlog,customFoods,meals,weights,waist,taps,logs};
  }
  function markExported(){
    lsSet("pt:lastexport",new Date().toISOString());
    try{localStorage.removeItem("pt:nudgesnooze");}catch(e){}
    renderNudge();
  }
  async function shareExport(){
    const json=JSON.stringify(collectAll(),null,2);
    const name="protein-tracker-export-"+dateKey+".json";
    try{
      const file=new File([json],name,{type:"application/json"});
      if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){
        await navigator.share({files:[file],title:"Protein Tracker export"});
        markExported();toast("Export shared");return;
      }
    }catch(err){
      if(err&&err.name==="AbortError")return;   // user closed the share sheet — not an export
    }
    download(name,json,"application/json");
    markExported();toast("Export downloaded");
  }
  bind("expJson","click",shareExport);
  $("expCsv").onclick=()=>{
    const data=collectAll();
    const esc=v=>{v=String(v==null?"":v);return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;};
    const rows=[["date","meal","food","amount","unit","protein_g","fat_g","carbs_g","fibre_g","kcal"]];
    Object.keys(data.logs).sort().forEach(d=>{
      (data.logs[d]||[]).forEach(e=>rows.push([d,e.meal||"",e.n,e.amt==null?"":e.amt,e.unit||"",
        round(e.p||0),round(e.f||0),round(e.c||0),round(e.fib||0),Math.round(e.k||0)]));
    });
    if(weights.length){
      rows.push([]);rows.push(["date","weight_kg"]);
      weights.forEach(w=>rows.push([w.d,w.kg]));
    }
    download("protein-tracker-"+dateKey+".csv",rows.map(r=>r.map(esc).join(",")).join("\n"),"text/csv");
    toast("CSV downloaded");
  };
  $("impBtn").onclick=()=>$("impFile").click();
  $("impFile").onchange=function(){
    const file=this.files&&this.files[0]; if(!file)return;
    const r=new FileReader();
    r.onload=()=>{
      try{
        const d=JSON.parse(r.result);
        if(!d||d.app!=="protein-tracker"||!d.logs) throw new Error("not a backup");
        const dayCount=Object.keys(d.logs).length;
        if(!confirm("Import backup from "+(d.exported||"unknown date")+"?\n\n"+dayCount+" days, "+
           (d.customFoods||[]).length+" custom foods, "+(d.meals||[]).length+" meals, "+
           (d.weights||[]).length+" weigh-ins.\n\nThis replaces everything currently in the app.")) return;
        allLogKeys().forEach(k=>localStorage.removeItem(k));
        Object.entries(d.logs).forEach(([day,list])=>lsSet("pt:log:"+day,list));
        if(d.targets)lsSet("pt:targets",d.targets);
        if(d.customFoods)lsSet("pt:customfoods",d.customFoods);
        if(d.meals)lsSet("pt:meals",d.meals);
        if(d.weights)lsSet("pt:weights",d.weights);
        if(d.waist)lsSet("pt:waist",d.waist);   // absent in schema-3 backups — fine
        if(d.targetlog)lsSet("pt:targetlog",d.targetlog);
        if(d.taps)lsSet("pt:taps",d.taps);
        toast("Backup restored");
        setTimeout(()=>location.reload(),700);
      }catch(err){ toast("That file isn't a valid backup"); }
    };
    r.readAsText(file);
    this.value="";
  };

  /* ---------- durability (localStorage stays the source of truth;
     this is about not losing it, not about sync) ---------- */
  const storageState={persist:null,usage:null,quota:null};
  function fmtBytes(n){
    if(n==null)return "?";
    if(n<1024*1024)return Math.max(1,Math.round(n/1024))+" KB";
    if(n<1024*1024*1024)return (n/1048576).toFixed(1)+" MB";
    return (n/1073741824).toFixed(1)+" GB";
  }
  function storageLineText(){
    let bits=[];
    if(storageState.persist===true) bits.push("Persistent storage: granted — the browser won't evict this app's data under pressure.");
    else if(storageState.persist===false) bits.push("Persistent storage: not granted — keep exporting; the browser may evict data under storage pressure.");
    else bits.push("Persistent storage: unknown on this browser.");
    if(storageState.quota) bits.push("Using "+fmtBytes(storageState.usage)+" of "+fmtBytes(storageState.quota)+".");
    const last=lsGet("pt:lastexport",null);
    if(last){const d=daysBetween(last);bits.push("Last export: "+(d===0?"today":d+" day"+(d===1?"":"s")+" ago")+".");}
    else bits.push("Last export: never.");
    return bits.join(" ");
  }
  function initDurability(){
    if(navigator.storage&&navigator.storage.persist){
      navigator.storage.persisted()
        .then(p=>p?true:navigator.storage.persist())
        .then(g=>{storageState.persist=!!g;})
        .catch(()=>{});
    }
    if(navigator.storage&&navigator.storage.estimate){
      navigator.storage.estimate().then(e=>{
        storageState.usage=e.usage;storageState.quota=e.quota;
        if(e.quota&&e.usage/e.quota>0.8) toast("Storage almost full — export your data");
      }).catch(()=>{});
    }
  }

  /* ---------- days-since-export nudge (dismiss = snooze, it comes back) ---------- */
  const NUDGE_AFTER_DAYS=7, NUDGE_SNOOZE_DAYS=3, NUDGE_MIN_LOGGED_DAYS=3;
  function renderNudge(){
    const el=$("nudge"); if(!el)return;
    const last=lsGet("pt:lastexport",null);
    const snooze=lsGet("pt:nudgesnooze",null);
    let msg=null;
    if(last){
      const d=daysBetween(last);
      if(d!=null&&d>=NUDGE_AFTER_DAYS) msg="Last export was "+d+" days ago — the coach review needs fresh data.";
    } else if(allLogKeys().length>=NUDGE_MIN_LOGGED_DAYS){
      msg="You've never exported — the weekly coach review runs on the JSON export.";
    }
    if(msg&&snooze!=null){const s=daysBetween(snooze);if(s!=null&&s<NUDGE_SNOOZE_DAYS)msg=null;}
    if(!msg){el.hidden=true;el.innerHTML="";return;}
    el.hidden=false;
    el.innerHTML='<span class="ntxt"></span><span class="nacts"><button class="ngo">Export</button><button class="nlater">Later</button></span>';
    el.querySelector(".ntxt").textContent=msg;
    el.querySelector(".ngo").onclick=shareExport;
    el.querySelector(".nlater").onclick=()=>{lsSet("pt:nudgesnooze",new Date().toISOString());renderNudge();};
  }

  /* ---------- appbar ---------- */
  window.addEventListener("scroll",()=>{$("appbar").classList.toggle("scrolled",window.scrollY>8);},{passive:true});

  /* ---------- appearance: auto / light / dark ---------- */
  const THEME_ICONS={
    auto:'<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor" stroke="none"/>',
    light:'<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.1 5.1l1.4 1.4M17.5 17.5l1.4 1.4M18.9 5.1l-1.4 1.4M6.5 17.5l-1.4 1.4"/>',
    dark:'<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5z"/>'
  };
  const THEME_LABEL={auto:"Following your phone",light:"Light mode",dark:"Dark mode"};
  function systemDark(){return window.matchMedia&&window.matchMedia("(prefers-color-scheme:dark)").matches;}
  function applyTheme(mode){
    const root=document.documentElement;
    if(mode==="auto") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme",mode);
    const ic=$("thIcon"); if(ic) ic.innerHTML=THEME_ICONS[mode];
    const effectiveDark = mode==="dark" || (mode==="auto" && systemDark());
    const mc=$("themeColor"); if(mc) mc.setAttribute("content", effectiveDark ? "#14130e" : "#f0f0ec");
  }
  function cycleTheme(){
    const order=["auto","light","dark"];
    const cur=lsGet("pt:theme","auto");
    const next=order[(order.indexOf(cur)+1)%order.length];
    lsSet("pt:theme",next);applyTheme(next);toast(THEME_LABEL[next]);
  }
  bind("btnTheme","click",cycleTheme);
  if(window.matchMedia){
    const mq=window.matchMedia("(prefers-color-scheme:dark)");
    const onSys=()=>{ if(lsGet("pt:theme","auto")==="auto") applyTheme("auto"); };
    if(mq.addEventListener) mq.addEventListener("change",onSys); else if(mq.addListener) mq.addListener(onSys);
  }

  /* ================= TABS ================= */
  function showView(id){
    document.querySelectorAll(".view").forEach(v=>v.classList.toggle("on",v.id===id));
    document.querySelectorAll(".tab").forEach(t=>t.classList.toggle("on",t.dataset.v===id));
    window.scrollTo({top:0,behavior:"instant"});
    if(id==="viewMeals") renderMeals();
    if(id==="viewPlan") renderPlan();
  }
  document.querySelectorAll(".tab").forEach(t=>t.addEventListener("click",()=>showView(t.dataset.v)));

  /* ================= MY MEALS ================= */
  let meals=[], draft=null, editingId=null;
  function loadMeals(){meals=lsGet("pt:meals",[]);}
  function saveMeals(){lsSet("pt:meals",meals);}
  function mealTotals(m){return sumOf(m.items||[]);}
  function ingLine(m){return (m.items||[]).map(i=>i.n+" "+(i.lbl||fmtAmt(i.amt)+i.unit)).join(" · ");}

  function renderMeals(){
    const wrap=$("mealList"); if(!wrap)return;
    wrap.innerHTML="";
    if(!meals.length){
      wrap.innerHTML='<div class="empty">No meals yet. Build one below — add the foods you actually eat together, and it becomes a single tap.</div>';
      return;
    }
    const order={Breakfast:0,Lunch:1,Snack:2,Dinner:3};
    meals.slice().sort((a,b)=>(order[a.slot]??9)-(order[b.slot]??9)||a.name.localeCompare(b.name)).forEach(m=>{
      const t=mealTotals(m);
      const card=document.createElement("div");card.className="mealcard";
      card.innerHTML='<div class="mh"><div class="mi">'+
          '<div class="mn"></div><div class="mslot">'+m.slot+'</div>'+
          '<div class="mmac"><b>'+nice(round(t.p))+'g P</b> · '+Math.round(t.k)+' kcal · F '+nice(round(t.f))+
          ' · C '+Math.round(t.c)+' · Fib '+nice(round(t.fib))+'</div>'+
          '<div class="ming"></div></div>'+
          '<button class="mlog">Log</button></div>'+
        '<div class="mfoot"><button class="med">Edit</button><button class="mdel">Delete</button></div>';
      card.querySelector(".mn").textContent=m.name;
      card.querySelector(".ming").textContent=ingLine(m);
      card.querySelector(".mlog").onclick=()=>logMeal(m);
      card.querySelector(".med").onclick=()=>openBuilder(m);
      card.querySelector(".mdel").onclick=()=>{
        if(confirm('Delete "'+m.name+'"? Days you already logged it stay untouched.')){
          meals=meals.filter(x=>x.id!==m.id);saveMeals();renderMeals();renderFavs();toast("Meal deleted");
        }
      };
      wrap.appendChild(card);
    });
  }

  function logMeal(m){
    const t=mealTotals(m);
    addEntry({n:m.name,amt:null,unit:"",meal:m.slot,note:ingLine(m),
      p:t.p,f:t.f,c:t.c,k:t.k,fib:t.fib});
    taps["meal:"+m.id]=(taps["meal:"+m.id]||0)+1;saveTaps();renderFavs();
    toast("+"+nice(round(t.p))+" g protein · "+m.name);
  }

  /* ---- builder ---- */
  function openBuilder(m){
    editingId = m ? m.id : null;
    draft = m ? {name:m.name,slot:m.slot,items:m.items.map(i=>Object.assign({},i))}
              : {name:"",slot:guessMeal(),items:[]};
    $("mbTitle").textContent = m ? "Edit meal" : "Create a meal";
    $("mbName").value=draft.name;
    $("mbDelete").style.display = m ? "block" : "none";
    $("mbSearch").value="";
    setMbSeg(draft.slot);
    renderDraft();renderPicker("");
    showSheet("mbSheet","mbBack");
  }
  function closeBuilder(){hideSheet("mbSheet","mbBack");draft=null;editingId=null;}
  function setMbSeg(slot){
    draft.slot=slot;
    $("mbSeg").querySelectorAll("button").forEach(b=>b.classList.toggle("on",b.dataset.m===slot));
  }
  function renderDraft(){
    const wrap=$("mbItems");wrap.innerHTML="";
    if(!draft.items.length){
      wrap.innerHTML='<div class="empty" style="padding:12px">No ingredients yet — search below to add some.</div>';
    } else {
      draft.items.forEach((it,idx)=>{
        const r=document.createElement("div");r.className="mbrow";
        r.innerHTML='<span class="mbn"></span><span class="mba">'+(it.lbl||fmtAmt(it.amt)+' '+it.unit)+' · '+nice(round(it.p))+'g P</span>'+
          '<button class="mbx" aria-label="Remove">×</button>';
        r.querySelector(".mbn").textContent=it.n;
        r.querySelector(".mbx").onclick=()=>{draft.items.splice(idx,1);renderDraft();};
        wrap.appendChild(r);
      });
    }
    const t=sumOf(draft.items);
    $("mbTot").innerHTML= draft.items.length
      ? '<b>'+nice(round(t.p))+'g P</b> · '+Math.round(t.k)+' kcal · F '+nice(round(t.f))+' · C '+Math.round(t.c)+' · Fib '+nice(round(t.fib))
      : 'Totals appear once you add ingredients';
  }
  function renderPicker(filter){
    filter=(filter||"").trim().toLowerCase();
    const wrap=$("mbPick");wrap.innerHTML="";
    if(!filter){wrap.innerHTML='';return;}
    FOODS.filter(f=>f.n.toLowerCase().includes(filter)).slice(0,12).forEach(f=>{
      const d=document.createElement("div");d.className="chip";
      const ds=defServing(f), dm=macrosFor(f,ds.g);
      d.innerHTML='<button class="cmain" type="button"><div class="nm"></div>'+
        '<div class="mac"><b>'+nice(round(dm.p))+'g P</b> / '+ds.l+'</div></button>';
      d.querySelector(".nm").textContent=f.n;
      d.querySelector(".cmain").onclick=()=>openSheet(f,null,"meal");
      wrap.appendChild(d);
    });
    if(!wrap.children.length) wrap.innerHTML='<div class="empty" style="grid-column:1/-1;padding:12px">Nothing matches. Save it under My foods on the Today tab first.</div>';
  }
  bind("mealNew","click",()=>openBuilder(null));
  bind("mbSearch","input",function(){renderPicker(this.value);});
  bind("mbName","input",function(){if(draft)draft.name=this.value;});
  $("mbSeg").querySelectorAll("button").forEach(b=>b.onclick=()=>setMbSeg(b.dataset.m));
  bind("mbCancel","click",closeBuilder);
  bind("mbBack","click",closeBuilder);
  makeDraggable("mbSheet",closeBuilder);
  bind("mbDelete","click",()=>{
    if(!editingId)return;
    const m=meals.find(x=>x.id===editingId);
    if(m&&confirm('Delete "'+m.name+'"?')){
      meals=meals.filter(x=>x.id!==editingId);saveMeals();closeBuilder();renderMeals();renderFavs();toast("Meal deleted");
    }
  });
  bind("mbSave","click",()=>{
    if(!draft)return;
    const name=(draft.name||"").trim();
    if(!name){toast("Give the meal a name");return;}
    if(!draft.items.length){toast("Add at least one ingredient");return;}
    if(meals.some(m=>m.name.toLowerCase()===name.toLowerCase()&&m.id!==editingId)){toast("You already have a meal with that name");return;}
    if(editingId){
      const m=meals.find(x=>x.id===editingId);
      m.name=name;m.slot=draft.slot;m.items=draft.items;
    } else {
      meals.push({id:"m"+Date.now().toString(36),name:name,slot:draft.slot,items:draft.items});
    }
    saveMeals();closeBuilder();renderMeals();renderFavs();toast('"'+name+'" saved');
  });

  /* ================= PLAN (data-driven from plan.js) =================
     Every macro shown here is recomputed live from the food DB — the plan
     document's own claimed numbers are never rendered. Estimated (unlinked)
     items are marked "est". */
  let planRendered=false;
  const PLAN=window.MEAL_PLAN||null;

  function planItemMacros(it){
    if(it.est) return it.est;
    const f=findFood(it.food);
    if(!f){warn("plan item not in food DB: "+it.food);return null;}
    return macrosFor(f,it.amt);          // plan amounts are grams/ml
  }
  function planSum(items){
    const t={p:0,f:0,c:0,k:0,fib:0,est:false};
    (items||[]).forEach(it=>{
      const m=planItemMacros(it); if(!m)return;
      t.p+=m.p;t.f+=m.f;t.c+=m.c;t.k+=m.k;t.fib+=m.fib;
      if(it.est)t.est=true;
    });
    return t;
  }
  function planItemLabel(it){
    if(!it.food) return it.name+(it.note?" ("+it.note+")":"");
    const f=findFood(it.food);
    let s=fmtAmt(it.amt)+" "+(f?f.unit:"g")+" "+it.food;
    if(it.note)s+=" ("+it.note+")";
    return s;
  }
  function macLine(t,withFib){
    return '<b>'+nice(round(t.p))+'g P</b> · '+Math.round(t.k)+' kcal · F '+nice(round(t.f))+
      ' · C '+Math.round(t.c)+(withFib!==false?' · Fib '+nice(round(t.fib)):'')+
      (t.est?' <span class="est">est</span>':'');
  }
  function esc(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
  function optionCard(o){
    const t=planSum(o.items);
    let h='<div class="popt"><div class="poh"><span class="potag">'+esc(o.tag)+'</span>'+
      '<span class="ponm">'+esc(o.name)+'</span></div>'+
      (o.hint?'<div class="pohint">'+esc(o.hint)+'</div>':'')+
      '<div class="pomac">'+macLine(t)+'</div><ul class="poing">';
    o.items.forEach(it=>{h+='<li'+(it.unlinked?' class="unlinked"':'')+'>'+esc(planItemLabel(it))+(it.unlinked?' <span class="est">est</span>':'')+'</li>';});
    (o.extras||[]).forEach(x=>{h+='<li class="extra">'+esc(x)+'</li>';});
    h+='</ul><div class="pomethod">'+esc(o.method)+'</div></div>';
    return h;
  }
  function slotTotals(slotName,optIdx){
    if(slotName==="pregym") return planSum(PLAN.pregym.items);
    const s=PLAN.slots.find(x=>x.slot===slotName);
    return s?planSum(s.options[optIdx||0].items):{p:0,f:0,c:0,k:0,fib:0};
  }
  function accSection(title,html,open){
    return '<details class="acc"'+(open?' open':'')+'><summary><span class="ttl">'+esc(title)+'</span>'+
      '<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></summary>'+
      '<div class="accbody">'+html+'</div></details>';
  }
  function renderPlan(){
    if(planRendered)return;
    const ov=$("planOverview"),body=$("planBody");
    if(!ov||!body)return;
    if(!PLAN){body.innerHTML='<div class="empty">Plan data failed to load — fully close and reopen the app.</div>';return;}
    // overview: live targets only — they come from the weekly coaching review
    ov.innerHTML=
      '<div class="planhero"><h2>Your plan</h2>'+
      '<div class="plangrid">'+
        '<div><div class="pk">Protein</div><div class="pv hero">'+targets.p+' g</div></div>'+
        '<div><div class="pk">Calories</div><div class="pv">'+targets.k+'</div></div>'+
        '<div><div class="pk">Fat</div><div class="pv">'+targets.f+' g</div></div>'+
        '<div><div class="pk">Carbs</div><div class="pv">'+targets.c+' g</div></div>'+
        '<div><div class="pk">Fibre</div><div class="pv">'+targets.fib+' g</div></div>'+
        '<div><div class="pk">Pace goal</div><div class="pv">0.3–0.5</div></div>'+
      '</div>'+
      '<p class="pnote">Targets come from the weekly coaching review — update them in Settings after each check-in. Pace goal is kg lost per week (7-day average).</p>'+
      '<div class="nn"><b>Non-negotiables:</b> hit protein (within ~'+PLAN.nonNegotiables.proteinBand+
      ' g of your '+targets.p+' g target) and calories every day. '+esc(PLAN.nonNegotiables.flex)+' '+
      esc(PLAN.nonNegotiables.safetyNet)+'</div></div>';

    const doc=document.createElement("div");doc.className="pdoc";
    let html="";

    // the daily shape
    const pre=planSum(PLAN.pregym.items);
    let shapeHtml='<div class="tablewrap"><table class="tight"><thead><tr><th>Time</th><th>Slot</th></tr></thead><tbody>'+
      '<tr><td>'+esc(PLAN.pregym.time)+'</td><td><b>'+esc(PLAN.pregym.label)+'</b> (fixed) — '+
      esc(PLAN.pregym.items.map(planItemLabel).join(" + "))+' + black coffee → '+macLine(pre,false)+'</td></tr>';
    PLAN.slots.forEach(s=>{
      shapeHtml+='<tr><td>'+esc(s.time)+'</td><td><b>'+esc(s.slot)+'</b>'+(s.optional?' <i>(optional)</i>':'')+
        ' — '+esc(s.role)+'</td></tr>';
    });
    shapeHtml+='</tbody></table></div><p>'+esc(PLAN.breakfastNote)+'</p>';
    html+=accSection("The daily shape",shapeHtml,true);

    // each meal slot with A/B options
    PLAN.slots.forEach(s=>{
      let inner='<div class="porole">'+esc(s.role)+'</div>';
      s.options.forEach(o=>{inner+=optionCard(o);});
      html+=accSection(s.slot+(s.optional?" (optional)":""),inner,false);
    });

    // day shapes with computed totals
    let shapes='';
    const base=PLAN.shapes.find(x=>x.base);
    const baseRows=base.sequence.map(sl=>{
      const t=slotTotals(sl,0);
      const label= sl==="pregym" ? PLAN.pregym.label : sl+" A";
      return {label,t};
    });
    const baseTotal=baseRows.reduce((a,r)=>{a.p+=r.t.p;a.f+=r.t.f;a.c+=r.t.c;a.k+=r.t.k;a.fib+=r.t.fib;return a;},{p:0,f:0,c:0,k:0,fib:0});
    shapes+='<h3>'+esc(base.name)+' — the base plan</h3><div class="tablewrap"><table class="tight"><thead><tr><th></th><th>kcal</th><th>P</th><th>F</th><th>C</th><th>Fib</th></tr></thead><tbody>';
    baseRows.forEach(r=>{
      shapes+='<tr><td>'+esc(r.label)+'</td><td>'+Math.round(r.t.k)+'</td><td>'+nice(round(r.t.p))+'</td><td>'+nice(round(r.t.f))+'</td><td>'+Math.round(r.t.c)+'</td><td>'+nice(round(r.t.fib))+'</td></tr>';
    });
    shapes+='<tr class="tot"><td><b>Total</b></td><td><b>'+Math.round(baseTotal.k)+'</b></td><td><b>'+nice(round(baseTotal.p))+'</b></td><td><b>'+nice(round(baseTotal.f))+'</b></td><td><b>'+Math.round(baseTotal.c)+'</b></td><td><b>'+nice(round(baseTotal.fib))+'</b></td></tr>'+
      '</tbody></table></div><p class="pnote">All-A day, computed from your food DB. Rotate any meal to its B option — the roles match; Dinner B runs ~26 g protein higher for days breakfast or lunch ran low.</p>';
    PLAN.shapes.filter(x=>!x.base).forEach(sh=>{
      shapes+='<h3>'+esc(sh.name)+'</h3><p>'+esc(sh.adjustment?sh.adjustment.text:sh.text)+'</p>';
      if(sh.adjustment){
        const at=planSum(sh.adjustment.items);
        shapes+='<p class="pnote">The add-back: '+esc(sh.adjustment.items.map(planItemLabel).join(" + "))+' → '+macLine(at,false)+'</p>';
      }
    });
    html+=accSection("Three ways to run a day",shapes,false);

    // no-cook fallback
    const nc=PLAN.nocook;
    let ncHtml='<p>'+esc(nc.text)+'</p>';
    const ncTotal={p:0,f:0,c:0,k:0,fib:0,est:false};
    nc.meals.forEach(m=>{
      const t=planSum(m.items);
      ncTotal.p+=t.p;ncTotal.f+=t.f;ncTotal.c+=t.c;ncTotal.k+=t.k;ncTotal.fib+=t.fib;if(t.est)ncTotal.est=true;
      ncHtml+='<div class="popt"><div class="poh"><span class="potag">'+esc(m.slot)+'</span><span class="ponm">'+esc(m.name)+'</span></div>'+
        '<div class="pomac">'+macLine(t)+'</div><ul class="poing">'+
        m.items.map(it=>'<li'+(it.unlinked?' class="unlinked"':'')+'>'+esc(planItemLabel(it))+(it.unlinked?' <span class="est">est</span>':'')+'</li>').join("")+
        '</ul></div>';
    });
    ncHtml+='<div class="pomac" style="margin-top:10px">Day total: '+macLine(ncTotal)+'</div>'+
      '<p class="pnote">'+esc(nc.safety)+' '+esc(nc.prep)+'</p>';
    html+=accSection(nc.name,ncHtml,false);

    // quick swaps
    let sw='';
    PLAN.swaps.forEach(g=>{sw+='<h3>'+esc(g.group)+'</h3><p>'+esc(g.options.join(" · "))+'</p>';});
    html+=accSection("Quick swaps (macros stay ~same)",sw,false);

    doc.innerHTML=html;
    body.innerHTML="";body.appendChild(doc);
    planRendered=true;
  }

  /* ---------- init ---------- */
  try{
    applyTheme(lsGet("pt:theme","auto"));
  }catch(e){ warn("theme init failed: "+e.message); }

  try{
    targets=Object.assign({},DEFAULT_TARGETS,lsGet("pt:targets",{}));
    const rawCustom=lsGet("pt:customfoods",[]);
    customFoods=rawCustom.map(migrateCustom);
    if(JSON.stringify(customFoods)!==JSON.stringify(rawCustom)) saveCustom();  // persist v1→v2 migration once
    loadMeals();
    weights=lsGet("pt:weights",[]);
    waist=lsGet("pt:waist",[]);
    targetlog=lsGet("pt:targetlog",[]);
    taps=lsGet("pt:taps",{});
    entries=loadDay(dateKey);
    rebuildFoods();
    const dEl=$("date"); if(dEl) dEl.textContent=prettyDate();
    renderChips("");renderFavs();render();renderWeight();renderWaist();renderWeek();renderNudge();
    initDurability();
  }catch(e){
    warn("init failed: "+e.message);
    const fl=$("foodlist");
    if(fl) fl.innerHTML='<div class="empty">Something went wrong loading the app ('+e.message+
      '). If you just updated it, fully close and reopen to clear the old cache.</div>';
  }

  if("serviceWorker" in navigator){
    window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
  }
})();
