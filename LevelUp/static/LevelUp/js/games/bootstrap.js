// static/LevelUp/js/games/bootstrap.js
(function () {
  function initAvatar() {
    const dataEl = document.getElementById("game-avatar-data");
    if (!dataEl) return;

    let equip = {};
    const equipEl = document.getElementById("game-avatar-equip");
    if (equipEl && equipEl.textContent) {
      try { equip = JSON.parse(equipEl.textContent); } catch (e) { console.error("equip JSON inválido", e); }
    }

    window.GAME_AVATAR = {
      img: dataEl.dataset.img || "",
      nivel: parseInt(dataEl.dataset.nivel || "1", 10),
      xp: parseInt(dataEl.dataset.xp || "0", 10),
      equip: equip
    };
  }

  // Espera al DOM y configura avatar
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAvatar);
  } else {
    initAvatar();
  }
})();
