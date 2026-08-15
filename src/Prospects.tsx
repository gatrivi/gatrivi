import {useEffect,useMemo,useState,type FormEvent} from 'react';
import {useSearchParams} from 'react-router-dom';
import {Copy,ExternalLink,Smartphone,Target} from 'lucide-react';
import {useCrm} from './context/CrmContext';
import {parseProspectCapture} from './services/prospectCapture';
import {
  buildDemoLinks,
  buildOutreachMessage,
  prospectCategories,
  scoreProspect,
  type ProspectCategory,
  type ProspectColor,
  type ProspectPlatform,
  type ProspectSignals,
} from './services/prospecting';

const defaultSignals:ProspectSignals={
  runningAds:true,
  weakOrNoStore:false,
  dmCheckout:false,
  strongVisuals:false,
  catalogLike:false,
  localReachable:true,
};

const signalLabels:Record<keyof ProspectSignals,string>={
  runningAds:'Está pautando anuncios',
  weakOrNoStore:'Sin tienda propia fuerte',
  dmCheckout:'Compra por DM / WhatsApp',
  strongVisuals:'Buenas fotos / producto visual',
  catalogLike:'Oferta tipo catálogo',
  localReachable:'Local / fácil de contactar',
};

const inputStyle={width:'100%',minHeight:42,border:'1px solid #d6d3d1',borderRadius:10,padding:'0 12px',background:'#fff'} as const;
const labelStyle={display:'grid',gap:6,fontSize:12,fontWeight:700} as const;
const gridStyle={display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:12} as const;

type InstallPromptEvent=Event&{
  prompt:()=>Promise<void>;
  userChoice:Promise<{outcome:'accepted'|'dismissed'}>;
};

