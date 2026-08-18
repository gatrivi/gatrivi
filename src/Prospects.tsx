import {useMemo,useState,type FormEvent} from 'react';
import {Check,Copy,ExternalLink,Instagram,MessageCircle,Share2,Target} from 'lucide-react';
import {useSearchParams} from 'react-router-dom';
import {useCrm} from './context/CrmContext';
import {
  buildDemoLinks,
  buildOutreachMessages,
  prospectCategories,
  scoreProspect,
  type ProspectCategory,
  type ProspectColor,
  type ProspectPlatform,
  type ProspectSignals,
} from './services/prospecting';
import {inferProspectPrefill,sharedPayloadFromSearch} from './services/shareCapture';

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

function webUrl(raw:string){
  try{
    const url=new URL(raw.trim());
    return url.protocol==='https:'||url.protocol==='http:'?url.href:'';
  }catch{return ''}
}

function argentineWhatsappDigits(phone:string){
  let digits=phone.replace(/\D/g,'');
  if(!digits)return '';
  if(digits.startsWith('00'))digits=digits.slice(2);
  if(digits.startsWith('549')&&digits.length===13)return digits;

  let national=digits.startsWith('54')?digits.slice(2):digits;
  if(national.startsWith('0'))national=national.slice(1);
  if(national.startsWith('9')&&national.length===11)return `54${national}`;

  // Local mobile format: 011 15 1234 5678 / 0341 15 1234567.
  for(let areaLength=2;areaLength<=4;areaLength++){
    if(national.slice(areaLength,areaLength+2)==='15'&&national.length-2===10){
      return `549${national.slice(0,areaLength)}${national.slice(areaLength+2)}`;
    }
  }

  // Keep valid 10-digit national numbers; WhatsApp Business may use fixed lines too.
  if(national.length===10)return `54${national}`;
  return '';
}

function whatsappUrl(phone:string){
  const digits=argentineWhatsappDigits(phone);
  return digits?`https://wa.me/${digits}`:'';
}

function instagramUrl(handle:string|undefined,sourceUrl:string,platform:ProspectPlatform){
  const clean=(handle??'').trim().replace(/^@/,'');
  if(clean)return `https://instagram.com/${encodeURIComponent(clean)}`;
  return platform==='instagram'?webUrl(sourceUrl):'';
}

