/* ═══════════ LEADERBOARD ═══════════ */
async function loadLeaderboard(){
  const list=document.getElementById('lbList');
  const podium=document.getElementById('lbPodium');
  const youBanner=document.getElementById('lbYouBanner');
  list.innerHTML='<div class="empty"><div class="spin" style="margin:0 auto 12px"></div><p>Loading…</p></div>';
  if(podium)podium.style.display='none';
  if(youBanner)youBanner.style.display='none';
  const af=getAFStudent();
  if(!_isOnline){
    list.innerHTML='<div class="empty"><div class="empty-ico">📡</div><div class="empty-ttl">Offline</div><div class="empty-sub">Connect to see live rankings</div></div>';
    return;
  }
  try{
    const res=await nxdbApi(NXDB_LEADERBOARD_URL,{action:'get'});
    const lb=res.leaderboard||[];nxdbLeaderboard=lb;
    if(!lb.length){list.innerHTML='<div class="empty"><div class="empty-ico">🏆</div><div class="empty-ttl">No Players Yet</div><div class="empty-sub">Be the first!</div></div>';return;}
    if(lb.length>=1&&podium){
      podium.style.display='grid';
      const po=lb.length>=3?[lb[1],lb[0],lb[2]]:lb.length===2?[lb[1],lb[0],null]:[null,lb[0],null];
      const pCls=['r2','r1','r3'],pMed=['🥈','🥇','🥉'];
      podium.innerHTML=po.map((p,i)=>{
        if(!p)return'<div></div>';
        return`<div class="podium-card ${pCls[i]}">
          <div class="podium-medal">${pMed[i]}</div>
          <div class="podium-ava">${p.avatar||'😀'}</div>
          <div class="podium-name">${p.name||p.username}</div>
          <div class="podium-xp">${(p.xp||0).toLocaleString()} XP</div>
          <div class="podium-lv">Lv.${p.level||1}</div>
        </div>`;
      }).join('');
    }
    const myIdx=lb.findIndex(p=>(af.studentId&&p.student_id===af.studentId)||(af.email&&p.email===af.email));
    if(myIdx>=0&&youBanner){
      const myP=lb[myIdx],myRank=myIdx+1;
      if(nxdbPlayer)nxdbPlayer.rank=myRank;
      localData.globalRank=myRank;saveLocal();
      document.getElementById('lbYouAva').textContent=myP.avatar||'😀';
      document.getElementById('lbYouName').textContent=myP.name||myP.username;
      document.getElementById('lbYouSub').textContent=`${(myP.xp||0).toLocaleString()} XP · Lv.${myP.level||1}`;
      document.getElementById('lbYouRank').textContent=`#${myRank}`;
      youBanner.style.display='flex';
      updateRankUI(myRank);
    }
    list.innerHTML=lb.map((p,i)=>{
      const rank=i+1,isMe=(af.studentId&&p.student_id===af.studentId)||(af.email&&p.email===af.email);
      const rd=rank<=3?['🥇','🥈','🥉'][rank-1]:`#${rank}`;
      const wins=p.wins||p.games_won||0;
      const streak=p.streak||0;
      const played=p.played||p.games_played||0;
      return`<div class="lb-item${isMe?' is-me':''}">
        <div class="lb-rank-col${rank<=3?' top3':''}">${rd}</div>
        <div class="lb-player-col">
          <div class="lb-avatar">${p.avatar||'😀'}</div>
          <div>
            <div class="lb-player-name">${p.name||p.username||'Player'}${isMe?` <span style="font-size:.56rem;background:var(--pri);color:#fff;padding:1px 6px;border-radius:var(--r-full);margin-left:4px">You</span>`:''}</div>
            <div class="lb-player-sub">Lv.${p.level||1} · ${played}P / ${wins}W · 🔥${streak}</div>
          </div>
        </div>
        <div class="lb-xp-col">
          <div class="lb-xp-val">${(p.xp||0).toLocaleString()}</div>
          <div class="lb-xp-wins">XP</div>
        </div>
      </div>`;
    }).join('');
  }catch(e){
    list.innerHTML='<div class="empty"><div class="empty-ico">⚠️</div><div class="empty-ttl">Error</div><div class="empty-sub">Could not load rankings.</div></div>';
  }
}
function updateRankUI(rank){
  const r=rank>0?`#${rank}`:'#—';
  ['stRank','pGlobalRank'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=r;});
}
