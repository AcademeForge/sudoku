/* ═══════════ THEME (default light) ═══════════ */
(function initTheme(){
  const stored=localStorage.getItem('sm_theme3');
  if(!stored){
    document.documentElement.setAttribute('data-theme','light');
    localStorage.setItem('sm_theme3','light');
  } else {
    document.documentElement.setAttribute('data-theme',stored);
  }
  updateThemeUI();
})();
function isDark(){return localStorage.getItem('sm_theme3')==='dark';}
function updateThemeUI(){
  const dark=isDark();
  const t=document.getElementById('darkToggle');
  if(t)t.classList.toggle('on',dark);
}
function toggleTheme(){
  const nt=isDark()?'light':'dark';
  localStorage.setItem('sm_theme3',nt);
  document.documentElement.setAttribute('data-theme',nt);
  updateThemeUI();
}
