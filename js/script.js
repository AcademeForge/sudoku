/* ═══════════ STUDENT DATA — CACHED ═══════════ */
function getAFStudent(){
  const live={
    name:      localStorage.getItem('af_student_name')||'',
    phone:     localStorage.getItem('af_student_mobile')||localStorage.getItem('af_student_phone')||'',
    email:     localStorage.getItem('af_student_email')||'',
    studentId: localStorage.getItem('af_student_id')||'',
    uuid:      localStorage.getItem('af_student_uuid')||'',
    profilePhoto: localStorage.getItem('af_student_photo')||'',
    loggedIn:  localStorage.getItem('af_student_logged_in')==='true'
  };
  if(live.studentId){
    localStorage.setItem('sm_cached_student',JSON.stringify({...live,ca:Date.now()}));
    return live;
  }
  try{
    const c=JSON.parse(localStorage.getItem('sm_cached_student')||'null');
    if(c&&c.studentId)return c;
  }catch(e){}
  return{name:'',phone:'',email:'',studentId:'',uuid:'',profilePhoto:'',loggedIn:false};
}

function getXp()    {return nxdbPlayer?(nxdbPlayer.xp||0)         :localData.xp;}
function getLevel() {return nxdbPlayer?(nxdbPlayer.level||1)      :localData.level;}
function getWins()  {return nxdbStats ?(nxdbStats.games_won||0)   :localData.wins;}
function getPlayed(){return nxdbStats ?(nxdbStats.games_played||0):localData.played;}
function getBestTime(){return nxdbStats?(nxdbStats.best_time||0)  :localData.bestTime;}
function getStreak(){return nxdbPlayer?(nxdbPlayer.streak||0)     :localData.streak;}
function getRank()  {return nxdbPlayer?(nxdbPlayer.rank||0)       :localData.globalRank;}

function computeLevel(xp){let lv=1,t=0;while(t+lv*500<=xp){t+=lv*500;lv++;}return lv;}
function xpForLevel(xp){let lv=1,t=0;while(t+lv*500<=xp){t+=lv*500;lv++;}return{level:lv,progress:xp-t,needed:lv*500};}

function getTier(level){
  if(level>=25)return{name:'Heroic', css:'tier-heroic', icon:'⚔️'};
  if(level>=20)return{name:'Diamond',css:'tier-diamond',icon:'💎'};
  if(level>=15)return{name:'Platinum',css:'tier-platinum',icon:'🔷'};
  if(level>=10)return{name:'Gold',   css:'tier-gold',   icon:'🥇'};
  if(level>=5) return{name:'Silver', css:'tier-silver', icon:'🥈'};
  return{name:'Bronze',css:'tier-bronze',icon:'🥉'};
}

function fmtTime(s){const m=Math.floor(s/60),r=s%60;return m>0?`${m}m ${r}s`:`${r}s`;}

// Win streak bonus: 3 wins = +5, 4 = +10, 5 = +15 etc.
function getStreakBonus(cw){
  if(cw<3)return 0;
  return (cw-2)*5;
}

/* ═══════════ LOCAL STORAGE ═══════════ */
function loadLocal(){
  try{const s=localStorage.getItem('sm_local3');if(s)localData={...localData,...JSON.parse(s)};}catch(e){}
  consecutiveWins=localData.consecutiveWins||0;
}
function saveLocal(){localStorage.setItem('sm_local3',JSON.stringify(localData));}
function addLocalXp(amount){localData.xp+=amount;localData.level=computeLevel(localData.xp);saveLocal();}
function loadOfflineQueue(){
  try{const s=localStorage.getItem('sm_oq3');if(s)offlineQueue=JSON.parse(s)||[];}catch(e){offlineQueue=[];}
}
function saveOfflineQueue(){localStorage.setItem('sm_oq3',JSON.stringify(offlineQueue));}
function updateOfflineSub(){
  const el=document.getElementById('offlineSyncSub');if(!el)return;
  const n=offlineQueue.length;
  el.textContent=n>0?`${n} game${n>1?'s':''} pending sync`:'No pending games';
}

/* ═══════════ ONLINE/OFFLINE ═══════════ */
function setOnlineState(online){
  _isOnline=online;
  document.getElementById('offlineBanner').classList.toggle('show',!online);
  if(online)flushOfflineQueue();
}
window.addEventListener('online',()=>setOnlineState(true));
window.addEventListener('offline',()=>setOnlineState(false));

