/* play.js – colisión exacta con plataformas, centrado correcto y menús */
window.Play = (function () {
    // ===== util =====
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const nowMs = () => performance.now();
    const rectHit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    function circleRectHit(cx, cy, r, rx, ry, rw, rh) {
        const nx = clamp(cx, rx, rx + rw), ny = clamp(cy, ry, ry + rh);
        const dx = cx - nx, dy = cy - ny; return (dx * dx + dy * dy) <= r * r;
    }

    // ===== input (teclado; móvil será traducido a teclas desde el HTML) =====
    const keys = Object.create(null);
    addEventListener('keydown', e => { keys[e.code] = true; });
    addEventListener('keyup', e => { keys[e.code] = false; });

    // ===== SFX (sintetizados) =====
    const AudioCtx = window.AudioContext || window.webkitAudioContext; let AC = null;
    function ac() { if (!AC && AudioCtx) AC = new AudioCtx(); if (AC && AC.state === 'suspended') AC.resume().catch(() => { }); return AC; }
    function noiseBurst(ctx, d = 0.06, g = 0.08) {
        const n = Math.floor(ctx.sampleRate * d), buf = ctx.createBuffer(1, n, ctx.sampleRate), ch = buf.getChannelData(0);
        for (let i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / n);
        const s = ctx.createBufferSource(); s.buffer = buf; const gn = ctx.createGain(); gn.gain.value = g;
        s.connect(gn); gn.connect(ctx.destination); s.start(); setTimeout(() => { try { s.stop(); } catch { } }, d * 1000 + 10);
    }
    function sfx(type) {
        const ctx = ac(); if (!ctx) return;
        const o = ctx.createOscillator(), g = ctx.createGain(); o.connect(g); g.connect(ctx.destination);
        switch (type) {
            case 'jump':
                o.type = 'triangle'; o.frequency.setValueAtTime(420, ctx.currentTime);
                o.frequency.exponentialRampToValueAtTime(820, ctx.currentTime + 0.08);
                g.gain.setValueAtTime(0.12, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.14);
                noiseBurst(ctx, 0.05, 0.05); break;
            case 'coin':
                o.type = 'square'; o.frequency.setValueAtTime(1600, ctx.currentTime);
                o.frequency.exponentialRampToValueAtTime(2200, ctx.currentTime + 0.06);
                g.gain.setValueAtTime(0.14, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.16);
                noiseBurst(ctx, 0.04, 0.04); break;
            case 'enemyDown':
                o.type = 'square'; o.frequency.setValueAtTime(900, ctx.currentTime);
                o.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.22);
                g.gain.setValueAtTime(0.16, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.24);
                noiseBurst(ctx, 0.06, 0.06); break;
            case 'wrong':
                o.type = 'sawtooth'; o.frequency.setValueAtTime(300, ctx.currentTime);
                o.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.18);
                g.gain.setValueAtTime(0.16, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22); break;
            default:
                o.type = 'square'; o.frequency.value = 600;
                g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
        }
        o.start(); o.stop(ctx.currentTime + 0.3);
    }

    // ===== motor =====
    async function createEngine(canvas, level, askQuestionCb, onAllCleared) {
        const ctx = canvas.getContext('2d', { alpha: true });
        ctx.imageSmoothingEnabled = false;

        const tw = level.tileSize.w | 0, th = level.tileSize.h | 0;
        const W = level.size.pxW | 0, H = level.size.pxH | 0;
        canvas.width = W; canvas.height = H;

        // grillas
        const solids = level.solids || [];
        const fullBlocks = level.fullBlocks || [];      // bloques completos (pared)
        const topGrid = level.solidTopGrid || [];       // top parcial 0..th
        const bottomGrid = level.solidBottomGrid || []; // bottom parcial 0..th
        const solidAtTile = (tx, ty) => !!(solids[ty] && solids[ty][tx]);
        const fullAtTile = (tx, ty) => !!(fullBlocks[ty] && fullBlocks[ty][tx]);

        // AABB vs paredes completas
        function collideRectFull(x, y, w, h) {
            const x0 = Math.floor(x / tw), x1 = Math.floor((x + w - 1) / tw);
            const y0 = Math.floor(y / th), y1 = Math.floor((y + h - 1) / th);
            for (let ty = y0; ty <= y1; ty++)
                for (let tx = x0; tx <= x1; tx++)
                    if (fullAtTile(tx, ty)) return true;
            return false;
        }

        // Top de suelo real bajo los pies (plataformas parciales)
        function groundTopUnder(feetX1, feetX2, startFeetY, maxTilesDown = 12) {
            const tx1 = Math.floor(feetX1 / tw), tx2 = Math.floor(feetX2 / tw);
            let ty = Math.floor(startFeetY / th);
            for (let k = 0; k <= maxTilesDown; k++) {
                const t = ty + k;
                const a = solidAtTile(tx1, t), b = solidAtTile(tx2, t);
                const aboveA = solidAtTile(tx1, t - 1), aboveB = solidAtTile(tx2, t - 1);
                if ((a || b) && !(aboveA && aboveB)) {
                    const base = t * th;
                    const offA = (topGrid[t] && Number.isFinite(topGrid[t][tx1])) ? topGrid[t][tx1] : 0;
                    const offB = (topGrid[t] && Number.isFinite(topGrid[t][tx2])) ? topGrid[t][tx2] : 0;
                    return base + Math.min(offA, offB);
                }
            }
            return startFeetY;
        }

        // Bottom de techo real sobre la cabeza (parciales)
        function ceilingBottomAbove(headX1, headX2, startHeadY, maxTilesUp = 12) {
            const tx1 = Math.floor(headX1 / tw), tx2 = Math.floor(headX2 / tw);
            let ty = Math.floor((startHeadY - 1) / th);
            for (let k = 0; k <= maxTilesUp; k++) {
                const t = ty - k; if (t < 0) break;
                if (solidAtTile(tx1, t) || solidAtTile(tx2, t)) {
                    const base = t * th;
                    const bA = (bottomGrid[t] && Number.isFinite(bottomGrid[t][tx1])) ? bottomGrid[t][tx1] : th;
                    const bB = (bottomGrid[t] && Number.isFinite(bottomGrid[t][tx2])) ? bottomGrid[t][tx2] : th;
                    return base + Math.max(bA, bB);
                }
            }
            return startHeadY;
        }

        // física
        const GRAV = (level.settings && typeof level.settings.gravity === 'number') ? level.settings.gravity : 0.9;
        const JUMP = (level.settings && typeof level.settings.jump === 'number') ? level.settings.jump : -18;
        const WALK = 3.8, MAX_FALL = 18;

        // monedas
        const COIN_SPIN_SPEED = 0.03, COIN_BOB_SPEED = 0.02, COIN_BOB_AMP = 1.0;

        // assets
        const A = level.assets || {};
        const loadImg = src => new Promise(res => { if (!src) return res(null); const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
        const [imgPlayer, imgCoin, imgEnemy] = await Promise.all([loadImg(A.player), loadImg(A.coin), loadImg(A.enemy1)]);

        // jugador
        const p = {
            w: Math.round(tw * 0.88), h: Math.round(th * 1.06),
            x: 0, y: 0, vx: 0, vy: 0, onGround: false, coins: 0, facing: 1, walkPhase: 0
        };
        const sp = level.spawn || { x: tw * 2, y: th * 2 };
        p.x = Math.round(sp.x - p.w / 2);
        p.y = Math.round(sp.y - p.h);

        // monedas
        const coins = (level.coins || []).map(c => ({
            x: c.x, y: c.y,
            r: Math.max(8, Math.floor(Math.min(tw, th) * 0.25)),
            taken: false, ang: Math.random() * Math.PI * 2, bobT: Math.random() * Math.PI * 2
        }));

        // enemigos
        const enemies = (level.enemies || []).map(e => {
            const w = Math.round(tw * 0.90), h = Math.round(th * 0.90);
            const left = Math.min(e.patrolMinX ?? e.x - tw * 2, e.patrolMaxX ?? e.x + tw * 2);
            const right = Math.max(e.patrolMinX ?? e.x - tw * 2, e.patrolMaxX ?? e.x + tw * 2);
            const x0 = e.x - w / 2;
            const gTop = groundTopUnder(x0 + 4, x0 + w - 4, (e.groundY ?? e.y) + 1);
            return {
                id: e.id, x: x0, y: gTop - h, w, h, left, right,
                dir: (e.dir === 'left' ? -1 : 1), speed: (e.speed != null ? e.speed / 60 : 60 / 60),
                qid: e.qid != null ? String(e.qid) : null, alive: true, paused: false, deadT: 0
            };
        });

        // bucle
        const STEP = 1 / 60;
        let last = nowMs(), acc = 0;
        let uiOpen = false;
        const t0 = nowMs();
        let notified = false;

        function updateOneFrame() {
            const left = keys.ArrowLeft || keys.KeyA;
            const right = keys.ArrowRight || keys.KeyD;
            const up = keys.ArrowUp || keys.KeyW || keys.Space;

            if (!uiOpen) {
                p.vx = 0;
                if (left) { p.vx -= WALK; p.facing = -1; }
                if (right) { p.vx += WALK; p.facing = +1; }
                if (up && p.onGround) { p.vy = JUMP; p.onGround = false; sfx('jump'); }
                const spd = Math.abs(p.vx); p.walkPhase += (spd > 0 ? 0.22 + spd * 0.06 : 0.1);
            } else p.vx = 0;

            // X: paredes completas
            if (p.vx !== 0) {
                const nx = p.x + p.vx;
                if (!collideRectFull(nx, p.y, p.w, p.h)) p.x = nx;
                else if (p.vx > 0) { const tx = Math.floor((p.x + p.w + p.vx) / tw); p.x = tx * tw - p.w; }
                else { const tx = Math.floor((p.x + p.vx) / tw); p.x = (tx + 1) * tw; }
            }
            p.x = clamp(p.x, 0, W - p.w);

            // Y con top/bottom reales
            p.vy = clamp(p.vy + GRAV, -999, MAX_FALL);
            const nextY = p.y + p.vy;

            if (p.vy > 0) { // cayendo
                const feet1 = p.x + 3, feet2 = p.x + p.w - 3;
                const gTop = groundTopUnder(feet1, feet2, p.y + p.h + p.vy);
                if (gTop < p.y + p.h + p.vy) { p.y = gTop - p.h; p.vy = 0; p.onGround = true; }
                else if (!collideRectFull(p.x, nextY, p.w, p.h)) { p.y = nextY; p.onGround = false; }
                else { const ty = Math.floor((p.y + p.h + p.vy) / th); p.y = ty * th - p.h; p.vy = 0; p.onGround = true; }
            } else { // subiendo
                const head1 = p.x + 3, head2 = p.x + p.w - 3;
                const ceil = ceilingBottomAbove(head1, head2, p.y + p.vy);
                if ((p.y + p.vy) < ceil) { p.y = ceil; p.vy = 0; }
                else if (!collideRectFull(p.x, nextY, p.w, p.h)) p.y = nextY;
                else { const ty = Math.floor((p.y + p.vy) / th); p.y = (ty + 1) * th; p.vy = 0; }
            }
            p.y = clamp(p.y, 0, H - p.h);

            // monedas
            for (const c of coins) {
                if (c.taken) continue;
                c.ang += COIN_SPIN_SPEED; c.bobT += COIN_BOB_SPEED;
                const cy = c.y + Math.sin(c.bobT) * COIN_BOB_AMP;
                if (circleRectHit(c.x, cy, c.r, p.x, p.y, p.w, p.h)) { c.taken = true; p.coins++; sfx('coin'); }
            }

            // enemigos
            for (const e of enemies) {
                if (!e.alive) { e.deadT += 1; continue; }
                if (e.paused) continue;

                e.x += e.dir * e.speed;
                if (e.x < e.left) { e.x = e.left; e.dir = +1; }
                if (e.x + e.w > e.right) { e.x = e.right - e.w; e.dir = -1; }

                const f1 = e.x + 4, f2 = e.x + e.w - 4;
                const gTop = groundTopUnder(f1, f2, e.y + e.h + 1);
                e.y = gTop - e.h;

                if (!uiOpen && rectHit(p, e)) {
                    e.paused = true; uiOpen = true;
                    if (typeof askQuestionCb === 'function') {
                        askQuestionCb(e.qid,
                            () => { e.alive = false; uiOpen = false; sfx('enemyDown'); setTimeout(() => { e.paused = false; }, 100); },
                            () => { sfx('wrong'); p.vx = (p.x + p.w / 2 < e.x + e.w / 2) ? -WALK * 2 : WALK * 2; setTimeout(() => { p.vx = 0; }, 120); }
                        );
                    } else { e.alive = false; uiOpen = false; sfx('enemyDown'); }
                    break;
                }
            }

            // ¿Todos los enemigos derrotados?
            if (!notified && enemies.every(e => !e.alive)) {
                notified = true;
                if (typeof onAllCleared === 'function') onAllCleared({ coins: p.coins, time: nowMs() - t0 });
            }
        }

        function draw() {
            ctx.clearRect(0, 0, W, H);

            // monedas
            for (const c of coins) {
                if (c.taken) continue;
                const s = c.r * 2;
                const cy = c.y + Math.sin(c.bobT) * 1.0;
                if (imgCoin) {
                    const side = Math.min(imgCoin.width, imgCoin.height);
                    const sx = (imgCoin.width - side) / 2;
                    const sy = (imgCoin.height - side) / 2;
                    ctx.save(); ctx.translate(c.x, cy); ctx.rotate(c.ang);
                    ctx.drawImage(imgCoin, sx, sy, side, side, -s / 2, -s / 2, s, s);
                    ctx.restore();
                } else {
                    ctx.fillStyle = '#FFD54A'; ctx.beginPath(); ctx.arc(c.x, cy, c.r, 0, Math.PI * 2); ctx.fill();
                }
            }

            // enemigos
            for (const e of enemies) {
            if (e.alive) {
                if (imgEnemy) {
                ctx.save();

                // dir > 0 para que el enemigo camine hacia la derecha
                if (e.dir > 0) {
                    // caminando a la derecha -> voltear imagen
                    ctx.translate(e.x + e.w, e.y);
                    ctx.scale(-1, 1);
                    ctx.drawImage(imgEnemy, 0, 0, e.w, e.h);
                } else {
                    // caminando a la izquierda -> es igual a la dirección de la imagen
                    ctx.drawImage(imgEnemy, e.x, e.y, e.w, e.h);
                }

                ctx.restore();
                } else {
                ctx.fillStyle = '#e74c3c';
                ctx.fillRect(e.x | 0, e.y | 0, e.w, e.h);
                }
            } else if (e.deadT < 22) {
                const k = Math.max(0, 1 - e.deadT / 20);
                const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
                ctx.save(); ctx.translate(cx, cy); ctx.scale(k, k);
                if (imgEnemy) ctx.drawImage(imgEnemy, -e.w / 2, -e.h / 2, e.w, e.h);
                else { ctx.fillStyle = '#e74c3c'; ctx.fillRect(-e.w / 2, -e.h / 2, e.w, e.h); }
                ctx.restore();
            }
            }

            // jugador
            const bob = (Math.abs(p.vx) > 0.01 && p.onGround) ? Math.sin(p.walkPhase) * 1.5 : 0;
            if (imgPlayer) {
                ctx.save();
                if (p.facing < 0) { ctx.translate(p.x + p.w, p.y + bob); ctx.scale(-1, 1); ctx.drawImage(imgPlayer, 0, 0, p.w, p.h); }
                else { ctx.drawImage(imgPlayer, p.x, p.y + bob, p.w, p.h); }
                ctx.restore();
            } else {
                ctx.fillStyle = '#4aa3ff'; ctx.fillRect(p.x | 0, (p.y + bob) | 0, p.w, p.h);
            }
        }

        function frame(t) {
            const dt = Math.min(0.05, (t - last) / 1000 || STEP);
            last = t; acc += dt;
            while (acc >= STEP) { updateOneFrame(); acc -= STEP; }
            draw();
            requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
    }

    return { init(canvas, level, askQuestionCb, onAllCleared) { createEngine(canvas, level, askQuestionCb, onAllCleared); } };
})();
