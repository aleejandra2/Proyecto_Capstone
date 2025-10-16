(()=>{
  const root = document.getElementById('msGame');
  if (!root) return;

  // Construcción del suelo visual
  const cols = 12;
  const grid = document.createElement('div');
  grid.className = 'ms-grid';
  root.appendChild(grid);
  for (let i=0;i<cols;i++){
    const t = document.createElement('div'); t.className='ms-tile'; grid.appendChild(t);
  }

  // Estado del mundo (pixeles)
  let W = root.clientWidth;
  let H = root.clientHeight;
  const FLOOR_Y = H - 56; // altura del piso
  const AV_W = 36, AV_H = 36;
  // Velocidades más lentas para caminar lentamente
  const SPEED = 0.7, GRAV = 0.6, JUMP = -9.8;

  // Avatar + HUD
  // Usamos un contenedor para poder voltear (flip) sin interferir con la animación del avatar
  const avWrap = document.createElement('div'); avWrap.className = 'ms-avatar-wrap'; avWrap.style.left = '0px'; avWrap.style.top = (FLOOR_Y-AV_H)+'px'; root.appendChild(avWrap);
  const av = document.createElement('div'); av.className='ms-avatar'; avWrap.appendChild(av);
  const hud = document.createElement('div'); hud.className='ms-hud'; hud.innerHTML='🪙 <b id="msCoins">0</b>'; root.appendChild(hud);
  function coinsGet(){ return parseInt(localStorage.getItem('ms_coins')||'0',10)||0; }
  function coinsSet(v){ localStorage.setItem('ms_coins', String(Math.max(0, v|0))); document.getElementById('msCoins').textContent = String(v|0); }
  coinsSet(coinsGet());

  let x = 16, y = FLOOR_Y-AV_H, vx = 0, vy = 0; const keys = {}; let paused=false;

  // Objetos (moneda y enemigo)
  const coin = document.createElement('div'); coin.className='ms-coin'; root.appendChild(coin);
  const enemyEl = document.createElement('div'); enemyEl.className='ms-enemy'; root.appendChild(enemyEl);
  let coinPos = { x: Math.round(W*0.35), y: FLOOR_Y-24 };
  let enemyPos   = { x: Math.round(W*0.65), y: FLOOR_Y-30 };
  const enemy = { el: enemyEl, baseX: enemyPos.x, baseY: enemyPos.y, amp: 36, speed: 0.003, t: 0, state:'patrol', respawnAt:0 };

  position(coin, coinPos.x, coinPos.y); position(enemyEl, enemyPos.x, enemyPos.y);

  function position(el, px, py){ el.style.position='absolute'; el.style.left=px+'px'; el.style.top=py+'px'; }
  function place(){ avWrap.style.left = Math.round(x)+'px'; avWrap.style.top = Math.round(y)+'px'; }

  // Preguntas desde json_script
  let preguntas = [];
  try{ const el = document.getElementById('ms-questions'); if(el){ preguntas = JSON.parse(el.textContent||'[]'); } }catch{}
  const overlay = document.createElement('div'); overlay.className='ms-q'; overlay.innerHTML='<div><div class="fw-bold mb-2" id="qText"></div><div id="qOpts"></div></div>'; root.appendChild(overlay);
  function ask(){ if(!preguntas.length) return; const p=preguntas[0]; document.getElementById('qText').textContent=p.q; const box=document.getElementById('qOpts'); box.innerHTML=''; p.opts.forEach((o,i)=>{ const b=document.createElement('button'); b.className='btn btn-sm btn-outline-primary me-2 mb-2'; b.textContent=o; b.onclick=()=>{ if(i===p.ans){ onCorrect(); overlay.style.display='none'; preguntas.shift(); } else { b.classList.replace('btn-outline-primary','btn-danger'); onWrong(); } }; box.appendChild(b); }); overlay.style.display='flex'; enemy.el.classList.add('trigger'); paused=true; }

  function award(){ const key='ms_'+(document.title||'world')+'_progress'; const cur=parseInt(localStorage.getItem(key)||'0',10)||0; const nxt=Math.min(100,cur+25); localStorage.setItem(key,String(nxt)); coinsSet(coinsGet()+5); }
  function onCorrect(){ award(); enemy.state='defeated'; enemy.respawnAt=Date.now()+30000; enemy.el.classList.add('defeat'); setTimeout(()=>{ enemy.el.style.display='none'; enemy.el.classList.remove('defeat','alert','trigger'); },480); paused=false; }
  function onWrong(){ vx = (x > enemy.baseX ? 1 : -1) * 4; x += vx*3; y = Math.min(y, FLOOR_Y-AV_H); setTimeout(()=>{ vx=0; }, 180); paused=false; }

  // Input
  window.addEventListener('keydown',e=>{ keys[e.key.toLowerCase()] = true; });
  window.addEventListener('keyup',e=>{ keys[e.key.toLowerCase()] = false; });

  function hit(ax,ay,aw,ah,bx,by,bw,bh){ return ax < bx+bw && ax+aw > bx && ay < by+bh && ay+ah > by; }

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
    if ((keys['arrowup']||keys['w']||keys[' ']) && Math.abs((y+AV_H)-FLOOR_Y)<1) vy = JUMP;
    // Física
    vy += GRAV; y += vy; x += vx;
    if (y+AV_H >= FLOOR_Y){ y = FLOOR_Y-AV_H; vy = 0; }
    if (x < 0) x = 0; if (x+AV_W > W) x = W-AV_W; place();

    // Moneda
    if (hit(x,y,AV_W,AV_H, coinPos.x, coinPos.y, 24,24)) coin.remove();
    // Enemigo: patrulla + detección + colisión
    if (enemy.state !== 'defeated'){
      enemy.t += enemy.speed * 16; const dx = Math.sin(enemy.t) * enemy.amp; enemyPos.x = enemy.baseX + dx; position(enemy.el, enemyPos.x, enemyPos.y);
      const cx = x + AV_W/2, cy = y + AV_H/2; const ex = enemyPos.x + 13, ey = enemyPos.y + 13; const dist = Math.hypot(cx-ex, cy-ey);
      if (dist < 120){ enemy.el.classList.add('alert'); enemy.state='alert'; } else { enemy.el.classList.remove('alert'); if(enemy.state!=='patrol') enemy.state='patrol'; }
      if (hit(x,y,AV_W,AV_H, enemyPos.x, enemyPos.y, 26,26)) ask();
    } else if (enemy.respawnAt && Date.now() > enemy.respawnAt){ enemy.state='patrol'; enemy.el.style.display='block'; enemyPos.x = enemy.baseX; enemyPos.y = enemy.baseY; position(enemy.el,enemyPos.x,enemyPos.y); }

    requestAnimationFrame(loop);
  }

  function resize(){ W = root.clientWidth; H = root.clientHeight; }
  window.addEventListener('resize', resize);
  resize(); place(); requestAnimationFrame(loop);
})();