/* ═══════════ OFFLINE FLUSH ═══════════ */
async function flushOfflineQueue(){
  const af=getAFStudent();
  if(!af.loggedIn||!af.studentId||!_isOnline||!offlineQueue.length)return;
  if(_syncInProgress)return;
  _syncInProgress=true;
  const toFlush=[...offlineQueue];let flushed=0;
  for(const item of toFlush){
    try{
      await nxdbApi(NXDB_PROGRESS_URL,{...item,action:'save',student_id:af.studentId});
      offlineQueue=offlineQueue.filter(q=>q._id!==item._id);flushed++;
    }catch(e){break;}
  }
  saveOfflineQueue();updateOfflineSub();_syncInProgress=false;
  if(flushed>0){toast(`${flushed} game${flushed>1?'s':''} synced!`,'','success',3000);await doRefresh();}
}

/* ═══════════ API ═══════════ */
async function nxdbApi(url,payload){
  const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  const data=await res.json();
  if(!res.ok)throw new Error(data.message||data.error||'Error');
  return data;
}

/* ═══════════ REFRESH ═══════════ */
async function doRefresh(){
  const af=getAFStudent();
  if(!af.loggedIn||!af.studentId||!_isOnline){refreshUI();return;}
  try{
    const res=await nxdbApi(NXDB_API_URL,{
      action:'sync',student_id:af.studentId,
      name:af.name,email:af.email,phone:af.phone,profile_photo:af.profilePhoto||''
    });
    if(res.player)nxdbPlayer=res.player;
    if(res.stats) nxdbStats=res.stats;
    if(res.achievements)nxdbAchievements=res.achievements;
    loadLeaderboard().catch(()=>{});
    flushOfflineQueue().catch(()=>{});
  }catch(e){console.warn('Sync failed:',e);}
  refreshUI();
}

/* ═══════════ SAVE PROGRESS ═══════════ */
async function saveGameProgress({won,time,mistakes:m,hintsUsed,difficulty,boardSz,isD,xpEarned,perfect,noHints}){
  const af=getAFStudent();
  if(!af.loggedIn||!af.studentId)return null;
  const payload={action:'save',student_id:af.studentId,won,time_seconds:time||0,
    mistakes:m,hints_used:hintsUsed,difficulty,board_size:boardSz,is_daily:isD||false,
    xp_earned:xpEarned||0,perfect:perfect||false,no_hints:noHints||false};
  if(!_isOnline){
    payload._id=Date.now()+'_'+Math.random().toString(36).slice(2,7);
    offlineQueue.push(payload);saveOfflineQueue();updateOfflineSub();return null;
  }
  const badge=document.getElementById('savingBadge');
  if(badge)badge.classList.add('show');
  try{
    const res=await nxdbApi(NXDB_PROGRESS_URL,payload);
    if(res.player)nxdbPlayer=res.player;
    if(res.stats) nxdbStats=res.stats;
    return res;
  }catch(e){
    payload._id=Date.now()+'_'+Math.random().toString(36).slice(2,7);
    offlineQueue.push(payload);saveOfflineQueue();updateOfflineSub();return null;
  }finally{if(badge)badge.classList.remove('show');}
}

/* ═══════════ ACHIEVEMENTS ═══════════ */
async function syncAchievements(){
  const af=getAFStudent();
  if(!af.loggedIn||!af.studentId||!_isOnline)return;
  const stats=buildAchStats();
  try{
    const res=await nxdbApi(NXDB_ACHIEVEMENT_URL,{action:'sync',student_id:af.studentId,stats});
    if(res.achievements)nxdbAchievements=res.achievements;
    if(res.newly_unlocked&&res.newly_unlocked.length){
      const ul=ACHIEVEMENTS.filter(a=>res.newly_unlocked.includes(a.id));
      ul.forEach(a=>toast(`Achievement Unlocked! ${a.icon}`,a.name,'success',4000));
    }
    buildAchUI();
  }catch(e){}
}
function buildAchStats(){
  return{wins:getWins(),streak:getStreak(),bestTime:getBestTime(),
    perfectGames:localData.perfectGames,dailyChallenges:localData.dailyChallenges,
    noHintWins:localData.noHintWins,level:getLevel(),globalRank:getRank()};
}
function buildAchUI(){
  const grid=document.getElementById('achGrid');if(!grid)return;
  const stats=buildAchStats();
  const unlockedIds=nxdbAchievements.map(a=>a.achievement_id||a.id);
  grid.innerHTML=ACHIEVEMENTS.map(a=>{
    const unlocked=unlockedIds.includes(a.id)||a.condition(stats);
    return`<div class="ach-card ${unlocked?'unlocked':'locked'}">
      <div class="ach-icon">${a.icon}</div>
      <div class="ach-name">${a.name}</div>
    </div>`;
  }).join('');
}

