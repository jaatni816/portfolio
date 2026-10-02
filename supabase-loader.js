/* ============================================================
   supabase-js loader — CDN fallback + timeout ke saath
   ------------------------------------------------------------
   Purana pattern: ek CDN (jsdelivr) se supabase-js load hota tha.
   Wo CDN slow/blocked hota to page ka spinner forever chalta tha.

   Is file me:
     - 3 CDN try hote hain (pehla fail ho to agla)
     - har CDN par 9 second ka timeout
     - window.__supabaseReady  -> Promise (resolve: supabase lib)
     - window.onSupabaseReady(cb, failCb)

   Use:
     window.onSupabaseReady(function(){ ... }, function(err){ ... });
   ============================================================ */
(function(){
  var CDNS = [
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js',
    'https://unpkg.com/@supabase/supabase-js@2/dist/umd/supabase.min.js',
    'https://cdn.skypack.dev/@supabase/supabase-js'
  ];
  var CDN_TIMEOUT = 9000;

  window.__supabaseReady = new Promise(function(resolve, reject){
    if(window.supabase){ resolve(window.supabase); return; }

    var i = 0;
    function next(){
      if(i >= CDNS.length){
        window.__sbCdnError = 1;
        reject(new Error('supabase-js library kisi CDN se load nahi hui. Internet / network check karo.'));
        return;
      }
      var url = CDNS[i++];
      var el = document.createElement('script');
      var finished = false;

      var timer = setTimeout(function(){ giveUp(); }, CDN_TIMEOUT);

      function giveUp(){
        if(finished) return;
        finished = true;
        clearTimeout(timer);
        el.onload = null;
        el.onerror = null;
        if(el.parentNode) el.parentNode.removeChild(el);
        next();
      }

      el.onload = function(){
        if(finished) return;
        finished = true;
        clearTimeout(timer);
        if(window.supabase) resolve(window.supabase);
        else next();
      };
      el.onerror = giveUp;
      el.async = true;
      el.src = url;
      (document.head || document.documentElement).appendChild(el);
    }
    next();
  });

  // agar koi consumer na bhi ho to console me unhandled-rejection spam na aaye
  window.__supabaseReady.catch(function(){});

  window.onSupabaseReady = function(cb, fail){
    window.__supabaseReady.then(function(lib){ cb(lib); }, function(err){
      if(fail) fail(err); else console.error(err);
    });
  };
})();