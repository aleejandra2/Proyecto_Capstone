// ===== Tilt en ilustración (parallax suave) =====
(function(){
  const tilt = document.querySelector('.tilt-on-move');
  if(!tilt) return;
  tilt.addEventListener('mousemove', (e)=>{
    const r = tilt.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - .5;
    const y = (e.clientY - r.top) / r.height - .5;
    tilt.style.transform = `rotateX(${(-y*6).toFixed(2)}deg) rotateY(${(x*6).toFixed(2)}deg) scale(1.02)`;
  });
  tilt.addEventListener('mouseleave', ()=> tilt.style.transform = '');
})();

// ===== Contadores animados =====
(function(){
  const ease = t => t<.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2;
  const els = document.querySelectorAll('.stat-card');
  els.forEach(el=>{
    const target = +el.dataset.count || 0;
    const val = el.querySelector('.stat-value');
    let start = null, duration = 1200;
    const step = ts =>{
      if(!start) start = ts;
      const p = Math.min(1,(ts-start)/duration);
      val.textContent = Math.floor(ease(p)*target);
      if(p<1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
})();

// ===== Reveal on scroll =====
(function(){
  const revealEls = document.querySelectorAll('.reveal');
  if(!('IntersectionObserver' in window)) { revealEls.forEach(e=>e.classList.add('is-visible')); return; }
  const io = new IntersectionObserver(entries=>{
    entries.forEach(ent=>{ if(ent.isIntersecting){ ent.target.classList.add('is-visible'); io.unobserve(ent.target); } });
  },{ threshold:.25 });
  revealEls.forEach(e=>io.observe(e));
})();

// ===== Flip cards: activar con click (mobile friendly) =====
(function(){
  document.querySelectorAll('.flip-card').forEach(card=>{
    card.addEventListener('click', ()=> card.classList.toggle('active'));
    card.addEventListener('keyup', e=>{ if(e.key==='Enter' || e.key===' ') card.classList.toggle('active'); });
    card.setAttribute('tabindex','0');
  });
})();

// ===== Confetti =====
function launchConfetti(count=100){
  for(let i=0;i<count;i++){
    const c = document.createElement('span');
    c.className = 'confetti';
    const size = 6 + Math.random()*10;
    c.style.left = (Math.random()*100)+'vw';
    c.style.width = size+'px';
    c.style.height = (size*1.4)+'px';
    c.style.background = `hsl(${Math.floor(Math.random()*360)}, 90%, 60%)`;
    document.body.appendChild(c);
    c.addEventListener('animationend', ()=> c.remove());
  }
}
document.getElementById('btn-celebrar')?.addEventListener('click', ()=> launchConfetti(140));

// ===== Mini-reto matemático =====
(function(){
  const a = document.getElementById('q-a');
  const b = document.getElementById('q-b');
  const i = document.getElementById('q-ans');
  const f = document.getElementById('q-feedback');
  const btnNew = document.getElementById('btn-nueva');
  const btnGo  = document.getElementById('btn-comprobar');

  if(!a || !b || !i || !f) return;

  const beep = (ok=true)=>{
    // WebAudio sin assets externos
    const ctx = new (window.AudioContext||window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = ok ? 880 : 180;
    o.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(.2, ctx.currentTime+.01);
    o.start();
    setTimeout(()=>{ g.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime+.05); o.stop(ctx.currentTime+.06); }, ok?140:220);
  };

  let ans = 0;
  function nueva(){
    const A = 1+Math.floor(Math.random()*9);
    const B = 1+Math.floor(Math.random()*9);
    a.textContent = A; b.textContent = B; ans = A+B;
    i.value=''; f.textContent=''; f.className='';
  }
  function comprobar(){
    const v = Number(i.value);
    if(v===ans){
      f.textContent = '¡Correcto! 🎉'; f.className='feedback-ok';
      launchConfetti(80); beep(true);
    }else{
      f.textContent = 'Ups, intenta de nuevo.'; f.className='feedback-bad';
      i.classList.add('shake'); setTimeout(()=> i.classList.remove('shake'), 450); beep(false);
    }
  }
  btnNew?.addEventListener('click', nueva);
  btnGo?.addEventListener('click', comprobar);
  i.addEventListener('keydown', e=>{ if(e.key==='Enter') comprobar(); });

  nueva();
})();
