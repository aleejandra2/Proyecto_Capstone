(()=>{
  const root = document.getElementById('msGame');
  if (!root) return;

  // Activa tema retro + arcade por defecto
  root.classList.add('retro','theme-arcade');

  // Fondo responsivo por capas
  const bg = document.createElement('div');
  bg.className = 'ms-bg';
  bg.innerHTML = '<div class="ms-sky"></div><div class="ms-hills-back"></div><div class="ms-hills-front"></div><div class="ms-grass"></div><div class="ms-grass-blades"></div><div class="ms-grass-shine"></div><div class="ms-dirt"></div>';
  root.insertBefore(bg, root.firstChild);
  const bgSky   = bg.querySelector('.ms-sky');
  const bgHillsBack = bg.querySelector('.ms-hills-back');
  const bgHillsFront = bg.querySelector('.ms-hills-front');
  const bgGrass = bg.querySelector('.ms-grass');
  // (tiles decorativos desactivados)
  // Sprites decorativos (nubes y rocas)
  const deco = { clouds: [], rocks: [] };
  function makeCloud(){ const c=document.createElement('div'); c.className='ms-sprite ms-cloud'; bg.appendChild(c); return c; }
  function makeRock(){ const r=document.createElement('div'); r.className='ms-sprite ms-rock'; bg.appendChild(r); return r; }
  for(let i=0;i<8;i++) deco.clouds.push(makeCloud());
  for(let i=0;i<10;i++) deco.rocks.push(makeRock());
  // (sin árboles de tiles)

  // Construcción del suelo visual (tiles). Desactivado para no mostrar la barra azul.
  const SHOW_TILES = false;
  let grid = null;
  if (SHOW_TILES){
    const cols = 12;
    grid = document.createElement('div');
    grid.className = 'ms-grid';
    root.appendChild(grid);
    for (let i=0;i<cols;i++){
      const t = document.createElement('div'); t.className='ms-tile'; grid.appendChild(t);
    }
  }

  // Estado del mundo (pixeles)
  let W = root.clientWidth;
  let H = root.clientHeight;
  function floorRatio(){ const v = parseFloat(getComputedStyle(root).getPropertyValue('--floor-ratio')); return isFinite(v)&&v>0&&v<1 ? v : 0.78; }
  let FLOOR_Y = Math.round(H * floorRatio()); // altura del césped (relativa al fondo)
  const AV_W = 72, AV_H = 72;
  const AV_YOFF = -20; // levanta un poco al avatar para alinearlo al enemigo
  const ENEMY_W = 64, ENEMY_H = 64;
  const COIN_S = 148;
  const TILE_H = 28;
  // Velocidades más lentas para caminar lentamente
  const SPEED = 1.05, GRAV = 0.6, JUMP = -9.8;

  // Avatar + HUD
  // Usamos un contenedor para poder voltear (flip) sin interferir con la animación del avatar
  const avWrap = document.createElement('div'); avWrap.className = 'ms-avatar-wrap'; avWrap.style.left = '0px'; avWrap.style.top = (FLOOR_Y-6-AV_H + AV_YOFF)+'px'; root.appendChild(avWrap);
  const av = document.createElement('div'); av.className='ms-avatar'; avWrap.appendChild(av);
  const hud = document.createElement('div'); hud.className='ms-hud'; hud.innerHTML='🪙 <b id="msCoins">0</b>'; root.appendChild(hud);
  function coinsGet(){ return parseInt(localStorage.getItem('ms_coins')||'0',10)||0; }
  function coinsSet(v){ localStorage.setItem('ms_coins', String(Math.max(0, v|0))); document.getElementById('msCoins').textContent = String(v|0); }
  coinsSet(coinsGet());

  let x = 16, y = FLOOR_Y-6-AV_H + AV_YOFF, vx = 0, vy = 0; const keys = {}; let paused=true;

  // Objetos (moneda y enemigo)
  const coin = document.createElement('div'); coin.className='ms-coin'; root.appendChild(coin);
  const enemyEl = document.createElement('div'); enemyEl.className='ms-enemy'; root.appendChild(enemyEl);
  let coinPos = { x: Math.round(W*0.35), y: FLOOR_Y-6-COIN_S };
  let coinActive = true;
  let enemyPos   = { x: Math.round(W*0.65), y: FLOOR_Y-6-ENEMY_H };
  const enemy = { el: enemyEl, baseX: enemyPos.x, baseY: enemyPos.y, amp: 36, speed: 0.0008, t: 0, state:'patrol', respawnAt:0 };

  position(coin, coinPos.x, coinPos.y); position(enemyEl, enemyPos.x, enemyPos.y);

  function position(el, px, py){ el.style.position='absolute'; el.style.left=px+'px'; el.style.top=py+'px'; }
  function place(){ avWrap.style.left = Math.round(x)+'px'; avWrap.style.top = Math.round(y)+'px'; }

  // Preguntas desde json_script
  let preguntas = [];
  try{ const el = document.getElementById('ms-questions'); if(el){ preguntas = JSON.parse(el.textContent||'[]'); } }catch{}
  const overlay = document.createElement('div'); overlay.className='ms-q'; overlay.innerHTML='<div class="ms-q-card"><div class="fw-bold mb-2" id="qText"></div><div id="qOpts"></div></div>'; root.appendChild(overlay);

  // Pantalla de inicio: muestra un panel retro antes de jugar
  const start = document.createElement('div');
  start.className = 'ms-start';
  // Toma un título limpio desde data-title del contenedor; fallback a document.title
  const dataTitle = (root.getAttribute('data-title')||'').trim();
  const t = (dataTitle || (document.title || 'Quiz').replace(/\s*[-–].*$/, ''))
              .replace(/\s+/g,' ').trim();
  start.innerHTML = `
    <div class="ms-panel">
      <div class="ms-sub">quiz</div>
      <div class="ms-main">${t || 'retro bits'}</div>
      <div class="ms-cta">
        <img class="ms-wizard" src="/static/LevelUp/img/misiones/personaje.png" alt="personaje">
        <div class="ms-bubble">¡Vamos!</div>
        <button type="button" class="ms-arrow" id="msStartBtn" aria-label="Empezar">→</button>
      </div>
    </div>`;
  root.appendChild(start);
  function startGame(){
    try{ sfx('ok'); }catch{}
    try{ start.classList.add('hide'); }catch{}
    setTimeout(()=>{ try{ start.remove(); }catch{} paused=false; }, 160);
  }
  // Click en el botón o Enter/Espacio para iniciar
  start.addEventListener('click', (e)=>{
    const el = e.target;
    if (el && (el.id === 'msStartBtn' || el.classList.contains('ms-arrow'))) startGame();
  });
  window.addEventListener('keydown', (e)=>{
    if (paused && (e.key === 'Enter' || e.key === ' ')) startGame();
  });
  function ask(){
    if(!preguntas.length) return;
    const p=preguntas[0];
    document.getElementById('qText').textContent=p.q;
    const box=document.getElementById('qOpts'); box.innerHTML='';
    p.opts.forEach((o,i)=>{
      const b=document.createElement('button');
      b.className='btn btn-sm btn-outline-primary me-2 mb-2';
      b.textContent=o;
      b.onclick=()=>{
        if(i===p.ans){ onCorrect(); preguntas.shift(); overlay.classList.remove('show'); setTimeout(()=>{ overlay.style.display='none'; }, 180); }
        else { b.classList.replace('btn-outline-primary','btn-danger'); onWrong(); }
      };
      box.appendChild(b);
    });
    overlay.style.display='flex';
    // fuerza reflow para animación y luego muestra
    void overlay.offsetWidth; overlay.classList.add('show');
    enemy.el.classList.add('trigger'); paused=true;
  }

  // ---- SFX 8-bit (sin assets) ----
  let AC=null; function ac(){ if(!AC){ const A=window.AudioContext||window.webkitAudioContext; if(A) AC=new A(); } return AC; }
  function noiseBurst(ctx, duration=0.08, gain=0.12){
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for(let i=0;i<bufferSize;i++){ data[i] = (Math.random()*2-1) * (1 - i/bufferSize); }
    const src = ctx.createBufferSource(); src.buffer = buffer;
    const g = ctx.createGain(); g.gain.value = gain; src.connect(g); g.connect(ctx.destination);
    src.start(); setTimeout(()=>{ try{ src.stop(); }catch(_){} }, duration*1000+10);
  }
  function sfx(type){
    const ctx = ac(); if(!ctx) return; if(ctx.state==='suspended'){ ctx.resume().catch(()=>{}); }
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    g.gain.value = 0.12;
    switch(type){
      case 'ok':
        o.type='square'; o.frequency.setValueAtTime(1200, ctx.currentTime);
        o.frequency.exponentialRampToValueAtTime(780, ctx.currentTime+0.12);
        g.gain.setValueAtTime(0.14, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime+0.16);
        break;
      case 'bad':
        o.type='sawtooth'; o.frequency.setValueAtTime(260, ctx.currentTime);
        o.frequency.exponentialRampToValueAtTime(160, ctx.currentTime+0.18);
        g.gain.setValueAtTime(0.16, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime+0.22);
        break;
      case 'jump':
        o.type='triangle'; o.frequency.setValueAtTime(420, ctx.currentTime);
        o.frequency.exponentialRampToValueAtTime(820, ctx.currentTime+0.08);
        g.gain.setValueAtTime(0.12, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime+0.14);
        // toque de ruido para efecto retro
        noiseBurst(ctx, 0.06, 0.06);
        break;
      case 'coin':
        o.type='square'; o.frequency.setValueAtTime(1600, ctx.currentTime);
        o.frequency.exponentialRampToValueAtTime(2100, ctx.currentTime+0.06);
        g.gain.setValueAtTime(0.14, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime+0.16);
        noiseBurst(ctx, 0.04, 0.05);
        break;
      default:
        o.type='square'; o.frequency.value=600; g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime+0.12);
    }
    o.start(); o.stop(ctx.currentTime+0.25);
  }

  function award(){ const key='ms_'+(document.title||'world')+'_progress'; const cur=parseInt(localStorage.getItem(key)||'0',10)||0; const nxt=Math.min(100,cur+25); localStorage.setItem(key,String(nxt)); coinsSet(coinsGet()+5); }
  function onCorrect(){ sfx('ok'); award(); enemy.state='defeated'; enemy.respawnAt=Date.now()+30000; enemy.el.classList.add('defeat'); setTimeout(()=>{ enemy.el.style.display='none'; enemy.el.classList.remove('defeat','alert','trigger'); },480); paused=false; }
  function onWrong(){ sfx('bad'); vx = (x > enemy.baseX ? 1 : -1) * 4; x += vx*3; y = Math.min(y, FLOOR_Y-6-AV_H + AV_YOFF); setTimeout(()=>{ vx=0; }, 180); paused=false; }

  // Input
  window.addEventListener('keydown',e=>{ keys[e.key.toLowerCase()] = true; });
  window.addEventListener('keyup',e=>{ keys[e.key.toLowerCase()] = false; });

  function hit(ax,ay,aw,ah,bx,by,bw,bh){ return ax < bx+bw && ax+aw > bx && ay < by+bh && ay+ah > by; }
  // Colisión de moneda MUY estricta (círculos + proximidad vertical)
  // - Centro avatar al 82% de su altura (zona de pies)
  // - Radios pequeños y verificación extra de cercanía vertical
  function hitCoin(ax,ay,aw,ah,bx,by,bw,bh){
    const acx = ax + aw*0.5, acy = ay + ah*0.82;   // centro avatar (abajo)
    const bcx = bx + bw*0.5, bcy = by + bh*0.5;    // centro moneda
    const ar = Math.min(aw,ah) * 0.22;             // radio avatar reducido
    const br = Math.min(bw,bh) * 0.24;             // radio moneda reducido
    const dx = acx - bcx, dy = acy - bcy;
    const rsum = ar + br;
    // Cercanía vertical obligatoria (evita recolectar desde muy arriba/abajo)
    const verticalOk = Math.abs(dy) <= Math.min(ar, br) * 0.9;
    return verticalOk && (dx*dx + dy*dy) <= (rsum*rsum);
  }

  function loop(){
    if (paused){ requestAnimationFrame(loop); return; }
    // Horizontal
    vx = 0; if (keys['arrowright']||keys['d']) vx = SPEED; if (keys['arrowleft']||keys['a'])  vx = -SPEED;
    // Animación de caminar + dirección
    if (vx !== 0){
      av.classList.add('walk');
      if (vx < 0) avWrap.classList.add('left'); else avWrap.classList.remove('left');
    } else {
      av.classList.remove('walk');
    }
    // Salto
    // Permitir salto solo si está en el piso (con offset aplicado)
    if ((keys['arrowup']||keys['w']||keys[' ']) && Math.abs((y+AV_H)-(FLOOR_Y-6 + AV_YOFF))<1){ vy = JUMP; sfx('jump'); }
    // Física
    vy += GRAV; y += vy; x += vx;
    if (y+AV_H >= FLOOR_Y-6 + AV_YOFF){ y = FLOOR_Y-6-AV_H + AV_YOFF; vy = 0; }
    if (x < 0) x = 0; if (x+AV_W > W) x = W-AV_W; place();

    // Moneda
    if (coinActive && hitCoin(x,y,AV_W,AV_H, coinPos.x, coinPos.y, COIN_S, COIN_S)) {
      coinActive = false;
      try{ coin.style.display='none'; }catch{}
      sfx('coin'); coinsSet(coinsGet()+1);
      // Respawn simple tras 8s en otra posición
      setTimeout(()=>{
        coinPos.x = Math.round( (0.15 + Math.random()*0.7) * W );
        coinPos.y = FLOOR_Y - 6 - COIN_S;
        position(coin, coinPos.x, coinPos.y);
        coin.style.display='block'; coinActive = true;
      }, 8000);
    }
    // Enemigo: patrulla + detección + colisión
    if (enemy.state !== 'defeated'){
      enemy.t += enemy.speed * 16; const dx = Math.sin(enemy.t) * enemy.amp; enemyPos.x = enemy.baseX + dx; position(enemy.el, enemyPos.x, enemyPos.y);
      const cx = x + AV_W/2, cy = y + AV_H/2; const ex = enemyPos.x + ENEMY_W/2, ey = enemyPos.y + ENEMY_H/2; const dist = Math.hypot(cx-ex, cy-ey);
      if (dist < 120){ enemy.el.classList.add('alert'); enemy.state='alert'; } else { enemy.el.classList.remove('alert'); if(enemy.state!=='patrol') enemy.state='patrol'; }
      if (hit(x,y,AV_W,AV_H, enemyPos.x, enemyPos.y, ENEMY_W, ENEMY_H)) ask();
    } else if (enemy.respawnAt && Date.now() > enemy.respawnAt){ enemy.state='patrol'; enemy.el.style.display='block'; enemyPos.x = enemy.baseX; enemyPos.y = enemy.baseY; position(enemy.el,enemyPos.x,enemyPos.y); }

    // Parallax simple según x
    const nx = x / Math.max(1, W);
    if (bgHillsBack)  bgHillsBack.style.transform  = `translateX(${(-nx*12).toFixed(2)}px)`;
    if (bgHillsFront) bgHillsFront.style.transform = `translateX(${(-nx*28).toFixed(2)}px)`;
    if (bgGrass)      bgGrass.style.transform      = `translateX(${(-nx*40).toFixed(2)}px)`;
    // Lento movimiento de nubes y rocas para dar profundidad
    deco.clouds.forEach((c,i)=>{ c.style.transform = `translateX(${(-nx*(10+i*2)).toFixed(2)}px) translateY(${Math.sin((Date.now()/1000)+(i))*2}px)`; });
    deco.rocks.forEach((r,i)=>{ r.style.transform = `translateX(${(-nx*(20+i)).toFixed(2)}px)`; });
    requestAnimationFrame(loop);
  }

  function resize(){
    W = root.clientWidth; H = root.clientHeight;
    FLOOR_Y = Math.round(H * floorRatio());
    root.style.setProperty('--floor-px', FLOOR_Y + 'px');
    // Reposicionar elementos dependientes del suelo
    coinPos.y = FLOOR_Y-6-COIN_S; enemyPos.y = FLOOR_Y-6-ENEMY_H;
    position(coin, coinPos.x, coinPos.y); position(enemy.el, enemyPos.x, enemyPos.y);
    // Ajustar baseline del avatar con el nuevo FLOOR
    y = Math.min(y, FLOOR_Y-6-AV_H + AV_YOFF);
    // Alinear la grilla visual al piso (compensa la altura del tile)
    const gridBottom = Math.max(0, H - (FLOOR_Y-6) - Math.round(TILE_H*0.2));
    root.style.setProperty('--grid-bottom', gridBottom + 'px');
    // Colocar sprites decorativos
    deco.clouds.forEach((c,i)=>{
      const ww = 90 + Math.round(Math.random()*70);
      const hh = Math.round(ww*0.42);
      c.style.setProperty('--w', ww+'px');
      c.style.setProperty('--h', hh+'px');
      const y = Math.round(H*(0.12 + (i%3)*0.04));
      const x = Math.round(20 + (i/(deco.clouds.length-1))*(W-40));
      position(c, x, y);
    });
    deco.rocks.forEach((r,i)=>{
      const ww = 28 + Math.round(Math.random()*28);
      const hh = 16 + Math.round(Math.random()*14);
      r.style.setProperty('--w', ww+'px');
      r.style.setProperty('--h', hh+'px');
      if (Math.random() < 0.33){ r.style.setProperty('--rock-a','#f4b377'); r.style.setProperty('--rock-b','#d98844'); r.style.setProperty('--rock-c','#bf6b2e'); }
      const y = FLOOR_Y - 6 - Math.round(8 + (i%3)*6);
      const x = Math.round(20 + (i/(deco.rocks.length-1))*(W-40));
      position(r, x, y);
    });
    // (sin árboles ni plataformas)
  }

  // Debug: slider de piso si viene ?floor_debug=1
  try{
    const params = new URLSearchParams(location.search);
    if (params.get('floor_debug')==='1'){
      const box = document.createElement('div');
      box.style.cssText = 'position:absolute;top:10px;right:10px;z-index:9;background:rgba(0,0,0,.5);color:#fff;padding:8px 10px;border-radius:8px;backdrop-filter:blur(3px);';
      box.innerHTML = '<label style="font:700 12px system-ui, sans-serif;display:block;margin-bottom:4px;">Floor</label>';
      const input = document.createElement('input');
      input.type = 'range'; input.min = '0.55'; input.max = '0.78'; input.step = '0.001'; input.value = String(floorRatio());
      input.style.width = '180px';
      const val = document.createElement('div'); val.style.cssText='font:700 12px system-ui,sans-serif;margin-top:4px;text-align:right;'; val.textContent = input.value;
      input.oninput = () => { root.style.setProperty('--floor-ratio', input.value); val.textContent = input.value; resize(); };
      box.appendChild(input); box.appendChild(val); root.appendChild(box);
    }
  }catch{}
  window.addEventListener('resize', resize);
  resize(); place(); requestAnimationFrame(loop);
})();





