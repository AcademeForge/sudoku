/* ═══════════ CONFIG ═══════════ */
const NXDB_API_URL         = "https://afooyyydhlwngzssgqih.supabase.co/functions/v1/sudoku-sync-player-nxdb";
const NXDB_PROGRESS_URL    = "https://afooyyydhlwngzssgqih.supabase.co/functions/v1/sudoku-save-progress-nxdb";
const NXDB_LEADERBOARD_URL = "https://afooyyydhlwngzssgqih.supabase.co/functions/v1/sudoku-leaderboard-nxdb";
const NXDB_ACHIEVEMENT_URL = "https://afooyyydhlwngzssgqih.supabase.co/functions/v1/sudoku-achievement-nxdb";

const AVATARS = [
  "🧠","🎓","🏆","👑","⚡","🎯","🚀","🔥","💎","🌟",
  "🤖","🧩","🎮","🕹️","🥇","🥈","🥉","🏅","📚","🔮",
  "🦁","🐯","🦅","🦊","🐺","🐼","🐨","🐱","🐵","🐸",
  "😎","🗿","💀","😈","👹","🐉","🦖","🦈","🦍","🐲",
  "⚔️","🛡️","🏹","🔱","🪓","⚜️","☠️","👁️","🌪️","🌋",
  "💰","💸","💼","🎩","🕶️","⌚","📈","🏛️","🏰","🛸",
  "🌌","🌠","☄️","🪐","🌙","☀️","⭐","🌍","🛰️","🚁",
  "💻","⌨️","🖥️","📱","🎧","🎤","📡","🔋","⚙️","🧪",
  "👽","🐅","🦄","👻","🇮🇳","🚩","🕉️","☸️","🪔","🦚"
];

// XP table — 4x4 doubled
const XP_TABLE = {
  '4-easy':50,'4-moderate':80,'4-hard':120,
  '9-easy':150,'9-moderate':250,'9-hard':500,
  perfect:10, nohint:10,
  daily_9_easy:500, daily_9_moderate:500, daily_9_hard:500,
  daily_4_easy:250, daily_4_moderate:250, daily_4_hard:250
};

const BOARD_LIMITS = {
  4:{ hints:4, maxLives:4 },
  9:{ hints:9, maxLives:9 }
};

const DIFF_CONFIG = {
  easy:     {icon:'🌱',label:'Easy',    desc:'More clues, relaxed pace',       badge:'pill-s'},
  moderate: {icon:'🔥',label:'Moderate',desc:'Balanced challenge',             badge:'pill-w'},
  hard:     {icon:'💀',label:'Hard',    desc:'Fewest clues, maximum challenge',badge:'pill-d'}
};

const ACHIEVEMENTS = [
  {id:'first_win',icon:'🏆',name:'First Victory',  condition:s=>s.wins>=1},
  {id:'streak7',  icon:'🔥',name:'7-Day Streak',   condition:s=>s.streak>=7},
  {id:'speed',    icon:'⚡',name:'Speed Solver',   condition:s=>s.bestTime>0&&s.bestTime<=120},
  {id:'expert',   icon:'🧠',name:'Sudoku Expert',  condition:s=>s.wins>=50},
  {id:'perfect',  icon:'🎯',name:'Perfectionist',  condition:s=>s.perfectGames>=5},
  {id:'top10',    icon:'👑',name:'Top Ranked',     condition:s=>s.globalRank>0&&s.globalRank<=10},
  {id:'level5',   icon:'⭐',name:'Rising Star',    condition:s=>s.level>=5},
  {id:'daily10',  icon:'📅',name:'Daily Devotion', condition:s=>s.dailyChallenges>=10},
  {id:'nohints',  icon:'🕵️',name:'No Hints Needed',condition:s=>s.noHintWins>=5},
  {id:'heroic',   icon:'⚔️',name:'Heroic Rank',    condition:s=>s.level>=25}
];

// Daily challenge rotation — deterministic by day
const DAILY_ROTATION = [
  {size:9,diff:'moderate'},{size:4,diff:'hard'},{size:9,diff:'easy'},
  {size:4,diff:'moderate'},{size:9,diff:'hard'},{size:4,diff:'easy'},
  {size:9,diff:'moderate'},{size:9,diff:'easy'},{size:4,diff:'hard'},
  {size:9,diff:'hard'},{size:4,diff:'moderate'},{size:9,diff:'moderate'},
  {size:4,diff:'easy'},{size:9,diff:'easy'},{size:4,diff:'hard'}
];
function getTodayDailyConfig(){
  const dayNum=Math.floor(Date.now()/86400000); // days since epoch
  return DAILY_ROTATION[dayNum%DAILY_ROTATION.length];
}

/* ═══════════ STATE ═══════════ */
let nxdbPlayer=null,nxdbStats=null,nxdbLeaderboard=[],nxdbAchievements=[];
let setupBoard=null,setupDiff=null;
let puzzle=[],solution=[];
let selectedCell=null;
let notesMode=false;
let mistakes=0,maxLives=9,hints=9;
let timerSecs=0,timerIv=null;
let gameActive=false;
let boardSize=9,currentDiff='easy';
let usedHints=0,isDaily=false;
let editSelectedAvatar='😀';
let confirmCallback=null;
let _isOnline=navigator.onLine;
let _syncInProgress=false;
let offlineQueue=[];
let consecutiveWins=0; // in-session win streak for bonus XP

let localData={
  xp:0,level:1,wins:0,played:0,bestTime:0,streak:0,
  lastPlayDate:null,perfectGames:0,dailyChallenges:0,noHintWins:0,
  dailyDone:null,globalRank:0,consecutiveWins:0
};
