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
  const CIRC=2*Math.PI*88;
  const MEALS=["Breakfast","Lunch","Snack","Dinner"];

  /* per = macros per ONE unit (g / ml / egg / white / slice / katori / piece / roti / idli / dosa / tsp) */
  const BASE_FOODS=[
    // Protein & dairy
    {n:"TruNativ Raw Concentrate",cat:"Protein & dairy",unit:"g",def:35,step:5,hint:"1 scoop = 35 g · label: 28.1g P, 0.5g F, 2.7g C, 128 kcal",per:{p:0.8029,f:0.0143,c:0.0771,k:3.657,fib:0.0}},
    {n:"TruNativ Pro Blend",cat:"Protein & dairy",unit:"g",def:36,step:6,hint:"1 scoop = 36 g · 26 g protein",per:{p:0.733,f:0.0594,c:0.110,k:3.908,fib:0.0}},
    {n:"Chicken breast (cooked)",cat:"Protein & dairy",unit:"g",def:150,step:25,per:{p:0.30,f:0.036,c:0,k:1.65,fib:0.0}},
    {n:"Fish – rohu/surmai (cooked)",cat:"Protein & dairy",unit:"g",def:150,step:25,per:{p:0.22,f:0.05,c:0,k:1.35,fib:0.0}},
    {n:"Tuna (drained)",cat:"Protein & dairy",unit:"g",def:100,step:20,hint:"1 tin ≈ 100 g",per:{p:0.25,f:0.008,c:0,k:1.16,fib:0.0}},
    {n:"Prawns (cooked)",cat:"Protein & dairy",unit:"g",def:100,step:25,per:{p:0.24,f:0.003,c:0.002,k:0.99,fib:0.0}},
    {n:"Whole egg",cat:"Protein & dairy",unit:"egg",def:2,step:1,per:{p:6,f:5,c:0.5,k:72,fib:0.0}},
    {n:"Egg white",cat:"Protein & dairy",unit:"white",def:3,step:1,per:{p:3.6,f:0.06,c:0.2,k:17,fib:0.0}},
    {n:"Paneer",cat:"Protein & dairy",unit:"g",def:100,step:20,per:{p:0.18,f:0.20,c:0.04,k:2.65,fib:0.0}},
    {n:"Tofu",cat:"Protein & dairy",unit:"g",def:100,step:25,per:{p:0.08,f:0.048,c:0.019,k:0.76,fib:0.009}},
    {n:"Soya chunks (dry)",cat:"Protein & dairy",unit:"g",def:50,step:10,per:{p:0.52,f:0.005,c:0.33,k:3.45,fib:0.13}},
    {n:"Moong sprouts (boiled)",cat:"Protein & dairy",unit:"g",def:100,step:25,hint:"no-cook: steam/soak",per:{p:0.075,f:0.005,c:0.17,k:1.00,fib:0.02}},
    {n:"Greek yogurt / hung curd",cat:"Protein & dairy",unit:"g",def:150,step:25,per:{p:0.10,f:0.027,c:0.04,k:0.87,fib:0.0}},
    {n:"Curd (regular)",cat:"Protein & dairy",unit:"g",def:150,step:25,per:{p:0.053,f:0.03,c:0.048,k:0.60,fib:0.0}},
    {n:"Buttermilk / chaas",cat:"Protein & dairy",unit:"ml",def:200,step:50,hint:"no-cook",per:{p:0.01,f:0.005,c:0.025,k:0.20,fib:0.0}},
    {n:"Cheese slice",cat:"Protein & dairy",unit:"slice",def:1,step:1,per:{p:3.5,f:4.5,c:1,k:60,fib:0.0}},
    {n:"Milk – Nandini toned",cat:"Protein & dairy",unit:"ml",def:200,step:50,hint:"per 100 ml: 3.1 g protein",per:{p:0.031,f:0.030,c:0.048,k:0.58,fib:0.0}},
    // Grains & carbs
    {n:"Alpino High-Protein Oats (Choco)",cat:"Grains & carbs",unit:"g",def:50,step:10,hint:"27 g protein / 100 g",per:{p:0.27,f:0.095,c:0.47,k:3.80,fib:0.09}},
    {n:"Rolled oats (plain)",cat:"Grains & carbs",unit:"g",def:50,step:10,per:{p:0.13,f:0.07,c:0.66,k:3.80,fib:0.1}},
    {n:"Muesli",cat:"Grains & carbs",unit:"g",def:40,step:10,hint:"no-cook: add milk/curd",per:{p:0.10,f:0.075,c:0.67,k:3.75,fib:0.07}},
    {n:"Rice (cooked)",cat:"Grains & carbs",unit:"g",def:150,step:25,per:{p:0.027,f:0.003,c:0.28,k:1.30,fib:0.004}},
    {n:"Sweet potato / shakarkandi",cat:"Grains & carbs",unit:"g",def:150,step:25,per:{p:0.016,f:0.001,c:0.20,k:0.86,fib:0.03}},
    {n:"Chapati / roti",cat:"Grains & carbs",unit:"roti",def:2,step:1,per:{p:3,f:3,c:20,k:120,fib:2.0}},
    {n:"Idli",cat:"Grains & carbs",unit:"idli",def:3,step:1,hint:"steam only",per:{p:1.6,f:0.2,c:8,k:40,fib:0.6}},
    {n:"Dosa (plain)",cat:"Grains & carbs",unit:"dosa",def:1,step:1,per:{p:3,f:4,c:20,k:130,fib:1.2}},
    {n:"Poha (cooked)",cat:"Grains & carbs",unit:"katori",def:1,step:0.5,hint:"quick cook",per:{p:3,f:5,c:34,k:200,fib:1.5}},
    {n:"Brown bread",cat:"Grains & carbs",unit:"slice",def:2,step:1,per:{p:4,f:1,c:14,k:80,fib:1.5}},
    {n:"Roasted chana",cat:"Grains & carbs",unit:"g",def:30,step:10,per:{p:0.20,f:0.055,c:0.53,k:3.65,fib:0.15}},
    {n:"Dal / rajma (cooked)",cat:"Grains & carbs",unit:"katori",def:1,step:0.5,hint:"1 katori ≈ 150 g",per:{p:7,f:3,c:18,k:120,fib:5.0}},
    // Vegetables
    {n:"Spinach / palak (cooked)",cat:"Vegetables",unit:"g",def:100,step:25,per:{p:0.029,f:0.004,c:0.036,k:0.23,fib:0.024}},
    {n:"Broccoli (cooked)",cat:"Vegetables",unit:"g",def:100,step:25,per:{p:0.028,f:0.004,c:0.07,k:0.35,fib:0.033}},
    {n:"Mixed veg sabzi (1 tsp oil)",cat:"Vegetables",unit:"katori",def:1,step:0.5,per:{p:2,f:4,c:8,k:75,fib:3.0}},
    {n:"Sambar",cat:"Vegetables",unit:"katori",def:1,step:0.5,per:{p:4,f:2.5,c:12,k:90,fib:3.0}},
    {n:"Kosambari (moong salad)",cat:"Vegetables",unit:"katori",def:1,step:0.5,hint:"no-cook",per:{p:5,f:2,c:12,k:90,fib:4.0}},
    {n:"Green salad (dressed)",cat:"Vegetables",unit:"katori",def:1,step:0.5,per:{p:1,f:0.2,c:4,k:20,fib:1.5}},
    // Fruit
    {n:"Banana – Robusta/Cavendish",cat:"Fruit",unit:"piece",def:1,step:1,hint:"~120g edible, the common everyday banana",per:{p:1.32,f:0.36,c:27.36,k:106.8,fib:3.12}},
    {n:"Banana – Nendran",cat:"Fruit",unit:"piece",def:1,step:1,hint:"~160g edible, larger Kerala/coastal variety",per:{p:1.76,f:0.48,c:36.48,k:142.4,fib:4.16}},
    {n:"Banana – Yelakki (Elaichi)",cat:"Fruit",unit:"piece",def:2,step:1,hint:"~40g edible each, small — figures below are for 2",per:{p:0.44,f:0.12,c:9.12,k:35.6,fib:1.04}},
    {n:"Apple",cat:"Fruit",unit:"piece",def:1,step:1,per:{p:0.5,f:0.3,c:25,k:95,fib:4.4}},
    {n:"Guava",cat:"Fruit",unit:"piece",def:1,step:1,per:{p:2.6,f:1,c:14,k:68,fib:5.4}},
    {n:"Papaya (cubes)",cat:"Fruit",unit:"katori",def:1,step:0.5,per:{p:0.7,f:0.4,c:15,k:60,fib:2.5}},
    {n:"Orange",cat:"Fruit",unit:"piece",def:1,step:1,per:{p:1.2,f:0.2,c:15,k:62,fib:3.1}},
    {n:"Dates",cat:"Fruit",unit:"piece",def:2,step:1,per:{p:0.2,f:0,c:5.3,k:20,fib:0.8}},
    {n:"Coconut water",cat:"Fruit",unit:"ml",def:200,step:50,hint:"no-cook",per:{p:0.007,f:0,c:0.045,k:0.19,fib:0.0}},
    // Nuts & fats
    {n:"Almonds",cat:"Nuts & fats",unit:"g",def:10,step:5,per:{p:0.21,f:0.49,c:0.22,k:5.80,fib:0.125}},
    {n:"Walnuts",cat:"Nuts & fats",unit:"g",def:10,step:5,per:{p:0.15,f:0.65,c:0.14,k:6.54,fib:0.067}},
    {n:"Peanuts (roasted)",cat:"Nuts & fats",unit:"g",def:20,step:5,per:{p:0.26,f:0.49,c:0.16,k:5.67,fib:0.085}},
    {n:"Cashews",cat:"Nuts & fats",unit:"g",def:15,step:5,per:{p:0.18,f:0.44,c:0.30,k:5.53,fib:0.033}},
    {n:"Chia seeds",cat:"Nuts & fats",unit:"g",def:12,step:3,per:{p:0.17,f:0.31,c:0.42,k:4.86,fib:0.34}},
    {n:"Flax seeds",cat:"Nuts & fats",unit:"g",def:10,step:5,per:{p:0.18,f:0.42,c:0.29,k:5.34,fib:0.27}},
    {n:"Peanut butter",cat:"Nuts & fats",unit:"g",def:15,step:5,per:{p:0.25,f:0.50,c:0.20,k:5.90,fib:0.06}},
    {n:"Coconut (fresh grated)",cat:"Nuts & fats",unit:"g",def:20,step:10,per:{p:0.03,f:0.33,c:0.15,k:3.54,fib:0.09}},
    {n:"Ghee / oil",cat:"Nuts & fats",unit:"tsp",def:1,step:1,per:{p:0,f:5,c:0,k:45,fib:0.0}}
  ];
  const BASE_CATS=["My foods","Protein & dairy","Grains & carbs","Vegetables","Fruit","Nuts & fats"];

  const $=id=>document.getElementById(id);
  /* Safe wiring: a missing element must never take down the rest of the app
     (e.g. a stale index.html paired with a fresh app.js after a partial deploy). */
  function bind(id,ev,fn){const el=$(id); if(el) el.addEventListener(ev,fn); return el;}
  function warn(msg){ try{console.warn("[tracker] "+msg);}catch(e){} }
  const prog=$("prog"); prog.style.strokeDasharray=CIRC;

  let entries=[], customFoods=[], FOODS=[], targets={}, weights=[], waist=[], taps={};
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
  function render(){
    const t=totals(), p=round(t.p);
    $("pnum").textContent=nice(p);
    $("ptarget").textContent="/ "+targets.p+" g";
    prog.style.strokeDashoffset=CIRC*(1-Math.min(p/targets.p,1));
    const rem=round(targets.p-p);
    $("remain").innerHTML = rem>0 ? "<b>"+nice(rem)+" g</b> to go" : "<b>+"+nice(-rem)+" g</b> over target";
    $("hero").classList.toggle("hit",p>=targets.p);
    $("miniP").innerHTML="<b>"+nice(p)+"</b>/"+targets.p+" g";
    $("cal").textContent=Math.round(t.k);
    $("calof").textContent="/ "+targets.k+" kcal";
    $("calbar").style.width=(Math.min(t.k/targets.k,1)*100)+"%";
    $("calbox").classList.toggle("over",t.k>targets.k+40);
    $("fat").innerHTML=nice(round(t.f))+'<span class="of">/'+targets.f+'g</span>';
    $("carb").innerHTML=Math.round(t.c)+'<span class="of">/'+targets.c+'g</span>';
    const fibEl=$("fib");
    if(fibEl){
      fibEl.innerHTML=nice(round(t.fib))+'<span class="of">/'+targets.fib+'g</span>';
      const fbox=$("fibbox"); if(fbox) fbox.classList.toggle("met", t.fib>=targets.fib);
    }
    $("footTargets").textContent="Targets: "+targets.p+" g protein · "+targets.k+" kcal · fat "+targets.f+" g · carbs "+targets.c+" g · fibre "+targets.fib+" g";
    renderRecommender(t);
    renderLog();
  }

  /* ---------- recommender ---------- */
  function renderRecommender(t){
    const box=$("rec");
    const remP=round(targets.p-t.p), remK=Math.round(targets.k-t.k);
    if(remP<=2){
      box.classList.add("done");
      const msg = remK>150 ? ("Protein done — about <b>"+remK+" kcal</b> of room left if you're hungry.")
              : remK<-40 ? ("Protein done. You're <b>"+Math.abs(remK)+" kcal</b> over — ease off for the rest of the day.")
              : "Protein done and calories on target. You're set.";
      box.innerHTML='<div class="rh"><h3>Close the gap</h3></div><div class="celebrate">✓ '+targets.p+' g protein reached</div><div class="sub" style="margin-top:6px">'+msg+'</div>';
      return;
    }
    box.classList.remove("done");
    const scored=FOODS.filter(f=>f.per.p>0 && (f.per.p/f.per.k)>=0.09)
      .map(f=>{
        const need=remP/f.per.p;
        const amt=Math.min(need,f.def*1.5);           // realistic single portion
        const rAmt=Math.max(f.step,Math.round(amt/f.step)*f.step);
        const addP=f.per.p*rAmt, addK=f.per.k*rAmt;
        return {f,amt:rAmt,addP,addK,partial:need>f.def*1.5,fits:addK<=remK+40,eff:f.per.k/f.per.p};
      })
      .filter(s=> s.addP >= Math.min(10, Math.max(4, remP*0.3)))   // must make a real dent
      .sort((a,b)=> (a.fits!==b.fits ? (a.fits?-1:1) : a.eff-b.eff));

    const pool=scored.slice(0,10);
    if(!pool.length){ box.innerHTML='<div class="rh"><h3>Close the gap</h3></div><div class="sub">'+nice(remP)+' g protein left. Nothing in your list fits the remaining calories — a lean protein (whey, egg whites, tuna) is your best bet.</div>'; return; }
    const seed=(new Date().getDate()+entries.length)%pool.length;
    const rot=pool.slice(seed).concat(pool.slice(0,seed));
    const cands=[], cats=new Set();
    for(const s of rot){ if(cands.length>=3)break; if(cats.has(s.f.cat))continue; cats.add(s.f.cat); cands.push(s); }
    for(const s of rot){ if(cands.length>=3)break; if(!cands.includes(s))cands.push(s); }
    cands.sort((a,b)=> (a.fits!==b.fits ? (a.fits?-1:1) : a.eff-b.eff));

    let html='<div class="rh"><h3>Close the gap</h3></div>'+
      '<div class="sub">You have <b>'+nice(remP)+' g protein</b> and <b>'+remK+' kcal</b> left today. Quickest ways to close it:</div><div class="opts">';
    cands.forEach((s,i)=>{
      const over = !s.fits ? ' <span class="over">(+'+Math.round(s.addK-remK)+' over kcal)</span>' : '';
      const partial = s.partial ? ' · gets you part-way' : '';
      html+='<div class="opt"><div class="oi"><div class="on"></div>'+
        '<div class="oq"><b>+'+nice(round(s.addP))+'g P</b> · '+Math.round(s.addK)+' kcal'+over+partial+'</div></div>'+
        '<button class="oadd" data-i="'+i+'">'+fmtAmt(s.amt)+' '+s.f.unit+'</button></div>';
    });
    box.innerHTML=html+'</div>';
    box.querySelectorAll(".oadd").forEach(btn=>{
      const s=cands[+btn.dataset.i];
      btn.parentElement.querySelector(".on").textContent=s.f.n;
      btn.onclick=()=>openSheet(s.f,s.amt);
    });
  }

  /* ---------- today's log, grouped by meal ---------- */
  function entryRow(e,removable){
    const row=document.createElement("div");row.className="row";
    const q=e.amt!=null?(fmtAmt(e.amt)+" "+e.unit):(e.note||"");
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
        b.innerHTML='<div class="fn"></div><div class="fm">'+nice(f.per.p*f.def)+'g P · '+fmtAmt(f.def)+f.unit+'</div>';
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
        const b=document.createElement("button");b.className="chip"+(f.mine?" mine":"");b.type="button";
        b.innerHTML='<div class="nm"></div><div class="mac"><b>'+nice(f.per.p*f.def)+'g P</b> · '+
          Math.round(f.per.k*f.def)+' kcal / '+fmtAmt(f.def)+f.unit+'</div>';
        b.querySelector(".nm").textContent=f.n;
        b.onclick=()=>openSheet(f);
        grid.appendChild(b);
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
  function openSheet(f,amt,mode){
    sheetFood=f; sheetMode=mode||"log";
    $("sTitle").textContent=f.n;
    $("sHint").textContent=f.hint||"";
    $("sUnit").textContent=f.unit;
    $("sAmt").value=fmtAmt(amt!=null?amt:f.def);
    $("delFood").style.display=(f.mine&&sheetMode==="log")?"block":"none";
    const segEl=$("sSeg"); if(segEl) segEl.style.display = sheetMode==="meal" ? "none" : "grid";
    $("sAdd").textContent = sheetMode==="meal" ? "Add to meal" : "Add to today";
    // when picking a food for a meal, stack above the builder sheet
    $("sheet").classList.toggle("stacked", sheetMode==="meal");
    $("sheetBack").classList.toggle("stacked", sheetMode==="meal");
    setSeg(guessMeal());
    updateSheetMacros();
    showSheet("sheet","sheetBack");
  }
  function closeSheet(){hideSheet("sheet","sheetBack");sheetFood=null;}
  function updateSheetMacros(){
    if(!sheetFood)return;
    const a=parseFloat($("sAmt").value)||0, per=sheetFood.per;
    $("sMacros").innerHTML='<span class="pm">'+nice(per.p*a)+'g P</span><span>'+Math.round(per.k*a)+
      ' kcal</span><span>F '+nice(per.f*a)+'</span><span>C '+nice(per.c*a)+'</span>'+
      ((per.fib||0)>0?'<span>Fib '+nice(per.fib*a)+'</span>':'');
  }
  function stepSheet(dir){
    if(!sheetFood)return;
    let a=parseFloat($("sAmt").value)||0;
    a=Math.max(0,Math.round((a+dir*sheetFood.step)*100)/100);
    $("sAmt").value=fmtAmt(a);updateSheetMacros();
  }
  $("sMinus").onclick=()=>stepSheet(-1);
  $("sPlus").onclick=()=>stepSheet(1);
  $("sAmt").oninput=updateSheetMacros;
  $("sAmt").onfocus=function(){this.select();};
  $("sCancel").onclick=closeSheet;
  $("sheetBack").onclick=closeSheet;
  $("sSeg").querySelectorAll("button").forEach(b=>b.onclick=()=>setSeg(b.dataset.m));
  $("sAdd").onclick=()=>{
    if(!sheetFood)return;
    const a=parseFloat($("sAmt").value)||0;
    if(a<=0){toast("Set an amount above 0");return;}
    const per=sheetFood.per, fname=sheetFood.n, funit=sheetFood.unit;
    if(sheetMode==="meal"){
      if(!draft){closeSheet();return;}
      draft.items.push({n:fname,amt:a,unit:funit,
        p:per.p*a,f:per.f*a,c:per.c*a,k:per.k*a,fib:(per.fib||0)*a});
      renderDraft();closeSheet();   // note: closeSheet() nulls sheetFood, so read it before here
      const se=$("mbSearch"); if(se){se.value="";renderPicker("");}
      toast(fname+" added to the meal");
      return;
    }
    addEntry({n:sheetFood.n,amt:a,unit:sheetFood.unit,meal:sheetMeal,p:per.p*a,f:per.f*a,c:per.c*a,k:per.k*a,fib:(per.fib||0)*a});
    taps[sheetFood.n]=(taps[sheetFood.n]||0)+1; saveTaps(); renderFavs();
    toast("+"+nice(round(per.p*a))+" g protein · "+sheetMeal);
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
    customFoods.push({n:name,cat:"My foods",unit:unit,def:amt,step:(amt>=20?5:(amt>=5?1:0.5)),
      per:{p:p/amt,f:f/amt,c:c/amt,k:k/amt,fib:fib/amt}});
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

  /* ---------- settings ---------- */
  function openSettings(){
    $("tP").value=targets.p;$("tK").value=targets.k;$("tF").value=targets.f;$("tC").value=targets.c;
    const tf=$("tFib"); if(tf) tf.value=targets.fib;
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
  $("setSave").onclick=()=>{
    const p=parseFloat($("tP").value),k=parseFloat($("tK").value),f=parseFloat($("tF").value),c=parseFloat($("tC").value);
    if(!(p>0&&k>0)){toast("Protein and calories must be above 0");return;}
    if(p>400||k>8000){toast("That looks out of range — check the numbers");return;}
    const fibv=parseFloat(($("tFib")||{}).value);
    targets={p:Math.round(p),k:Math.round(k),f:Math.round(f)||0,c:Math.round(c)||0,
             fib:Math.round(fibv)||DEFAULT_TARGETS.fib};
    saveTargets();planRendered=false;render();renderWeek();closeSettings();toast("Targets updated");
  };

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
            targets,customFoods,meals,weights,waist,taps,logs};
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
  function ingLine(m){return (m.items||[]).map(i=>i.n+" "+fmtAmt(i.amt)+i.unit).join(" · ");}

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
        r.innerHTML='<span class="mbn"></span><span class="mba">'+fmtAmt(it.amt)+' '+it.unit+' · '+nice(round(it.p))+'g P</span>'+
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
      const b=document.createElement("button");b.className="chip";b.type="button";
      b.innerHTML='<div class="nm"></div><div class="mac"><b>'+nice(f.per.p*f.def)+'g P</b> / '+fmtAmt(f.def)+f.unit+'</div>';
      b.querySelector(".nm").textContent=f.n;
      b.onclick=()=>openSheet(f,null,"meal");
      wrap.appendChild(b);
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
    return {p:f.per.p*it.amt,f:f.per.f*it.amt,c:f.per.c*it.amt,k:f.per.k*it.amt,fib:(f.per.fib||0)*it.amt};
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
    if(!it.food) return it.name;
    const f=findFood(it.food);
    const unit=f?f.unit:"";
    let s;
    if(unit==="g"||unit==="ml") s=fmtAmt(it.amt)+" "+unit+" "+it.food;
    else if(unit==="katori"||unit==="tsp") s=it.food+" — "+fmtAmt(it.amt)+" "+unit;
    else s=it.food+" × "+fmtAmt(it.amt);
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
    customFoods=lsGet("pt:customfoods",[]);
    loadMeals();
    weights=lsGet("pt:weights",[]);
    waist=lsGet("pt:waist",[]);
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