/* ═══════════ TOAST ═══════════ */
function toast(title,msg='',type='info',dur=3000){
  const icons={success:'✅',error:'❌',warning:'⚠️',info:'ℹ️'};
  const wrap=document.getElementById('toastWrap');
  const el=document.createElement('div');
  el.className=`toast ${type}`;
  el.innerHTML=`<span class="toast-ico">${icons[type]}</span>
    <div class="toast-body">
      <div class="toast-ttl">${title}</div>
      ${msg?`<div class="toast-msg">${msg}</div>`:''}
    </div>
    <button class="toast-x" onclick="this.parentElement.remove()">✕</button>
    <div class="toast-bar" style="animation-duration:${dur}ms"></div>`;
  wrap.appendChild(el);
  setTimeout(()=>{el.classList.add('out');setTimeout(()=>el.remove(),220);},dur);
}

/* ═══════════ MODALS ═══════════ */
function openModal(id){document.getElementById(id).classList.add('show');}
function closeModal(id){document.getElementById(id).classList.remove('show');}
document.querySelectorAll('.modal').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)m.classList.remove('show');}));
function showConfirm({title,msg,icon='⚠️',onConfirm}){
  document.getElementById('confirmTitle').textContent=title||'Are you sure?';
  document.getElementById('confirmMsg').textContent=msg||'';
  document.getElementById('confirmIcon').textContent=icon;
  confirmCallback=onConfirm;openModal('confirmModal');
}
document.getElementById('confirmOkBtn').addEventListener('click',()=>{
  closeModal('confirmModal');if(typeof confirmCallback==='function')confirmCallback();
});

/* ═══════════ SCREEN NAV ═══════════ */
function openScreen(id){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  const btn=document.querySelector(`.nav-btn[data-screen="${id}"]`);
  if(btn)btn.classList.add('active');
  const labels={homeScreen:'Sudoku Master',playScreen:'Play',profileScreen:'Profile',leaderboardScreen:'Rankings',settingsScreen:'Settings'};
  document.getElementById('hdrSub').textContent=labels[id]||'Sudoku Master';
  if(id==='leaderboardScreen')loadLeaderboard();
  if(id==='profileScreen'){buildAchUI();refreshUI();}
  if(id==='homeScreen')refreshUI();
}
function navToPlay(){
  openScreen('playScreen');
  if(gameActive){
    document.getElementById('setupView').style.display='none';
    document.getElementById('gameView').style.display='block';
  }else{
    document.getElementById('setupView').style.display='block';
    document.getElementById('gameView').style.display='none';
  }
}

