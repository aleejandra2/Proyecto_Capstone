(()=>{
  const spans = document.querySelectorAll('.ms-progress');
  spans.forEach(sp=>{
    const w = sp.dataset.world; const key = `ms_${w}_progress`;
    const pct = parseInt(localStorage.getItem(key)||'0',10)||0;
    sp.textContent = pct+'%';
  });
})();

