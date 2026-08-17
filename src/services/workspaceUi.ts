import {getAvailableWorkspaces,switchWorkspace} from './auth';

const labels:Record<string,string>={gatrivi:'Ventas TMM',jobs:'Empleos'};

export function installWorkspaceUi(){
  if(typeof window==='undefined'||typeof document==='undefined')return;
  let scheduled=false;
  const apply=()=>{
    scheduled=false;
    const match=window.location.pathname.match(/^\/t\/([^/]+)/);
    if(!match)return;
    const tenant=match[1];
    const aside=document.querySelector('aside');
    if(!aside)return;

    const tenantName=aside.querySelector('.tenant b');
    if(tenantName)tenantName.textContent=labels[tenant]??tenant;

    const prospectLink=aside.querySelector<HTMLAnchorElement>('nav a[href$="/prospects"]');
    if(prospectLink){
      prospectLink.style.display=tenant==='jobs'?'none':'';
      if(tenant!=='jobs'){
        const textNode=[...prospectLink.childNodes].find(node=>node.nodeType===Node.TEXT_NODE);
        if(textNode)textNode.textContent=' Empezá acá';
      }
    }

    const workspaces=getAvailableWorkspaces();
    let button=aside.querySelector<HTMLButtonElement>('#workspace-switcher');
    if(workspaces.length<2){button?.remove();return;}
    if(!button){
      button=document.createElement('button');
      button.id='workspace-switcher';
      button.type='button';
      button.style.cssText='margin:10px 4px 4px;padding:10px 12px;border:1px solid #343741;border-radius:10px;background:#17191f;color:#f4f4f5;font:700 12px Inter,system-ui,sans-serif;text-align:left;cursor:pointer;width:calc(100% - 8px)';
      aside.querySelector('.brand')?.insertAdjacentElement('afterend',button);
    }
    const target=tenant==='jobs'?'gatrivi':'jobs';
    button.textContent=`${tenant==='jobs'?'📄':'💼'} ${labels[tenant]??tenant}  ·  cambiar a ${labels[target]}`;
    button.onclick=()=>{
      const next=switchWorkspace(target);
      if(!next)return;
      const destination=target==='jobs'?`/t/${target}/dashboard`:`/t/${target}/prospects`;
      window.location.assign(destination);
    };
  };
  const schedule=()=>{if(scheduled)return;scheduled=true;queueMicrotask(apply)};
  const observer=new MutationObserver(schedule);
  observer.observe(document.body,{childList:true,subtree:true});
  window.addEventListener('popstate',schedule);
  schedule();
}