/* ═══════════ GLOBAL UI REFRESH ═══════════ */
function refreshUI(){
  const af=getAFStudent();
  const xp=getXp(),level=getLevel(),wins=getWins(),played=getPlayed(),best=getBestTime();
  const xpData=xpForLevel(xp),tier=getTier(level),rank=getRank();
  const displayName=(af.loggedIn&&af.name)?af.name:(nxdbPlayer?.name||localStorage.getItem('sm_nxdb_username')||'Guest Player');
  const displayAvatar=localStorage.getItem('af_student_avatar')||localStorage.getItem('sm_nxdb_avatar')||(af.loggedIn?'🎓':'😀');

  document.getElementById('headerAvatarBtn').textContent=displayAvatar;
  document.getElementById('heroEyebrow').textContent=`⚡ Level ${level} · ${tier.icon} ${tier.name}`;
  document.getElementById('heroName').textContent=displayName;
  document.getElementById('heroId').textContent=af.studentId?`ID: ${af.studentId}`:'';
  document.getElementById('stLevel').textContent=level;
  document.getElementById('stWins').textContent=wins;
  document.getElementById('stStreak').textContent=getStreak();
  if(rank>0)updateRankUI(rank);
  document.getElementById('xpLvLabel').textContent=`Level ${level}`;
  document.getElementById('xpNums').textContent=`${xpData.progress.toLocaleString()} / ${xpData.needed.toLocaleString()} XP`;
  document.getElementById('xpFill').style.width=`${Math.min(100,Math.round(xpData.progress/xpData.needed*100))}%`;

  // Daily card
  const dailyCfg=getTodayDailyConfig();
  const today=new Date().toDateString(),todayDone=localData.dailyDone===today;
  const dailyXpKey=`daily_${dailyCfg.size}_${dailyCfg.diff}`;
  const dailyXp=XP_TABLE[dailyXpKey]||500;
  document.getElementById('dailyTitle').textContent=todayDone?'✅ Completed! Come back tomorrow.':'Today\'s Challenge';
  document.getElementById('dailyType').textContent=`🧩 ${dailyCfg.size}×${dailyCfg.size} ${DIFF_CONFIG[dailyCfg.diff].label}`;
  document.getElementById('dailyMeta').textContent=todayDone?'New challenge at midnight':`+${dailyXp} Bonus XP`;

  document.getElementById('qsWins').textContent=wins;
  document.getElementById('qsPlayed').textContent=played;
  document.getElementById('qsWinRate').textContent=played>0?`${Math.round(wins/played*100)}%`:'0%';

  document.getElementById('profileAvatar').textContent=displayAvatar;
  document.getElementById('profileName').textContent=displayName;
  document.getElementById('profileLevelBadge').textContent=`⚡ Level ${level}`;
  const tb=document.getElementById('profileTierBadge');
  tb.textContent=`${tier.icon} ${tier.name}`;tb.className=`tier-badge ${tier.css}`;
  document.getElementById('profileEmail').textContent=nxdbPlayer?.email||af.email||'';
  const syncEl=document.getElementById('syncStatus');
  if(syncEl){
    if(!_isOnline){syncEl.textContent='📡 Offline — playing locally';}
    else if(nxdbPlayer){syncEl.textContent='☁️ Cloud synced';}
    else if(af.loggedIn){syncEl.textContent='⏳ Syncing…';}
    else syncEl.textContent='';
  }
  document.getElementById('pxpLv').textContent=`Level ${level}`;
  document.getElementById('pxpNums').textContent=`${xpData.progress.toLocaleString()} / ${xpData.needed.toLocaleString()} XP`;
  document.getElementById('pxpFill').style.width=`${Math.min(100,Math.round(xpData.progress/xpData.needed*100))}%`;
  document.getElementById('pxpRemaining').textContent=`${(xpData.needed-xpData.progress).toLocaleString()} XP to Level ${level+1}`;
  document.getElementById('pTotalXp').textContent=xp.toLocaleString();
  document.getElementById('pWins').textContent=wins;
  document.getElementById('pPlayed').textContent=played;
  document.getElementById('pWinRate').textContent=played>0?`${Math.round(wins/played*100)}%`:'0%';
  document.getElementById('pBestTime').textContent=best?fmtTime(best):'—';
  if(rank>0)document.getElementById('pGlobalRank').textContent=`#${rank}`;

  const afCard=document.getElementById('afProfileCard');
  if(af.loggedIn&&af.name){
    afCard.style.display='block';
    document.getElementById('afpcName').textContent=af.name||'—';
    document.getElementById('afpcPhone').textContent=af.phone||'—';
    document.getElementById('afpcEmail').textContent=af.email||'—';
    document.getElementById('afpcSid').textContent=af.studentId||'—';
  }else{afCard.style.display='none';}

  buildAchUI();updateOfflineSub();

  // Update win streak banner in game view
  updateStreakBanner();
}

function updateStreakBanner(){
  const banner=document.getElementById('winStreakBanner');
  const cw=consecutiveWins;
  if(!banner)return;
  if(cw>=3&&gameActive){
    banner.style.display='flex';
    document.getElementById('streakBannerText').textContent=`${cw}-Win Streak! 🔥`;
    const bonus=getStreakBonus(cw);
    document.getElementById('streakBannerBonus').textContent=`+${bonus} XP bonus`;
  }else{
    banner.style.display='none';
  }
}