export default function Prospects(){
  const {contacts,deals,stages,tasks,addProspect,markProspectContacted,setProspectStage,tenant}=useCrm();
  const [params]=useSearchParams();
  const initial=inferProspectPrefill(sharedPayloadFromSearch(params));
  const shared=params.get('shared')==='1'||Boolean(params.get('source')||params.get('url'));
  const [company,setCompany]=useState(initial.company);
  const [socialHandle,setSocialHandle]=useState(initial.socialHandle);
  const [contactName,setContactName]=useState('');
  const [phone,setPhone]=useState('');
  const [sourceUrl,setSourceUrl]=useState(initial.sourceUrl);
  const [platform,setPlatform]=useState<ProspectPlatform>(initial.platform==='other'?'instagram':initial.platform);
  const [area,setArea]=useState('Olivos');
  const [category,setCategory]=useState<ProspectCategory>(initial.category);
  const [color,setColor]=useState<ProspectColor>('carbon');
  const [value,setValue]=useState('325000');
  const [signals,setSignals]=useState<ProspectSignals>(defaultSignals);
  const [saved,setSaved]=useState('');
  const [copied,setCopied]=useState('');

  const qualification=useMemo(()=>scoreProspect(signals),[signals]);
  const demoLinks=useMemo(()=>buildDemoLinks({businessName:company||'Tu negocio',area,category,color}),[company,area,category,color]);
  const outreachMessages=useMemo(()=>buildOutreachMessages(company,demoLinks.customerUrl),[company,demoLinks.customerUrl]);
  const outreach=outreachMessages[0];
  const prospects=contacts.filter(contact=>contact.prospect).sort((a,b)=>(b.prospect?.score??0)-(a.prospect?.score??0));
  const orderedStages=stages.slice().sort((a,b)=>a.order-b.order);
  const crmCaptureUrl=typeof window==='undefined'?'':`${window.location.origin}/t/${tenant}/prospects`;
  const bookmarklet=`javascript:(()=>{const u=new URL(${JSON.stringify(crmCaptureUrl)});u.searchParams.set('source',location.href);u.searchParams.set('title',document.title);location.href=u.toString()})()`;

  const setSignal=(key:keyof ProspectSignals)=>setSignals(current=>({...current,[key]:!current[key]}));
  const copy=async(key:string,text:string)=>{
    try{
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(()=>setCopied(current=>current===key?'':current),1500);
    }catch{setCopied('')}
  };
  const openAndCopy=(key:string,url:string,message:string)=>{
    const safe=webUrl(url);
    if(safe)window.open(safe,'_blank','noopener,noreferrer');
    void copy(key,message);
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
        sourceUrl:webUrl(sourceUrl),
        platform,
        socialHandle:socialHandle.trim(),
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
        outreachMessages,
      },
    });
    setSaved(company.trim());
    setCompany('');setSocialHandle('');setContactName('');setPhone('');setSourceUrl('');
  };

  const fit=qualification.score>=80?'Prioridad alta':qualification.score>=55?'Buen candidato':'Baja prioridad';

  return <div style={{display:'grid',gap:18}}>
    {shared&&<section className="panel wide" style={{border:'1px solid #b7d733'}}>
      <div style={{display:'flex',gap:12,alignItems:'center'}}><Share2 size={20}/><div><b>Lead recibido por compartir</b><small style={{display:'block'}}>Inferí lo evidente; revisá nombre, rubro y señales antes de guardarlo.</small></div></div>
    </section>}

    <section className="panel wide">
      <div className="panel-title">
        <div><span className="eyebrow">TMM OUTBOUND</span><h2>Capturar prospecto</h2></div>
        <div style={{textAlign:'right'}}><strong style={{fontSize:28}}>{qualification.score}/100</strong><small style={{display:'block'}}>{fit}</small></div>
      </div>

      <form onSubmit={submit} style={{display:'grid',gap:16}}>
        <div style={gridStyle}>
          <label style={labelStyle}>Negocio<input style={inputStyle} value={company} onChange={event=>setCompany(event.target.value)} placeholder="Ej. Panadería Roma" required/></label>
          <label style={labelStyle}>Usuario / handle<input style={inputStyle} value={socialHandle} onChange={event=>setSocialHandle(event.target.value)} placeholder="@panaderiaroma"/></label>
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
            {outreachMessages.map((message,index)=>{
              const key=`draft-${index}`;
              return <button className="secondary" key={key} type="button" onClick={()=>copy(key,message)}><Copy size={15}/> {copied===key?'Copiado':`Pitch ${index+1}`}</button>;
            })}
          </div>
        </div>

        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'}}>
          <small>{saved?`${saved} quedó en CRM + tarea de contacto para mañana.`:'Guardar crea contacto, oportunidad y follow-up.'}</small>
          <button className="primary" type="submit"><Target size={16}/> Guardar prospecto</button>
        </div>
      </form>
    </section>

    <section className="panel wide">
      <div className="panel-title"><div><span className="eyebrow">CAPTURA RÁPIDA</span><h2>Desde navegador o teléfono</h2></div></div>
      <div style={gridStyle}>
        <div className="note"><b>📱 Compartir desde el teléfono</b><p>Instalá Gatrivi CRM como app. Después, desde una publicación o perfil, usá Compartir → Gatrivi CRM. El formulario abre prellenado.</p></div>
        <div className="note"><b>🔖 Bookmarklet desktop</b><p>Copiá este código como URL de un favorito llamado “TMM lead”. Al tocarlo sobre una página, trae URL + título al CRM.</p><button className="secondary" type="button" onClick={()=>copy('bookmarklet',bookmarklet)}><Copy size={15}/> {copied==='bookmarklet'?'Copiado':'Copiar bookmarklet'}</button></div>
      </div>
    </section>

    <section className="panel wide">
      <div className="panel-title"><div><span className="eyebrow">COLA COMERCIAL</span><h2>Prospectos TMM</h2></div><b>{prospects.length}</b></div>
      {!prospects.length?<div className="empty">Todavía no capturaste prospectos.</div>:<div style={{display:'grid',gap:10}}>{prospects.map(contact=>{
        const prospect=contact.prospect!;
        const deal=deals.find(item=>item.contactId===contact.id);
        const stage=stages.find(item=>item.id===deal?.stageId);
        const nextTask=tasks.filter(task=>task.contactId===contact.id&&!task.done).sort((a,b)=>a.dueDate.localeCompare(b.dueDate))[0];
        const messages=prospect.outreachMessages?.length?prospect.outreachMessages:buildOutreachMessages(contact.company||contact.name,prospect.demoUrl);
        const wa=whatsappUrl(contact.phone);
        const safeSource=webUrl(prospect.sourceUrl);
        const ig=instagramUrl(prospect.socialHandle,safeSource,prospect.platform as ProspectPlatform);
        return <div className="note" key={contact.id} style={{display:'grid',gap:10}}>
          <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'flex-start',flexWrap:'wrap'}}>
            <span><b>{contact.company||contact.name}</b><small style={{display:'block'}}>{prospect.socialHandle?`${prospect.socialHandle} · `:''}{prospect.platform} · {prospect.area} · fit {prospect.score}/100</small></span>
            <label style={{...labelStyle,minWidth:150}}>Etapa<select style={{...inputStyle,minHeight:36}} value={stage?.id??orderedStages[0]?.id??''} onChange={event=>setProspectStage(contact.id,event.target.value)}>{orderedStages.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          </div>

          <small><b>Próxima:</b> {nextTask?`${nextTask.title} · ${nextTask.dueDate}`:'sin acción pendiente'}{prospect.lastContactedAt?` · último contacto ${new Date(prospect.lastContactedAt).toLocaleDateString('es-AR')}`:''}</small>

          <div style={{display:'flex',gap:7,flexWrap:'wrap'}}>
            {safeSource&&<a className="link" href={safeSource} target="_blank" rel="noreferrer">Fuente ↗</a>}
            <a className="link" href={prospect.demoUrl} target="_blank" rel="noreferrer">Demo ↗</a>
            {ig&&<button className="secondary" type="button" onClick={()=>openAndCopy(`${contact.id}-ig`,ig,messages[0])}><Instagram size={15}/> {copied===`${contact.id}-ig`?'Copiado':'IG + copiar'}</button>}
            {wa&&<button className="secondary" type="button" onClick={()=>openAndCopy(`${contact.id}-wa`,wa,messages[0])}><MessageCircle size={15}/> {copied===`${contact.id}-wa`?'Copiado':'WA + copiar'}</button>}
            {messages.slice(0,3).map((message,index)=>{
              const key=`${contact.id}-dm-${index}`;
              return <button className="secondary" key={key} type="button" onClick={()=>copy(key,message)}><Copy size={15}/> {copied===key?'Copiado':`DM ${index+1}`}</button>;
            })}
            <button className="primary" type="button" onClick={()=>markProspectContacted(contact.id)}><Check size={15}/> {prospect.lastContactedAt?'Enviado ✓':'Marcar enviado'}</button>
          </div>
        </div>;
      })}</div>}
    </section>
  </div>;
}
