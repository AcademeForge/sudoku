/* ═══════════ GAME START ═══════════ */
function startGame(){
  if(setupBoard)boardSize=setupBoard;
  if(setupDiff) currentDiff=setupDiff;
  const lim=BOARD_LIMITS[boardSize];
  hints=lim.hints;maxLives=lim.maxLives;
  mistakes=0;usedHints=0;notesMode=false;gameActive=true;selectedCell=null;
  document.getElementById('notesBtn').classList.remove('active');
  document.getElementById('setupView').style.display='none';
  document.getElementById('gameView').style.display='block';
  boardSize===4?create4x4():create9x9();
  const cfg=DIFF_CONFIG[currentDiff],xp=XP_TABLE[`${boardSize}-${currentDiff}`]||50;
  document.getElementById('gameTitle').textContent=boardSize===4?'⚡ Quick Play':'🧩 Classic';
  const db=document.getElementById('gameDiffBadge');
  db.textContent=cfg.label;db.className=`pill ${cfg.badge}`;
  document.getElementById('gameSubtitle').textContent=`${boardSize}×${boardSize}`;
  document.getElementById('gameRewardPreview').textContent=`+${xp} XP`;
  document.getElementById('diffDisplay').textContent=cfg.label;
  renderLives();renderHints();renderBoard();renderNumpad();
  startTimer();openScreen('playScreen');
  updateStreakBanner();
}

// Quick rematch: same settings, instant restart
function quickRematch(){
  gameActive=false;
  clearInterval(timerIv);
  startGame();
}

function newGameSetup(){
  setupBoard=null;setupDiff=null;
  document.getElementById('setupView').style.display='block';
  document.getElementById('gameView').style.display='none';
  goStep(1);
  document.querySelectorAll('.board-card').forEach(c=>c.classList.remove('selected'));
  document.getElementById('step1Next').disabled=true;
  document.getElementById('step2Next').disabled=true;
  openScreen('playScreen');
}

/* ═══════════ PUZZLE GENERATORS ═══════════ */
function shuffle(arr){const a=[...arr];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function create4x4(){
  const bases=[
    [[1,2,3,4],[3,4,1,2],[2,1,4,3],[4,3,2,1]],
    [[1,2,3,4],[3,4,1,2],[4,3,2,1],[2,1,4,3]],
    [[2,1,4,3],[4,3,2,1],[1,2,3,4],[3,4,1,2]],
  ];
  solution=bases[Math.floor(Math.random()*bases.length)];puzzle=solution.map(r=>[...r]);
  const rm={easy:4,moderate:7,hard:10};let remove=rm[currentDiff]||4,tries=0;
  while(remove>0&&tries<200){const r=Math.floor(Math.random()*4),c=Math.floor(Math.random()*4);if(puzzle[r][c]!==0){puzzle[r][c]=0;remove--;}tries++;}
}
function create9x9(){
  const base=[[1,2,3,4,5,6,7,8,9],[4,5,6,7,8,9,1,2,3],[7,8,9,1,2,3,4,5,6],[2,3,4,5,6,7,8,9,1],[5,6,7,8,9,1,2,3,4],[8,9,1,2,3,4,5,6,7],[3,4,5,6,7,8,9,1,2],[6,7,8,9,1,2,3,4,5],[9,1,2,3,4,5,6,7,8]];
  const nums=shuffle([1,2,3,4,5,6,7,8,9]);
  solution=base.map(row=>row.map(n=>nums[n-1]));puzzle=solution.map(r=>[...r]);
  const rm={easy:30,moderate:42,hard:54};let remove=rm[currentDiff]||30,tries=0;
  while(remove>0&&tries<1000){const r=Math.floor(Math.random()*9),c=Math.floor(Math.random()*9);if(puzzle[r][c]!==0){puzzle[r][c]=0;remove--;}tries++;}
}

/* ═══════════ BOARD RENDER ═══════════ */
function renderBoard(){
  const board=document.getElementById('sudokuBoard');
  board.innerHTML='';board.className=`sudoku-board g${boardSize}`;selectedCell=null;
  puzzle.forEach((row,ri)=>row.forEach((val,ci)=>{
    const cell=document.createElement('div');
    cell.className='cell';cell.dataset.row=ri;cell.dataset.col=ci;
    if(val!==0){cell.textContent=val;cell.classList.add('fixed');}
    cell.addEventListener('click',()=>selectCellFn(ri,ci));
    board.appendChild(cell);
  }));
}
function selectCellFn(row,col){
  document.querySelectorAll('.cell').forEach(c=>c.classList.remove('selected','highlight','same-val'));
  const el=getCellEl(row,col);if(!el)return;
  selectedCell={row,col,el};el.classList.add('selected');
  const val=puzzle[row][col],sz=boardSize;
  document.querySelectorAll('.cell').forEach(c=>{
    if(c===el)return;
    const r=+c.dataset.row,co=+c.dataset.col;
    let hl=r===row||co===col;
    if(sz===9)hl|=(Math.floor(r/3)===Math.floor(row/3)&&Math.floor(co/3)===Math.floor(col/3));
    else      hl|=(Math.floor(r/2)===Math.floor(row/2)&&Math.floor(co/2)===Math.floor(col/2));
    if(hl)c.classList.add('highlight');
    else if(val!==0&&puzzle[r][co]===val)c.classList.add('same-val');
  });
}
function getCellEl(r,c){return document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);}