/* ═══════════ SETUP FLOW ═══════════ */
function selectBoard(size){
  setupBoard=size;
  document.querySelectorAll('.board-card').forEach(c=>c.classList.toggle('selected',Number(c.dataset.board)===size));
  document.getElementById('step1Next').disabled=false;
}
function buildDiffOptions(){
  const list=document.getElementById('diffList');if(!list)return;
  list.innerHTML=['easy','moderate','hard'].map(d=>{
    const c=DIFF_CONFIG[d],xp=XP_TABLE[`${setupBoard||9}-${d}`]||50;
    return`<div class="diff-card${setupDiff===d?' selected':''}" data-diff="${d}" onclick="selectDiff('${d}')">
      <div class="diff-icon">${c.icon}</div>
      <div class="diff-info"><div class="diff-name">${c.label}</div><div class="diff-desc">${c.desc}</div></div>
      <div class="diff-xp-badge">+${xp} XP</div>
    </div>`;
  }).join('');
}
function selectDiff(d){
  setupDiff=d;
  document.querySelectorAll('.diff-card').forEach(c=>c.classList.toggle('selected',c.dataset.diff===d));
  document.getElementById('step2Next').disabled=false;
}
function goStep(step){
  if(step===2&&!setupBoard){toast('Pick a board size first','','warning');return;}
  if(step===3&&!setupDiff){toast('Pick a difficulty','','warning');return;}
  [1,2,3].forEach(i=>{
    document.getElementById(`sd${i}`).classList.toggle('active',i===step);
    document.getElementById(`sd${i}`).classList.toggle('done',i<step);
  });
  [1,2].forEach(i=>document.getElementById(`sl${i}`)?.classList.toggle('done',i<step));
  document.querySelectorAll('.step-panel').forEach(p=>p.classList.remove('active'));
  document.getElementById(`step${step}`).classList.add('active');
  if(step===2)buildDiffOptions();
  if(step===3)updateSummary();
}
function updateSummary(){
  const sz=setupBoard,d=setupDiff;
  const xp=XP_TABLE[`${sz}-${d}`]||50,lim=BOARD_LIMITS[sz],cfg=DIFF_CONFIG[d];
  document.getElementById('ssIcon').textContent=cfg.icon;
  document.getElementById('ssDesc').textContent=`${sz}×${sz} ${cfg.label}`;
  document.getElementById('ssBoard').textContent=`${sz}×${sz}`;
  document.getElementById('ssDiff').textContent=cfg.label;
  document.getElementById('ssHints').textContent=`${lim.hints} Hints`;
  document.getElementById('ssLives').textContent=`${lim.maxLives} Lives`;
  document.getElementById('ssXp').textContent=`+${xp} XP`;
}

/* ═══════════ DAILY CHALLENGE ═══════════ */
function startDailyChallenge(){
  const today=new Date().toDateString();
  if(localData.dailyDone===today){openModal('dailyDoneModal');return;}
  const cfg=getTodayDailyConfig();
  isDaily=true;setupBoard=cfg.size;setupDiff=cfg.diff;
  startGame();
}

/* ═══════════ EDIT PROFILE ═══════════ */
function openEditProfile(){
  const username=nxdbPlayer?.name||localStorage.getItem('sm_nxdb_username')||'';
  document.getElementById('editUsername').value=username;
  editSelectedAvatar=localStorage.getItem('sm_nxdb_avatar')||'😀';
  const grid=document.getElementById('editAvatarGrid');grid.innerHTML='';
  AVATARS.forEach(av=>{
    const btn=document.createElement('button');btn.type='button';
    btn.style.cssText=`height:40px;font-size:1.25rem;border-radius:8px;background:var(--surf-3);border:2px solid ${av===editSelectedAvatar?'var(--pri)':'transparent'};transition:all .12s;cursor:pointer`;
    btn.textContent=av;
    btn.onclick=()=>{
      grid.querySelectorAll('button').forEach(b=>{b.style.borderColor='transparent';b.style.background='var(--surf-3)';});
      btn.style.borderColor='var(--pri)';btn.style.background='var(--pri-bg)';
      editSelectedAvatar=av;
    };
    grid.appendChild(btn);
  });
  openModal('editProfileModal');
}
async function saveProfileEdit(){
  const username=document.getElementById('editUsername').value.trim();
  if(username.length<3){toast('Min 3 characters','','warning');return;}
  localStorage.setItem('sm_nxdb_username',username);
  localStorage.setItem('sm_nxdb_avatar',editSelectedAvatar);
  const af=getAFStudent();
  if(af.loggedIn&&af.studentId&&nxdbPlayer&&_isOnline){
    try{await nxdbApi(NXDB_API_URL,{action:'update-profile',student_id:af.studentId,display_name:username,avatar:editSelectedAvatar});}catch(e){}
  }
  closeModal('editProfileModal');toast('Profile updated!','','success');refreshUI();
}

