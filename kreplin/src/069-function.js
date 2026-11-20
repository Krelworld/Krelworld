/* === Deranged Visibility Guard (minimal, non-destructive) v5.9 === */
(function(){
  function ready(fn){ if (document.readyState!=='loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }

  function actionsRoot(){
    const actions = document.getElementById('actions');
    if (actions) return actions;
    return document.querySelector('#choicesPanel #actions')
        || document.querySelector('#choicesPanel .choices')
        || document.getElementById('choices')
        || null; // do NOT fall back to body
  }
  function text(n){ return (n && (n.innerText || n.textContent) || '').trim(); }

  function inAllowedContext(root){
    // must be high
    if (!(window.S && S.on_drugs_today)) return false;

    // locker room flags from state are the strongest signal
    if (S.visited_ownLocker || S.visited_oppLocker) return true;

    // buttons indicating a ref/manager bribe flow
    try{
      const labels = Array.from(root.querySelectorAll('button,a')).map(el => text(el).toLowerCase());
      const bribeRefMgr = labels.some(t => /\bbribe\b/.test(t) && (/\bref\b|\breferee\b|\bmanager\b/.test(t)));
      if (bribeRefMgr) return true;
    }catch(_){}

    // otherwise, not allowed
    return false;
  }

  function applyFilter(){
    const root = actionsRoot();
    if (!root) return;

    // Remove any "more deranged..." affordances entirely
    Array.from(root.querySelectorAll('button,a')).forEach(el => {
      const t = text(el).toLowerCase();
      if (t === 'more deranged ideas…' || t === 'more deranged ideas...' || t === 'more deranged options'){
        el.remove();
      }
    });

    const allowed = inAllowedContext(root);

    // Collect deranged buttons
    const deranged = Array.from(root.querySelectorAll('button,a')).filter(el => /^deranged:/i.test(text(el)));

    if (!allowed){
      // Hide all deranged everywhere if not allowed here
      deranged.forEach(el => { el.style.display='none'; el.setAttribute('aria-hidden','true'); });
      return;
    }

    // Allowed: show exactly one, hide the rest
    let shown = 0;
    deranged.forEach((el) => {
      if (shown === 0){
        el.style.display='';
        el.removeAttribute('aria-hidden');

        // Make it one-click-only per menu
        if (!el.__derangedOnce){
          el.__derangedOnce = true;
          el.addEventListener('click', function(){
            // remove after click so it cannot be spammed
            try{ el.remove(); }catch(_){}
          }, { once:true });
        }
        shown++;
      } else {
        el.style.display='none'; el.setAttribute('aria-hidden','true');
      }
    });
  }

  function observe(){
    let root = actionsRoot();
    if (!root) { setTimeout(observe, 300); return; }

    // Observe the actions container only; re-filter on changes
    const mo = new MutationObserver(()=>{ try{ applyFilter(); }catch(_){ } });
    mo.observe(root, { childList:true, subtree:true, characterData:true });

    // Also watch for the root being replaced
    const pageMo = new MutationObserver(()=>{
      const r = actionsRoot();
      if (r && r !== root){
        root = r;
        mo.disconnect();
        observe();
      }
    });
    pageMo.observe(document.body, { childList:true, subtree:true });

    // Initial passes
    setTimeout(applyFilter, 50);
    setTimeout(applyFilter, 250);
  }

  ready(function(){
    try{ observe(); }catch(_){}
  });
})();