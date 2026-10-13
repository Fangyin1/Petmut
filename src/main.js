import Phaser from 'phaser';
import { createClient } from '@supabase/supabase-js';
import './style.css';

// Isi dari Supabase Dashboard > Project Settings > API.
// Gunakan hanya Project URL dan anon/publishable key di frontend. Jangan pernah taruh service_role key di sini.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const $ = (id) => document.getElementById(id);
const home = $('home'), how = document.querySelector('.how'), footer = document.querySelector('footer');
const lobby = $('lobby'), modal = $('modal'), joinForm = $('joinForm');
let supabase = null, channel = null, game = null, myId = crypto.randomUUID();
let roomCode = '', playerName = '', isHost = false, started = false, players = {};
let myPos = { x: 400, y: 300 }, lastBroadcast = 0, localColor = '#9277ff', toastTimer;
const colors = ['#ff6b7e','#66c8ff','#72e1b4','#ffd06c','#b69aff','#ff9b5e'];

function connectSupabase() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    showToast('Supabase belum disetel. Baca README untuk mengaktifkan multiplayer.');
    return false;
  }
  if (!supabase) supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return true;
}
function showToast(msg) {
  const el = $('toast'); el.textContent = msg; el.classList.remove('hidden');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.add('hidden'), 3200);
}
function setView(inLobby) {
  home.classList.toggle('hidden', inLobby); how.classList.toggle('hidden', inLobby); footer.classList.toggle('hidden', inLobby);
  lobby.classList.toggle('hidden', !inLobby);
}
function openModal(create) {
  $('modalTitle').textContent = create ? 'Buat room privat' : 'Masuk ke kru';
  $('confirmCreate').textContent = create ? 'Buat room privat' : 'Gabung room';
  $('confirmCreate').dataset.action = create ? 'create' : 'join';
  $('modalError').textContent = '';
  modal.classList.remove('hidden'); $('nameInput').focus();
}
function makeCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let code = '';
  for (let i=0;i<5;i++) code += chars[Math.floor(Math.random()*chars.length)];
  return code;
}
function cleanName(value) { return value.trim().replace(/[<>]/g,'').slice(0,16); }
function randomSpawn() { return { x: 130 + Math.random()*500, y: 110 + Math.random()*300 }; }

