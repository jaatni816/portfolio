(function(){
  var url = window.SUPABASE_URL || '';
  var key = window.SUPABASE_ANON_KEY || '';
  var supabase = null;

  var els = {
    loadingBox: document.getElementById('loadingBox'),
    content: document.getElementById('content'),
    errorBox: document.getElementById('errorBox')
  };

  function esc(s){
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function setMeta(key, val){
    var m = document.querySelector('meta[name="' + key + '"]');
    if(!m){ m = document.createElement('meta'); m.name = key; document.head.appendChild(m); }
    m.content = val;
  }
  function setJsonLd(obj){
    var id = 'page-jsonld';
    var old = document.getElementById(id);
    if(old) old.remove();
    var s = document.createElement('script');
    s.type = 'application/ld+json';
    s.id = id;
    s.textContent = JSON.stringify(obj);
    document.head.appendChild(s);
  }
  function setCanonical(url){
    var c = document.querySelector('link[rel="canonical"]');
    if(!c){ c = document.createElement('link'); c.rel = 'canonical'; document.head.appendChild(c); }
    c.href = url;
  }

  function slugFromPath(){
    var p = window.location.pathname.replace(/\/+$/, '');
    var parts = p.split('/').filter(Boolean);
    if(parts.length >= 2 && parts[0] === 'projects'){
      return parts.slice(1).join('/').toLowerCase();
    }
    return null;
  }

  function injectDetail(p){
    var metaDesc = (p.description || '').slice(0, 160);
    document.title = (p.title || 'Project') + ' — Nargish | Web Developer Portfolio';
    setMeta('description', metaDesc);
    setCanonical(window.location.origin + '/projects/' + esc(p.slug));
    setJsonLd({
      '@context': 'https://schema.org',
      '@type': 'CreativeWork',
      headline: p.title,
      description: p.description,
      url: window.location.origin + '/projects/' + p.slug,
      author: { '@type': 'Person', name: 'Nargish', url: window.location.origin + '/' },
      image: p.image_url,
      keywords: (p.tech_stack || []).join(', '),
      dateCreated: p.created_at
    });

    var tech = (p.tech_stack || []).map(function(t){ return '<span>' + esc(t) + '</span>'; }).join('');
    var features = (p.features || []);
    var featureHtml = features.length
      ? '<ul class="feat-list">' + features.map(function(f){ return '<li>' + esc(f) + '</li>'; }).join('') + '</ul>'
      : '';
    var info = [];
    if(p.year) info.push('<li><strong>Year</strong>' + esc(p.year) + '</li>');
    if(p.role) info.push('<li><strong>My role</strong>' + esc(p.role) + '</li>');
    info.push('<li><strong>Tech stack</strong>' + ((p.tech_stack || []).join(', ') || '—') + '</li>');
    var mainImage = p.image_url
      ? '<div class="detail-thumb"><img src="' + esc(p.image_url.split('?')[0]) + '" alt="' + esc(p.title) + ' screenshot"></div>'
      : '';
    var live = p.live_url ? '<a class="live" href="' + esc(p.live_url) + '" rel="noopener" target="_blank">Live site</a>' : '';
    var git = p.github_url ? '<a class="git" href="' + esc(p.github_url) + '" rel="noopener" target="_blank">Source code</a>' : '';

    els.content.innerHTML =
      '<div class="detail">' +
        '<a class="backlink" href="/projects">&larr; All projects</a>' +
        '<div class="detail-hero">' +
          '<div>' +
            '<h1>' + esc(p.title) + '</h1>' +
            '<p class="detail-desc">' + esc(p.description) + '</p>' +
            (tech ? '<div class="tech" style="margin-top:16px;">' + tech + '</div>' : '') +
            (featureHtml ? '<h2 class="feat-h">Key features</h2>' + featureHtml : '') +
            '<div class="links">' + live + git + '</div>' +
            mainImage +
          '</div>' +
          '<aside class="detail-side">' +
            '<h2>Project info</h2>' +
            '<ul class="dl">' + info.join('') + '</ul>' +
          '</aside>' +
        '</div>' +
      '</div>';
  }

  function injectList(rows){
    document.title = 'Projects — Nargish | Web Developer Portfolio';
    setMeta('description', 'Explore Nargish\'s web developer portfolio projects — responsive websites and web apps built with modern tech stacks.');
    rows = (rows || []).slice().sort(function(a, b){
      return (b.featured ? 1 : 0) - (a.featured ? 1 : 0);
    });
    setJsonLd({
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'Nargish Projects',
      itemListElement: rows.map(function(p, i){
        return { '@type': 'ListItem', position: i + 1,
          item: { '@type': 'CreativeWork', name: p.title, url: window.location.origin + '/projects/' + p.slug } };
      })
    });
    setCanonical(window.location.origin + '/projects/');

    var cards = rows.map(function(p){
      var thumb = p.image_url
        ? '<img src="' + esc(p.image_url.split('?')[0]) + '" alt="' + esc(p.title) + ' screenshot" loading="lazy">'
        : '<span class="ph">' + esc((p.title || '?').slice(0,1).toUpperCase()) + '</span>';
      var tech = (p.tech_stack || []).map(function(t){ return '<span>' + esc(t) + '</span>'; }).join('');
      return '<a class="card" href="/projects/' + esc(p.slug) + '">' +
        '<div class="thumb">' + thumb + '</div>' +
        '<div class="card-body">' +
          '<div class="card-title">' + esc(p.title) + '</div>' +
          '<div class="card-desc">' + esc(p.description) + '</div>' +
          (tech ? '<div class="tech">' + tech + '</div>' : '') +
        '</div></a>';
    }).join('');

    els.content.innerHTML =
      '<h1>Projects</h1>' +
      '<p class="lead">Ye projects Supabase se live load hote hain — admin panel se jo bhi update karte ho, yahan turant dikhta hai.</p>' +
      '<div class="grid">' + cards + '</div>';
  }

  function fail(html){
    els.loadingBox.style.display = 'none';
    els.errorBox.style.display = 'block';
    els.errorBox.innerHTML = html || 'Projects load nahi hue.<br><a href="/projects">Phir try karo</a>';
  }

  function withTimeout(p, ms, label){
    return new Promise(function(resolve, reject){
      var done = false;
      var t = setTimeout(function(){
        if(done) return;
        done = true;
        reject(new Error(label + ' me time out'));
      }, ms);
      Promise.resolve(p).then(function(v){
        if(done) return;
        done = true;
        clearTimeout(t);
        resolve(v);
      }, function(e){
        if(done) return;
        done = true;
        clearTimeout(t);
        reject(e);
      });
    });
  }

  function start(lib){
    try {
      supabase = lib.createClient(url, key);
    } catch(err){
      supabase = null;
    }
    if(!supabase){
      fail('<strong>Supabase URL check karo</strong> — aisa hona chahiye: <code>https://abcdefgh.supabase.co</code>.<br><a href="/">Portfolio pe wapas jao</a>');
      return;
    }
    var slug = slugFromPath();

    var q = supabase.from('projects').select('*').order('created_at', { ascending: false });
    if(slug) q = q.eq('slug', slug);

    withTimeout(q, 12000, 'Projects').then(function(r){
      els.loadingBox.style.display = 'none';
      if(r.error){
        if(/relation .* does not exist/i.test(r.error.message || '')){
          fail('Table <code>projects</code> create nahi hai. Supabase mein table banao.');
        } else if(/permission|policy|RLS|42501/i.test(r.error.message || '')){
          fail('Table pe public SELECT policy (anon) set karo, taaki projects sabko dikhe.');
        } else if(slug){
          fail('Project mila nahi. <a href="/projects">Saare projects dekho</a>');
        } else {
          fail('Projects load nahi hue. <a href="/projects">Phir try karo</a>');
        }
        return;
      }
      if(slug){
        var p = r.data && r.data[0];
        if(!p){ fail('Project mila nahi. <a href="/projects">Saare projects dekho</a>'); return; }
        injectDetail(p);
      } else {
        injectList(r.data || []);
      }
      els.content.style.display = 'block';
    }).catch(function(err){
      fail('Network/DB error: ' + (err && err.message ? err.message : 'unknown') + '.<br><a href="/projects">Phir try karo</a>');
    });
  }

  function boot(){
    if(!url || !key){
      fail('<strong>Supabase config set nahi hui.</strong><br><code>supabase.config.js</code> mein keys bharo, warna public projects live load nahi honge.<br><a href="/">Portfolio pe wapas jao</a>');
      return;
    }
    if(!window.onSupabaseReady){
      fail('<strong>supabase-loader.js load nahi hua.</strong><br>Network check kar ke refresh karo.<br><a href="/">Portfolio pe wapas jao</a>');
      return;
    }
    window.onSupabaseReady(start, function(){
      fail('<strong>supabase-js library load nahi hua.</strong><br>CDN block ya slow hai — network check kar ke refresh karo.<br><a href="/">Portfolio pe wapas jao</a>');
    });
  }

  document.addEventListener('DOMContentLoaded', boot);
})();