/* ═══════════ NUMPAD ═══════════ */
function renderNumpad(){
  const pad=document.getElementById('numpad');pad.innerHTML='';
  for(let n=1;n<=boardSize;n++){
    const btn=document.createElement('button');
    btn.className='num-btn';btn.textContent=n;
    btn.addEventListener('click',()=>placeNumber(n));
    pad.appendChild(btn);
  }
}
function renderLives(){
  const rem=maxLives-mistakes;
  document.getElementById('livesDisplay').textContent='❤️'.repeat(Math.max(0,rem))+'🤍'.repeat(Math.min(mistakes,maxLives));
}
function renderHints(){document.getElementById('hintsDisplay').textContent=`💡×${hints}`;}

/* ═══════════ TIMER ═══════════ */
function startTimer(){
  clearInterval(timerIv);timerSecs=0;
  document.getElementById('timerDisplay').textContent='00:00';
  timerIv=setInterval(()=>{
    timerSecs++;
    const m=Math.floor(timerSecs/60),s=timerSecs%60;
    document.getElementById('timerDisplay').textContent=`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  },1000);
}

/* ═══════════ GAME ACTIONS ═══════════ */
function placeNumber(num){
  if(!selectedCell||!gameActive)return;
  const{row,col,el}=selectedCell;
  if(el.classList.contains('fixed'))return;
  if(notesMode){
    const existing=el.dataset.notes?el.dataset.notes.split(',').filter(Boolean):[];
    const ns=String(num),idx=existing.indexOf(ns);
    if(idx>-1)existing.splice(idx,1);else existing.push(ns);
    el.dataset.notes=existing.join(',');
    el.textContent=existing.sort().join(' ');
    el.style.fontSize=boardSize===4?'.52rem':'.4rem';el.style.color='var(--t-3)';
    return;
  }
  el.dataset.notes='';el.style.fontSize='';el.style.color='';
  if(solution[row][col]===num){
    puzzle[row][col]=num;el.textContent=num;
    el.classList.remove('wrong');el.classList.add('correct');
    selectCellFn(row,col);checkWin();
  }else{
    mistakes++;renderLives();
    el.classList.add('wrong');
    setTimeout(()=>el.classList.remove('wrong'),700);
    if(mistakes>=maxLives)triggerGameOver();
  }
}
function toggleNotes(){
  notesMode=!notesMode;
  document.getElementById('notesBtn').classList.toggle('active',notesMode);
}
function useHint(){
  if(hints<=0){toast('No hints left','','warning');return;}
  if(!selectedCell){toast('Tap an empty cell first','','info');return;}
  const{row,col,el}=selectedCell;
  if(el.classList.contains('fixed'))return;
  if(puzzle[row][col]===solution[row][col]){toast('Already correct!','','info');return;}
  hints--;usedHints++;renderHints();
  puzzle[row][col]=solution[row][col];
  el.textContent=solution[row][col];el.dataset.notes='';
  el.style.fontSize='';el.style.color='';
  el.classList.remove('wrong');el.classList.add('correct');
  checkWin();
}
function eraseCell(){
  if(!selectedCell)return;
  const{row,col,el}=selectedCell;
  if(el.classList.contains('fixed'))return;
  puzzle[row][col]=0;el.textContent='';el.dataset.notes='';
  el.style.fontSize='';el.style.color='';el.classList.remove('correct','wrong');
}
function solvePuzzle(){
  showConfirm({title:'Reveal Solution',msg:'No XP will be awarded.',icon:'🎯',onConfirm(){
    clearInterval(timerIv);gameActive=false;
    puzzle=solution.map(r=>[...r]);renderBoard();
    document.querySelectorAll('.cell').forEach(c=>c.classList.add('correct'));
    toast('Solution revealed','','info');
    recordGame(false,0,timerSecs);
  }});
}
function checkBoard(){
  let empty=false,errors=false;
  for(let r=0;r<boardSize;r++)for(let c=0;c<boardSize;c++){
    if(puzzle[r][c]===0){empty=true;continue;}
    if(puzzle[r][c]!==solution[r][c]){
      errors=true;const el=getCellEl(r,c);
      el?.classList.add('wrong');setTimeout(()=>el?.classList.remove('wrong'),1500);
    }
  }
  if(empty)toast('Some cells are still empty','','info');
  else if(errors)toast('Incorrect cells highlighted','','warning');
  else toast('No errors found!','','success',2000);
}
function triggerGameOver(){
  clearInterval(timerIv);gameActive=false;
  consecutiveWins=0;localData.consecutiveWins=0;saveLocal();
  document.getElementById('gameOverMsg').textContent=
    `You used all ${maxLives} lives on ${DIFF_CONFIG[currentDiff].label} ${boardSize}×${boardSize}.`;
  openModal('gameOverModal');
  recordGame(false,0,timerSecs);
}

/* ═══════════ CHECK WIN ═══════════ */
async function checkWin(){
  for(let r=0;r<puzzle.length;r++)
    for(let c=0;c<puzzle[r].length;c++)
      if(puzzle[r][c]!==solution[r][c])return;
  clearInterval(timerIv);gameActive=false;

  // Update consecutive wins
  consecutiveWins++;
  localData.consecutiveWins=consecutiveWins;saveLocal();

  const baseXp=XP_TABLE[`${boardSize}-${currentDiff}`]||50;
  const perfect=mistakes===0,noHints=usedHints===0,daily=isDaily;
  let bonusXp=0;
  if(perfect)bonusXp+=XP_TABLE.perfect;
  if(noHints)bonusXp+=XP_TABLE.nohint;
  if(daily){
    const dailyXpKey=`daily_${boardSize}_${currentDiff}`;
    bonusXp+=XP_TABLE[dailyXpKey]||500;
  }
  const streakBonus=getStreakBonus(consecutiveWins);
  bonusXp+=streakBonus;
  const totalXp=baseXp+bonusXp;
  const prevLevel=getLevel();

  const rows=[
    `<div class="win-row"><span class="win-lbl">⏱ Time</span><span class="win-val">${fmtTime(timerSecs)}</span></div>`,
    `<div class="win-row"><span class="win-lbl">❌ Mistakes</span><span class="win-val">${mistakes}</span></div>`,
    `<div class="win-row"><span class="win-lbl">Base XP</span><span class="win-val xp">+${baseXp} XP</span></div>`,
    perfect?`<div class="win-row"><span class="win-lbl">🎯 Perfect</span><span class="win-val xp">+${XP_TABLE.perfect} XP</span></div>`:'',
    noHints?`<div class="win-row"><span class="win-lbl">🕵️ No Hints</span><span class="win-val xp">+${XP_TABLE.nohint} XP</span></div>`:'',
    daily?  `<div class="win-row"><span class="win-lbl">🗓️ Daily Bonus</span><span class="win-val xp">+${XP_TABLE['daily_'+boardSize+'_'+currentDiff]||500} XP</span></div>`:'',
    streakBonus>0?`<div class="win-row"><span class="win-lbl">🔥 ${consecutiveWins}-Win Streak</span><span class="win-val xp">+${streakBonus} XP</span></div>`:'',
  ].join('');
  const total=`<div class="win-total"><span class="win-total-lbl">Total</span><span class="win-total-val">+${totalXp} XP</span></div>`;
  document.getElementById('winBreakdown').innerHTML=rows+total;
  document.getElementById('levelUpBanner').style.display='none';
  openModal('winModal');
  isDaily=false;
  await recordGame(true,totalXp,timerSecs,perfect,noHints,daily);
  const newLevel=getLevel();
  if(newLevel>prevLevel){
    const banner=document.getElementById('levelUpBanner');
    banner.textContent=`🎉 Level Up! You're now Level ${newLevel} — ${getTier(newLevel).name}!`;
    banner.style.display='block';
    toast(`Level ${newLevel}!`,'You levelled up! 🎉','success',4000);
  }
}

/* ═══════════ RECORD GAME ═══════════ */
async function recordGame(won,xpEarned=0,time=0,perfect=false,noHints=false,daily=false){
  localData.played++;
  if(won){
    localData.wins++;addLocalXp(xpEarned);
    if(perfect)localData.perfectGames++;
    if(noHints)localData.noHintWins++;
    if(!localData.bestTime||(time>0&&time<localData.bestTime))localData.bestTime=time;
    const today=new Date().toDateString(),yesterday=new Date(Date.now()-86400000).toDateString();
    if(localData.lastPlayDate===yesterday)localData.streak++;
    else if(localData.lastPlayDate!==today)localData.streak=1;
    localData.lastPlayDate=today;
    if(daily){localData.dailyDone=today;localData.dailyChallenges++;}
  }else{
    consecutiveWins=0;localData.consecutiveWins=0;
  }
  saveLocal();refreshUI();
  const res=await saveGameProgress({won,time,mistakes,hintsUsed:usedHints,difficulty:currentDiff,boardSz:boardSize,isD:daily,xpEarned,perfect,noHints});
  if(res&&_isOnline){await doRefresh();await syncAchievements();loadLeaderboard().catch(()=>{});}
}

/* ═══════════ NEW GAME AFTER WIN ═══════════ */
function confirmNewGame(){
  if(!gameActive){newGameSetup();return;}
  showConfirm({title:'Start New Game',msg:'Current progress will be lost.',icon:'🔄',onConfirm(){
    clearInterval(timerIv);gameActive=false;consecutiveWins=0;localData.consecutiveWins=0;saveLocal();
    recordGame(false,0,timerSecs);newGameSetup();
  }});
}
