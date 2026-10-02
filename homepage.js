(function(){
  function whenSupabase(cb){
    if(!window.onSupabaseReady) return;                 // loader script nahi mila
    window.onSupabaseReady(function(){ cb(); }, function(){ /* CDN fail — static content rehne do */ });
  }

  function esc(s){
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function observeReveals(){
    var els = document.querySelectorAll('.reveal:not(.in-view)');
    if(!els.length || !('IntersectionObserver' in window)) {
      els.forEach(function(el){ el.classList.add('in-view'); });
      return;
    }
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(entry.isIntersecting){
          entry.target.classList.add('in-view');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });
    els.forEach(function(el){ io.observe(el); });
  }

  // ---------- HERO ----------
  function applyHero(h){
    if(!h) return;

    if(h.title){
      var t = document.getElementById('hero-title');
      if(t) t.textContent = h.title;
    }
    if(h.role){
      var r = document.querySelector('.hero-role');
      if(r) r.textContent = h.role;
    }
    if(h.tagline){
      var g = document.querySelector('.hero-tagline');
      if(g) g.textContent = h.tagline;
    }
    if(h.photo_caption){
      var c = document.getElementById('heroPhotoCaption');
      if(c) c.textContent = h.photo_caption;
    }
    if(h.photo_url){
      var img = document.getElementById('photoImg');
      if(img){
        img.src = h.photo_url;
        img.hidden = false;
        var ph = document.getElementById('heroPhotoPlaceholder');
        if(ph) ph.style.display = 'none';
      }
    }
  }

  // ---------- GALLERY ----------
  function renderGallery(items){
    var section = document.getElementById('gallery');
    var grid = document.getElementById('galleryGrid');
    if(!section || !grid) return;

    if(!items || !items.length){
      section.hidden = true;
      return;
    }

    grid.innerHTML = items.map(function(g){
      var img = g.image_url
        ? '<img src="' + esc(g.image_url.split('?')[0]) + '" alt="' + esc(g.title) + '" loading="lazy" decoding="async">'
        : '';
      var inner =
        '<div class="g-thumb">' + img + '</div>' +
        '<div class="g-body">' +
          '<h3>' + esc(g.title) + '</h3>' +
          '<p>' + esc(g.text) + '</p>' +
          (g.link_url ? '<span class="g-link">' + esc(String(g.link_url).replace(/^https?:\/\/(www\.)?/, '').split('/')[0]) + '</span>' : '') +
        '</div>';

      if(g.link_url){
        return '<a class="g-card reveal" href="' + esc(g.link_url) + '" target="_blank" rel="noopener noreferrer">' + inner + '</a>';
      }
      return '<div class="g-card reveal">' + inner + '</div>';
    }).join('');

    section.hidden = false;
    observeReveals();
  }

  // ---------- JOURNEY ----------
  function renderJourney(items){
    var list = document.getElementById('timelineList');
    if(!list || !items || !items.length) return;

    list.innerHTML = items.map(function(j, i){
      var year = String(j.year == null ? '' : j.year);
      var node = year.slice(-2);
      var isLast = i === items.length - 1;
      return '<div class="t-item reveal' + (isLast ? ' active' : '') + '">' +
        '<div class="t-node">' + esc(node) + '</div>' +
        '<div class="t-year">' + esc(year) + '</div>' +
        '<h3>' + esc(j.title) + '</h3>' +
        '<p>' + esc(j.description) + '</p>' +
        (j.status ? '<span class="t-status">' + esc(j.status) + '</span>' : '') +
      '</div>';
    }).join('');

    observeReveals();
  }

  whenSupabase(function(){
    var url = window.SUPABASE_URL, key = window.SUPABASE_ANON_KEY;
    if(!url || !key) return;
    var supabase;
    try { supabase = window.supabase.createClient(url, key); }
    catch(err){ return; }

    function safe(p){
      return p.then(function(a){ return a; }).catch(function(){ return { error: true, data: [] }; });
    }

    var rHero = safe(supabase.from('hero_section').select('*').limit(1));
    var rGallery = safe(supabase.from('gallery_items').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: true }));
    var rJourney = safe(supabase.from('journey_items').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: true }));

    Promise.all([rHero, rGallery, rJourney]).then(function(results){
      var h = results[0], g = results[1], j = results[2];

      if(h && !h.error && h.data && h.data[0]) applyHero(h.data[0]);

      if(g && !g.error) renderGallery(g.data || []);

      if(j && !j.error && j.data && j.data.length) renderJourney(j.data);
    });
  });
})();