/* ═══════════ SETTINGS ═══════════ */
function confirmResetProgress(){
  showConfirm({title:'Reset Local Data',msg:'Cloud data is safe.',icon:'🗑️',onConfirm(){
    localData={xp:0,level:1,wins:0,played:0,bestTime:0,streak:0,lastPlayDate:null,perfectGames:0,dailyChallenges:0,noHintWins:0,dailyDone:null,globalRank:0,consecutiveWins:0};
    consecutiveWins=0;offlineQueue=[];saveLocal();saveOfflineQueue();refreshUI();
    toast('Local data cleared','','info');
  }});
}

/* ═══════════ ONBOARDING ═══════════ */
const ONBOARD_STEPS=[
  {ico:'🧩',title:'Welcome to Sudoku Master!',desc:'Fill the grid so every row, column, and box contains each number exactly once. Earn XP, level up, and climb the rankings!',hl:null},
  {ico:'🎮',title:'Start a Game',desc:'Tap Play at the bottom to choose your board size (4×4 for quick sessions or 9×9 for the full challenge) and your difficulty.',hlIcon:'🎮',hlText:'Tap "Play" in the bottom bar to begin a game anytime'},
  {ico:'🗓️',title:'Daily Challenge',desc:'A fresh puzzle drops every day on your Home screen. Complete it for massive XP bonus — up to +500 XP!',hlIcon:'🗓️',hlText:'The Daily Challenge card is on your Home screen. Tap it to play!'},
  {ico:'💡',title:'Game Tools',desc:'Inside a game you have Notes mode for pencil marks, Erase to clear a cell, Hints if you\'re stuck, and Auto-Solve to reveal the answer (no XP).',hlIcon:'📝',hlText:'Notes · Erase · Hint · Solve — these appear above the board during a game'},
  {ico:'🔥',title:'Win Streaks & XP',desc:'Win 3 games in a row for a +5 XP bonus, 4 in a row for +10, 5 for +15, and so on. Perfect games and no-hint clears earn extra too!',hlIcon:'🏆',hlText:'Check your XP progress anytime on your Profile tab'},
  {ico:'🚀',title:'You\'re Ready!',desc:'Compete on the global leaderboard, unlock achievements, and become a Sudoku Master. Good luck! 🎓',hl:null}
];
let obStep=0;
function showOnboarding(){
  obStep=0;
  document.getElementById('onboardOverlay').classList.remove('hidden');
  renderObStep();
}
function renderObStep(){
  const s=ONBOARD_STEPS[obStep];
  const dots=document.getElementById('obDots');
  dots.innerHTML=ONBOARD_STEPS.map((_,i)=>`<div class="ob-dot ${i===obStep?'active':''}"></div>`).join('');
  document.getElementById('obIco').textContent=s.ico;
  document.getElementById('obTitle').textContent=s.title;
  document.getElementById('obDesc').textContent=s.desc;
  const hl=document.getElementById('obHighlight');
  if(s.hlIcon){
    hl.style.display='flex';
    document.getElementById('obHlIcon').textContent=s.hlIcon;
    document.getElementById('obHlText').textContent=s.hlText;
  }else{hl.style.display='none';}
  const btn=document.getElementById('obNextBtn');
  const isLast=obStep===ONBOARD_STEPS.length-1;
  btn.textContent=isLast?'Start Playing! 🚀':'Next →';
  btn.className=isLast?'ob-finish':'ob-next';
}
function nextOnboardStep(){
  if(obStep<ONBOARD_STEPS.length-1){
    obStep++;renderObStep();
  }else{
    skipOnboarding();
  }
}
function skipOnboarding(){
  document.getElementById('onboardOverlay').classList.add('hidden');
  localStorage.setItem('sm_onboarded','1');
}

