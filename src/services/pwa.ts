let registered=false;

export function registerCrmPwa(){
  if(registered||typeof window==='undefined'||typeof document==='undefined')return;
  registered=true;

  if(!document.querySelector('link[rel="manifest"]')){
    const manifest=document.createElement('link');
    manifest.rel='manifest';
    manifest.href='/manifest.webmanifest';
    document.head.appendChild(manifest);
  }

  if(!document.querySelector('meta[name="theme-color"]')){
    const theme=document.createElement('meta');
    theme.name='theme-color';
    theme.content='#171814';
    document.head.appendChild(theme);
  }

  if('serviceWorker' in navigator){
    window.addEventListener('load',()=>{
      navigator.serviceWorker.register('/sw.js').catch(error=>console.warn('No se pudo registrar el service worker',error));
    },{once:true});
  }
}