export default function Prospects(){
  const {contacts,addProspect,tenant}=useCrm();
  const [params]=useSearchParams();
  const capture=parseProspectCapture(params);
  const captured=Boolean(capture.sourceUrl||capture.title||capture.text);
  const [company,setCompany]=useState(capture.company);
  const [contactName,setContactName]=useState('');
  const [phone,setPhone]=useState('');
  const [sourceUrl,setSourceUrl]=useState(capture.sourceUrl);
  const [platform,setPlatform]=useState<ProspectPlatform>(capture.platform);
  const [area,setArea]=useState(capture.area);
  const [category,setCategory]=useState<ProspectCategory>(capture.category);
  const [color,setColor]=useState<ProspectColor>('carbon');
  const [value,setValue]=useState('325000');
  const [signals,setSignals]=useState<ProspectSignals>(defaultSignals);
  const [saved,setSaved]=useState('');
  const [copied,setCopied]=useState('');
  const [installPrompt,setInstallPrompt]=useState<InstallPromptEvent|null>(null);

  useEffect(()=>{
    const handler=(event:Event)=>{
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt',handler);
    return()=>window.removeEventListener('beforeinstallprompt',handler);
  },[]);

  const qualification=useMemo(()=>scoreProspect(signals),[signals]);
  const demoLinks=useMemo(()=>buildDemoLinks({businessName:company||'Tu negocio',area,category,color}),[company,area,category,color]);
  const outreach=useMemo(()=>buildOutreachMessage(company,demoLinks.customerUrl),[company,demoLinks.customerUrl]);
  const prospects=contacts.filter(contact=>contact.prospect).sort((a,b)=>(b.prospect?.score??0)-(a.prospect?.score??0));
  const captureBase=typeof window==='undefined'?'':`${window.location.origin}/t/${tenant}/prospects`;
  const bookmarklet=`javascript:(()=>{const p=new URLSearchParams({source:location.href,name:document.title});open('${captureBase}?'+p.toString(),'_blank')})()`;

  const setSignal=(key:keyof ProspectSignals)=>setSignals(current=>({...current,[key]:!current[key]}));
  const copy=async(key:string,text:string)=>{
    try{
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(()=>setCopied(current=>current===key?'':current),1500);
    }catch{setCopied('')}
  };
  const installMobile=async()=>{
    if(!installPrompt)return;
    await installPrompt.prompt();
    const choice=await installPrompt.userChoice;
    if(choice.outcome==='accepted')setInstallPrompt(null);
  };

  const submit=(event:FormEvent)=>{
    event.preventDefault();
    if(company.trim().length<2)return;
    addProspect({
      name:contactName||company,
      company,
      phone,
      email:'',
      value:Number(value)||0,
      prospect:{
        sourceUrl:sourceUrl.trim(),
        platform,
        area:area.trim()||'Zona Norte',
        category,
        color,
        score:qualification.score,
        scoreReasons:qualification.reasons,
        signals,
        builderUrl:demoLinks.builderUrl,
        demoUrl:demoLinks.customerUrl,
        ownerUrl:demoLinks.ownerUrl,
        outreachMessage:outreach,
      },
    });
    setSaved(company.trim());
    setCompany('');setContactName('');setPhone('');setSourceUrl('');
  };

  const fit=qualification.score>=80?'Prioridad alta':qualification.score>=55?'Buen candidato':'Baja prioridad';

  return <div style={{display:'grid',gap:18}}>
    <section className="panel wide">
      <div className="panel-title">
        <div><span className="eyebrow">TMM OUTBOUND</span><h2>Capturar prospecto</h2></div>
        <div style={{textAlign:'right'}}><strong style={{fontSize:28}}>{qualification.score}/100</strong><small style={{display:'block'}}>{fit}</small></div>
      </div>

      {captured&&<div className="note" style={{marginBottom:16}}>
        <b>Capturado desde {capture.platform==='other'?'otra app':capture.platform}</b>
        <small style={{display:'block',marginTop:4}}>{capture.inferred.length?`Inferí ${capture.inferred.join(' · ')}. Revisá y guardá.`:'Adjunté la fuente. Completá el nombre y guardá.'}</small>
      </div>}

      <div className="note" style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap',marginBottom:16}}>
        <span><b>Captura rápida</b><small style={{display:'block'}}>Android: instalá Gatrivi CRM y aparecerá como destino en Compartir. Desktop: guardá el capturador como favorito “TMM lead”.</small></span>
        <span style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          {installPrompt&&<button className="secondary" type="button" onClick={installMobile}><Smartphone size={15}/> Instalar captura móvil</button>}
          <button className="secondary" type="button" onClick={()=>copy('bookmarklet',bookmarklet)}><Copy size={15}/> {copied==='bookmarklet'?'Copiado':'Copiar capturador'}</button>
        </span>
      </div>

      <form onSubmit={submit} style={{display:'grid',gap:16}}>
        <div style={gridStyle}>
          <label style={labelStyle}>Negocio<input style={inputStyle} autoFocus value={company} onChange={event=>setCompany(event.target.value)} placeholder="Ej. Panadería Roma" required/></label>
          <label style={labelStyle}>Contacto<input style={inputStyle} value={contactName} onChange={event=>setContactName(event.target.value)} placeholder="Opcional"/></label>
          <label style={labelStyle}>Teléfono / WhatsApp<input style={inputStyle} value={phone} onChange={event=>setPhone(event.target.value)} placeholder="Opcional"/></label>
          <label style={labelStyle}>Plataforma<select style={inputStyle} value={platform} onChange={event=>setPlatform(event.target.value as ProspectPlatform)}><option value="instagram">Instagram</option><option value="facebook">Facebook</option><option value="other">Otra</option></select></label>
          <label style={labelStyle}>URL del anuncio / perfil<input style={inputStyle} type="url" value={sourceUrl} onChange={event=>setSourceUrl(event.target.value)} placeholder="https://..."/></label>
          <label style={labelStyle}>Zona<input style={inputStyle} value={area} onChange={event=>setArea(event.target.value)} placeholder="Olivos"/></label>
          <label style={labelStyle}>Rubro<select style={inputStyle} value={category} onChange={event=>setCategory(event.target.value as ProspectCategory)}>{Object.entries(prospectCategories).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
          <label style={labelStyle}>Color demo<select style={inputStyle} value={color} onChange={event=>setColor(event.target.value as ProspectColor)}><option value="carbon">Carbón</option><option value="coral">Coral</option><option value="verde">Verde</option><option value="azul">Azul</option><option value="violeta">Violeta</option></select></label>
          <label style={labelStyle}>Valor oportunidad<input style={inputStyle} type="number" min="0" step="1000" value={value} onChange={event=>setValue(event.target.value)}/></label>
        </div>

        <div>
          <span className="eyebrow">SEÑALES DE COMPRA</span>
          <div style={{...gridStyle,marginTop:10}}>{(Object.keys(signalLabels) as Array<keyof ProspectSignals>).map(key=><label className="task" key={key} style={{cursor:'pointer'}}><input type="checkbox" checked={signals[key]} onChange={()=>setSignal(key)}/><span>{signalLabels[key]}</span></label>)}</div>
        </div>

        <div className="note" style={{display:'grid',gap:8}}>
          <b>Demo generada</b>
          <span style={{fontSize:13,overflowWrap:'anywhere'}}>{demoLinks.customerUrl}</span>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            <a className="secondary" href={demoLinks.customerUrl} target="_blank" rel="noreferrer"><ExternalLink size={15}/> Ver demo</a>
            <button className="secondary" type="button" onClick={()=>copy('draft',outreach)}><Copy size={15}/> {copied==='draft'?'Copiado':'Copiar pitch'}</button>
          </div>
        </div>

        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'}}>
          <small>{saved?`${saved} quedó en CRM + tarea de contacto para mañana.`:'Guardar crea contacto, oportunidad y follow-up.'}</small>
          <button className="primary" type="submit"><Target size={16}/> Guardar prospecto</button>
        </div>
      </form>
    </section>

    <section className="panel wide">
      <div className="panel-title"><div><span className="eyebrow">COLA COMERCIAL</span><h2>Prospectos TMM</h2></div><b>{prospects.length}</b></div>
      {!prospects.length?<div className="empty">Todavía no capturaste prospectos.</div>:prospects.map(contact=>{
        const prospect=contact.prospect!;
        return <div className="stage-row" key={contact.id} style={{gridTemplateColumns:'minmax(150px,1.2fr) 80px minmax(180px,1fr) auto'}}>
          <span><b>{contact.company||contact.name}</b><small style={{display:'block'}}>{prospect.platform} · {prospect.area}</small></span>
          <b>{prospect.score}/100</b>
          <span style={{fontSize:12}}>{prospect.scoreReasons.slice(0,2).join(' · ')}</span>
          <span style={{display:'flex',gap:6,flexWrap:'wrap',justifyContent:'flex-end'}}>
            {prospect.sourceUrl&&<a className="link" href={prospect.sourceUrl} target="_blank" rel="noreferrer">Fuente ↗</a>}
            <a className="link" href={prospect.demoUrl} target="_blank" rel="noreferrer">Demo ↗</a>
            <button className="link" type="button" onClick={()=>copy(contact.id,prospect.outreachMessage)}>{copied===contact.id?'Copiado':'Copiar DM'}</button>
          </span>
        </div>;
      })}
    </section>
  </div>;
}
