export function getCSRF() {
  const m = document.cookie.match(/csrftoken=([^;]+)/);
  return m ? m[1] : "";
}

export async function postAnswer(actividadId, itemId, payload = {}) {
  const res = await fetch(`/api/actividades/${actividadId}/answer/${itemId}/`, {
    method: "POST",
    headers: { "X-CSRFToken": getCSRF(), "Content-Type": "application/json" },
    body: JSON.stringify({ payload })
  });
  if (!res.ok) throw new Error("Fallo guardando respuesta");
  return res.json();
}

export function shuffle(a){ return a.map(v=>[Math.random(),v]).sort((x,y)=>x[0]-y[0]).map(x=>x[1]); }

export function header(root, title, timeStart=90){
  const wrap = document.createElement("div");
  wrap.className = "lv-header";
  const left = document.createElement("div");
  left.innerHTML = `
    <div style="display:flex; align-items:center; gap:12px;">
      <div class="lv-avatar" id="lvAvatar">
        <img id="lvAvatarImg" alt="avatar">
        <div class="lv-layer" id="lvLayerCara"></div>
        <div class="lv-layer" id="lvLayerCabeza"></div>
        <div class="lv-layer" id="lvLayerEspalda"></div>
      </div>
      <div>
        <div style="font-weight:800">${title}</div>
        <div class="lv-meta">
          <span class="pill">Nivel <span id="lvLevel">1</span></span>
          <span class="pill">XP <span id="lvXP">0</span></span>
        </div>
      </div>
    </div>`;
  const right = document.createElement("div");
  right.innerHTML = `
    <div class="pill">⏱ <span id="lvTime">Tiempo</span></div>
    <div class="lv-progress"><div id="lvBar"></div></div>`;
  wrap.appendChild(left); wrap.appendChild(right);
  root.appendChild(wrap);

  // Avatar + equip
  const AV = window.GAME_AVATAR || {};
  const img = root.querySelector("#lvAvatarImg");
  img.src = AV.img || "";
  root.querySelector("#lvLevel").textContent = AV.nivel ?? 1;
  root.querySelector("#lvXP").textContent = AV.xp ?? 0;

  const equip = AV.equip || {};
  const map = { cara: "lvLayerCara", cabeza: "lvLayerCabeza", espalda: "lvLayerEspalda" };
  Object.entries(map).forEach(([slot, id])=>{
    const layer = root.querySelector("#"+id);
    const slug = (equip[slot] || "").trim();
    layer.className = "lv-layer " + (slug ? ("lv-accessorio-" + slug) : "");
  });

  // contador
  let t = timeStart;
  const timeEl = root.querySelector("#lvTime");
  timeEl.textContent = `${t}s`;
  const it = setInterval(()=>{ t--; timeEl.textContent = `${t}s`; if (t<=0) clearInterval(it); },1000);

  return {
    setBar: (p)=>{ root.querySelector("#lvBar").style.width = `${Math.max(0, Math.min(100, p))}%`; },
    bump: ()=>{
      const a = root.querySelector("#lvAvatar");
      a.style.transform = "translateY(-4px)"; setTimeout(()=>a.style.transform="", 180);
    }
  };
}