async function enterRoom(action) {
  if (!connectSupabase()) return;
  playerName = cleanName($('nameInput').value) || 'Pemain';
  const requested = $('roomCodeInput').value.trim().toUpperCase();
  if (action === 'join' && !/^[A-Z0-9]{5}$/.test(requested)) { $('modalError').textContent = 'Masukkan kode room 5 karakter.'; return; }
  roomCode = action === 'create' ? makeCode() : requested;
  isHost = action === 'create'; started = false; myPos = randomSpawn(); players = {};
  $('confirmCreate').disabled = true;
  try {
    if (channel) { await supabase.removeChannel(channel); channel = null; }
    channel = supabase.channel(`fangus-${roomCode}`, { config: { presence: { key: myId }, broadcast: { self: false } } });
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const found = Object.values(state).flat().filter(p => p?.id);
      players = Object.fromEntries(found.map(p => [p.id, p]));
      renderCrew(); if (game) game.scene.getScene('MapScene')?.drawPlayers(players);
    });
    channel.on('broadcast', { event: 'player-update' }, ({ payload }) => {
      if (!payload?.id || payload.id === myId) return;
      players[payload.id] = { ...(players[payload.id] || {}), ...payload };
      renderCrew(); if (game) game.scene.getScene('MapScene')?.drawPlayers(players);
    });
    channel.on('broadcast', { event: 'game-start' }, ({ payload }) => {
      started = true; $('lobbyTitle').textContent = 'Misi dimulai'; $('startBtn').textContent = 'Permainan dimulai';
      $('startBtn').disabled = true; showToast('Permainan dimulai! Jelajahi sektor bersama kru.');
      if (payload?.host) isHost = payload.host === myId;
    });
    const status = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Koneksi timeout. Periksa konfigurasi Supabase.')), 12000);
      channel.subscribe(async s => {
        if (s === 'SUBSCRIBED') { clearTimeout(timeout); resolve(s); }
        if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') { clearTimeout(timeout); reject(new Error('Tidak dapat terhubung ke Supabase.')); }
      });
    });
    await channel.track({ id: myId, name: playerName, color: colors[Math.floor(Math.random()*colors.length)], x: myPos.x, y: myPos.y, host: isHost, joinedAt: Date.now() });
    localColor = channel.presenceState()[myId]?.[0]?.color || colors[0];
    modal.classList.add('hidden'); setView(true);
    $('roomCodeLabel').textContent = roomCode; $('inviteCode').textContent = roomCode;
    $('lobbyTitle').textContent = 'Menunggu kru...';
    $('startBtn').disabled = false; $('startBtn').textContent = 'Mulai permainan →';
    $('startHint').textContent = isHost ? 'Host dapat memulai saat minimal 3 pemain bergabung.' : 'Tunggu host memulai permainan.';
    $('startBtn').classList.toggle('hidden', !isHost);
    $('crewList').innerHTML = '';
    setupGame();
    await announce();
    showToast(isHost ? `Room ${roomCode} berhasil dibuat.` : `Kamu bergabung ke room ${roomCode}.`);
  } catch (e) {
    if (channel) { await supabase.removeChannel(channel); channel = null; }
    $('modalError').textContent = e.message || 'Gagal masuk room.';
  } finally { $('confirmCreate').disabled = false; }
}
async function announce() {
  if (!channel) return;
  await channel.track({ id: myId, name: playerName, color: localColor, x: myPos.x, y: myPos.y, host: isHost, joinedAt: Date.now() });
  await channel.send({ type:'broadcast', event:'player-update', payload:{ id:myId, name:playerName, color:localColor, x:myPos.x, y:myPos.y, host:isHost } });
}
function renderCrew() {
  const all = Object.values(players);
  if (!all.some(p => p.id === myId)) all.push({ id:myId, name:playerName, color:localColor, host:isHost, x:myPos.x, y:myPos.y });
  $('playerCount').textContent = `${Math.min(all.length,6)} / 6 PEMAIN`;
  $('crewList').innerHTML = all.slice(0,6).map((p,i)=>`<div class="crew-member"><div class="crew-avatar" style="background:${safeColor(p.color)}">${escapeHTML((p.name||'P').slice(0,1).toUpperCase())}</div><div class="crew-info"><div class="crew-name">${escapeHTML(p.name||'Pemain')}${p.id===myId?' (Kamu)':''}</div><div class="crew-role">${p.host?'PEMBUAT ROOM':'ANGGOTA KRU'}</div></div>${p.host?'<span class="host-tag">HOST</span>':''}</div>`).join('');
}
function safeColor(c) { return /^#[0-9a-f]{6}$/i.test(c||'') ? c : '#9277ff'; }
function escapeHTML(s) { return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function setupGame() {
  if (game) { game.destroy(true); game = null; }
  $('gameMount').innerHTML = '';
  game = new Phaser.Game({
    type: Phaser.AUTO, parent:'gameMount', width:800, height:480, backgroundColor:'#0a1220',
    scale:{ mode:Phaser.Scale.FIT, autoCenter:Phaser.Scale.CENTER_BOTH },
    scene:{ key:'MapScene', create, update }
  });
  function create() {
    const s=this;
    const g=s.add.graphics();
    g.fillStyle(0x0e1b2b,1);g.fillRect(0,0,800,480);
    g.lineStyle(1,0x1d2c40,.8);
    for(let x=0;x<800;x+=40){g.lineBetween(x,0,x,480);}
    for(let y=0;y<480;y+=40){g.lineBetween(0,y,800,y);}
    // Sektor/ruangan bergaya sci-fi
    [[30,35,190,120],[580,35,180,120],[35,325,210,115],[560,325,205,115]].forEach(([x,y,w,h],i)=>{
      g.fillStyle(i%2?0x14253a:0x172238,1);g.fillRoundedRect(x,y,w,h,12);
      g.lineStyle(2,0x344660,1);g.strokeRoundedRect(x,y,w,h,12);
      g.fillStyle(0x6b7f9c,.12);g.fillRect(x+12,y+12,w-24,5);
    });
    g.lineStyle(4,0x293d54,1);g.lineBetween(220,95,580,95);g.lineBetween(245,380,560,380);g.lineBetween(400,95,400,380);
    s.add.text(50,48,'NAVIGATION',{fontFamily:'monospace',fontSize:'10px',color:'#7286a4',letterSpacing:2});
    s.add.text(600,48,'ENGINE ROOM',{fontFamily:'monospace',fontSize:'10px',color:'#7286a4',letterSpacing:1});
    s.add.text(50,338,'LABORATORY',{fontFamily:'monospace',fontSize:'10px',color:'#7286a4',letterSpacing:1});
    s.add.text(580,338,'COMMS',{fontFamily:'monospace',fontSize:'10px',color:'#7286a4',letterSpacing:2});
    this.playersLayer=s.add.container(0,0); this.playerShapes={};
    this.drawPlayers=(data)=>drawCrew(this,data); this.keys=s.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT');
    this.speed=180;
    this.input.on('pointerdown', p=>{ if(p.pointerType==='touch'||p.pointerType==='mouse'){this.target={x:p.worldX,y:p.worldY};}});
    this.drawPlayers(players);
  }
  function update(_,delta) {
    if (!this.playerShapes) return;
    const k=this.keys, speed=this.speed*delta/1000;
    let dx=0,dy=0;
    if(k.A.isDown||k.LEFT.isDown)dx--;if(k.D.isDown||k.RIGHT.isDown)dx++;
    if(k.W.isDown||k.UP.isDown)dy--;if(k.S.isDown||k.DOWN.isDown)dy++;
    if(this.target && dx===0 && dy===0){const vx=this.target.x-myPos.x,vy=this.target.y-myPos.y,d=Math.hypot(vx,vy);if(d>8){dx=vx/d;dy=vy/d;}else this.target=null;}
    if(dx||dy){const n=Math.hypot(dx,dy)||1;myPos.x=Phaser.Math.Clamp(myPos.x+dx/n*speed,25,775);myPos.y=Phaser.Math.Clamp(myPos.y+dy/n*speed,25,455);}
    if(this.playerShapes[myId]){this.playerShapes[myId].setPosition(myPos.x,myPos.y);}
    const now=Date.now();
    if(channel && now-lastBroadcast>90 && (dx||dy)){lastBroadcast=now;channel.send({type:'broadcast',event:'player-update',payload:{id:myId,name:playerName,color:localColor,x:myPos.x,y:myPos.y,host:isHost}});}
  }
}
function leaveRoom() {
  if (channel && supabase) supabase.removeChannel(channel);
  channel=null;roomCode='';started=false;players={};
  if(game){game.destroy(true);game=null;}
  $('gameMount').innerHTML='<div class="game-placeholder"><div class="radar"></div><strong>SEKTOR BELUM AKTIF</strong><span>Gerakkan karakter setelah masuk ke permainan.</span></div>';
  setView(false); showToast('Kamu keluar dari room.');
}
$('createBtn').addEventListener('click',()=>openModal(true));
$('joinToggle').addEventListener('click',()=>{joinForm.classList.toggle('hidden');if(!joinForm.classList.contains('hidden'))$('roomCodeInput').focus();});
$('joinBtn').addEventListener('click',()=>{if(!/^[A-Z0-9]{5}$/.test($('roomCodeInput').value.trim().toUpperCase())){showToast('Masukkan kode room 5 karakter.');return;}openModal(false);});
$('confirmCreate').addEventListener('click',()=>enterRoom($('confirmCreate').dataset.action||'create'));
$('closeModal').addEventListener('click',()=>modal.classList.add('hidden'));
$('cancelModal').addEventListener('click',()=>modal.classList.add('hidden'));
$('leaveBtn').addEventListener('click',leaveRoom);
$('copyCode').addEventListener('click',()=>copyRoom());
$('copyInvite').addEventListener('click',()=>copyRoom());
async function copyRoom(){try{await navigator.clipboard.writeText(roomCode);showToast('Kode room disalin.');}catch{showToast(`Kode room: ${roomCode}`);}}
$('startBtn').addEventListener('click',async()=>{
  if(!isHost||!channel||started)return;
  const count=Object.keys(channel.presenceState()).length;
  const actual=Object.values(channel.presenceState()).flat().length;
  if(actual<3){showToast('Butuh minimal 3 pemain untuk mulai.');return;}
  started=true;$('lobbyTitle').textContent='Misi dimulai';$('startBtn').textContent='Permainan dimulai';$('startBtn').disabled=true;
  await channel.send({type:'broadcast',event:'game-start',payload:{host:myId,at:Date.now()}});
  showToast('Misi dimulai! Game masih dalam tahap beta.');
});
$('nameInput').addEventListener('keydown',e=>{if(e.key==='Enter')enterRoom($('confirmCreate').dataset.action||'create');});
$('roomCodeInput').addEventListener('input',e=>{e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,5);});

// Helper scene function: draw crew as original, simple space-suit characters.
function drawCrew(scene, data) {
  if(!scene.playersLayer) return;
  scene.playersLayer.removeAll(true); scene.playerShapes={};
  const all=Object.values(data);
  if(!all.some(p=>p.id===myId)) all.push({id:myId,name:playerName,color:localColor,x:myPos.x,y:myPos.y,host:isHost});
  for(const p of all.slice(0,6)){
    const c=safeColor(p.color), x=p.id===myId?myPos.x:(Number.isFinite(p.x)?p.x:400), y=p.id===myId?myPos.y:(Number.isFinite(p.y)?p.y:240);
    const cont=scene.add.container(x,y);
    const shadow=scene.add.ellipse(0,20,40,12,0x000000,.28);
    const body=scene.add.graphics();body.fillStyle(parseInt(c.slice(1),16),1);body.fillRoundedRect(-15,-18,30,38,11);body.fillRoundedRect(-14,9,10,15,4);body.fillRoundedRect(4,9,10,15,4);body.fillRoundedRect(-20,-8,8,21,4);
    body.fillStyle(0xffffff,.2);body.fillRoundedRect(-10,-14,6,19,3);
    const visor=scene.add.graphics();visor.fillStyle(0xdafaff,1);visor.fillRoundedRect(-10,-12,23,12,6);visor.fillStyle(0x6aa8c4,.8);visor.fillRoundedRect(-7,-9,16,7,4);
    const label=scene.add.text(0,-34,(p.name||'Pemain').slice(0,12),{fontFamily:'Arial',fontSize:'11px',fontStyle:p.id===myId?'bold':'normal',color:'#edf3ff',stroke:'#080d17',strokeThickness:3}).setOrigin(.5);
    cont.add([shadow,body,visor,label]);scene.playersLayer.add(cont);scene.playerShapes[p.id]=cont;
  }
}
const originalCreate = create; // scene callbacks are wrapped by Phaser; attach public renderer via prototype-safe scene lookup
// Patch method on current/future scene through the scene config's create/update wrapper above.
const oldSetupGame = setupGame;
setupGame = function() {
  oldSetupGame();
  const attach = () => {
    if(!game) return;
    const s=game.scene.getScene('MapScene');
    if(s && !s.__fangusDrawPatched) {
      s.drawPlayers=(data)=>drawCrew(s,data);
      s.__fangusDrawPatched=true;
      if(s.sys.isActive())s.drawPlayers(players);
    }
  };
  setTimeout(attach,100); setTimeout(attach,500);
};
window.addEventListener('beforeunload',()=>{if(channel&&supabase)supabase.removeChannel(channel);});
