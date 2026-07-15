/* Protein Tracker PWA — logic (v2)
   Storage (localStorage, per-device, offline):
     pt:log:<YYYY-MM-DD>  entries for that day
     pt:customfoods       permanently saved foods
     pt:targets           {p,k,f,c}
     pt:weights           [{d:'YYYY-MM-DD', kg:Number}]
     pt:taps              {foodName: tapCount}   -> drives favourites
*/
(function(){
  "use strict";
  const DEFAULT_TARGETS={p:160,k:1975,f:58,c:200};
  const CIRC=2*Math.PI*88;
  const MEALS=["Breakfast","Lunch","Snack","Dinner"];

  /* per = macros per ONE unit (g / ml / egg / white / slice / katori / piece / roti / idli / dosa / tsp) */
  const BASE_FOODS=[
    // Protein & dairy
    {n:"TruNativ Raw Concentrate",cat:"Protein & dairy",unit:"g",def:35,step:5,hint:"1 scoop = 35 g · label: 28.1g P, 0.5g F, 2.7g C, 128 kcal",per:{p:0.8029,f:0.0143,c:0.0771,k:3.657}},
    {n:"TruNativ Pro Blend",cat:"Protein & dairy",unit:"g",def:36,step:6,hint:"1 scoop = 36 g · 26 g protein",per:{p:0.733,f:0.0594,c:0.110,k:3.908}},
    {n:"Chicken breast (cooked)",cat:"Protein & dairy",unit:"g",def:150,step:25,per:{p:0.30,f:0.036,c:0,k:1.65}},
    {n:"Fish – rohu/surmai (cooked)",cat:"Protein & dairy",unit:"g",def:150,step:25,per:{p:0.22,f:0.05,c:0,k:1.35}},
    {n:"Tuna (drained)",cat:"Protein & dairy",unit:"g",def:100,step:20,hint:"1 tin ≈ 100 g",per:{p:0.25,f:0.008,c:0,k:1.16}},
    {n:"Prawns (cooked)",cat:"Protein & dairy",unit:"g",def:100,step:25,per:{p:0.24,f:0.003,c:0.002,k:0.99}},
    {n:"Whole egg",cat:"Protein & dairy",unit:"egg",def:2,step:1,per:{p:6,f:5,c:0.5,k:72}},
    {n:"Egg white",cat:"Protein & dairy",unit:"white",def:3,step:1,per:{p:3.6,f:0.06,c:0.2,k:17}},
    {n:"Paneer",cat:"Protein & dairy",unit:"g",def:100,step:20,per:{p:0.18,f:0.20,c:0.04,k:2.65}},
    {n:"Tofu",cat:"Protein & dairy",unit:"g",def:100,step:25,per:{p:0.08,f:0.048,c:0.019,k:0.76}},
    {n:"Soya chunks (dry)",cat:"Protein & dairy",unit:"g",def:50,step:10,per:{p:0.52,f:0.005,c:0.33,k:3.45}},
    {n:"Moong sprouts (boiled)",cat:"Protein & dairy",unit:"g",def:100,step:25,hint:"no-cook: steam/soak",per:{p:0.075,f:0.005,c:0.17,k:1.00}},
    {n:"Greek yogurt / hung curd",cat:"Protein & dairy",unit:"g",def:150,step:25,per:{p:0.10,f:0.027,c:0.04,k:0.87}},
    {n:"Curd (regular)",cat:"Protein & dairy",unit:"g",def:150,step:25,per:{p:0.053,f:0.03,c:0.048,k:0.60}},
    {n:"Buttermilk / chaas",cat:"Protein & dairy",unit:"ml",def:200,step:50,hint:"no-cook",per:{p:0.01,f:0.005,c:0.025,k:0.20}},
    {n:"Cheese slice",cat:"Protein & dairy",unit:"slice",def:1,step:1,per:{p:3.5,f:4.5,c:1,k:60}},
    {n:"Milk – Nandini toned",cat:"Protein & dairy",unit:"ml",def:200,step:50,hint:"per 100 ml: 3.1 g protein",per:{p:0.031,f:0.030,c:0.048,k:0.58}},
    // Grains & carbs
    {n:"Alpino High-Protein Oats (Choco)",cat:"Grains & carbs",unit:"g",def:50,step:10,hint:"27 g protein / 100 g",per:{p:0.27,f:0.095,c:0.47,k:3.80}},
    {n:"Rolled oats (plain)",cat:"Grains & carbs",unit:"g",def:50,step:10,per:{p:0.13,f:0.07,c:0.66,k:3.80}},
    {n:"Muesli",cat:"Grains & carbs",unit:"g",def:40,step:10,hint:"no-cook: add milk/curd",per:{p:0.10,f:0.075,c:0.67,k:3.75}},
    {n:"Rice (cooked)",cat:"Grains & carbs",unit:"g",def:150,step:25,per:{p:0.027,f:0.003,c:0.28,k:1.30}},
    {n:"Sweet potato / shakarkandi",cat:"Grains & carbs",unit:"g",def:150,step:25,per:{p:0.016,f:0.001,c:0.20,k:0.86}},
    {n:"Chapati / roti",cat:"Grains & carbs",unit:"roti",def:2,step:1,per:{p:3,f:3,c:20,k:120}},
    {n:"Idli",cat:"Grains & carbs",unit:"idli",def:3,step:1,hint:"steam only",per:{p:1.6,f:0.2,c:8,k:40}},
    {n:"Dosa (plain)",cat:"Grains & carbs",unit:"dosa",def:1,step:1,per:{p:3,f:4,c:20,k:130}},
    {n:"Poha (cooked)",cat:"Grains & carbs",unit:"katori",def:1,step:0.5,hint:"quick cook",per:{p:3,f:5,c:34,k:200}},
    {n:"Brown bread",cat:"Grains & carbs",unit:"slice",def:2,step:1,per:{p:4,f:1,c:14,k:80}},
    {n:"Roasted chana",cat:"Grains & carbs",unit:"g",def:30,step:10,per:{p:0.20,f:0.055,c:0.53,k:3.65}},
    {n:"Dal / rajma (cooked)",cat:"Grains & carbs",unit:"katori",def:1,step:0.5,hint:"1 katori ≈ 150 g",per:{p:7,f:3,c:18,k:120}},
    // Vegetables
    {n:"Spinach / palak (cooked)",cat:"Vegetables",unit:"g",def:100,step:25,per:{p:0.029,f:0.004,c:0.036,k:0.23}},
    {n:"Broccoli (cooked)",cat:"Vegetables",unit:"g",def:100,step:25,per:{p:0.028,f:0.004,c:0.07,k:0.35}},
    {n:"Mixed veg sabzi (1 tsp oil)",cat:"Vegetables",unit:"katori",def:1,step:0.5,per:{p:2,f:4,c:8,k:75}},
    {n:"Sambar",cat:"Vegetables",unit:"katori",def:1,step:0.5,per:{p:4,f:2.5,c:12,k:90}},
    {n:"Kosambari (moong salad)",cat:"Vegetables",unit:"katori",def:1,step:0.5,hint:"no-cook",per:{p:5,f:2,c:12,k:90}},
    {n:"Green salad (dressed)",cat:"Vegetables",unit:"katori",def:1,step:0.5,per:{p:1,f:0.2,c:4,k:20}},
    // Fruit
    {n:"Banana",cat:"Fruit",unit:"piece",def:1,step:1,per:{p:1.3,f:0.3,c:27,k:105}},
    {n:"Apple",cat:"Fruit",unit:"piece",def:1,step:1,per:{p:0.5,f:0.3,c:25,k:95}},
    {n:"Guava",cat:"Fruit",unit:"piece",def:1,step:1,per:{p:2.6,f:1,c:14,k:68}},
    {n:"Papaya (cubes)",cat:"Fruit",unit:"katori",def:1,step:0.5,per:{p:0.7,f:0.4,c:15,k:60}},
    {n:"Orange",cat:"Fruit",unit:"piece",def:1,step:1,per:{p:1.2,f:0.2,c:15,k:62}},
    {n:"Dates",cat:"Fruit",unit:"piece",def:2,step:1,per:{p:0.2,f:0,c:5.3,k:20}},
    {n:"Coconut water",cat:"Fruit",unit:"ml",def:200,step:50,hint:"no-cook",per:{p:0.007,f:0,c:0.045,k:0.19}},
    // Nuts & fats
    {n:"Almonds",cat:"Nuts & fats",unit:"g",def:10,step:5,per:{p:0.21,f:0.49,c:0.22,k:5.80}},
    {n:"Walnuts",cat:"Nuts & fats",unit:"g",def:10,step:5,per:{p:0.15,f:0.65,c:0.14,k:6.54}},
    {n:"Peanuts (roasted)",cat:"Nuts & fats",unit:"g",def:20,step:5,per:{p:0.26,f:0.49,c:0.16,k:5.67}},
    {n:"Cashews",cat:"Nuts & fats",unit:"g",def:15,step:5,per:{p:0.18,f:0.44,c:0.30,k:5.53}},
    {n:"Chia seeds",cat:"Nuts & fats",unit:"g",def:12,step:3,per:{p:0.17,f:0.31,c:0.42,k:4.86}},
    {n:"Flax seeds",cat:"Nuts & fats",unit:"g",def:10,step:5,per:{p:0.18,f:0.42,c:0.29,k:5.34}},
    {n:"Peanut butter",cat:"Nuts & fats",unit:"g",def:15,step:5,per:{p:0.25,f:0.50,c:0.20,k:5.90}},
    {n:"Coconut (fresh grated)",cat:"Nuts & fats",unit:"g",def:20,step:10,per:{p:0.03,f:0.33,c:0.15,k:3.54}},
    {n:"Ghee / oil",cat:"Nuts & fats",unit:"tsp",def:1,step:1,per:{p:0,f:5,c:0,k:45}}
  ];
  const BASE_CATS=["My foods","Protein & dairy","Grains & carbs","Vegetables","Fruit","Nuts & fats"];

  const $=id=>document.getElementById(id);
  const prog=$("prog"); prog.style.strokeDasharray=CIRC;

  let entries=[], customFoods=[], FOODS=[], targets={}, weights=[], taps={};
  let sheetFood=null, sheetMeal=null, histDate=null;
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
  function saveTaps(){lsSet("pt:taps",taps);}
  function allLogKeys(){
    const out=[];
    for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith("pt:log:"))out.push(k);}
    return out.sort();
  }

  function rebuildFoods(){FOODS=customFoods.map(c=>Object.assign({},c,{mine:true})).concat(BASE_FOODS);}
  function findFood(n){return FOODS.find(f=>f.n===n);}
  function sumOf(list){return list.reduce((a,e)=>{a.p+=e.p||0;a.f+=e.f||0;a.c+=e.c||0;a.k+=e.k||0;return a;},{p:0,f:0,c:0,k:0});}
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
    $("count").textContent=entries.length;
    $("footTargets").textContent="Targets: "+targets.p+" g protein · "+targets.k+" kcal · fat "+targets.f+" g · carbs "+targets.c+" g";
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
    const q=e.amt!=null?(fmtAmt(e.amt)+" "+e.unit):"";
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
    const wrap=$("favs"); wrap.innerHTML="";
    const top=Object.entries(taps).sort((a,b)=>b[1]-a[1]).slice(0,5)
      .map(([n])=>findFood(n)).filter(Boolean);
    if(top.length<2){wrap.style.display="none";return;}
    wrap.style.display="flex";
    top.forEach(f=>{
      const b=document.createElement("button");b.className="fav";b.type="button";
      b.innerHTML='<div class="fn"></div><div class="fm">'+nice(f.per.p*f.def)+'g P · '+fmtAmt(f.def)+f.unit+'</div>';
      b.querySelector(".fn").textContent=f.n;
      b.onclick=()=>openSheet(f);
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
  function openSheet(f,amt){
    sheetFood=f;
    $("sTitle").textContent=f.n;
    $("sHint").textContent=f.hint||"";
    $("sUnit").textContent=f.unit;
    $("sAmt").value=fmtAmt(amt!=null?amt:f.def);
    $("delFood").style.display=f.mine?"block":"none";
    setSeg(guessMeal());
    updateSheetMacros();
    showSheet("sheet","sheetBack");
  }
  function closeSheet(){hideSheet("sheet","sheetBack");sheetFood=null;}
  function updateSheetMacros(){
    if(!sheetFood)return;
    const a=parseFloat($("sAmt").value)||0, per=sheetFood.per;
    $("sMacros").innerHTML='<span class="pm">'+nice(per.p*a)+'g P</span><span>'+Math.round(per.k*a)+
      ' kcal</span><span>F '+nice(per.f*a)+'</span><span>C '+nice(per.c*a)+'</span>';
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
    const per=sheetFood.per;
    addEntry({n:sheetFood.n,amt:a,unit:sheetFood.unit,meal:sheetMeal,p:per.p*a,f:per.f*a,c:per.c*a,k:per.k*a});
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
          f=parseFloat($("cfF").value)||0,c=parseFloat($("cfC").value)||0;
    if(!name){toast("Give the food a name");return;}
    if(amt<=0){toast("Enter the amount those macros are for");return;}
    if(!p&&!k){toast("Enter at least protein or calories");return;}
    if(FOODS.some(x=>x.n.toLowerCase()===name.toLowerCase())){toast("A food with that name exists");return;}
    customFoods.push({n:name,cat:"My foods",unit:unit,def:amt,step:(amt>=20?5:(amt>=5?1:0.5)),
      per:{p:p/amt,f:f/amt,c:c/amt,k:k/amt}});
    saveCustom();rebuildFoods();
    ["cfName","cfUnit","cfAmt","cfP","cfK","cfF","cfC"].forEach(i=>$(i).value="");
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
    let verdict;
    if(diff<=-0.7) verdict='<span class="warn">Faster than ideal</span> — that pace risks muscle. Consider adding ~150 kcal back.';
    else if(diff<=-0.25) verdict='<span class="good">On target</span> — this is the 0.3–0.5 kg/week range you want.';
    else if(diff<=-0.05) verdict='Slightly slow but moving. Give it another week before changing anything.';
    else if(diff<0.25) verdict='Flat. If this holds 2–3 weeks, add ~1,500 steps/day before cutting food.';
    else verdict='<span class="warn">Trending up.</span> Worth checking your logging is complete before adjusting.';
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
      ? '<b>'+nice(round(s.p))+'g P</b> · '+Math.round(s.k)+' kcal · F '+nice(round(s.f))+' · C '+Math.round(s.c)
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
    const days=allLogKeys().length;
    $("statLine").textContent=days+" day"+(days===1?"":"s")+" logged · "+customFoods.length+" custom food"+(customFoods.length===1?"":"s")+" · "+weights.length+" weigh-in"+(weights.length===1?"":"s");
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
    targets={p:Math.round(p),k:Math.round(k),f:Math.round(f)||0,c:Math.round(c)||0};
    saveTargets();render();renderWeek();closeSettings();toast("Targets updated");
  };

  /* ---------- export / import ---------- */
  function download(name,text,type){
    const blob=new Blob([text],{type:type});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();
    setTimeout(()=>{URL.revokeObjectURL(url);a.remove();},400);
  }
  function collectAll(){
    const logs={};
    allLogKeys().forEach(k=>{logs[k.replace("pt:log:","")]=lsGet(k,[]);});
    logs[dateKey]=entries;
    return {app:"protein-tracker",version:2,exported:new Date().toISOString(),targets,customFoods,weights,taps,logs};
  }
  $("expJson").onclick=()=>{
    download("protein-tracker-backup-"+dateKey+".json",JSON.stringify(collectAll(),null,2),"application/json");
    toast("Backup downloaded");
  };
  $("expCsv").onclick=()=>{
    const data=collectAll();
    const esc=v=>{v=String(v==null?"":v);return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;};
    const rows=[["date","meal","food","amount","unit","protein_g","fat_g","carbs_g","kcal"]];
    Object.keys(data.logs).sort().forEach(d=>{
      (data.logs[d]||[]).forEach(e=>rows.push([d,e.meal||"",e.n,e.amt==null?"":e.amt,e.unit||"",
        round(e.p||0),round(e.f||0),round(e.c||0),Math.round(e.k||0)]));
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
           (d.customFoods||[]).length+" custom foods, "+(d.weights||[]).length+" weigh-ins.\n\nThis replaces everything currently in the app.")) return;
        allLogKeys().forEach(k=>localStorage.removeItem(k));
        Object.entries(d.logs).forEach(([day,list])=>lsSet("pt:log:"+day,list));
        if(d.targets)lsSet("pt:targets",d.targets);
        if(d.customFoods)lsSet("pt:customfoods",d.customFoods);
        if(d.weights)lsSet("pt:weights",d.weights);
        if(d.taps)lsSet("pt:taps",d.taps);
        toast("Backup restored");
        setTimeout(()=>location.reload(),700);
      }catch(err){ toast("That file isn't a valid backup"); }
    };
    r.readAsText(file);
    this.value="";
  };

  /* ---------- appbar ---------- */
  window.addEventListener("scroll",()=>{$("appbar").classList.toggle("scrolled",window.scrollY>8);},{passive:true});

  /* ---------- init ---------- */
  targets=Object.assign({},DEFAULT_TARGETS,lsGet("pt:targets",{}));
  customFoods=lsGet("pt:customfoods",[]);
  weights=lsGet("pt:weights",[]);
  taps=lsGet("pt:taps",{});
  entries=loadDay(dateKey);
  rebuildFoods();
  $("date").textContent=prettyDate();
  renderChips("");renderFavs();render();renderWeight();renderWeek();

  if("serviceWorker" in navigator){
    window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
  }
})();
