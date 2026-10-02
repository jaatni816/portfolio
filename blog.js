(function(){
  var url = window.SUPABASE_URL || '';
  var key = window.SUPABASE_ANON_KEY || '';

  var detail = /^\/post\//.test(location.pathname);
  var detailSlug = detail ? decodeURIComponent(location.pathname.split('/')[2] || '').replace(/\.html$/i, '') : '';

  function esc(s){
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function fmtDate(iso){
    if(!iso) return '';
    var d = new Date(iso);
    if(isNaN(d)) return '';
    return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()] + ' ' + d.getFullYear();
  }

  function readMins(content){
    var words = String(content || '').trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 200)) + ' min read';
  }

  function meta(name, content){
    var el = document.querySelector('meta[name="' + name + '"]');
    if(el && content){ el.setAttribute('content', content); }
  }

  function renderProse(text){
    var blocks = String(text || '').split(/\n\s*\n/);
    var out = [];
    blocks.forEach(function(b){
      var lines = b.split('\n').map(function(l){ return l.trim(); });
      if(lines.every(function(l){ return l === ''; })) return;
      var lis = [];
      lines.forEach(function(line){
        if(/^###\s+/.test(line)){
          out.push('<h3>' + esc(line.replace(/^###\s+/, '')) + '</h3>');
        } else if(/^##\s+/.test(line)){
          out.push('<h2>' + esc(line.replace(/^##\s+/, '')) + '</h2>');
        } else if(/^-\s+/.test(line)){
          lis.push('<li>' + esc(line.replace(/^-\s+/, '')) + '</li>');
        } else if(lis.length){
          out.push('<ul>' + lis.join('') + '</ul>');
          lis = [];
          out.push('<p>' + esc(line) + '</p>');
        } else {
          out.push('<p>' + esc(line) + '</p>');
        }
      });
      if(lis.length) out.push('<ul>' + lis.join('') + '</ul>');
    });
    return out.join('');
  }

  function buildGrid(posts){
    var grid = document.querySelector('.posts-grid');
    if(!grid || !posts.length) return;
    var articles = posts.filter(function(p){ return p.published !== false; }).map(function(p){
      var cover = p.image_url
        ? '<img src="' + p.image_url + '" alt="' + esc(p.title) + ' cover" loading="lazy" decoding="async">'
        : '';
      return '<article class="post reveal">' +
        '<div class="post-cover">' + cover + '</div>' +
        '<div class="post-body">' +
          '<div class="post-meta"><span class="cat">' + esc(p.category || 'General') + '</span><span>' + esc(fmtDate(p.published_at || p.created_at)) + '</span><span>' + esc(readMins(p.content)) + '</span></div>' +
          '<h3>' + esc(p.title) + '</h3>' +
          '<p>' + esc(p.excerpt) + '</p>' +
          '<a href="/post/' + encodeURIComponent(p.slug) + '" class="btn btn-primary">Read the full post</a>' +
        '</div>' +
      '</article>';
    }).join('');
    if(articles){
      grid.innerHTML = articles;
      observeReveals();
    }
  }

  function observeReveals(){
    var els2 = document.querySelectorAll('.reveal:not(.in-view)');
    if(!els2.length) return;
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(entry.isIntersecting){
          entry.target.classList.add('in-view');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });
    els2.forEach(function(el){ io.observe(el); });
  }

  function renderDetail(post){
    document.title = post.title + ' — Nargish Blog';
    meta('description', post.excerpt || '');
    var canonical = document.querySelector('link[rel="canonical"]');
    if(canonical) canonical.setAttribute('href', location.origin + '/post/' + encodeURIComponent(post.slug));

    document.getElementById('post-title').textContent = post.title;
    document.getElementById('post-subtitle').textContent = (post.excerpt || '');

    var hero = document.getElementById('blog-hero');
    hero.querySelector('.eyebrow').textContent = 'Blog / ' + (post.category || 'General');

    var posts = document.getElementById('posts');
    posts.innerHTML =
      '<div class="wrap">' +
        '<div class="post-detail-wrap">' +
          '<div class="post-detail-meta"><span class="cat">' + esc(post.category || 'General') + '</span><span>' + esc(fmtDate(post.published_at || post.created_at)) + '</span><span>' + esc(readMins(post.content)) + '</span></div>' +
          (post.image_url ? '<div class="post-detail-cover"><img src="' + post.image_url + '" alt="' + esc(post.title) + '" loading="lazy" decoding="async"></div>' : '') +
          '<div class="post-detail-body">' + renderProse(post.content) + '</div>' +
          '<div class="post-detail-back"><a class="btn btn-primary" href="/blog">&larr; Back to all posts</a></div>' +
        '</div>' +
      '</div>';

    var jsonld = document.createElement('script');
    jsonld.type = 'application/ld+json';
    jsonld.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      'headline': post.title,
      'description': post.excerpt || '',
      'datePublished': post.published_at || post.created_at,
      'image': post.image_url || undefined,
      'author': { '@type': 'Person', 'name': 'Nargish' }
    });
    document.head.appendChild(jsonld);

    if(window.__revealBlog){}else{
      var rs = document.querySelectorAll('.reveal');
      rs.forEach(function(el){ el.classList.add('in-view'); });
    }
  }

  function notFound(slug){
    var posts = document.getElementById('posts');
    document.title = 'Post not found — Nargish Blog';
    posts.innerHTML =
      '<div class="wrap" style="text-align:center;padding:60px 0;">' +
        '<h2 style="font-family:\'Unbounded\';font-size:1.6rem;">Ye post nahi mili</h2>' +
        '<p style="color:var(--text-dim);margin-top:10px;">"/' + esc(slug) + '" nahi mila — galat link ho sakta hai ya post draft hai.</p>' +
        '<div style="margin-top:22px;"><a class="btn btn-primary" href="/blog">&larr; Back to all posts</a></div>' +
      '</div>';
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
    if(!url || !key){ return; }
    var supabase;
    try { supabase = lib.createClient(url, key); }
    catch(err){ return; }

    if(detail && detailSlug){
      withTimeout(supabase.from('posts').select('*').eq('slug', detailSlug).maybeSingle(), 12000, 'Post').then(function(r){
        if(r.error || !r.data){ notFound(detailSlug); return; }
        renderDetail(r.data);
      }).catch(function(){ notFound(detailSlug); });
      return;
    }

    withTimeout(supabase.from('posts').select('*').order('published_at', { ascending: false }), 12000, 'Posts').then(function(r){
      if(r.error || !r.data || !r.data.length) return;
      buildGrid(r.data);
    }).catch(function(){});
  }

  function boot(){
    if(!window.onSupabaseReady) return;              // loader script nahi mila
    window.onSupabaseReady(start, function(){});     // CDN fail — page as-is rehne do
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();