/* ═══════════ KEYBOARD ═══════════ */
document.addEventListener('keydown',e=>{
  if(!gameActive)return;
  const num=parseInt(e.key);
  if(num>=1&&num<=boardSize){placeNumber(num);return;}
  if(e.key==='Backspace'||e.key==='Delete'){eraseCell();return;}
  if(!selectedCell)return;
  let{row,col}=selectedCell;const sz=boardSize;
  const dirs={ArrowUp:[-1,0],ArrowDown:[1,0],ArrowLeft:[0,-1],ArrowRight:[0,1]};
  if(dirs[e.key]){
    e.preventDefault();
    row=Math.max(0,Math.min(sz-1,row+dirs[e.key][0]));
    col=Math.max(0,Math.min(sz-1,col+dirs[e.key][1]));
    selectCellFn(row,col);
  }
});

/* ═══════════ SWIPE NAV ═══════════ */
const SCREEN_ORDER=['homeScreen','playScreen','profileScreen','leaderboardScreen','settingsScreen'];
let swipeStartX=0,swipeStartY=0,swipeT=0;
const appEl=document.querySelector('.app');
if(appEl){
  appEl.addEventListener('touchstart',e=>{swipeStartX=e.changedTouches[0].clientX;swipeStartY=e.changedTouches[0].clientY;swipeT=Date.now();},{passive:true});
  appEl.addEventListener('touchend',e=>{
    const dx=e.changedTouches[0].clientX-swipeStartX,dy=e.changedTouches[0].clientY-swipeStartY;
    if(Math.abs(dy)>Math.abs(dx)||Math.abs(dx)<90||Date.now()-swipeT>600)return;
    if(e.target.closest('.modal,.modal-sheet,.onboard-sheet,#editAvatarGrid'))return;
    const activeBtn=document.querySelector('.bottom-nav .nav-btn.active');
    if(!activeBtn)return;
    const cur=SCREEN_ORDER.indexOf(activeBtn.dataset.screen);if(cur===-1)return;
    if(dx<0&&cur<SCREEN_ORDER.length-1){const n=SCREEN_ORDER[cur+1];n==='playScreen'?navToPlay():openScreen(n);}
    if(dx>0&&cur>0){const p=SCREEN_ORDER[cur-1];p==='playScreen'?navToPlay():openScreen(p);}
  },{passive:true});
}

/* ═══════════ CROSS-TAB STORAGE SYNC ═══════════ */
window.addEventListener('storage',e=>{
  const afKeys=['af_student_name','af_student_mobile','af_student_email','af_student_logged_in','af_student_id','af_student_uuid'];
  if(afKeys.includes(e.key)){
    refreshUI();
    const af=getAFStudent();
    if(af.loggedIn&&af.studentId&&_isOnline)doRefresh().catch(()=>{});
  }
});

/* ═══════════ SECURITY ═══════════ */
document.addEventListener('contextmenu',e=>e.preventDefault());
document.addEventListener('keydown',e=>{
  if(e.key==='F12'||(e.ctrlKey&&e.shiftKey&&['i','j','c'].includes(e.key.toLowerCase()))||(e.ctrlKey&&['u','s'].includes(e.key.toLowerCase())))e.preventDefault();
});
document.addEventListener('selectstart',e=>e.preventDefault());
document.addEventListener('copy',e=>e.preventDefault());
document.addEventListener('dragstart',e=>e.preventDefault());
window.addEventListener('wheel',e=>{if(e.ctrlKey)e.preventDefault();},{passive:false});
document.addEventListener('touchmove',e=>{if(e.touches.length>1)e.preventDefault();},{passive:false});
let lastTap=0;document.addEventListener('touchend',e=>{const n=Date.now();if(n-lastTap<=300)e.preventDefault();lastTap=n;},false);

/* ═══════════ LOGOUT ═══════════ */
window.doLogout = function() {
  localStorage.clear();
  window.location.replace('index.html');
};

/* ═══════════ INIT ═══════════ */
async function init(){
  try{
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(err => console.error('SW registration failed:', err));
    }
    loadLocal();loadOfflineQueue();setOnlineState(navigator.onLine);
    consecutiveWins=localData.consecutiveWins||0;
    refreshUI();
    const af=getAFStudent();
    if(af.loggedIn&&af.name){
      setTimeout(()=>toast(`Hi, ${af.name.split(' ')[0]}! 👋`,_isOnline?'Syncing…':'Playing offline','success',2800),500);
    }
    if(_isOnline){doRefresh().then(()=>refreshUI()).catch(()=>{});}
    updateOfflineSub();
    // Onboarding — only on first visit
    if(!localStorage.getItem('sm_onboarded')){
      setTimeout(showOnboarding,800);
    }
  }catch(err){console.error('Init error:',err);}
}
init();
