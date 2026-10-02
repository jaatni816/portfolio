(function(){
  function whenSupabase(cb){
    if(!window.onSupabaseReady) return;                 // loader script nahi mila
    window.onSupabaseReady(function(){ cb(); }, function(){ /* CDN fail — static content rehne do */ });
  }

  function cleanUrl(s){
    if(!s) return '';
    var u = String(s).trim();
    if(!/^https?:\/\//i.test(u)) u = 'https://' + u;
    return u;
  }

  whenSupabase(function(){
    var url = window.SUPABASE_URL, key = window.SUPABASE_ANON_KEY;
    if(!url || !key) return;
    var supabase;
    try { supabase = window.supabase.createClient(url, key); }
    catch(err){ return; }

    supabase.from('site_settings').select('*').limit(1).then(function(r){
      if(r.error || !r.data || !r.data[0]) return;
      var s = r.data[0] || {};

      if(s.email){
        var mail = 'mailto:' + s.email;
        var el = document.getElementById('heroEmail');
        if(el) el.setAttribute('href', mail);
        var cve = document.getElementById('cEmailVal');
        if(cve) cve.textContent = s.email;
        var sce = document.getElementById('scEmail');
        if(sce) sce.setAttribute('href', mail);
        var scH = document.getElementById('scEmailHandle');
        if(scH) scH.textContent = s.email;
      }

      if(s.github){
        var gh = cleanUrl(s.github);
        var hg = document.getElementById('heroGh');
        if(hg) hg.setAttribute('href', gh);
        var cgv = document.getElementById('cGhVal');
        if(cgv) cgv.textContent = gh.replace(/^https?:\/\/(www\.)?/, '');
        var scg = document.getElementById('scGh');
        if(scg) scg.setAttribute('href', gh);
        var scGh = document.getElementById('scGhHandle');
        if(scGh) scGh.textContent = gh.replace(/^https?:\/\/(www\.)?/, '');
      }

      if(s.linkedin){
        var li = cleanUrl(s.linkedin).replace(/\/+$/,'');
        var card = document.createElement('a');
        card.setAttribute('href', li);
        card.setAttribute('target', '_blank');
        card.setAttribute('rel', 'noopener noreferrer');
        card.className = 'social-card';
        var handle = li.replace(/^https?:\/\/(www\.)?(linkedin\.com)\//, '');
        card.innerHTML = '<div><div class="s-name">LinkedIn</div><div class="s-handle">' + (handle || 'LinkedIn') + '</div></div><span class="arrow">&#8599;</span>';
        var parent = document.querySelector('.social-list');
        if(parent && !document.getElementById('scLi')){
          var anchor = document.getElementById('scGh');
          card.id = 'scLi';
          parent.insertBefore(card, anchor ? anchor.nextSibling : null);
        }
      }

      if(s.instagram){
        var ig = cleanUrl(s.instagram).replace(/\/+$/,'');
        if(!document.getElementById('scIg')){
          var card = document.createElement('a');
          card.id = 'scIg';
          card.setAttribute('href', ig);
          card.setAttribute('target', '_blank');
          card.setAttribute('rel', 'noopener noreferrer');
          card.className = 'social-card';
          var handle = ig.replace(/^https?:\/\/(www\.)?/, '').replace(/instagram\.com\//, '');
          card.innerHTML = '<div><div class="s-name">Instagram</div><div class="s-handle">' + (handle || 'Instagram') + '</div></div><span class="arrow">&#8599;</span>';
          var parent = document.querySelector('.social-list');
          if(parent) parent.appendChild(card);
        }
      }

      if(s.about){
        var fb = document.getElementById('fBio');
        if(fb) fb.textContent = s.about;
      }
    }).catch(function(){});
  });
})();